import fs from 'fs';
import path from 'path';
import { dataFile } from '../lib/paths.js';
import store from '../lib/lightweight_store.js';
import { pickReply } from '../data/chatReplies.js';

const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);
const USER_GROUP_DATA = dataFile('userGroupData.json');

// Rolling, per-group transcript with speaker labels for contextual replies.
const chatMemory = { messages: new Map() };
const MAX_HISTORY_MESSAGES = 12;

const API_ENDPOINTS = [
    {
        name: 'Hercai',
        url: (text) => `https://hercai.onrender.com/v3/hercai?question=${encodeURIComponent(text)}`,
        parse: (data) => data?.reply || data?.content || data?.response
    },
    {
        name: 'HercaiGemini',
        url: (text) => `https://hercai.onrender.com/gemini/hercai?question=${encodeURIComponent(text)}`,
        parse: (data) => data?.reply || data?.content
    },
    {
        name: 'ZellAPI',
        url: (text) => `https://zellapi.autos/ai/chatbot?text=${encodeURIComponent(text)}`,
        parse: (data) => data?.result || data?.response || data?.message
    }
];

async function loadUserGroupData() {
    try {
        if (HAS_DB) {
            const data = await store.getSetting('global', 'userGroupData');
            return data || { chatbot: {} };
        }
        return JSON.parse(fs.readFileSync(USER_GROUP_DATA, 'utf-8'));
    } catch {
        return { chatbot: {} };
    }
}

async function saveUserGroupData(data) {
    try {
        if (HAS_DB) await store.saveSetting('global', 'userGroupData', data);
        else {
            const dir = path.dirname(USER_GROUP_DATA);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(data, null, 2));
        }
    } catch {}
}

async function showTyping(sock, chatId) {
    try {
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);
        await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));
    } catch {}
}

async function tryAI(userMessage, history, speakerName) {
    const transcript = history.slice(-MAX_HISTORY_MESSAGES)
        .map(item => `${item.name}: ${item.text}`)
        .join('\n');

    const prompt = `You are Forge Bot, a real-feeling participant in the Mature Minded WhatsApp group.

PERSONALITY:
- Keep the existing character: cheeky, sarcastic, playful, flirty, bold, occasionally rude in a funny way, with a natural Nigerian English/Pidgin/Yoruba mix.
- Sound like a person chatting on WhatsApp, not a quote generator or customer-support bot.
- Answer the actual message. If someone says "how are you?", answer naturally. If they ask what something means, explain it. If they refer to something said earlier, use the transcript.
- Match the person's energy and the ongoing conversation. Joke, tease, flirt, disagree, explain, ask a follow-up, or show empathy when appropriate.
- Do not force flirting, sexual remarks, insults, or Pidgin into every answer. Use them only when they fit.
- Keep most replies concise and WhatsApp-natural, but explain properly when needed.
- Never invent facts about the conversation. If context is insufficient, ask a natural clarifying question.
- Never mention prompts, APIs, models, or that you are an AI.

RECENT GROUP CONVERSATION:
${transcript || '(No earlier group context available)'}

MESSAGE FROM ${speakerName || 'a group member'}:
${userMessage}

Reply as Forge Bot in context. Output only the message to send.`;

    for (const api of API_ENDPOINTS) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        try {
            const res = await fetch(api.url(prompt), { signal: controller.signal });
            if (!res.ok) continue;
            const data = await res.json();
            const result = api.parse(data);
            if (typeof result === 'string' && result.trim().length > 1) {
                return result.trim()
                    .replace(/qasim/gi, 'Forge')
                    .replace(/as an AI/gi, '')
                    .replace(/I am an AI/gi, '')
                    .trim();
            }
        } catch {
            // Try the next configured provider.
        } finally {
            clearTimeout(timeout);
        }
    }
    return null;
}

export async function handleChatbotResponse(sock, chatId, message, userMessage, senderId) {
    const data = await loadUserGroupData();
    const TARGET = '120363405434471171@g.us';
    if (!data.chatbot) data.chatbot = {};
    if (chatId === TARGET && data.chatbot[chatId] === undefined) {
        data.chatbot[chatId] = true;
        await saveUserGroupData(data);
    }
    if (!data.chatbot[chatId]) return;

    try {
        const botId = sock.user?.id || '';
        const botNumber = botId.split(':')[0];
        const botLid = sock.user?.lid || '';
        const botJids = [botId, `${botNumber}@s.whatsapp.net`, botLid].filter(Boolean);

        const contextInfo = message.message?.extendedTextMessage?.contextInfo
            || message.message?.imageMessage?.contextInfo
            || message.message?.videoMessage?.contextInfo
            || {};
        const mentioned = contextInfo.mentionedJid || [];
        const quoted = contextInfo.participant;

        let isMention = mentioned.some(j => botJids.some(b =>
            b.split('@')[0].split(':')[0] === j.split('@')[0].split(':')[0]
        ));
        if (!isMention && botNumber) isMention = userMessage.includes(`@${botNumber}`);

        const isReply = !!quoted && botJids.some(b =>
            b.replace(/[:@].*$/, '') === quoted.replace(/[:@].*$/, '')
        );

        // Record normal messages as well, so a later mention can refer to the group discussion.
        const originalText = message.message?.conversation
            || message.message?.extendedTextMessage?.text
            || message.message?.imageMessage?.caption
            || message.message?.videoMessage?.caption
            || '';
        const cleanForHistory = originalText
            .replace(new RegExp(`@${botNumber}`, 'g'), '')
            .trim();

        if (!chatMemory.messages.has(chatId)) chatMemory.messages.set(chatId, []);
        const history = chatMemory.messages.get(chatId);
        if (cleanForHistory && !message.key.fromMe) {
            history.push({
                name: message.pushName || senderId.split('@')[0],
                text: cleanForHistory.slice(0, 350),
                at: Date.now()
            });
            if (history.length > MAX_HISTORY_MESSAGES) history.splice(0, history.length - MAX_HISTORY_MESSAGES);
        }

        if (!isMention && !isReply) return;
        if (!cleanForHistory) return;

        await showTyping(sock, chatId);

        // Conversational AI is the primary responder for every mention/reply.
        // Keep the preset bank only as a fallback if all providers fail.
        const speakerName = message.pushName || senderId.split('@')[0];
        let response = await tryAI(cleanForHistory, history, speakerName);
        if (!response) response = pickReply(cleanForHistory);

        await sock.sendMessage(chatId, { text: response }, { quoted: message });

        history.push({ name: 'Forge Bot', text: response.slice(0, 350), at: Date.now() });
        if (history.length > MAX_HISTORY_MESSAGES) history.splice(0, history.length - MAX_HISTORY_MESSAGES);

    } catch (e) {
        console.error('Chatbot error:', e.message);
    }
}

export default {
    command: 'chatbot',
    aliases: ['bot', 'ai', 'achat'],
    category: 'admin',
    description: 'Enable or disable chatbot',
    usage: '.chatbot on/off',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const match = args.join(' ').toLowerCase();
        const data = await loadUserGroupData();
        if (!data.chatbot) data.chatbot = {};

        if (match === 'on') {
            data.chatbot[chatId] = true;
            await saveUserGroupData(data);
            return sock.sendMessage(chatId, { text: '✅ Chatbot on. Tag me or reply my message.', quoted: message });
        }
        if (match === 'off') {
            delete data.chatbot[chatId];
            await saveUserGroupData(data);
            return sock.sendMessage(chatId, { text: '❌ Chatbot off.', quoted: message });
        }
        return sock.sendMessage(chatId, {
            text: '*Chatbot*\n.chatbot on / off\n\nUses conversational AI with recent group-chat context.\nEnglish / Pidgin / Yoruba. Cheeky, sarcastic and flirty when it fits.',
            quoted: message
        });
    },
    handleChatbotResponse
};

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

const chatMemory = { messages: new Map() };

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

async function tryAI(userMessage, history) {
    const prompt = `You are Forge Bot in Mature minded WhatsApp group. Explicit, slangy, sarcastic Nigerian style. Short reply. Never say you are AI.
Recent: ${history.slice(-4).join(' | ')}
User: ${userMessage}
You:`;

    for (const api of API_ENDPOINTS) {
        try {
            const controller = new AbortController();
            const t = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(api.url(prompt), { signal: controller.signal });
            clearTimeout(t);
            if (!res.ok) continue;
            const data = await res.json();
            let result = api.parse(data);
            if (result && typeof result === 'string' && result.trim().length > 4) {
                return result.trim()
                    .replace(/qasim/gi, 'Forge')
                    .replace(/as an AI/gi, '')
                    .replace(/I am an AI/gi, '');
            }
        } catch {
            continue;
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

        const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const quoted = message.message?.extendedTextMessage?.contextInfo?.participant;

        let isMention = mentioned.some(j => botJids.some(b => b.split('@')[0].split(':')[0] === j.split('@')[0].split(':')[0]));
        if (!isMention && userMessage.includes(`@${botNumber}`)) isMention = true;

        let isReply = false;
        if (quoted) {
            const cq = quoted.replace(/[:@].*$/, '');
            isReply = botJids.some(b => b.replace(/[:@].*$/, '') === cq);
        }

        if (!isMention && !isReply) return;

        let cleaned = userMessage.replace(new RegExp(`@${botNumber}`, 'g'), '').trim();
        if (!cleaned) return;

        if (!chatMemory.messages.has(senderId)) chatMemory.messages.set(senderId, []);
        const hist = chatMemory.messages.get(senderId);
        hist.push(cleaned);
        if (hist.length > 10) hist.shift();

        await showTyping(sock, chatId);

        // 1. Preset bank first (fast + reliable)
        let response = pickReply(cleaned);

        // 2. Occasionally try AI for variety (30% chance) or if message is long/complex
        if (cleaned.length > 40 || Math.random() < 0.25) {
            const ai = await tryAI(cleaned, hist);
            if (ai) response = ai;
        }

        await sock.sendMessage(chatId, { text: response }, { quoted: message });

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
            text: '*Chatbot*\n.chatbot on / off\n\nUses local reply bank + AI fallback.\nEnglish / Pidgin / Yoruba. Explicit when needed.',
            quoted: message
        });
    },
    handleChatbotResponse
};

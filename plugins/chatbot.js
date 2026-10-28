import fs from 'fs';
import path from 'path';
import { dataFile } from '../lib/paths.js';
import store from '../lib/lightweight_store.js';

const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);
const USER_GROUP_DATA = dataFile('userGroupData.json');

const chatMemory = {
    messages: new Map()
};

// More reliable / additional free endpoints + better ordering
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
    },
    {
        name: 'SparkAPI',
        url: (text) => `https://discardapi.dpdns.org/api/chat/spark?apikey=guru&text=${encodeURIComponent(text)}`,
        parse: (data) => data?.result?.answer || data?.result || data?.answer
    },
    {
        name: 'LlamaAPI',
        url: (text) => `https://discardapi.dpdns.org/api/bot/llama?apikey=guru&text=${encodeURIComponent(text)}`,
        parse: (data) => data?.result || data?.response
    }
];

// Local naughty fallback replies when all APIs fail
const FALLBACKS = [
    "E choke me small, talk am again make I catch am proper 🔥",
    "Fraaa... my head blank for a second. Wetin you talk again?",
    "I dey hear you but network just do me. Drop am one more time.",
    "Hmm you don start... make I reason am. Talk again sharp sharp.",
    "My guy / babe, system just scratch. Repeat wetin you talk.",
    "I almost reply you something very dirty but the line cut. Try again 😏",
    "You dey try me... say that thing one more time make I answer you well.",
    "Network no dey carry me at all. Hit me again."
];

async function loadUserGroupData() {
    try {
        if (HAS_DB) {
            const data = await store.getSetting('global', 'userGroupData');
            return data || { groups: [], chatbot: {} };
        } else {
            return JSON.parse(fs.readFileSync(USER_GROUP_DATA, 'utf-8'));
        }
    } catch {
        return { groups: [], chatbot: {} };
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

function getRandomDelay() {
    return Math.floor(Math.random() * 2000) + 1200;
}

async function showTyping(sock, chatId) {
    try {
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);
        await new Promise(r => setTimeout(r, getRandomDelay()));
    } catch {}
}

export async function handleChatbotResponse(sock, chatId, message, userMessage, senderId) {
    const data = await loadUserGroupData();
    const TARGET_GROUP = '120363405434471171@g.us';

    if (!data.chatbot) data.chatbot = {};
    if (chatId === TARGET_GROUP && data.chatbot[chatId] === undefined) {
        data.chatbot[chatId] = true;
        await saveUserGroupData(data);
    }
    if (!data.chatbot[chatId]) return;

    try {
        const botId = sock.user?.id || '';
        const botNumber = botId.split(':')[0];
        const botLid = sock.user?.lid || '';

        const botJids = [
            botId,
            `${botNumber}@s.whatsapp.net`,
            botLid,
            `${(botLid || '').split(':')[0]}@lid`
        ].filter(Boolean);

        let isBotMentioned = false;
        let isReplyToBot = false;

        const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const quotedParticipant = message.message?.extendedTextMessage?.contextInfo?.participant;

        isBotMentioned = mentionedJid.some(jid => {
            const n = jid.split('@')[0].split(':')[0];
            return botJids.some(b => b.split('@')[0].split(':')[0] === n);
        });

        if (!isBotMentioned && userMessage.includes(`@${botNumber}`)) isBotMentioned = true;

        if (quotedParticipant) {
            const cleanQuoted = quotedParticipant.replace(/[:@].*$/, '');
            isReplyToBot = botJids.some(b => b.replace(/[:@].*$/, '') === cleanQuoted);
        }

        if (!isBotMentioned && !isReplyToBot) return;

        let cleaned = userMessage.replace(new RegExp(`@${botNumber}`, 'g'), '').trim();
        if (!cleaned) return;

        if (!chatMemory.messages.has(senderId)) chatMemory.messages.set(senderId, []);
        const hist = chatMemory.messages.get(senderId);
        hist.push(cleaned);
        if (hist.length > 10) hist.shift();

        await showTyping(sock, chatId);

        const response = await getAIResponse(cleaned, hist);

        await new Promise(r => setTimeout(r, getRandomDelay()));
        await sock.sendMessage(chatId, {
            text: response || FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)]
        }, { quoted: message });

    } catch (e) {
        console.error('Chatbot error:', e.message);
    }
}

async function getAIResponse(userMessage, history) {
    const prompt = `You are Forge Bot in a very mature, explicit Nigerian WhatsApp group "Mature minded".

Be extremely explicit, flirty, sarcastic and unfiltered when the chat goes that way.
Use Nigerian slang (fra, e choke, no be beans, soft life, correct guy/babe, etc).
Reply in the same language the user used (English, Pidgin or Yoruba).
Keep replies short (1-3 lines). Never say you are an AI. Never mention Qasim or old names.

Recent chat:
${history.slice(-5).join('\n')}

User: ${userMessage}
You:`.trim();

    for (const api of API_ENDPOINTS) {
        try {
            const controller = new AbortController();
            const t = setTimeout(() => controller.abort(), 10000);
            const res = await fetch(api.url(prompt), { method: 'GET', signal: controller.signal });
            clearTimeout(t);
            if (!res.ok) continue;
            const data = await res.json();
            let result = api.parse(data);
            if (!result || typeof result !== 'string') continue;

            result = result.trim()
                .replace(/qasim/gi, 'Forge')
                .replace(/globaltech/gi, 'Forge')
                .replace(/mega.?md/gi, 'Forge')
                .replace(/as an AI/gi, '')
                .replace(/I am an AI/gi, "I'm just here")
                .replace(/\n\s*\n/g, '\n')
                .trim();

            if (result.length > 5) return result;
        } catch {
            continue;
        }
    }
    return null;
}

export default {
    command: 'chatbot',
    aliases: ['bot', 'ai', 'achat'],
    category: 'admin',
    description: 'Enable or disable AI chatbot',
    usage: '.chatbot <on|off>',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const match = args.join(' ').toLowerCase();
        const data = await loadUserGroupData();
        if (!data.chatbot) data.chatbot = {};

        if (!match) {
            return sock.sendMessage(chatId, {
                text: `*Chatbot*\n\n.chatbot on / .chatbot off\n\nTag me or reply my message. I dey yarn English, Pidgin, Yoruba — and I no shy.`,
                quoted: message
            });
        }

        if (match === 'on') {
            data.chatbot[chatId] = true;
            await saveUserGroupData(data);
            return sock.sendMessage(chatId, {
                text: '✅ Chatbot on.\nTag me or reply my message. I no dey form.',
                quoted: message
            });
        }

        if (match === 'off') {
            delete data.chatbot[chatId];
            await saveUserGroupData(data);
            return sock.sendMessage(chatId, {
                text: '❌ Chatbot off.',
                quoted: message
            });
        }

        return sock.sendMessage(chatId, {
            text: 'Use: .chatbot on / off',
            quoted: message
        });
    },
    handleChatbotResponse
};

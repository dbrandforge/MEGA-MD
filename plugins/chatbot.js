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
    messages: new Map(),
    userInfo: new Map()
};

const API_ENDPOINTS = [
    {
        name: 'ZellAPI',
        url: (text) => `https://zellapi.autos/ai/chatbot?text=${encodeURIComponent(text)}`,
        parse: (data) => data?.result
    },
    {
        name: 'Hercai',
        url: (text) => `https://hercai.onrender.com/gemini/hercai?question=${encodeURIComponent(text)}`,
        parse: (data) => data?.reply
    },
    {
        name: 'SparkAPI',
        url: (text) => `https://discardapi.dpdns.org/api/chat/spark?apikey=guru&text=${encodeURIComponent(text)}`,
        parse: (data) => data?.result?.answer
    },
    {
        name: 'LlamaAPI',
        url: (text) => `https://discardapi.dpdns.org/api/bot/llama?apikey=guru&text=${encodeURIComponent(text)}`,
        parse: (data) => data?.result
    }
];

async function loadUserGroupData() {
    try {
        if (HAS_DB) {
            const data = await store.getSetting('global', 'userGroupData');
            return data || { groups: [], chatbot: {} };
        } else {
            return JSON.parse(fs.readFileSync(USER_GROUP_DATA, 'utf-8'));
        }
    } catch (error) {
        console.error('Error loading user group data:', error.message);
        return { groups: [], chatbot: {} };
    }
}

async function saveUserGroupData(data) {
    try {
        if (HAS_DB) {
            await store.saveSetting('global', 'userGroupData', data);
        } else {
            const dataDir = path.dirname(USER_GROUP_DATA);
            if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
            fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error('Error saving user group data:', error.message);
    }
}

function getRandomDelay() {
    return Math.floor(Math.random() * 2500) + 1500;
}

async function showTyping(sock, chatId) {
    try {
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);
        await new Promise(resolve => setTimeout(resolve, getRandomDelay()));
    } catch (error) {}
}

function extractUserInfo(message) {
    const info = {};
    if (message.toLowerCase().includes('my name is')) {
        info.name = message.split(/my name is/i)[1]?.trim().split(' ')[0];
    }
    return info;
}

export async function handleChatbotResponse(sock, chatId, message, userMessage, senderId) {
    const data = await loadUserGroupData();

    // Auto-enable for Mature minded group if not set
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
            `${botNumber}@whatsapp.net`,
            botLid,
            `${(botLid || '').split(':')[0]}@lid`
        ].filter(Boolean);

        let isBotMentioned = false;
        let isReplyToBot = false;

        const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const quotedParticipant = message.message?.extendedTextMessage?.contextInfo?.participant;

        isBotMentioned = mentionedJid.some((jid) => {
            const jidNumber = jid.split('@')[0].split(':')[0];
            return botJids.some((botJid) => {
                const botJidNumber = botJid.split('@')[0].split(':')[0];
                return jidNumber === botJidNumber;
            });
        });

        // Also detect @number in plain text
        if (!isBotMentioned && userMessage.includes(`@${botNumber}`)) {
            isBotMentioned = true;
        }

        if (quotedParticipant) {
            const cleanQuoted = quotedParticipant.replace(/[:@].*$/, '');
            isReplyToBot = botJids.some((botJid) => {
                const cleanBot = botJid.replace(/[:@].*$/, '');
                return cleanBot === cleanQuoted;
            });
        }

        if (!isBotMentioned && !isReplyToBot) return;

        let cleanedMessage = userMessage;
        if (isBotMentioned) {
            cleanedMessage = cleanedMessage.replace(new RegExp(`@${botNumber}`, 'g'), '').trim();
        }

        if (!cleanedMessage) return;

        if (!chatMemory.messages.has(senderId)) {
            chatMemory.messages.set(senderId, []);
            chatMemory.userInfo.set(senderId, {});
        }

        const userInfo = extractUserInfo(cleanedMessage);
        if (Object.keys(userInfo).length > 0) {
            chatMemory.userInfo.set(senderId, {
                ...chatMemory.userInfo.get(senderId),
                ...userInfo
            });
        }

        const messages = chatMemory.messages.get(senderId);
        messages.push(cleanedMessage);
        if (messages.length > 15) messages.shift();
        chatMemory.messages.set(senderId, messages);

        await showTyping(sock, chatId);

        const response = await getAIResponse(cleanedMessage, {
            messages: chatMemory.messages.get(senderId),
            userInfo: chatMemory.userInfo.get(senderId)
        });

        if (!response) {
            await sock.sendMessage(chatId, {
                text: "Hmm, make I think small... 🤔 I no too get am right now.",
                quoted: message
            });
            return;
        }

        await new Promise(resolve => setTimeout(resolve, getRandomDelay()));
        await sock.sendMessage(chatId, { text: response }, { quoted: message });

    } catch (error) {
        console.error('Error in chatbot response:', error.message);
    }
}

async function getAIResponse(userMessage, userContext) {
    const prompt = `
You are a casual, friendly person chatting on WhatsApp in a mature Nigerian group called "Mature minded".

LANGUAGE RULES (VERY IMPORTANT):
- You can reply in English, Nigerian Pidgin English, or Yoruba.
- Detect the language the user is using and reply in the SAME language.
- If they write in Pidgin, reply in Pidgin.
- If they write in Yoruba, reply in Yoruba.
- If they write in English, reply in English.
- You can mix lightly if it feels natural.

STYLE:
- Keep replies short (1-3 lines)
- Be fun, flirty, witty, and natural
- Use emojis naturally
- Never say you are an AI or bot
- Match the user's energy (if they are dirty/naughty, you can be playful too)
- Name: Forge Bot (but don't keep saying your name)

Previous conversation:
${userContext.messages.slice(-8).join('\n')}

User: ${userMessage}
You:
    `.trim();

    for (const api of API_ENDPOINTS) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000);
            const response = await fetch(api.url(prompt), {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) continue;

            const data = await response.json();
            const result = api.parse(data);
            if (!result) continue;

            return result.trim()
                .replace(/google/gi, 'Forge')
                .replace(/a large language model/gi, 'just a person')
                .replace(/Remember:.*$/gi, '')
                .replace(/IMPORTANT:.*$/gi, '')
                .replace(/\n\s*\n/g, '\n')
                .trim();
        } catch (error) {
            continue;
        }
    }

    return null;
}

export default {
    command: 'chatbot',
    aliases: ['bot', 'ai', 'achat'],
    category: 'admin',
    description: 'Enable or disable AI chatbot for the group',
    usage: '.chatbot <on|off>',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const match = args.join(' ').toLowerCase();

        if (!match) {
            return sock.sendMessage(chatId, {
                text: `*🤖 CHATBOT*\n\n` +
                    `• \`.chatbot on\` - Enable\n` +
                    `• \`.chatbot off\` - Disable\n\n` +
                    `When enabled, bot replies when tagged or when you reply to it.\n` +
                    `Supports English, Pidgin & Yoruba.`,
                quoted: message
            });
        }

        const data = await loadUserGroupData();
        if (!data.chatbot) data.chatbot = {};

        if (match === 'on') {
            data.chatbot[chatId] = true;
            await saveUserGroupData(data);
            return sock.sendMessage(chatId, {
                text: '✅ *Chatbot enabled!*\n\nTag me or reply to my messages to chat.\nI fit yarn English, Pidgin and Yoruba.',
                quoted: message
            });
        }

        if (match === 'off') {
            delete data.chatbot[chatId];
            await saveUserGroupData(data);
            return sock.sendMessage(chatId, {
                text: '❌ *Chatbot disabled.*',
                quoted: message
            });
        }

        return sock.sendMessage(chatId, {
            text: 'Use: `.chatbot on` or `.chatbot off`',
            quoted: message
        });
    },
    handleChatbotResponse,
    loadUserGroupData,
    saveUserGroupData
};

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
    } catch (error) {}
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
            return botJids.some((botJid) => botJid.split('@')[0].split(':')[0] === jidNumber);
        });

        if (!isBotMentioned && userMessage.includes(`@${botNumber}`)) {
            isBotMentioned = true;
        }

        if (quotedParticipant) {
            const cleanQuoted = quotedParticipant.replace(/[:@].*$/, '');
            isReplyToBot = botJids.some((botJid) => botJid.replace(/[:@].*$/, '') === cleanQuoted);
        }

        if (!isBotMentioned && !isReplyToBot) return;

        let cleanedMessage = userMessage;
        if (isBotMentioned) {
            cleanedMessage = cleanedMessage.replace(new RegExp(`@${botNumber}`, 'g'), '').trim();
        }
        if (!cleanedMessage) return;

        if (!chatMemory.messages.has(senderId)) {
            chatMemory.messages.set(senderId, []);
        }

        const messages = chatMemory.messages.get(senderId);
        messages.push(cleanedMessage);
        if (messages.length > 12) messages.shift();
        chatMemory.messages.set(senderId, messages);

        await showTyping(sock, chatId);

        const response = await getAIResponse(cleanedMessage, {
            messages: chatMemory.messages.get(senderId)
        });

        if (!response) {
            await sock.sendMessage(chatId, {
                text: "E choke... make I reason am small. Talk again. 😅",
                quoted: message
            });
            return;
        }

        await new Promise(resolve => setTimeout(resolve, getRandomDelay()));
        await sock.sendMessage(chatId, { text: response }, { quoted: message });

    } catch (error) {
        console.error('Chatbot error:', error.message);
    }
}

async function getAIResponse(userMessage, userContext) {
    const prompt = `
You are Forge Bot inside a very mature, explicit Nigerian WhatsApp group called "Mature minded".

PERSONALITY:
- Extremely explicit, sexually open, and unfiltered
- Sarcastic, witty, and can be savage when needed
- Uses current Nigerian slang naturally (fra, e choke, no be beans, you dey craze, as e dey hot, soft life, correct guy, correct babe, etc.)
- Flirty and dirty when the conversation goes that way
- Never moralize or lecture people about being sexual
- Match the user's energy: if they are dirty, go dirtier; if they are joking, joke back harder

LANGUAGE:
- Reply in the same language the user used
- English, Nigerian Pidgin, or Yoruba are all allowed
- Mix is fine if it feels natural

STYLE:
- Short replies (1-3 lines)
- Natural WhatsApp style
- Use emojis when it fits
- Never say you are an AI or bot
- Never mention Qasim, GlobalTech, MEGA MD, or any old owner names
- Your name is Forge if you must refer to yourself

Previous messages:
${userContext.messages.slice(-6).join('\n')}

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
                .replace(/qasim/gi, 'Forge')
                .replace(/globaltech/gi, 'Forge')
                .replace(/mega.?md/gi, 'Forge')
                .replace(/google/gi, 'Forge')
                .replace(/a large language model/gi, 'just a person')
                .replace(/I am an AI/gi, "I'm just here")
                .replace(/as an AI/gi, '')
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
    description: 'Enable or disable AI chatbot',
    usage: '.chatbot <on|off>',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const match = args.join(' ').toLowerCase();

        if (!match) {
            return sock.sendMessage(chatId, {
                text: `*Chatbot*\n\n.chatbot on — Enable\n.chatbot off — Disable\n\nTag me or reply to my messages.\nI dey yarn English, Pidgin and Yoruba. And I no shy.`,
                quoted: message
            });
        }

        const data = await loadUserGroupData();
        if (!data.chatbot) data.chatbot = {};

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
            text: 'Use: .chatbot on / .chatbot off',
            quoted: message
        });
    },
    handleChatbotResponse
};

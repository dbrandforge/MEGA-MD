import fs from 'fs';
import path from 'path';
import { dataFile } from '../lib/paths.js';
import store from '../lib/lightweight_store.js';
import { classifyIntent } from '../data/chatbotResponseLibrary.js';
import { pickPersonalityReply } from '../data/forgeBotPersonalityBank.js';
import { getUserGender } from './gender.js';

const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);
const USER_GROUP_DATA = dataFile('userGroupData.json');
const CHAT_MEMORY_FILE = dataFile('chatbotConversationMemory.json');
const PROVIDER_TIMEOUT_MS = 7500;
const PROVIDER_TOTAL_BUDGET_MS = 20000;
const PROVIDER_COOLDOWN_MS = 30000;
const MAX_REPLY_CHARS = 1200;
const providerHealth = new Map();

// Rolling, per-group transcript with speaker labels for contextual replies.
const chatMemory = { messages: new Map(), loaded: new Set() };
const MEMORY_SETTING = 'chatbotConversationMemory';
const MAX_HISTORY_MESSAGES = 30;
const MAX_HISTORY_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PROMPT_TRANSCRIPT_CHARS = 2200;

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

async function loadChatHistory(chatId) {
    if (chatMemory.loaded.has(chatId)) return chatMemory.messages.get(chatId) || [];
    try {
        let history = [];
        if (HAS_DB) {
            const saved = await store.getSetting(chatId, MEMORY_SETTING);
            history = Array.isArray(saved) ? saved : (Array.isArray(saved?.[chatId]) ? saved[chatId] : []);
            if (!history.length) {
                const legacy = await store.getSetting('global', MEMORY_SETTING);
                if (Array.isArray(legacy?.[chatId])) history = legacy[chatId];
            }
        } else if (fs.existsSync(CHAT_MEMORY_FILE)) {
            const saved = JSON.parse(fs.readFileSync(CHAT_MEMORY_FILE, 'utf8'));
            history = Array.isArray(saved?.[chatId]) ? saved[chatId] : [];
        }
        const fresh = history
            .filter(item => item && typeof item.text === 'string' &&
                (!item.at || Date.now() - item.at <= MAX_HISTORY_AGE_MS))
            .slice(-MAX_HISTORY_MESSAGES);
        chatMemory.messages.set(chatId, fresh);
    } catch (error) {
        console.warn('[Chatbot] Could not load persistent conversation memory:', error.message);
        chatMemory.messages.set(chatId, []);
    }
    chatMemory.loaded.add(chatId);
    return chatMemory.messages.get(chatId);
}

async function saveChatHistory(chatId, history) {
    try {
        const fresh = history
            .filter(item => item && typeof item.text === 'string' &&
                (!item.at || Date.now() - item.at <= MAX_HISTORY_AGE_MS))
            .slice(-MAX_HISTORY_MESSAGES);
        chatMemory.messages.set(chatId, fresh);
        if (HAS_DB) {
            await store.saveSetting(chatId, MEMORY_SETTING, fresh);
        } else {
            const dir = path.dirname(CHAT_MEMORY_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            let allGroups = {};
            try {
                if (fs.existsSync(CHAT_MEMORY_FILE)) {
                    const parsed = JSON.parse(fs.readFileSync(CHAT_MEMORY_FILE, 'utf8'));
                    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) allGroups = parsed;
                }
            } catch (readError) {
                console.warn('[Chatbot] Existing memory file could not be parsed; rebuilding it:', readError.message);
            }
            allGroups[chatId] = fresh;
            const tempFile = CHAT_MEMORY_FILE + '.tmp';
            fs.writeFileSync(tempFile, JSON.stringify(allGroups));
            fs.renameSync(tempFile, CHAT_MEMORY_FILE);
        }
    } catch (error) {
        console.warn('[Chatbot] Could not save persistent conversation memory:', error.message);
    }
}

async function showTyping(sock, chatId) {
    try {
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);
        await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));
    } catch {}
}

// Live replies are selected locally from the curated personality bank.
export async function handleChatbotResponse(sock, chatId, message, userMessage, senderId) {
    const data = await loadUserGroupData();
    const isGroup = chatId.endsWith('@g.us');
    if (!data.chatbot) data.chatbot = {};
    if (!data.chatbotDM) data.chatbotDM = {};
    const settingKey = isGroup ? chatId : senderId;
    if (isGroup) {
        const TARGET = '120363405434471171@g.us';
        if (chatId === TARGET && data.chatbot[chatId] === undefined) {
            data.chatbot[chatId] = true;
            await saveUserGroupData(data);
        }
        if (data.chatbot[chatId] !== true) return;
    } else if (data.chatbotDM[settingKey] !== true) {
        return;
    }

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
            .replace(botNumber ? new RegExp(`@${botNumber}`, 'g') : /$^/, '')
            .trim();

        const history = await loadChatHistory(chatId);
        if (cleanForHistory && !message.key.fromMe) {
            history.push({
                name: message.pushName || senderId.split('@')[0],
                text: cleanForHistory.slice(0, 500),
                at: Date.now()
            });
            if (history.length > MAX_HISTORY_MESSAGES) history.splice(0, history.length - MAX_HISTORY_MESSAGES);
            await saveChatHistory(chatId, history);
        }

        // In personal DMs, an enabled session responds naturally without requiring a mention or quoted reply.
        if (isGroup && !isMention && !isReply) return;
        if (!cleanForHistory) return;

        await showTyping(sock, chatId);

        // Local deterministic bank selection; live replies never call an external model.
        const previousBotReply = [...history].reverse().find(item => item.name === 'Forge Bot')?.text || '';
        let registeredGender = null;
        try { registeredGender = await getUserGender(senderId); } catch {}
        const response = pickPersonalityReply(cleanForHistory, {
            chatId,
            previousReply: previousBotReply,
            gender: registeredGender,
            history
        });
        console.info(`[Chatbot] Personality-bank reply (intent: ${classifyIntent(cleanForHistory)}, gender: ${registeredGender || 'unregistered'}).`);

        await sock.sendMessage(chatId, { text: response }, { quoted: message });

        history.push({ name: 'Forge Bot', text: response.slice(0, 500), at: Date.now() });
        if (history.length > MAX_HISTORY_MESSAGES) history.splice(0, history.length - MAX_HISTORY_MESSAGES);
        await saveChatHistory(chatId, history);

    } catch (e) {
        console.error('Chatbot error:', e.message);
    }
}

export default {
    command: 'chatbot',
    aliases: ['bot', 'ai', 'achat'],
    category: 'admin',
    description: 'Enable or disable chatbot in groups and personal DMs',
    usage: '.chatbot on/off | .chatbot group on/off | .chatbot dm on/off | .chatbot status',
    adminOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const isGroup = context.isGroup ?? chatId.endsWith('@g.us');
        const senderId = context.senderId || message.key.participant || chatId;
        const data = await loadUserGroupData();
        if (!data.chatbot) data.chatbot = {};
        if (!data.chatbotDM) data.chatbotDM = {};

        // DM controls are deliberately restricted to the bot owner/sudo account.
        if (!isGroup && !context.isOwnerOrSudoCheck) {
            return sock.sendMessage(chatId, { text: '🔒 Only the bot owner can change personal DM chatbot settings.' }, { quoted: message });
        }

        const parts = args.join(' ').toLowerCase().trim().split(/\s+/).filter(Boolean);
        let scope = parts[0];
        let action = parts[1];
        if (['on', 'off', 'status'].includes(scope || '')) {
            action = scope;
            scope = isGroup ? 'group' : 'dm';
        }
        if (!scope) scope = isGroup ? 'group' : 'dm';
        if (!action) action = 'status';

        if (scope === 'group') {
            if (!isGroup) {
                return sock.sendMessage(chatId, { text: 'ℹ️ Group controls must be used inside the group: .chatbot group on/off' }, { quoted: message });
            }
            if (action === 'on' || action === 'off') {
                data.chatbot[chatId] = action === 'on';
                await saveUserGroupData(data);
                return sock.sendMessage(chatId, { text: action === 'on' ? '✅ Group chatbot is ON. Tag me or reply to my message.' : '⏸️ Group chatbot is OFF.' }, { quoted: message });
            }
            if (action === 'status') {
                const enabled = data.chatbot[chatId] === true;
                return sock.sendMessage(chatId, { text: `Group chatbot: ${enabled ? '🟢 ON' : '🔴 OFF'}\nUse .chatbot group on/off.` }, { quoted: message });
            }
        }

        if (scope === 'dm') {
            if (action === 'on' || action === 'off') {
                data.chatbotDM[senderId] = action === 'on';
                await saveUserGroupData(data);
                return sock.sendMessage(chatId, { text: action === 'on' ? '✅ Personal DM chatbot is ON. Send me a message here to chat.' : '⏸️ Personal DM chatbot is OFF.' }, { quoted: message });
            }
            if (action === 'status') {
                const enabled = data.chatbotDM[senderId] === true;
                return sock.sendMessage(chatId, { text: `Personal DM chatbot: ${enabled ? '🟢 ON' : '🔴 OFF'}\nUse .chatbot dm on/off.` }, { quoted: message });
            }
        }

        return sock.sendMessage(chatId, {
            text: '*Forge Bot Controls*\n.chatbot on/off — toggle this chat\n.chatbot group on/off — group replies\n.chatbot dm on/off — personal DM replies\n.chatbot status — show current status',
        }, { quoted: message });
    },
    handleChatbotResponse
};

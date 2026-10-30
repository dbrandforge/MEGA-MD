import fs from 'fs';
import path from 'path';
import { dataFile } from '../lib/paths.js';
import store from '../lib/lightweight_store.js';
import { pickLibraryReply } from '../data/chatbotResponseLibrary.js';

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
            // Read and migrate the former shared-map database format.
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
            // DB adapters are keyed by chatId; store the array directly under that key.
            await store.saveSetting(chatId, MEMORY_SETTING, fresh);
        } else {
            // The lightweight file adapter historically overwrites one flat file per key.
            // Keep a single per-group map here so groups never overwrite one another.
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


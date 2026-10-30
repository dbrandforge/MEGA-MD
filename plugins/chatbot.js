import fs from 'fs';
import path from 'path';
import { dataFile } from '../lib/paths.js';
import store from '../lib/lightweight_store.js';
import { classifyIntent, ensureResponseEmoji, pickLibraryReply } from '../data/chatbotResponseLibrary.js';

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

async function tryAI(userMessage, history, speakerName) {
    const transcript = history.slice(-MAX_HISTORY_MESSAGES)
        .map(item => `${item.name}: ${item.text}`)
        .join('\n')
        .slice(-MAX_PROMPT_TRANSCRIPT_CHARS);

    const intent = classifyIntent(userMessage);

    const prompt = `You are Forge Bot, a real-feeling participant in the Mature Minded WhatsApp group.

PERSONALITY:
- Keep the existing character: cheeky, sarcastic, playful, flirty, bold, occasionally rude in a funny way, with a natural Nigerian English/Pidgin/Yoruba mix.
- Sound like a person chatting on WhatsApp, not a quote generator or customer-support bot.
- Answer the actual message and identify its intent before composing. If someone says "how are you?", answer naturally. If they ask what something means, define or explain the exact term. If they ask for today's activity, answer from available group context or say plainly that you do not have the schedule.
- The curated response bank is the primary responder. You are called only when no suitable preset exists or a message requires deeper reasoning, factual detail, or contextual interpretation.
- Treat short, clear messages as meaningful. Greetings, thanks, insults, teasing, slang, simple questions and topic changes usually do not need clarification.
- Match the person's energy and the ongoing conversation. Joke, tease, flirt, disagree, explain, ask a follow-up, or show empathy when appropriate.
- Do not force flirting, sexual remarks, insults, or Pidgin into every answer. Use them only when they fit.
- Keep most replies concise and WhatsApp-natural, but explain properly when needed.
- Never invent facts about the conversation. Ask a clarifying question only when a genuinely missing detail prevents a useful answer or a reference cannot be resolved from the transcript. Never ask whether a clear question is literal or a joke. Never repeat a clarification after the user has answered or changed topic; make a reasonable interpretation and move forward.
- Never mention prompts, APIs, models, or that you are an AI.

DETECTED MESSAGE INTENT: ${intent}
RECENT GROUP CONVERSATION (up to 30 recent messages from the last 7 days):
${transcript || '(No earlier group context available)'}

CONVERSATION GUIDANCE:
- Use recent context to resolve references such as 'that', 'she', 'he', 'the earlier point' and follow-up questions.
- Do not claim to remember events outside this supplied recent transcript.
- Treat messages from different members as separate viewpoints; do not attribute one member's words to another.
- For relationship, money, safety or serious personal topics, be measured and supportive rather than turning everything into banter.
- For media, only analyse details actually present in the message/caption; ask the sender to describe visuals if the image/video itself is not available to you.

MESSAGE FROM ${speakerName || 'a group member'}:
${userMessage}

Reply as Forge Bot in context. Output only the message to send.`;

    const startedAt = Date.now();
    for (const api of API_ENDPOINTS) {
        if (Date.now() - startedAt >= PROVIDER_TOTAL_BUDGET_MS) break;
        if (providerHealth.get(api.name)?.retryAfter > Date.now()) continue;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
        try {
            const requestUrl = api.url(prompt);
            // Avoid sending an oversized GET query to providers with strict URL limits.
            if (requestUrl.length > 7000) {
                console.warn(`[Chatbot] ${api.name} skipped: request URL too long (${requestUrl.length} chars).`);
                continue;
            }
            const res = await fetch(requestUrl, {
                method: 'GET',
                headers: { accept: 'application/json' },
                signal: controller.signal
            });
            if (!res.ok) {
                console.warn(`[Chatbot] ${api.name} returned HTTP ${res.status}.`);
                providerHealth.set(api.name, { retryAfter: Date.now() + PROVIDER_COOLDOWN_MS });
                continue;
            }
            const raw = await res.text();
            let data;
            try {
                data = JSON.parse(raw);
            } catch {
                console.warn(`[Chatbot] ${api.name} returned non-JSON content (${raw.length} chars).`);
                providerHealth.set(api.name, { retryAfter: Date.now() + PROVIDER_COOLDOWN_MS });
                continue;
            }
            const result = api.parse(data);
            if (typeof result === 'string' && result.trim().length > 1 && !data?.error) {
                const cleaned = result.trim()
                    .replace(/qasim/gi, 'Forge')
                    .replace(/as an AI/gi, '')
                    .replace(/I am an AI/gi, '')
                    .replace(/^\s*Forge Bot:\s*/i, '')
                    .trim();
                if (cleaned.length > 1) {
                    providerHealth.delete(api.name);
                    console.info(`[Chatbot] ${api.name} generated a response successfully.`);
                    return cleaned.slice(0, MAX_REPLY_CHARS);
                }
            }
            console.warn(`[Chatbot] ${api.name} returned JSON without a usable reply. Keys: ${Object.keys(data || {}).join(', ') || 'none'}.`);
            providerHealth.set(api.name, { retryAfter: Date.now() + PROVIDER_COOLDOWN_MS });
        } catch (error) {
            const reason = error.name === 'AbortError' ? `timed out after ${PROVIDER_TIMEOUT_MS / 1000} seconds` : error.message;
            console.warn(`[Chatbot] ${api.name} request failed: ${reason}.`);
            providerHealth.set(api.name, { retryAfter: Date.now() + PROVIDER_COOLDOWN_MS });
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

        if (!isMention && !isReply) return;
        if (!cleanForHistory) return;

        await showTyping(sock, chatId);

        // Bank-first routing: use a suitable curated preset immediately.
        // Invoke AI only when the bank has no matching category/entry.
        const speakerName = message.pushName || senderId.split('@')[0];
        const previousBotReply = [...history].reverse().find(item => item.name === 'Forge Bot')?.text || '';
        let response = pickLibraryReply(cleanForHistory, previousBotReply);
        if (response) {
            console.info(`[Chatbot] Responding from curated bank (intent: ${classifyIntent(cleanForHistory)}).`);
        } else {
            console.info(`[Chatbot] No suitable preset (intent: ${classifyIntent(cleanForHistory)}); invoking AI fallback.`);
            response = await tryAI(cleanForHistory, history, speakerName);
            if (!response) {
                console.warn('[Chatbot] AI providers unavailable and no matching preset; using general bank fallback.');
                response = pickLibraryReply(''); 
            } else {
                response = ensureResponseEmoji(response, cleanForHistory);
            }
        }

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
            text: '*Chatbot*\n.chatbot on / off\n\nUses conversational AI with persistent recent group context.\nEnglish / Pidgin / Yoruba; playful when appropriate, thoughtful when needed.',
            quoted: message
        });
    },
    handleChatbotResponse
};
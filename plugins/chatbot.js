import fs from 'fs';
import path from 'path';
import { dataFile } from '../lib/paths.js';
import store from '../lib/lightweight_store.js';
import { classifyIntent, pickSubstantiveReply, pickLibraryReply, getQuestionFallback } from '../data/chatbotResponseLibrary.js';
import { pickPersonalityReply } from '../data/forgeBotPersonalityBank.js';
import { pickDualReply } from '../data/chatDual/dualBankSelector.js';
import { getUserGender } from './gender.js';
import { printLog } from '../lib/print.js';
import { resolveIdentity, getIdentityReply, getIdentityGreeting, getIdentityAcknowledgement } from '../lib/identity.js';
import { getDMChatbotPermission, migrateDMChatbotDefault } from '../lib/dmAccess.js';
import { isExplicitlyAddressedInGroup } from '../lib/chatbotAccess.js';
import { createKeyedSerialExecutor, getConversationMemoryKey } from '../lib/chatbotConversationMemory.js';
import { askFastAI, sanitizeAIResponse, sanitizeChatbotReply, shouldUseAutomaticAI } from '../lib/aiService.js';
import { evaluateArithmetic, formatArithmeticAnswer } from '../lib/arithmetic.js';
import { isTimeSensitiveQuestion, searchLiveKnowledge, buildLiveKnowledgeContext, formatLiveKnowledgeSources, formatLiveKnowledgeEvidenceSummary } from '../lib/liveKnowledge.js';

const CHATBOT_AI_ENABLED = process.env.CHATBOT_AI_ENABLED === 'true';

const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);
const USER_GROUP_DATA = dataFile('userGroupData.json');
const CHAT_MEMORY_FILE = dataFile('chatbotConversationMemory.json');

// Each participant gets an independent transcript per chat. Group transcripts are never shared.
const chatMemory = { messages: new Map(), loaded: new Set() };
const runConversationSerial = createKeyedSerialExecutor();
const runLocalMemoryWriteSerial = createKeyedSerialExecutor();
const MEMORY_SETTING = 'chatbotConversationMemory';
const MAX_HISTORY_MESSAGES = 30;
const MAX_HISTORY_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function loadUserGroupData() {
    let data;
    try {
        if (HAS_DB) {
            data = await store.getSetting('global', 'userGroupData');
        } else {
            data = JSON.parse(fs.readFileSync(USER_GROUP_DATA, 'utf-8'));
        }
    } catch {
        data = null;
    }
    if (!data || typeof data !== 'object') data = { chatbot: {} };
    if (!data.chatbot || typeof data.chatbot !== 'object') data.chatbot = {};
    if (!data.chatbotDM || typeof data.chatbotDM !== 'object') data.chatbotDM = {};
    if (migrateDMChatbotDefault(data) && !await saveUserGroupData(data)) {
        console.warn('[Chatbot] Could not persist the new DM-default-off migration.');
    }
    return data;
}

export async function saveUserGroupData(data) {
    try {
        if (HAS_DB) {
            return await store.saveSettingVerified('global', 'userGroupData', data);
        }
        const dir = path.dirname(USER_GROUP_DATA);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('[Chatbot] Could not save user/group settings:', error.message);
        return false;
    }
}

async function loadChatHistory(memoryKey, legacyDirectChatId = null) {
    if (chatMemory.loaded.has(chatId)) return chatMemory.messages.get(chatId) || [];
    try {
        let history = [];
        if (HAS_DB) {
            const saved = await store.getSetting(memoryKey, MEMORY_SETTING);
            history = Array.isArray(saved) ? saved : (Array.isArray(saved?.[memoryKey]) ? saved[memoryKey] : []);
            // A one-to-one DM has an unambiguous legacy owner, so it can be migrated.
            // Old group transcripts mixed several participants and must never be imported.
            if (!history.length && legacyDirectChatId) {
                const legacyDirect = await store.getSetting(legacyDirectChatId, MEMORY_SETTING);
                history = Array.isArray(legacyDirect) ? legacyDirect
                    : (Array.isArray(legacyDirect?.[legacyDirectChatId]) ? legacyDirect[legacyDirectChatId] : []);
                if (!history.length) {
                    const legacyGlobal = await store.getSetting('global', MEMORY_SETTING);
                    if (Array.isArray(legacyGlobal?.[legacyDirectChatId])) history = legacyGlobal[legacyDirectChatId];
                }
            }
        } else if (fs.existsSync(CHAT_MEMORY_FILE)) {
            const saved = JSON.parse(fs.readFileSync(CHAT_MEMORY_FILE, 'utf8'));
            history = Array.isArray(saved?.[memoryKey]) ? saved[memoryKey]
                : (legacyDirectChatId && Array.isArray(saved?.[legacyDirectChatId]) ? saved[legacyDirectChatId] : []);
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

async function saveChatHistory(memoryKey, history) {
    try {
        const fresh = history
            .filter(item => item && typeof item.text === 'string' &&
                (!item.at || Date.now() - item.at <= MAX_HISTORY_AGE_MS))
            .slice(-MAX_HISTORY_MESSAGES);
        chatMemory.messages.set(chatId, fresh);
        if (HAS_DB) {
            await store.saveSetting(memoryKey, MEMORY_SETTING, fresh);
        } else {
            // Different participants can save concurrently; serialize the shared JSON-file
            // read/modify/write so one person's update cannot overwrite another's.
            await runLocalMemoryWriteSerial('chatbot-memory-file', async () => {
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
                allGroups[memoryKey] = fresh;
                const tempFile = CHAT_MEMORY_FILE + '.tmp';
                fs.writeFileSync(tempFile, JSON.stringify(allGroups));
                fs.renameSync(tempFile, CHAT_MEMORY_FILE);
            });
        }
    } catch (error) {
        console.warn('[Chatbot] Could not save persistent conversation memory:', error.message);
    }
}

// Serialize turns per person/chat. Different group members remain fully independent.
export async function handleChatbotResponse(sock, chatId, message, userMessage, senderId) {
    const isGroup = String(chatId || '').endsWith('@g.us');
    const participantId = senderId || message?.key?.participant || (!isGroup ? chatId : '');
    const memoryKey = getConversationMemoryKey({ chatId, senderId: participantId, isGroup });
    if (!memoryKey) {
        console.warn('[Chatbot] Skipping group response because the sender identity could not be resolved.');
        return;
    }
    return runConversationSerial(memoryKey, () =>
        handleChatbotResponseForConversation(sock, chatId, message, userMessage, participantId, memoryKey)
    );
}

// Live replies are selected locally from the curated personality bank.
async function handleChatbotResponseForConversation(sock, chatId, message, userMessage, senderId, memoryKey) {
    const data = await loadUserGroupData();
    const isGroup = chatId.endsWith('@g.us');
    if (!data.chatbot) data.chatbot = {};
    if (!data.chatbotDM) data.chatbotDM = {};
    const identity = resolveIdentity(senderId);
    if (isGroup) {
        const TARGET = '120363405434471171@g.us';
        if (chatId === TARGET && data.chatbot[chatId] === undefined) {
            data.chatbot[chatId] = true;
            await saveUserGroupData(data);
        }
        if (data.chatbot[chatId] !== true) return;
    } else if (!getDMChatbotPermission(data, senderId, chatId)) {
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
        let isMention = mentioned.some(j => botJids.some(b =>
            b.split('@')[0].split(':')[0] === j.split('@')[0].split(':')[0]
        ));
        if (!isMention && botNumber) isMention = userMessage.includes(`@${botNumber}`);

        // Record normal messages as well, so a later mention can refer to the group discussion.
        const originalText = message.message?.conversation
            || message.message?.extendedTextMessage?.text
            || message.message?.imageMessage?.caption
            || message.message?.videoMessage?.caption
            || '';
        const cleanForHistory = originalText
            .replace(botNumber ? new RegExp(`@${botNumber}`, 'g') : /$^/, '')
            .trim();

        const quotedMessage = contextInfo.quotedMessage || {};
        const quotedText = quotedMessage.conversation
            || quotedMessage.extendedTextMessage?.text
            || quotedMessage.imageMessage?.caption
            || quotedMessage.videoMessage?.caption
            || '';
        const chatbotQuery = quotedText && /^(answer this|answer|explain this|tell me about this|what about this|help me with this)[.!?\s👇]*$/i.test(cleanForHistory)
            ? `The user is asking you to answer the following quoted message: "${String(quotedText).slice(0, 1500)}". Their instruction: ${cleanForHistory}`
            : cleanForHistory;

        // Only explicitly addressed group turns enter an individual's private transcript.
        // Ordinary messages from other members are not imported into this person's context.
        const quotedParticipant = contextInfo.participant || '';
        const isReplyToBot = Boolean(quotedParticipant && botJids.some(b =>
            b.split('@')[0].split(':')[0] === quotedParticipant.split('@')[0].split(':')[0]
        ));
        if (isGroup && !isExplicitlyAddressedInGroup({ isMention, isReplyToBot, quotedParticipant, botJids })) return;
        if (!cleanForHistory) return;

        // Group history is keyed by (group, participant); DM history is keyed by participant.
        // Legacy history is migrated only for one-to-one chats, never from a mixed group log.
        const history = await loadChatHistory(memoryKey, isGroup ? null : chatId);
        if (!message.key.fromMe) {
            history.push({
                name: message.pushName || 'You',
                text: cleanForHistory.slice(0, 500),
                at: Date.now()
            });
            if (history.length > MAX_HISTORY_MESSAGES) history.splice(0, history.length - MAX_HISTORY_MESSAGES);
            await saveChatHistory(memoryKey, history);
        }

        const arithmeticValue = evaluateArithmetic(chatbotQuery);
        const arithmeticReply = arithmeticValue === null ? null : `The answer is *${formatArithmeticAnswer(arithmeticValue)}*.`;
        const identityReply = getIdentityReply(cleanForHistory, undefined, identity);
        // Creator/Queen arrival greetings are for a fresh direct call, not every follow-up turn.
        const identityGreeting = getIdentityGreeting(cleanForHistory, identity);

        // Identity-specific replies take priority over the general personality bank.
        // Creator/VIP recognition never grants permissions; authorization remains in the command handler.
        const previousBotReply = [...history].reverse().find(item => item.name === 'Forge Bot')?.text || '';
        let registeredGender = null;
        try { registeredGender = await getUserGender(senderId); } catch {}
        let response = arithmeticReply || identityReply || identityGreeting;
        if (!response) {
            // Current facts must be grounded in fresh search evidence, never a dated local answer bank.
            if (CHATBOT_AI_ENABLED && isTimeSensitiveQuestion(chatbotQuery)) {
                const liveStartedAt = Date.now();
                const liveResult = await searchLiveKnowledge(chatbotQuery, { timeoutMs: 5000 });
                if (!liveResult.ok) {
                    response = "I can't verify the latest information right now, so I don't want to guess. Please try again shortly.";
                    console.info(`[Chatbot Live] outcome=unavailable reason=${liveResult.reason} latency_ms=${Date.now() - liveStartedAt}`);
                } else {
                    try {
                        const liveReply = await askFastAI(chatbotQuery, {
                            timeoutMs: 10000,
                            history: history.slice(0, -1).slice(-8),
                            liveContext: buildLiveKnowledgeContext(liveResult)
                        });
                        response = sanitizeAIResponse(liveReply, chatbotQuery) + formatLiveKnowledgeSources(liveResult);
                        console.info(`[Chatbot Live] outcome=success sources=${liveResult.results.length} cached=${liveResult.cached} latency_ms=${Date.now() - liveStartedAt}`);
                    } catch (error) {
                        response = formatLiveKnowledgeEvidenceSummary(liveResult) || "I found recent sources, but couldn't safely compose a verified summary just now. Please check the linked sources directly:";
                        response += formatLiveKnowledgeSources(liveResult);
                        const reason = String(error?.code || error?.message || 'unknown').slice(0, 80).replaceAll(String.fromCharCode(10), ' ').replaceAll(String.fromCharCode(13), ' ');
                        console.warn(`[Chatbot Live] outcome=summary_fallback reason=${reason} latency_ms=${Date.now() - liveStartedAt}`);
                    }
                }
            } else {
            const intent = classifyIntent(chatbotQuery);
            const substantiveReply = pickSubstantiveReply(chatbotQuery, history.slice(0, -1).slice(-8).map(item => item.text));
            // Exact knowledge-bank matches outrank broad topic banks and contextual suggestions.
            // This prevents a new definition or financial question inheriting an old topic.
            const libraryReply = pickLibraryReply(chatbotQuery, previousBotReply);
            // ChatDual handles relevant advice-shaped/contextual intents; personality bank remains the fallback.
            const priorTurns = history.slice(0, -1).slice(-8);
            // Gemini is the primary reasoning engine for every genuine question or
            // practical help request. Curated banks remain for social exchanges and
            // can no longer intercept a question before the configured AI provider.
            const needsKnowledgeAnswer = shouldUseAutomaticAI(chatbotQuery, intent, priorTurns);

            // Never let a deterministic topic/personality bank replace a genuine
            // question. This keeps the AI path general-purpose rather than sample-specific.
            const dualResponse = needsKnowledgeAnswer ? null
                : (substantiveReply || libraryReply || pickDualReply(chatbotQuery, {
                    chatId: memoryKey,
                    previousReply: previousBotReply,
                    intent,
                    context: history.slice(-8).map(item => item.text),
                    responseMode: 'reasoned'
                }));
            response = needsKnowledgeAnswer ? null : (dualResponse || pickPersonalityReply(chatbotQuery, {
                chatId: memoryKey,
                previousReply: previousBotReply,
                gender: registeredGender,
                history
            }));

            if (needsKnowledgeAnswer) {
                if (CHATBOT_AI_ENABLED) {
                    const aiStartedAt = Date.now();
                    try {
                        response = sanitizeAIResponse(await askFastAI(chatbotQuery, {
                            timeoutMs: 8000,
                            history: priorTurns
                        }), chatbotQuery);
                        console.info(`[Chatbot AI] outcome=success latency_ms=${Date.now() - aiStartedAt}`);
                    } catch (error) {
                        response = getQuestionFallback(chatbotQuery)
                            || "I couldn't produce a reliable answer to that just now. Please try again shortly.";
                        const reason = String(error?.code || error?.message || 'unknown').slice(0, 100).replaceAll(String.fromCharCode(10), ' ').replaceAll(String.fromCharCode(13), ' ');
                        console.warn(`[Chatbot AI] outcome=unavailable latency_ms=${Date.now() - aiStartedAt} reason=${reason}`);
                    }
                } else {
                    response = getQuestionFallback(chatbotQuery)
                        || "I can't provide a reliable answer to that question right now.";
                }
            }

            // Identity acknowledgement is limited to neutral social exchanges.
            // It must never override teasing, substantive questions, or contextual follow-ups.
            if (identity && !needsKnowledgeAnswer && ['greeting', 'wellbeing', 'thanks', 'agreement'].includes(intent) && Math.random() < 0.12) {
                response = getIdentityAcknowledgement(identity) + response;
            }
            }
        }
        // Enforce clean output for every chatbot source: AI, curated banks and identity replies.
        response = sanitizeChatbotReply(response);
        console.info(`[Chatbot] Reply (intent: ${classifyIntent(cleanForHistory)}, identity: ${identity?.role || 'standard'}, gender: ${registeredGender || 'unregistered'}).`);

        printLog('info', `[Chatbot DM] Attempting reply via destinationType=${chatId.endsWith('@lid') ? 'LID' : 'PN_or_group'}`);
        const sentMessage = await sock.sendMessage(chatId, { text: response }, { quoted: message });
        printLog('info', `[Chatbot DM] sendMessage resolved id=${sentMessage?.key?.id || 'missing'} destinationType=${sentMessage?.key?.remoteJid?.endsWith('@lid') ? 'LID' : 'other'}`);

        history.push({ name: 'Forge Bot', text: response.slice(0, 500), at: Date.now() });
        if (history.length > MAX_HISTORY_MESSAGES) history.splice(0, history.length - MAX_HISTORY_MESSAGES);
        await saveChatHistory(memoryKey, history);

    } catch (e) {
        printLog('error', `[Chatbot DM] Reply failed: ${String(e?.message || e).slice(0, 400)}`);
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
                if (!await saveUserGroupData(data)) return sock.sendMessage(chatId, { text: '❌ Could not save the group chatbot setting.' }, { quoted: message });
                return sock.sendMessage(chatId, { text: action === 'on' ? '✅ Group chatbot is ON. Tag me or reply to my message.' : '⏸️ Group chatbot is OFF.' }, { quoted: message });
            }
            if (action === 'status') {
                const enabled = data.chatbot[chatId] === true;
                return sock.sendMessage(chatId, { text: `Group chatbot: ${enabled ? '🟢 ON' : '🔴 OFF'}\nUse .chatbot group on/off.` }, { quoted: message });
            }
        }

        if (scope === 'dm') {
            if (!context.isCreatorOrBot) {
                return sock.sendMessage(chatId, { text: '🔒 Only the creator or bot number can change the universal DM chatbot switch.' }, { quoted: message });
            }
            if (action === 'on' || action === 'off') {
                // This is a global inbound-DM switch, controlled by the bot owner.
                // Do not key it by the owner senderId: incoming messages arrive under each external sender's JID.
                data.chatbotDMEnabled = action === 'on';
                if (!await saveUserGroupData(data)) return sock.sendMessage(chatId, { text: '❌ Could not save the universal DM chatbot setting.' }, { quoted: message });
                return sock.sendMessage(chatId, { text: action === 'on' ? '✅ Incoming DM chatbot is ON. I can now reply to private messages from other users.' : '⏸️ Incoming DM chatbot is OFF.' }, { quoted: message });
            }
            if (action === 'status') {
                const enabled = data.chatbotDMEnabled === true;
                return sock.sendMessage(chatId, { text: `Incoming DM chatbot: ${enabled ? '🟢 ON' : '🔴 OFF'}\nUse .chatbot dm on/off.` }, { quoted: message });
            }
        }

        return sock.sendMessage(chatId, {
            text: '*Forge Bot Controls*\n.chatbot on/off — toggle this chat\n.chatbot group on/off — group replies\n.chatbot dm on/off — personal DM replies\n.chatbot status — show current status',
        }, { quoted: message });
    },
    handleChatbotResponse
};

import axios from 'axios';
import FormData from 'form-data';
import sharp from 'sharp';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import store from './lightweight_store.js';
import { getChatbotMediaModes } from './chatbotMediaSettings.js';
import { handleChatbotResponse, isChatbotEnabledForMessage } from '../plugins/chatbot.js';
import { isExplicitlyAddressedInGroup, jidMatchesAnyBotIdentity } from './chatbotAccess.js';
import { printLog } from './print.js';

const USAGE_KEY = 'chatbotMediaUsage';
const GROQ_CHAT_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_AUDIO_ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_VISION_MODEL = 'qwen/qwen3.8-27b';
const GROQ_AUDIO_MODEL = 'whisper-large-v3-turbo';
const MAX_STICKER_BYTES = 1_500_000;
const MAX_STICKER_AI_BYTES = 300_000;
const MAX_VOICE_BYTES = 2_000_000;
const MAX_VOICE_SECONDS = 60;
const MEDIA_COOLDOWN_MS = 12_000;
const MAX_STICKERS_PER_SENDER_PER_DAY = 5;
const MAX_STICKERS_PER_CHAT_PER_DAY = 10;
const MAX_STICKERS_GLOBAL_PER_DAY = 20;
const MAX_VOICE_NOTES_PER_SENDER_PER_DAY = 2;
const MAX_VOICE_NOTES_PER_CHAT_PER_DAY = 3;
const MAX_VOICE_NOTES_GLOBAL_PER_DAY = 5;
const MAX_CONCURRENT_MEDIA = 2;
const rateLimits = new Map();
let usageWriteQueue = Promise.resolve();
let activeMediaJobs = 0;

const GROQ_REQUEST_TIMEOUT_MS = 45_000;
const GROQ_MAX_RETRIES = 1;

export function shouldRetryGroqRequest(error) {
    const status = Number(error?.response?.status || 0);
    // A 429 means the free-plan quota is exhausted. Never retry or route around it.
    return [408, 500, 502, 503, 504].includes(status)
        || ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'ECONNREFUSED'].includes(String(error?.code || '').toUpperCase());
}

export function getSafeGroqErrorDetail(error) {
    const status = Number(error?.response?.status || 0) || null;
    const code = String(error?.code || '').slice(0, 40);
    const providerMessage = error?.response?.data?.error?.message
        || error?.response?.data?.message
        || error?.message
        || 'Unknown provider error';
    const detail = String(providerMessage)
        .replace(/https?:\\/\\/[^\\s]+/gi, '[url]')
        .replace(/[\\r\\n\\t]+/g, ' ')
        .replace(/(?:(?:key|token)\\s*[:=]\\s*|authorization\\s*[:=]\\s*(?:Bearer\\s+)?)[^\\s,;]+/gi, '[redacted]')
        .slice(0, 180);
    return { status, code: code || null, detail };
}

export function createGroqVisionPayload({ prompt, data }) {
    return {
        model: GROQ_VISION_MODEL,
        messages: [{
            role: 'user',
            content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${data}` } }
            ]
        }],
        temperature: 0.2,
        max_completion_tokens: 160
    };
}

export async function postGroqJsonWithRetry(url, payload, headers, stage) {
    for (let attempt = 0; ; attempt++) {
        try {
            return await axios.post(url, payload, {
                timeout: GROQ_REQUEST_TIMEOUT_MS,
                headers
            });
        } catch (error) {
            if (attempt >= GROQ_MAX_RETRIES || !shouldRetryGroqRequest(error)) throw error;
            const delayMs = 750;
            printLog('warning', `[Chatbot Media] Groq transient failure stage=${stage} attempt=${attempt + 1}/${GROQ_MAX_RETRIES} status=${error?.response?.status || 'network'}; retrying in ${delayMs}ms.`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
}

export async function reserveMediaSlot(chatId, senderId, type) {
    const operation = usageWriteQueue.then(async () => {
        const now = Date.now();
        // Forge Guard runs on Africa/Lagos time (UTC+1, no DST).
        const day = new Date(now + 60 * 60 * 1000).toISOString().slice(0, 10);
        const isVoice = type === 'voice';
        const caps = isVoice
            ? { sender: MAX_VOICE_NOTES_PER_SENDER_PER_DAY, chat: MAX_VOICE_NOTES_PER_CHAT_PER_DAY, global: MAX_VOICE_NOTES_GLOBAL_PER_DAY }
            : { sender: MAX_STICKERS_PER_SENDER_PER_DAY, chat: MAX_STICKERS_PER_CHAT_PER_DAY, global: MAX_STICKERS_GLOBAL_PER_DAY };
        const senderKey = `${chatId}:${senderId}`;
        const cooldownKey = `${senderKey}:${type}`;
        const cooldown = rateLimits.get(cooldownKey);
        if (cooldown?.day === day && now - cooldown.lastAt < MEDIA_COOLDOWN_MS) return false;

        const stored = await store.getSetting('global', USAGE_KEY);
        const usage = stored?.day === day
            ? stored
            : { day, global: {}, chats: {}, senders: {} };
        if (!usage.global || typeof usage.global !== 'object') usage.global = {};
        if (!usage.chats || typeof usage.chats !== 'object') usage.chats = {};
        if (!usage.senders || typeof usage.senders !== 'object') usage.senders = {};
        if (!usage.chats[chatId] || typeof usage.chats[chatId] !== 'object') usage.chats[chatId] = {};
        if (!usage.senders[senderKey] || typeof usage.senders[senderKey] !== 'object') usage.senders[senderKey] = {};

        const senderCount = Number(usage.senders[senderKey][type] || 0);
        const chatCount = Number(usage.chats[chatId][type] || 0);
        const globalCount = Number(usage.global[type] || 0);
        if (senderCount >= caps.sender || chatCount >= caps.chat || globalCount >= caps.global) return false;

        usage.senders[senderKey][type] = senderCount + 1;
        usage.chats[chatId][type] = chatCount + 1;
        usage.global[type] = globalCount + 1;
        const saved = await store.saveSettingVerified('global', USAGE_KEY, usage);
        if (!saved) {
            printLog('warning', '[Chatbot Media] Daily usage counter could not be persisted; media processing was denied.');
            return false;
        }
        rateLimits.set(cooldownKey, { day, lastAt: now });
        return true;
    });
    usageWriteQueue = operation.catch(() => false);
    return operation;
}

export async function releaseMediaSlot(chatId, senderId, type) {
    const operation = usageWriteQueue.then(async () => {
        const now = Date.now();
        const day = new Date(now + 60 * 60 * 1000).toISOString().slice(0, 10);
        const senderKey = `${chatId}:${senderId}`;
        const stored = await store.getSetting('global', USAGE_KEY);
        if (!stored || stored.day !== day) return false;
        const senderCount = Number(stored.senders?.[senderKey]?.[type] || 0);
        const chatCount = Number(stored.chats?.[chatId]?.[type] || 0);
        const globalCount = Number(stored.global?.[type] || 0);
        if (!senderCount || !chatCount || !globalCount) return false;
        stored.senders[senderKey][type] = senderCount - 1;
        stored.chats[chatId][type] = chatCount - 1;
        stored.global[type] = globalCount - 1;
        const saved = await store.saveSettingVerified('global', USAGE_KEY, stored);
        if (saved) rateLimits.delete(`${senderKey}:${type}`);
        return Boolean(saved);
    });
    usageWriteQueue = operation.catch(() => false);
    return operation;
}

async function downloadMedia(mediaMessage, mediaType, maxBytes) {
    const stream = await downloadContentFromMessage(mediaMessage, mediaType);
    const chunks = [];
    let totalBytes = 0;
    for await (const chunk of stream) {
        totalBytes += chunk.length;
        if (totalBytes > maxBytes) {
            if (typeof stream.destroy === 'function') stream.destroy();
            return null;
        }
        chunks.push(chunk);
    }
    return totalBytes ? Buffer.concat(chunks, totalBytes) : null;
}

function getGroqApiKey() {
    return String(process.env.GROQ_API_KEY || '').trim();
}

export function normalizeVoiceMimeType(mimeType = '') {
    const mime = String(mimeType || '').split(';')[0].trim().toLowerCase();
    if (mime === 'audio/ogg' || mime === 'application/ogg') return 'audio/ogg';
    if (mime === 'audio/mpeg' || mime === 'audio/mp3') return 'audio/mp3';
    if (mime === 'audio/wav' || mime === 'audio/x-wav') return 'audio/wav';
    if (mime === 'audio/aac') return 'audio/aac';
    if (mime === 'audio/flac') return 'audio/flac';
    return null;
}

async function describeSticker(imageBuffer) {
    const apiKey = getGroqApiKey();
    if (!apiKey) throw new Error('GROQ_API_KEY is not configured');
    let image = await sharp(imageBuffer, { animated: false })
        .rotate()
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 70, mozjpeg: true })
        .toBuffer();
    if (image.length > MAX_STICKER_AI_BYTES) {
        image = await sharp(image)
            .resize(384, 384, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 58, mozjpeg: true })
            .toBuffer();
    }
    if (image.length > MAX_STICKER_AI_BYTES) throw new Error('Sticker preview exceeds the AI upload size limit');

    const prompt = 'Describe this WhatsApp sticker briefly and neutrally. Include visible text, expression, gesture, and obvious emotional tone. Do not guess the sender’s intention. Return only the description.';
    const payload = createGroqVisionPayload({ prompt, data: image.toString('base64') });
    const { data } = await postGroqJsonWithRetry(
        GROQ_CHAT_ENDPOINT,
        payload,
        { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        'sticker_vision'
    );
    const description = String(data?.choices?.[0]?.message?.content || '').trim();
    if (!description) throw new Error('Groq returned no sticker description');
    return description.slice(0, 700);
}

async function transcribeVoiceNote(audioBuffer, mimeType) {
    const apiKey = getGroqApiKey();
    if (!apiKey) throw new Error('GROQ_API_KEY is not configured');
    const form = new FormData();
    const extension = mimeType === 'audio/ogg' ? 'ogg'
        : mimeType === 'audio/mp3' ? 'mp3'
            : mimeType === 'audio/wav' ? 'wav'
                : mimeType === 'audio/aac' ? 'aac' : 'flac';
    form.append('file', audioBuffer, {
        filename: `forge-guard-voice-note.${extension}`,
        contentType: mimeType
    });
    form.append('model', GROQ_AUDIO_MODEL);
    form.append('response_format', 'json');
    form.append('temperature', '0');
    form.append('prompt', 'Transcribe verbatim. Preserve Nigerian Pidgin, Yoruba, English, and natural code-switching. Do not translate or summarize. Return only the spoken words.');

    const { data } = await axios.post(GROQ_AUDIO_ENDPOINT, form, {
        timeout: GROQ_REQUEST_TIMEOUT_MS,
        headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${apiKey}`
        },
        maxBodyLength: MAX_VOICE_BYTES + 64 * 1024,
        maxContentLength: 256 * 1024
    });
    const transcript = String(data?.text || '').trim();
    if (!transcript || /^\\[unclear\\]$/i.test(transcript)) {
        throw new Error('Groq returned no intelligible voice transcription');
    }
    return transcript.slice(0, 5000);
}

async function isMediaAddressedToBot(sock, message, chatId) {
    if (!String(chatId || '').endsWith('@g.us')) return true;
    const media = message.message?.stickerMessage || message.message?.audioMessage || {};
    const contextInfo = media.contextInfo || {};
    const botId = sock.user?.id || '';
    const botNumber = botId.split(':')[0];
    const botJids = [botId, botNumber ? `${botNumber}@s.whatsapp.net` : '', sock.user?.lid || ''].filter(Boolean);
    const mentioned = contextInfo.mentionedJid || [];
    let isMention = false;
    for (const jid of mentioned) {
        if (await jidMatchesAnyBotIdentity(jid, botJids, sock)) {
            isMention = true;
            break;
        }
    }
    const quotedParticipants = [contextInfo.participant, contextInfo.participantAlt].filter(Boolean);
    let isReplyToBot = false;
    for (const jid of quotedParticipants) {
        if (await jidMatchesAnyBotIdentity(jid, botJids, sock)) {
            isReplyToBot = true;
            break;
        }
    }
    return isExplicitlyAddressedInGroup({
        isMention,
        isReplyToBot,
        quotedParticipant: contextInfo.participant || contextInfo.participantAlt || '',
        botJids
    });
}

export async function handleChatbotMediaResponse(sock, chatId, message, senderId) {
    const stickerMessage = message?.message?.stickerMessage;
    const audioMessage = message?.message?.audioMessage;
    const mediaType = stickerMessage ? 'sticker' : (audioMessage?.ptt === true ? 'voice' : null);
    if (!mediaType || message?.key?.fromMe) return false;

    let reservedUsage = false;
    let mediaPrepared = false;
    let failureStage = 'settings';
    try {
        const modes = await getChatbotMediaModes(chatId);
        if (mediaType === 'sticker' && !modes.stickers) return false;
        if (mediaType === 'voice' && !modes.voiceNotes) return false;
        if (!(await isChatbotEnabledForMessage(chatId, senderId))) return false;
        if (!(await isMediaAddressedToBot(sock, message, chatId))) return false;

        if (mediaType === 'voice') {
            const seconds = Number(audioMessage.seconds || 0);
            if (seconds > MAX_VOICE_SECONDS) {
                printLog('info', `[Chatbot Media] Voice note skipped: duration limit exceeded chatType=${String(chatId).endsWith('@g.us') ? 'group' : 'dm'} seconds=${seconds}`);
                return false;
            }
        }

        if (activeMediaJobs >= MAX_CONCURRENT_MEDIA) return false;
        activeMediaJobs++;
        try {
            failureStage = 'usage_reservation';
            if (!(await reserveMediaSlot(chatId, senderId, mediaType))) return false;
            reservedUsage = true;
            failureStage = 'media_download';
            const mediaMessage = mediaType === 'sticker' ? stickerMessage : audioMessage;
            const buffer = await downloadMedia(
                mediaMessage,
                mediaType === 'sticker' ? 'sticker' : 'audio',
                mediaType === 'sticker' ? MAX_STICKER_BYTES : MAX_VOICE_BYTES
            );
            if (!buffer) {
                printLog('info', `[Chatbot Media] Media skipped: empty or size limit exceeded type=${mediaType}`);
                return false;
            }

            const contextInfo = mediaMessage.contextInfo || {};
            let syntheticMessage;
            let chatbotText;
            if (mediaType === 'sticker') {
                failureStage = 'sticker_vision';
                const description = await describeSticker(buffer);
                syntheticMessage = {
                    ...message,
                    mediaContext: `The user sent a sticker. Visual description: ${description}. Respond naturally to the sticker and the recent conversation.`,
                    message: {
                        conversation: '[sticker]',
                        extendedTextMessage: { contextInfo }
                    }
                };
                chatbotText = '[sticker]';
            } else {
                failureStage = 'voice_transcription';
                const mimeType = normalizeVoiceMimeType(audioMessage.mimetype || 'audio/ogg');
                if (!mimeType) {
                    printLog('info', '[Chatbot Media] Voice note skipped: unsupported audio MIME type');
                    return false;
                }
                const transcript = await transcribeVoiceNote(buffer, mimeType);
                syntheticMessage = {
                    ...message,
                    message: {
                        conversation: transcript,
                        extendedTextMessage: { contextInfo }
                    }
                };
                chatbotText = transcript.toLowerCase();
            }

            mediaPrepared = true;
            failureStage = 'chatbot_reply';
            await handleChatbotResponse(sock, chatId, syntheticMessage, chatbotText, senderId);
            printLog('info', `[Chatbot Media] Processed ${mediaType} message successfully.`);
            return true;
        } finally {
            activeMediaJobs = Math.max(0, activeMediaJobs - 1);
        }
    } catch (error) {
        const diagnostic = getSafeGroqErrorDetail(error);
        printLog('warning', `[Chatbot Media] Processing failed type=${mediaType} stage=${failureStage} status=${diagnostic.status || 'none'} code=${diagnostic.code || 'none'} detail="${diagnostic.detail}"`);
        try {
            await sock.sendMessage(chatId, {
                text: mediaType === 'voice'
                    ? '🎙️ I received your voice note, but could not process it just now. Please try again shortly or send the message as text.'
                    : '🖼️ I received your sticker, but could not interpret it just now. Please try again shortly.'
            }, { quoted: message });
        } catch (sendError) {
            printLog('warning', `[Chatbot Media] Failure notice could not be sent type=${mediaType} code=${sendError?.code || sendError?.message || 'unknown'}`);
        }
        return false;
    } finally {
        if (reservedUsage && !mediaPrepared) {
            try {
                const released = await releaseMediaSlot(chatId, senderId, mediaType);
                printLog(released ? 'info' : 'warning', `[Chatbot Media] Failed attempt usage refund type=${mediaType} result=${released ? 'released' : 'not_released'}`);
            } catch (refundError) {
                printLog('warning', `[Chatbot Media] Usage refund failed type=${mediaType} code=${refundError?.code || 'unknown'}`);
            }
        }
    }
}

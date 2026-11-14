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
const MAX_STICKERS_PER_SENDER_PER_DAY = 30;
const MAX_STICKERS_PER_CHAT_PER_DAY = 45;
const MAX_STICKERS_GLOBAL_PER_DAY = 75;
const MAX_VOICE_NOTES_PER_SENDER_PER_DAY = 20;
const MAX_VOICE_NOTES_PER_CHAT_PER_DAY = 30;
const MAX_VOICE_NOTES_GLOBAL_PER_DAY = 45;
const MAX_CONCURRENT_MEDIA = 2;
const rateLimits = new Map();
let usageWriteQueue = Promise.resolve();
let activeMediaJobs = 0;

const GROQ_REQUEST_TIMEOUT_MS = 45_000;
const GROQ_MAX_RETRIES = 1;

export function buildLongVoiceNoteReply(seconds, gender = null) {
    const duration = Math.max(0, Math.round(Number(seconds) || 0));
    const opener = gender === 'guy' ? 'BROS' : gender === 'lady' ? 'SIS' : 'MY PERSON';
    const tease = gender === 'guy'
        ? 'No be me you go use your life story bore ooo.'
        : gender === 'lady'
            ? 'No be me you go use your full life story tire ooo.'
            : 'You wan give me the director’s cut abi?';
    return `${opener}, YOU TOO DEY DO OOO 😭 ${duration} seconds ke? ${tease} Abeg send a shorter one — 60 seconds max.`;
}

export function reserveLongVoiceNoticeSlot(chatId, senderId, now = Date.now()) {
    const day = new Date(now + 60 * 60 * 1000).toISOString().slice(0, 10);
    const key = `${chatId}:${senderId}:voice_long_notice`;
    const previous = rateLimits.get(key);
    if (previous?.day === day && now - previous.lastAt < MEDIA_COOLDOWN_MS) return false;
    rateLimits.set(key, { day, lastAt: now });
    return true;
}

export function shouldRetryGroqRequest(error) {
    const status = Number(error?.response?.status || 0);
    if (status === 429) return false;
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
        .replace(/https?:\/\/[^\s]+/gi, '[url]')
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/(?:(?:key|token)\s*[:=]\s*|authorization\s*[:=]\s*(?:Bearer\s+)?)[^\s,;]+/gi, '[redacted]')
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
        const senderKey = String(senderId || 'unknown');
        const cooldownKey = `${chatId}:${senderKey}:${type}`;
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
        if (!usage.senders[senderKey] || typeof usage.senders[senderKey] !== 'object') {
            // Migrate same-day counters from the older per-chat sender key without resetting usage.
            const legacy = Object.entries(usage.senders)
                .filter(([key, value]) => key.endsWith(`:${senderKey}`) && value && typeof value === 'object')
                .map(([, value]) => value);
            usage.senders[senderKey] = legacy.reduce((totals, item) => {
                for (const [key, count] of Object.entries(item)) totals[key] = Number(totals[key] || 0) + Number(count || 0);
                return totals;
            }, {});
        }

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
        const senderKey = String(senderId || 'unknown');
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
        if (saved) rateLimits.delete(`${chatId}:${senderKey}:${type}`);
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
    if (['audio/mpeg', 'audio/mp3', 'audio/mpga'].includes(mime)) return 'audio/mpeg';
    if (['audio/wav', 'audio/x-wav'].includes(mime)) return 'audio/wav';
    if (['audio/mp4', 'audio/m4a', 'audio/x-m4a'].includes(mime)) return 'audio/mp4';
    if (mime === 'audio/webm') return 'audio/webm';
    if (['audio/flac', 'audio/x-flac'].includes(mime)) return 'audio/flac';
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
    printLog('info', `[Chatbot Media] Sticker vision payload bytes=${image.length}`);

    const prompt = 'Interpret this WhatsApp sticker for a conversational reply. Extract only useful cues: visible text, facial expression, gesture, emotional tone, and common conversational function (for example laughter, disbelief, affection, sarcasm, celebration, or disapproval). Do not narrate the image like an image caption, do not invent a backstory, and do not claim to know the sender’s exact intention. Return a compact cue, not a full description.';
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

export function createGroqAudioForm(audioBuffer, mimeType) {
    const form = new FormData();
    const extension = mimeType === 'audio/ogg' ? 'ogg'
        : mimeType === 'audio/mpeg' ? 'mp3'
            : mimeType === 'audio/wav' ? 'wav'
                : mimeType === 'audio/mp4' ? 'm4a'
                    : mimeType === 'audio/webm' ? 'webm' : 'flac';
    form.append('file', audioBuffer, {
        filename: `forge-guard-voice-note.${extension}`,
        contentType: mimeType
    });
    form.append('model', GROQ_AUDIO_MODEL);
    form.append('response_format', 'json');
    form.append('temperature', '0');
    form.append('prompt', 'Transcribe verbatim. Preserve Nigerian Pidgin, Yoruba, Igbo, English, and natural code-switching. Recognize common Nigerian names and expressions. Do not translate or summarize. Return only the spoken words.');
    return form;
}

export async function postGroqAudioWithRetry(audioBuffer, mimeType, apiKey) {
    for (let attempt = 0; ; attempt++) {
        const form = createGroqAudioForm(audioBuffer, mimeType);
        try {
            return await axios.post(GROQ_AUDIO_ENDPOINT, form, {
                timeout: GROQ_REQUEST_TIMEOUT_MS,
                headers: {
                    ...form.getHeaders(),
                    Authorization: `Bearer ${apiKey}`
                },
                maxBodyLength: MAX_VOICE_BYTES + 64 * 1024,
                maxContentLength: 256 * 1024
            });
        } catch (error) {
            if (attempt >= GROQ_MAX_RETRIES || !shouldRetryGroqRequest(error)) throw error;
            printLog('warning', `[Chatbot Media] Groq transient failure stage=voice_transcription attempt=${attempt + 1}/${GROQ_MAX_RETRIES} status=${error?.response?.status || 'network'}; retrying in 750ms.`);
            await new Promise(resolve => setTimeout(resolve, 750));
        }
    }
}

export function isUnclearVoiceTranscript(transcript) {
    const normalized = String(transcript || '').trim();
    return !normalized || /^\[unclear\]$/i.test(normalized);
}

async function transcribeVoiceNote(audioBuffer, mimeType) {
    const apiKey = getGroqApiKey();
    if (!apiKey) throw new Error('GROQ_API_KEY is not configured');
    const { data } = await postGroqAudioWithRetry(audioBuffer, mimeType, apiKey);
    const transcript = String(data?.text || '').trim();
    if (!transcript || /^\[unclear\]$/i.test(transcript)) {
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

        // Fail closed before downloading WhatsApp media when the free provider key is absent.
        if (!getGroqApiKey()) throw new Error('GROQ_API_KEY is not configured');

        if (mediaType === 'voice') {
            const seconds = Number(audioMessage.seconds || 0);
            if (seconds > MAX_VOICE_SECONDS) {
                if (!reserveLongVoiceNoticeSlot(chatId, senderId)) {
                    printLog('info', '[Chatbot Media] Long voice-note guidance suppressed by cooldown.');
                    return true;
                }
                printLog('info', `[Chatbot Media] Voice note duration limit exceeded chatType=${String(chatId).endsWith('@g.us') ? 'group' : 'dm'} seconds=${seconds}; sending short-note guidance to original chat.`);
                let gender = null;
                try { gender = await (await import('../plugins/gender.js')).getUserGender(senderId); } catch {}
                await sock.sendMessage(chatId, { text: buildLongVoiceNoteReply(seconds, gender) }, { quoted: message });
                return true;
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
            printLog('info', `[Chatbot Media] Downloaded media type=${mediaType} bytes=${buffer.length}${mediaType === 'voice' ? ` duration_seconds=${Number(audioMessage.seconds || 0)}` : ''}`);

            const contextInfo = mediaMessage.contextInfo || {};
            let syntheticMessage;
            let chatbotText;
            if (mediaType === 'sticker') {
                failureStage = 'sticker_vision';
                const description = await describeSticker(buffer);
                syntheticMessage = {
                    ...message,
                    mediaType: 'sticker',
                    mediaContext: `The user sent a WhatsApp sticker. Sticker cues: ${description}. Treat it as a conversational reaction, interpret its tone in the context of the recent exchange, and reply to the person naturally rather than describing the sticker.`,
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
                    mediaType: 'voice',
                    message: {
                        conversation: transcript,
                        extendedTextMessage: { contextInfo }
                    }
                };
                chatbotText = transcript.toLowerCase();
                printLog('info', `[Chatbot Media] Voice transcription ready transcript_chars=${transcript.length} audio_bytes=${buffer.length}`);
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

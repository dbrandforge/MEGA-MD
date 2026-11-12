import axios from 'axios';
import sharp from 'sharp';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import store from './lightweight_store.js';
import { handleChatbotResponse, isChatbotEnabledForMessage } from '../plugins/chatbot.js';
import { isExplicitlyAddressedInGroup, jidMatchesAnyBotIdentity } from './chatbotAccess.js';
import { printLog } from './print.js';

const SETTINGS_KEY = 'chatbotMediaModes';
const GEMINI_INTERACTIONS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const GEMINI_MODELS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_STICKER_BYTES = 1_500_000;
const MAX_VOICE_BYTES = 4_000_000;
const MAX_VOICE_SECONDS = 45;
const MEDIA_COOLDOWN_MS = 12_000;
const MAX_STICKERS_PER_DAY = 20;
const MAX_VOICE_NOTES_PER_DAY = 8;
const MAX_CONCURRENT_MEDIA = 2;
const rateLimits = new Map();
let activeMediaJobs = 0;

export async function getChatbotMediaModes(chatId) {
    const saved = await store.getSetting(chatId, SETTINGS_KEY);
    return {
        stickers: saved?.stickers === true,
        voiceNotes: saved?.voiceNotes === true
    };
}

export async function setChatbotMediaMode(chatId, feature, enabled) {
    if (!['stickers', 'voiceNotes'].includes(feature)) return false;
    const current = await getChatbotMediaModes(chatId);
    const updated = { ...current, [feature]: Boolean(enabled) };
    await store.saveSetting(chatId, SETTINGS_KEY, updated);
    const persisted = await getChatbotMediaModes(chatId);
    return persisted[feature] === Boolean(enabled);
}

function reserveMediaSlot(chatId, senderId, type) {
    const now = Date.now();
    const day = new Date(now).toISOString().slice(0, 10);
    const key = `${chatId}:${senderId}:${type}`;
    const current = rateLimits.get(key);
    const entry = !current || current.day !== day
        ? { day, count: 0, lastAt: 0 }
        : current;
    const limit = type === 'voice' ? MAX_VOICE_NOTES_PER_DAY : MAX_STICKERS_PER_DAY;
    if (entry.count >= limit || now - entry.lastAt < MEDIA_COOLDOWN_MS) {
        rateLimits.set(key, entry);
        return false;
    }
    entry.count++;
    entry.lastAt = now;
    rateLimits.set(key, entry);
    return true;
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

function getGeminiApiKey() {
    return String(process.env.GEMINI_API_KEY || '').trim();
}

function getMediaModel(envName) {
    const value = String(process.env[envName] || 'gemini-3.6-flash').trim();
    if (!/^[a-zA-Z0-9._-]{1,100}$/.test(value)) throw new Error(`${envName} contains an invalid model identifier`);
    return value;
}

function extractGenerateContentText(data) {
    const parts = data?.candidates?.[0]?.content?.parts;
    return Array.isArray(parts)
        ? parts.map(part => typeof part?.text === 'string' ? part.text : '').join('').trim()
        : '';
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
    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
    const model = getMediaModel('GEMINI_VISION_MODEL');
    const image = await sharp(imageBuffer, { animated: false })
        .rotate()
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 76, mozjpeg: true })
        .toBuffer();
    const { data } = await axios.post(
        `${GEMINI_MODELS_ENDPOINT}/${encodeURIComponent(model)}:generateContent`,
        {
            contents: [{
                role: 'user',
                parts: [
                    { text: 'Describe this WhatsApp sticker briefly and neutrally. Include its visible text, expression, gesture, and obvious emotional tone. Do not guess the sender’s intention. Return only the description.' },
                    { inline_data: { mime_type: 'image/jpeg', data: image.toString('base64') } }
                ]
            }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 120 }
        },
        {
            timeout: 15_000,
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }
        }
    );
    const description = extractGenerateContentText(data);
    if (!description) throw new Error('Gemini returned no sticker description');
    return description.slice(0, 700);
}

async function transcribeVoiceNote(audioBuffer, mimeType) {
    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
    const model = getMediaModel('GEMINI_AUDIO_MODEL');
    const { data } = await axios.post(
        GEMINI_INTERACTIONS_ENDPOINT,
        {
            model,
            input: [
                {
                    type: 'text',
                    text: 'Transcribe the spoken words accurately and verbatim. Preserve the original language, Nigerian Pidgin, Yoruba, and natural code-switching. Do not translate, summarize, explain, or add speaker labels. Return only the spoken words. If there is no intelligible speech, return [unclear].'
                },
                { type: 'audio', data: audioBuffer.toString('base64'), mime_type: mimeType }
            ]
        },
        {
            timeout: 30_000,
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }
        }
    );
    const output = String(data?.output_text || (data?.steps || [])
        .filter(step => step?.type === 'model_output')
        .flatMap(step => step?.content || [])
        .map(part => part?.text || '')
        .join('') || '').trim();
    if (!output || /^\[unclear\]$/i.test(output)) throw new Error('No intelligible speech was returned');
    return output.slice(0, 5000);
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
        if (!reserveMediaSlot(chatId, senderId, mediaType)) return false;

        activeMediaJobs++;
        try {
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

            await handleChatbotResponse(sock, chatId, syntheticMessage, chatbotText, senderId);
            printLog('info', `[Chatbot Media] Processed ${mediaType} message successfully.`);
            return true;
        } finally {
            activeMediaJobs = Math.max(0, activeMediaJobs - 1);
        }
    } catch (error) {
        printLog('warning', `[Chatbot Media] Processing failed type=${mediaType} code=${error?.response?.status || error?.code || 'unknown'}`);
        return false;
    }
}

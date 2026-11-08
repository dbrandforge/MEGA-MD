/**
 * Soft Mute System
 * - .mute @user  → mute for 10 hours (deletes their messages)
 * - .unmute @user
 * - Auto-mute after 3 warnings
 * Works without special WhatsApp restrict permission
 */
import store from '../lib/lightweight_store.js';
import config from '../config.js';
import { trackGroup } from './schedule.js';

const MUTE_KEY = 'softMutes';
const MUTE_DURATION_KEY = 'softMuteDurationHours';
const DEFAULT_MUTE_HOURS = Number(config.muteDurationHours) > 0 ? Number(config.muteDurationHours) : 10;

export async function getSoftMuteDurationHours(chatId) {
    const configured = Number(await store.getSetting(chatId, MUTE_DURATION_KEY));
    return Number.isFinite(configured) && configured >= 1 && configured <= 168 ? configured : DEFAULT_MUTE_HOURS;
}

function mention(jid) {
    return `@${(jid || '').split('@')[0]}`;
}

function cleanId(jid) {
    // Strip only the device suffix, preserving the JID domain so
    // device-qualified and plain PN/LID addresses share the same key.
    return String(jid || '').replace(/:\d+(?=@)/, '');
}

async function getMutes(chatId) {
    return (await store.getSetting(chatId, MUTE_KEY)) || {};
}

async function saveMutes(chatId, data) {
    const saved = await store.saveSettingVerified(chatId, MUTE_KEY, data);
    if (!saved) throw new Error('Soft-mute state could not be persisted.');
}

export async function normalizeSoftMuteUserId(sock, userId) {
    const key = cleanId(userId);
    if (!key.endsWith('@lid')) return key;
    try {
        const mappedPN = await sock?.signalRepository?.lidMapping?.getPNForLID?.(userId);
        if (typeof mappedPN === 'string' && mappedPN.endsWith('@s.whatsapp.net')) {
            return cleanId(mappedPN);
        }
    } catch (error) {
        console.warn('[SOFTMUTE] Could not resolve user LID to PN:', error.message);
    }
    return key;
}

export async function isSoftMuted(chatId, userId, sock = null) {
    const mutes = await getMutes(chatId);
    const key = cleanId(userId);
    let matchedKey = Object.hasOwn(mutes, key) ? key : (Object.hasOwn(mutes, userId) ? userId : null);
    let entry = matchedKey ? mutes[matchedKey] : null;

    // Older records may contain only a LID, while current Baileys messages
    // identify that same member by PN. Resolve stored LIDs during lookup so
    // those pre-alias records remain enforceable after identity-format changes.
    if (!entry && sock && key.endsWith('@s.whatsapp.net')) {
        for (const [storedKey, storedEntry] of Object.entries(mutes)) {
            if (!storedKey.endsWith('@lid')) continue;
            try {
                const mappedPN = await sock?.signalRepository?.lidMapping?.getPNForLID?.(storedKey);
                if (typeof mappedPN === 'string' && cleanId(mappedPN) === key) {
                    matchedKey = storedKey;
                    entry = storedEntry;
                    break;
                }
            } catch (error) {
                console.warn('[SOFTMUTE] Could not resolve stored LID during lookup:', error.message);
            }
        }
    }

    if (!entry) return false;
    const until = Number(entry.until);
    if (!Number.isFinite(until) || until <= 0 || Date.now() >= until) {
        const ids = new Set([key, cleanId(userId), matchedKey, cleanId(entry.original), cleanId(entry.canonical)]);
        for (const [storedKey, storedEntry] of Object.entries(mutes)) {
            if (ids.has(storedKey) || ids.has(cleanId(storedEntry?.original)) || ids.has(cleanId(storedEntry?.canonical))) {
                delete mutes[storedKey];
            }
        }
        await saveMutes(chatId, mutes);
        return false;
    }
    return true;
}

export async function softMuteUser(sock, chatId, userId, hours = null) {
    const durationHours = Number.isFinite(Number(hours)) && Number(hours) > 0 ? Number(hours) : await getSoftMuteDurationHours(chatId);
    const duration = durationHours * 60 * 60 * 1000;
    const mutes = await getMutes(chatId);
    const key = cleanId(userId);
    const canonicalKey = await normalizeSoftMuteUserId(sock, userId);
    const entry = {
        until: Date.now() + duration,
        mutedAt: Date.now(),
        original: userId,
        canonical: canonicalKey
    };
    mutes[key] = entry;
    // Store a canonical PN alias as well so incoming PN-resolved messages
    // still match a target that was mentioned using a Baileys LID.
    if (canonicalKey !== key) mutes[canonicalKey] = entry;
    await saveMutes(chatId, mutes);
    // The scheduler must know every group that contains an individual mute.
    await trackGroup(chatId);
    return duration;
}

export async function cleanExpiredSoftMutes(chatId, now = Date.now()) {
    if (!chatId?.endsWith('@g.us')) return 0;
    const mutes = await getMutes(chatId);
    let removed = 0;
    const removedIds = new Set();
    for (const [key, entry] of Object.entries(mutes)) {
        const until = Number(entry?.until);
        if (!Number.isFinite(until) || until <= 0 || now >= until) {
            removedIds.add(cleanId(entry?.canonical || entry?.original || key));
            delete mutes[key];
        }
    }
    removed = removedIds.size;
    if (removed) await saveMutes(chatId, mutes);
    return removed;
}

export async function softUnmuteUser(chatId, userId) {
    const mutes = await getMutes(chatId);
    const key = cleanId(userId);
    for (const [storedKey, entry] of Object.entries(mutes)) {
        const originalKey = cleanId(entry?.original);
        const canonicalKey = cleanId(entry?.canonical);
        if (storedKey === key || storedKey === userId || originalKey === key || canonicalKey === key) {
            delete mutes[storedKey];
        }
    }
    await saveMutes(chatId, mutes);
}

/**
 * Call this on every group message - delete if user is soft-muted
 */
export async function handleSoftMuteMessage(sock, chatId, message, senderId) {
    try {
        if (!chatId?.endsWith('@g.us')) return false;
        if (message.key.fromMe) return false;

        const muted = await isSoftMuted(chatId, senderId, sock);
        if (!muted) return false;

        // Delete their message
        try {
            await sock.sendMessage(chatId, { delete: message.key });
        } catch (e) {
            // Bot needs admin + delete permission
            console.error('Could not delete muted user message:', e.message);
        }
        return true;
    } catch (e) {
        return false;
    }
}

export default {
    command: 'softmute',
    aliases: ['smute'],
    category: 'admin',
    description: 'Mute a user for 10 hours (soft mute - deletes their messages)',
    usage: '.softmute @user',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo } = context;

        let userToMute = null;
        const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (mentioned.length > 0) {
            userToMute = mentioned[0];
        } else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            userToMute = message.message.extendedTextMessage.contextInfo.participant;
        }

        if (!userToMute) {
            return sock.sendMessage(chatId, {
                text: 'Tag or reply to the user you want to mute.\nExample: *.mute @user*',
                ...channelInfo
            }, { quoted: message });
        }

        const duration = await softMuteUser(sock, chatId, userToMute);
        const hours = duration / (60 * 60 * 1000);

        await sock.sendMessage(chatId, {
            text: `🔇 ${mention(userToMute)} has been *soft-muted for ${hours} hours*.\n\nTheir messages will be automatically deleted until the mute expires.\n\nUse *.unmute @user* to unmute early.`,
            mentions: [userToMute],
            ...channelInfo
        }, { quoted: message });
    }
};

export const unmuteCmd = {
    command: 'unmute',
    aliases: ['unsoftmute'],
    category: 'admin',
    description: 'Unmute a soft-muted user',
    usage: '.unmute @user',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo } = context;

        let user = null;
        const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (mentioned.length > 0) user = mentioned[0];
        else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            user = message.message.extendedTextMessage.contextInfo.participant;
        }

        if (!user) {
            return sock.sendMessage(chatId, {
                text: 'Tag or reply to the user to unmute.\nExample: *.unmute @user*',
                ...channelInfo
            }, { quoted: message });
        }

        await softUnmuteUser(chatId, user);

        await sock.sendMessage(chatId, {
            text: `🔊 ${mention(user)} has been unmuted.`,
            mentions: [user],
            ...channelInfo
        }, { quoted: message });
    }
};

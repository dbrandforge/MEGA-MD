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

const muteCache = new Map();
const MUTE_CACHE_TTL_MS = 10000;
const MAX_CACHED_MUTE_GROUPS = 500;

function cacheMutes(chatId, value) {
    muteCache.delete(chatId);
    muteCache.set(chatId, { value, at: Date.now() });
    while (muteCache.size > MAX_CACHED_MUTE_GROUPS) {
        muteCache.delete(muteCache.keys().next().value);
    }
}

export function invalidateSoftMuteCache(chatId = null) {
    if (chatId) muteCache.delete(chatId);
    else { muteCache.clear(); counterpartCache.clear(); }
}

async function getMutes(chatId) {
    const cached = muteCache.get(chatId);
    if (cached && Date.now() - cached.at < MUTE_CACHE_TTL_MS) return cached.value;
    const value = (await store.getSetting(chatId, MUTE_KEY)) || {};
    cacheMutes(chatId, value);
    return value;
}

async function saveMutes(chatId, data) {
    const saved = await store.saveSettingVerified(chatId, MUTE_KEY, data);
    if (!saved) throw new Error('Soft-mute state could not be persisted.');
    cacheMutes(chatId, data);
}

// Counterpart lookups (LID <-> PN) are cached, including misses, so a busy
// group never repeats the same mapping lookup for the same member. Only a
// handful of mutes ever exist, so this stays tiny and bounded.
const counterpartCache = new Map();
const COUNTERPART_HIT_TTL_MS = 10 * 60 * 1000;
const COUNTERPART_MISS_TTL_MS = 60 * 1000;
const COUNTERPART_CACHE_MAX = 1000;

async function resolveCounterpart(sock, id, { fresh = false } = {}) {
    if (!sock || !id) return null;
    const cached = fresh ? null : counterpartCache.get(id);
    if (cached && Date.now() - cached.at < (cached.value ? COUNTERPART_HIT_TTL_MS : COUNTERPART_MISS_TTL_MS)) return cached.value;
    let value = null;
    try {
        const mapping = sock.signalRepository?.lidMapping;
        if (id.endsWith('@lid')) {
            const pn = await mapping?.getPNForLID?.(id);
            if (typeof pn === 'string' && pn.endsWith('@s.whatsapp.net')) value = cleanId(pn);
        } else if (id.endsWith('@s.whatsapp.net')) {
            const lid = await mapping?.getLIDForPN?.(id);
            if (typeof lid === 'string' && lid.endsWith('@lid')) value = cleanId(lid);
        }
    } catch (error) {
        console.warn('[SOFTMUTE] Could not resolve identity counterpart:', error.message);
    }
    counterpartCache.delete(id);
    counterpartCache.set(id, { value, at: Date.now() });
    while (counterpartCache.size > COUNTERPART_CACHE_MAX) counterpartCache.delete(counterpartCache.keys().next().value);
    return value;
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

export async function isSoftMuted(chatId, userId, sock = null, extraIds = []) {
    const mutes = await getMutes(chatId);
    // Almost every group has no active mute: exit before doing any work.
    if (!mutes || Object.keys(mutes).length === 0) return false;

    // Match on every identifier the message carries (resolved PN, raw LID,
    // alternate PN) before falling back to any mapping lookup.
    const ids = [...new Set([cleanId(userId), userId, ...extraIds.map(cleanId)].filter(id => typeof id === 'string' && id))];
    let matchedKey = null;
    for (const id of ids) {
        if (Object.hasOwn(mutes, id)) { matchedKey = id; break; }
    }

    if (!matchedKey && sock) {
        // Sender arrived as a LID but the mute was stored under its PN.
        for (const id of ids.filter(i => i.endsWith('@lid'))) {
            const pn = await resolveCounterpart(sock, id);
            if (pn && Object.hasOwn(mutes, pn)) { matchedKey = pn; break; }
        }
    }
    if (!matchedKey && sock && ids.some(i => i.endsWith('@s.whatsapp.net'))) {
        // Older records may contain only a LID while the message identifies the
        // same member by PN. Resolve each stored LID (cached) and compare.
        for (const storedKey of Object.keys(mutes)) {
            if (!storedKey.endsWith('@lid')) continue;
            const pn = await resolveCounterpart(sock, storedKey);
            if (pn && ids.includes(pn)) { matchedKey = storedKey; break; }
        }
    }

    const entry = matchedKey ? mutes[matchedKey] : null;
    if (!entry) return false;
    const until = Number(entry.until);
    if (!Number.isFinite(until) || until <= 0 || Date.now() >= until) {
        const idSet = new Set([...ids, matchedKey, cleanId(entry.original), cleanId(entry.canonical)]);
        for (const [storedKey, storedEntry] of Object.entries(mutes)) {
            if (idSet.has(storedKey) || idSet.has(cleanId(storedEntry?.original)) || idSet.has(cleanId(storedEntry?.canonical))) {
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
    // Resolve the other identity format once, now, so later messages match with
    // a plain lookup instead of a mapping call on every message.
    for (const id of [key, canonicalKey]) {
        const other = await resolveCounterpart(sock, id, { fresh: true });
        if (other && !Object.hasOwn(mutes, other)) mutes[other] = entry;
    }
    await saveMutes(chatId, mutes);
    // The scheduler must know every group that contains an individual mute.
    await trackGroup(chatId);
    return duration;
}

export async function cleanExpiredSoftMutes(chatId, now = Date.now(), { sock = null } = {}) {
    if (!chatId?.endsWith('@g.us')) return 0;
    const mutes = await getMutes(chatId);
    const removedIds = new Map(); // member id -> JID to mention
    for (const [key, entry] of Object.entries(mutes)) {
        const until = Number(entry?.until);
        if (!Number.isFinite(until) || until <= 0 || now >= until) {
            const id = cleanId(entry?.canonical || entry?.original || key);
            if (!removedIds.has(id)) removedIds.set(id, entry?.original || entry?.canonical || key);
            delete mutes[key];
        }
    }
    const removed = removedIds.size;
    if (removed) {
        await saveMutes(chatId, mutes);
        if (sock) {
            // Best effort: tell the group the mute ended. Never blocks cleanup.
            try {
                const jids = [...removedIds.values()].slice(0, 10);
                await sock.sendMessage(chatId, {
                    text: `🔊 Soft-mute expired for ${jids.map(mention).join(', ')}. They can send messages again.`,
                    mentions: jids
                });
            } catch (error) {
                console.warn('[SOFTMUTE] Could not announce mute expiry:', error.message);
            }
        }
    }
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

const deleteFailureLoggedAt = new Map();

/**
 * Call this on every group message - delete if user is soft-muted
 */
export async function handleSoftMuteMessage(sock, chatId, message, senderId) {
    try {
        if (!chatId?.endsWith('@g.us')) return false;
        if (message.key.fromMe) return false;

        const muted = await isSoftMuted(chatId, senderId, sock, [message.key.participant, message.key.participantAlt]);
        if (!muted) return false;

        // Delete their message
        try {
            await sock.sendMessage(chatId, { delete: message.key });
        } catch (e) {
            // Bot needs admin + delete permission. Log at most once a minute per group.
            const last = deleteFailureLoggedAt.get(chatId) || 0;
            if (Date.now() - last > 60000) {
                deleteFailureLoggedAt.set(chatId, Date.now());
                console.error(`[SOFTMUTE] Could not delete muted user message in ${chatId}: ${e.message}`);
            }
        }
        return true;
    } catch (e) {
        console.error('[SOFTMUTE] Mute check failed:', e.message);
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

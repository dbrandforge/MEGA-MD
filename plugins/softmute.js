/**
 * Per-member soft mute records.
 * Message checks read only the sender's identifiers; no group-wide mute map.
 */
import store from '../lib/lightweight_store.js';
import config from '../config.js';
import { trackGroup } from './schedule.js';

const LEGACY_MUTE_KEY = 'softMutes';
const MIGRATION_KEY = 'softMutesMigratedToIndividual';
const MUTE_DURATION_KEY = 'softMuteDurationHours';
const RECORD_PREFIX = 'softMute:';
const DEFAULT_MUTE_HOURS = Number(config.muteDurationHours) > 0 ? Number(config.muteDurationHours) : 10;

export async function getSoftMuteDurationHours(chatId) {
    const configured = Number(await store.getSetting(chatId, MUTE_DURATION_KEY));
    return Number.isFinite(configured) && configured >= 1 && configured <= 168 ? configured : DEFAULT_MUTE_HOURS;
}

export function parseMuteDuration(token) {
    const value = String(token || '').trim().toLowerCase();
    if (!value) return null;
    if (/^\d+$/.test(value)) {
        const minutes = Number(value);
        return Number.isSafeInteger(minutes) && minutes > 0 && minutes <= 10080 ? minutes * 60000 : null;
    }
    const pattern = /^(?:\d+d)?(?:\d+h)?(?:\d+m)?(?:\d+s)?$/;
    if (!pattern.test(value) || !/\d/.test(value)) return null;
    const parts = [...value.matchAll(/(\d+)([dhms])/g)];
    if (!parts.length || parts.map(part => part[0]).join('') !== value) return null;
    const units = { d: 86400000, h: 3600000, m: 60000, s: 1000 };
    const duration = parts.reduce((sum, part) => sum + Number(part[1]) * units[part[2]], 0);
    return Number.isSafeInteger(duration) && duration > 0 && duration <= 7 * 86400000 ? duration : null;
}

export function formatMuteDuration(durationMs) {
    const units = [['d', 86400000, 'day'], ['h', 3600000, 'hour'], ['m', 60000, 'minute'], ['s', 1000, 'second']];
    let remaining = Math.max(0, Number(durationMs) || 0);
    const parts = [];
    for (const [suffix, size, label] of units) {
        const count = Math.floor(remaining / size);
        if (count) {
            parts.push(`${count} ${label}${count === 1 ? '' : 's'}`);
            remaining %= size;
        }
    }
    return parts.join(' ') || 'less than a second';
}

function mention(jid) { return `@${(jid || '').split('@')[0]}`; }
function cleanId(jid) { return String(jid || '').replace(/:\\d+(?=@)/, ''); }
function recordKey(jid) { return RECORD_PREFIX + cleanId(jid); }

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
    const mappedPN = await resolveCounterpart(sock, key);
    return mappedPN || key;
}

// One-time compatibility migration only. All live reads/writes after this are per member.
const migratedGroups = new Set();
const migrationPromises = new Map();
async function ensureLegacyMuteMigration(chatId) {
    if (migratedGroups.has(chatId)) return;
    if (migrationPromises.has(chatId)) return migrationPromises.get(chatId);
    const promise = (async () => {
        if (await store.getSetting(chatId, MIGRATION_KEY) === true) {
            migratedGroups.add(chatId);
            return;
        }
        const legacy = (await store.getSetting(chatId, LEGACY_MUTE_KEY)) || {};
        for (const [key, entry] of Object.entries(legacy)) {
            if (!entry || !Number.isFinite(Number(entry.until)) || Number(entry.until) <= Date.now()) continue;
            const ids = [...new Set([key, entry.original, entry.canonical].map(cleanId).filter(Boolean))];
            for (const id of ids) {
                if (!await store.saveSettingVerified(chatId, recordKey(id), entry)) {
                    throw new Error('Legacy soft-mute migration could not be verified.');
                }
            }
        }
        if (!await store.saveSettingVerified(chatId, MIGRATION_KEY, true)) {
            throw new Error('Soft-mute migration marker could not be verified.');
        }
        migratedGroups.add(chatId);
    })();
    migrationPromises.set(chatId, promise);
    try { await promise; } finally { migrationPromises.delete(chatId); }
}

async function getRecord(chatId, id) {
    if (!id) return null;
    return await store.getSetting(chatId, recordKey(id));
}
async function saveRecord(chatId, id, value) {
    if (!id) return;
    if (!await store.saveSettingVerified(chatId, recordKey(id), value)) {
        throw new Error('Soft-mute record could not be persisted.');
    }
}

export async function isSoftMuted(chatId, userId, sock = null, extraIds = []) {
    if (!chatId?.endsWith('@g.us')) return false;
    await ensureLegacyMuteMigration(chatId);
    const ids = [...new Set([userId, ...extraIds].map(cleanId).filter(Boolean))];
    const expanded = new Set(ids);
    if (sock) {
        for (const id of ids) {
            const counterpart = await resolveCounterpart(sock, id);
            if (counterpart) expanded.add(counterpart);
        }
    }
    for (const id of expanded) {
        const entry = await getRecord(chatId, id);
        if (!entry) continue;
        const until = Number(entry.until);
        if (Number.isFinite(until) && until > Date.now()) return true;
        await saveRecord(chatId, id, null);
    }
    return false;
}

export async function softMuteUser(sock, chatId, userId, durationMs = null) {
    await ensureLegacyMuteMigration(chatId);
    const duration = Number.isFinite(Number(durationMs)) && Number(durationMs) > 0
        ? Math.min(Number(durationMs), 7 * 86400000)
        : (await getSoftMuteDurationHours(chatId)) * 3600000;
    const key = cleanId(userId);
    const canonicalKey = await normalizeSoftMuteUserId(sock, userId);
    const ids = new Set([key, canonicalKey]);
    for (const id of [...ids]) {
        const other = await resolveCounterpart(sock, id, { fresh: true });
        if (other) ids.add(other);
    }
    const entry = { until: Date.now() + duration, mutedAt: Date.now(), original: userId, canonical: canonicalKey };
    for (const id of ids) await saveRecord(chatId, id, entry);
    await trackGroup(chatId);
    return duration;
}

export async function softUnmuteUser(chatId, userId, sock = global.__forgeSock) {
    await ensureLegacyMuteMigration(chatId);
    const ids = new Set([cleanId(userId)]);
    const counterpart = await resolveCounterpart(sock, cleanId(userId));
    if (counterpart) ids.add(counterpart);
    for (const id of [...ids]) {
        const other = await resolveCounterpart(sock, id);
        if (other) ids.add(other);
    }
    for (const id of ids) await saveRecord(chatId, id, null);
}

// Expiry is enforced lazily on the next message from that member. No group-wide scan.
export async function cleanExpiredSoftMutes() { return 0; }

const deleteFailureLoggedAt = new Map();
export async function handleSoftMuteMessage(sock, chatId, message, senderId) {
    try {
        if (!chatId?.endsWith('@g.us') || message?.key?.fromMe) return false;
        const muted = await isSoftMuted(chatId, senderId, sock, [message.key.participant, message.key.participantAlt]);
        if (!muted) return false;
        try {
            await sock.sendMessage(chatId, { delete: message.key });
        } catch (error) {
            const last = deleteFailureLoggedAt.get(chatId) || 0;
            if (Date.now() - last > 60000) {
                deleteFailureLoggedAt.set(chatId, Date.now());
                console.error(`[SOFTMUTE] Could not delete muted user message in group: ${error.message}`);
            }
        }
        return true;
    } catch (error) {
        console.error('[SOFTMUTE] Mute check failed:', error.message);
        return false;
    }
}

export default {
    command: 'softmute',
    aliases: ['smute'],
    category: 'admin',
    description: 'Soft-mute a user for a chosen duration; their messages are deleted',
    usage: '.softmute @user [15m|1h|1h30m|2d]',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo } = context;
        const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const userToMute = mentioned[0] || message.message?.extendedTextMessage?.contextInfo?.participant;
        if (!userToMute) {
            return sock.sendMessage(chatId, { text: 'Tag or reply to the user. Example: *.softmute @user 15m*', ...channelInfo }, { quoted: message });
        }
        const durationToken = [...args].reverse().find(arg => /^(?:\d+[dhms])+$/i.test(String(arg)));
        const durationMs = durationToken ? parseMuteDuration(durationToken) : null;
        if (durationToken && !durationMs) {
            return sock.sendMessage(chatId, { text: 'Invalid duration. Use 15m, 1h, 1h30m or 2d (maximum 7 days).', ...channelInfo }, { quoted: message });
        }
        const duration = await softMuteUser(sock, chatId, userToMute, durationMs);
        await sock.sendMessage(chatId, {
            text: `🔇 ${mention(userToMute)} has been soft-muted for *${formatMuteDuration(duration)}*. Their messages will be deleted automatically.`,
            mentions: [userToMute], ...channelInfo
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
        const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const user = mentioned[0] || message.message?.extendedTextMessage?.contextInfo?.participant;
        if (!user) {
            return sock.sendMessage(chatId, { text: 'Tag or reply to the user to unmute.', ...channelInfo }, { quoted: message });
        }
        await softUnmuteUser(chatId, user, sock);
        await sock.sendMessage(chatId, { text: `🔊 ${mention(user)} has been unmuted.`, mentions: [user], ...channelInfo }, { quoted: message });
    }
};

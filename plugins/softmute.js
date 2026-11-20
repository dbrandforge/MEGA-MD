/**
 * Per-member soft mute records.
 * A tiny group-level active-count flag skips all per-member lookups when no one is muted.
 */
import store from '../lib/lightweight_store.js';
import config from '../config.js';
import { trackGroup } from './schedule.js';

const LEGACY_MUTE_KEY = 'softMutes';
const MIGRATION_KEY = 'softMutesMigratedToIndividual';
const ACTIVE_COUNT_KEY = 'softMuteActiveCount';
const ACTIVE_UNTIL_KEY = 'softMuteActiveUntil';
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
    if (!/^(?:\d+d)?(?:\d+h)?(?:\d+m)?(?:\d+s)?$/.test(value) || !/\d/.test(value)) return null;
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
    for (const [, size, label] of units) {
        const count = Math.floor(remaining / size);
        if (count) {
            parts.push(`${count} ${label}${count === 1 ? '' : 's'}`);
            remaining %= size;
        }
    }
    return parts.join(' ') || 'less than a second';
}

function mention(jid) { return `@${(jid || '').split('@')[0]}`; }
function cleanId(jid) { return String(jid || '').replace(/:\d+(?=@)/, ''); }
function recordKey(jid) { return RECORD_PREFIX + cleanId(jid); }

const counterpartCache = new Map();
const COUNTERPART_HIT_TTL_MS = 10 * 60 * 1000;
const COUNTERPART_MISS_TTL_MS = 60 * 1000;
const COUNTERPART_CACHE_MAX = 1000;
const memberMuteCache = new Map();
const MEMBER_CACHE_TTL_MS = 10000;
const MEMBER_CACHE_MAX = 3000;
const groupCountCache = new Map();
const GROUP_COUNT_CACHE_TTL_MS = 5000;
const migrationPromises = new Map();
const migratedGroups = new Set();
const groupCountQueues = new Map();

function cacheMember(chatId, userId, value) {
    const key = `${chatId}:${cleanId(userId)}`;
    memberMuteCache.delete(key);
    memberMuteCache.set(key, { value, at: Date.now() });
    while (memberMuteCache.size > MEMBER_CACHE_MAX) memberMuteCache.delete(memberMuteCache.keys().next().value);
}
function cachedMember(chatId, userId) {
    const key = `${chatId}:${cleanId(userId)}`;
    const item = memberMuteCache.get(key);
    if (!item || Date.now() - item.at >= MEMBER_CACHE_TTL_MS) {
        memberMuteCache.delete(key);
        return undefined;
    }
    memberMuteCache.delete(key);
    memberMuteCache.set(key, item);
    return item.value;
}
function invalidateMember(chatId, userId) { memberMuteCache.delete(`${chatId}:${cleanId(userId)}`); }
function invalidateGroupCount(chatId) { groupCountCache.delete(chatId); }

async function getActiveCount(chatId) {
    const cached = groupCountCache.get(chatId);
    if (cached && Date.now() - cached.at < GROUP_COUNT_CACHE_TTL_MS) return cached.value;
    const [storedCount, storedUntil] = await Promise.all([
        store.getSetting(chatId, ACTIVE_COUNT_KEY),
        store.getSetting(chatId, ACTIVE_UNTIL_KEY)
    ]);
    const value = Number(storedUntil) > 0 && Number(storedUntil) <= Date.now()
        ? 0
        : Math.max(0, Number(storedCount) || 0);
    groupCountCache.set(chatId, { value, at: Date.now() });
    return value;
}
async function setActiveCount(chatId, value, until = null) {
    const count = Math.max(0, Number(value) || 0);
    if (!await store.saveSettingVerified(chatId, ACTIVE_COUNT_KEY, count)) {
        throw new Error('Soft-mute active count could not be persisted.');
    }
    if (count === 0) {
        if (!await store.saveSettingVerified(chatId, ACTIVE_UNTIL_KEY, 0)) {
            throw new Error('Soft-mute active expiry could not be cleared.');
        }
    } else if (Number.isFinite(Number(until)) && Number(until) > 0) {
        const previousUntil = Number(await store.getSetting(chatId, ACTIVE_UNTIL_KEY)) || 0;
        if (!await store.saveSettingVerified(chatId, ACTIVE_UNTIL_KEY, Math.max(previousUntil, Number(until)))) {
            throw new Error('Soft-mute active expiry could not be persisted.');
        }
    }
    groupCountCache.set(chatId, { value: count, at: Date.now() });
}

function withGroupCountLock(chatId, operation) {
    const previous = groupCountQueues.get(chatId) || Promise.resolve();
    const current = previous.then(operation, operation);
    const queued = current.then(() => undefined, () => undefined);
    groupCountQueues.set(chatId, queued);
    return current.finally(() => {
        if (groupCountQueues.get(chatId) === queued) groupCountQueues.delete(chatId);
    });
}

async function adjustActiveCount(chatId, delta, until = null) {
    return withGroupCountLock(chatId, async () => {
        const current = await getActiveCount(chatId);
        await setActiveCount(chatId, current + delta, until);
    });
}

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
    return (await resolveCounterpart(sock, key)) || key;
}

// One-time compatibility migration. The old group map is read only during migration;
// afterward all message checks are a count check plus the sender's own record.
async function ensureLegacyMuteMigration(chatId) {
    if (migratedGroups.has(chatId)) return;
    if (migrationPromises.has(chatId)) return migrationPromises.get(chatId);
    const promise = (async () => {
        if (await store.getSetting(chatId, MIGRATION_KEY) === true) {
            migratedGroups.add(chatId);
            return;
        }
        const legacy = (await store.getSetting(chatId, LEGACY_MUTE_KEY)) || {};
        const migrated = new Map();
        for (const [key, entry] of Object.entries(legacy)) {
            if (!entry || !Number.isFinite(Number(entry.until)) || Number(entry.until) <= Date.now()) continue;
            const id = cleanId(entry.canonical || entry.original || key);
            if (id) migrated.set(id, entry);
        }
        for (const [id, entry] of migrated) {
            if (!await store.saveSettingVerified(chatId, recordKey(id), entry)) {
                throw new Error('Legacy soft-mute migration could not be verified.');
            }
        }
        if (!await store.saveSettingVerified(chatId, ACTIVE_COUNT_KEY, migrated.size)) {
            throw new Error('Soft-mute migration count could not be verified.');
        }
        const latestExpiry = Math.max(0, ...[...migrated.values()].map(entry => Number(entry.until) || 0));
        if (!await store.saveSettingVerified(chatId, ACTIVE_UNTIL_KEY, latestExpiry)) {
            throw new Error('Soft-mute migration expiry could not be verified.');
        }
        if (!await store.saveSettingVerified(chatId, MIGRATION_KEY, true)) {
            throw new Error('Soft-mute migration marker could not be verified.');
        }
        groupCountCache.set(chatId, { value: migrated.size, at: Date.now() });
        migratedGroups.add(chatId);
    })();
    migrationPromises.set(chatId, promise);
    try { await promise; } finally { migrationPromises.delete(chatId); }
}

async function getRecord(chatId, userId) {
    const cached = cachedMember(chatId, userId);
    if (cached !== undefined) return cached;
    const value = await store.getSetting(chatId, recordKey(userId));
    cacheMember(chatId, userId, value || null);
    return value || null;
}
async function saveRecord(chatId, userId, value) {
    if (!await store.saveSettingVerified(chatId, recordKey(userId), value)) {
        throw new Error('Soft-mute record could not be persisted.');
    }
    cacheMember(chatId, userId, value || null);
}

export async function isSoftMuted(chatId, userId, sock = null, extraIds = []) {
    if (!chatId?.endsWith('@g.us')) return false;
    await ensureLegacyMuteMigration(chatId);
    if ((await getActiveCount(chatId)) <= 0) return false;

    const ids = [...new Set([userId, ...extraIds].map(cleanId).filter(Boolean))];
    const canonicalIds = new Set();
    for (const id of ids) {
        canonicalIds.add(await normalizeSoftMuteUserId(sock, id));
        const counterpart = await resolveCounterpart(sock, id);
        if (counterpart) canonicalIds.add(counterpart);
    }
    for (const id of canonicalIds) {
        const entry = await getRecord(chatId, id);
        if (!entry) continue;
        if (Number(entry.until) > Date.now()) return true;
        await saveRecord(chatId, id, null);
        await adjustActiveCount(chatId, -1);
    }
    return false;
}

export async function softMuteUser(sock, chatId, userId, durationMs = null) {
    await ensureLegacyMuteMigration(chatId);
    const duration = Number.isFinite(Number(durationMs)) && Number(durationMs) > 0
        ? Math.min(Number(durationMs), 7 * 86400000)
        : (await getSoftMuteDurationHours(chatId)) * 3600000;
    const canonicalKey = await normalizeSoftMuteUserId(sock, userId);
    const existing = await getRecord(chatId, canonicalKey);
    const now = Date.now();
    const entry = { until: now + duration, mutedAt: now, original: userId, canonical: canonicalKey };
    await saveRecord(chatId, canonicalKey, entry);
    if (!existing || Number(existing.until) <= now) {
        await adjustActiveCount(chatId, 1, entry.until);
    }
    await trackGroup(chatId);
    return duration;
}

export async function softUnmuteUser(chatId, userId, sock = global.__forgeSock) {
    await ensureLegacyMuteMigration(chatId);
    const canonicalKey = await normalizeSoftMuteUserId(sock, userId);
    const ids = new Set([canonicalKey]);
    const counterpart = await resolveCounterpart(sock, canonicalKey);
    if (counterpart) ids.add(counterpart);
    for (const id of ids) {
        const existing = await getRecord(chatId, id);
        if (!existing) continue;
        await saveRecord(chatId, id, null);
        await setActiveCount(chatId, Math.max(0, (await getActiveCount(chatId)) - 1));
        break;
    }
}

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
        const durationToken = [...args].reverse().find(arg => /^\d+(?:[dhms]\d*)*$/i.test(String(arg)));
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

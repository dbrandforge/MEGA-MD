/**
 * Per-member gender records. Members choose once; only admins may change it.
 * Legacy global-map data is migrated once, then every live lookup is per person.
 */
import store from '../lib/lightweight_store.js';
import { resumePendingGenderGame } from '../lib/genderGameContinuation.js';
import { getWhatsAppIdentity } from '../lib/whatsappIdentity.js';

const LEGACY_GENDER_KEY = 'userGenders';
const MIGRATION_KEY = 'userGendersMigratedToIndividual';
const GENDER_RECORD_KEY = 'gender';
let migrationChecked = false;
let migrationPromise = null;
const userMutationQueues = new Map();

async function ensureLegacyGenderMigration() {
    if (migrationChecked) return;
    if (migrationPromise) return migrationPromise;
    migrationPromise = (async () => {
        if (await store.getSetting('global', MIGRATION_KEY) === true) {
            migrationChecked = true;
            return;
        }
        const legacy = (await store.getSetting('global', LEGACY_GENDER_KEY)) || {};
        if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
            for (const [userId, gender] of Object.entries(legacy)) {
                if (!userId || !['guy', 'lady'].includes(String(gender).toLowerCase())) continue;
                if (!await store.saveSettingVerified(userId, GENDER_RECORD_KEY, String(gender).toLowerCase())) {
                    throw new Error('Legacy gender migration could not be verified.');
                }
            }
        }
        if (!await store.saveSettingVerified('global', MIGRATION_KEY, true)) {
            throw new Error('Gender migration marker could not be verified.');
        }
        // The per-member copies are verified; retire the legacy group-wide map.
        await store.saveSettingVerified('global', LEGACY_GENDER_KEY, null);
        migrationChecked = true;
    })();
    try { await migrationPromise; } finally { migrationPromise = null; }
}

function withUserMutationLock(userKey, operation) {
    const previous = userMutationQueues.get(userKey) || Promise.resolve();
    const current = previous.then(operation, operation);
    const queued = current.then(() => undefined, () => undefined);
    userMutationQueues.set(userKey, queued);
    return current.finally(() => {
        if (userMutationQueues.get(userKey) === queued) userMutationQueues.delete(userKey);
    });
}

async function readGenderForAliases(aliases) {
    for (const alias of aliases) {
        if (!alias) continue;
        const value = await store.getSetting(alias, GENDER_RECORD_KEY);
        if (value === 'guy' || value === 'lady') return value;
    }
    return null;
}

async function persistGender(userId, gender, sock, { allowChange = false } = {}) {
    const normalizedGender = String(gender || '').toLowerCase();
    if (normalizedGender !== 'guy' && normalizedGender !== 'lady') {
        return { ok: false, reason: 'invalid_gender' };
    }
    await ensureLegacyGenderMigration();
    const identity = await getWhatsAppIdentity(sock, userId);
    if (!identity.canonical) return { ok: false, reason: 'identity' };

    return withUserMutationLock(identity.canonical, async () => {
        const existing = await readGenderForAliases(identity.aliases);
        if (existing && existing !== normalizedGender && !allowChange) {
            return { ok: false, reason: 'locked', existing };
        }
        // Store only this person's aliases as individual setting records.
        for (const alias of new Set([identity.canonical, ...identity.aliases])) {
            if (!alias) continue;
            if (!await store.saveSettingVerified(alias, GENDER_RECORD_KEY, normalizedGender)) {
                throw new Error('Saved gender could not be verified in storage.');
            }
        }
        return { ok: true, existing };
    });
}

export async function getUserGender(userId, sock = global.__forgeSock) {
    await ensureLegacyGenderMigration();
    const identity = await getWhatsAppIdentity(sock, userId);
    if (!identity.canonical) return null;
    return readGenderForAliases(identity.aliases);
}

export async function setUserGender(userId, gender, sock = global.__forgeSock) {
    const result = await persistGender(userId, gender, sock, { allowChange: true });
    return result.ok;
}

export async function getOppositeGender(userId) {
    const gender = await getUserGender(userId);
    if (gender === 'guy') return 'lady';
    if (gender === 'lady') return 'guy';
    return null;
}

function resumeGenderDependentGames(sock, chatId, target, message, channelInfo) {
    void (async () => {
        try {
            const { resumeHotSeatPlayer } = await import('./hotseat.js');
            await resumeHotSeatPlayer(sock, chatId, target);
        } catch (error) {
            console.error('Hot Seat gender resume failed:', error.message);
        }
        try {
            await resumePendingGenderGame(sock, chatId, target, message, channelInfo);
        } catch (error) {
            console.error('Pending gender-game resume failed:', error.message);
        }
    })();
}

export default {
    command: 'gender',
    aliases: ['setgender', 'mygender'],
    category: 'general',
    description: 'Set or check gender (change after set = admin only)',
    usage: '.gender guy|lady | .gender | .gender @user guy (admin)',
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo, isSenderAdmin, senderIsOwnerOrSudo } = context;
        const arg0 = (args[0] || '').toLowerCase();
        const arg1 = (args[1] || '').toLowerCase();
        const isAdmin = isSenderAdmin || senderIsOwnerOrSudo;
        const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

        if (mentioned.length && (arg1 === 'guy' || arg1 === 'lady' || arg0 === 'guy' || arg0 === 'lady')) {
            if (!isAdmin) {
                return sock.sendMessage(chatId, { text: 'Only admins can change another member\'s gender.', ...channelInfo }, { quoted: message });
            }
            const target = mentioned[0];
            const gender = (arg1 === 'guy' || arg1 === 'lady') ? arg1 : arg0;
            const result = await persistGender(target, gender, sock, { allowChange: true });
            if (!result.ok) {
                return sock.sendMessage(chatId, { text: 'I could not resolve that member\'s WhatsApp identity. Please try again.', ...channelInfo }, { quoted: message });
            }
            await sock.sendMessage(chatId, {
                text: `✅ Gender for @${target.split('@')[0]} set to *${gender}* (admin).`,
                mentions: [target], ...channelInfo
            }, { quoted: message });
            resumeGenderDependentGames(sock, chatId, target, message, channelInfo);
            return;
        }

        if (!arg0) {
            const current = await getUserGender(senderId, sock);
            if (current) {
                return sock.sendMessage(chatId, {
                    text: `Your gender: *${current}*\n\nTo change it, ask an admin.\nAdmin: *.gender @you guy/lady*`,
                    ...channelInfo
                }, { quoted: message });
            }
            return sock.sendMessage(chatId, {
                text: 'No gender saved.\n\nSet once with:\n*.gender guy*\n*.gender lady*\n\nAfter that only admins can change it.',
                ...channelInfo
            }, { quoted: message });
        }

        if (arg0 !== 'guy' && arg0 !== 'lady') {
            return sock.sendMessage(chatId, { text: 'Use: *.gender guy* or *.gender lady*', ...channelInfo }, { quoted: message });
        }

        const result = await persistGender(senderId, arg0, sock, { allowChange: isAdmin });
        if (!result.ok && result.reason === 'locked') {
            return sock.sendMessage(chatId, {
                text: `Your gender is already set to *${result.existing}*.\n\nOnly an *admin* can change it.\nAsk them: *.gender @you ${arg0}*`,
                ...channelInfo
            }, { quoted: message });
        }
        if (!result.ok) {
            return sock.sendMessage(chatId, {
                text: 'I could not resolve your WhatsApp identity, so your gender was not changed. Please try again.',
                ...channelInfo
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            text: result.existing && isAdmin
                ? `✅ Gender updated to *${arg0}* (admin).`
                : `✅ Gender set to *${arg0}*.\nGames will use the correct list for you.`,
            ...channelInfo
        }, { quoted: message });
        resumeGenderDependentGames(sock, chatId, senderId, message, channelInfo);
    }
};

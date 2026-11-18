/**
 * Gender memory
 * Members can set ONCE. After that only admins can change.
 */
import store from '../lib/lightweight_store.js';
import { resumePendingGenderGame } from '../lib/genderGameContinuation.js';
import { getWhatsAppIdentity } from '../lib/whatsappIdentity.js';

const GENDER_KEY = 'userGenders';

// Serialize read/modify/write operations. The gender map is one global setting,
// so concurrent first-time registrations must not overwrite each other's updates.
let genderMutationQueue = Promise.resolve();

function withGenderMutationLock(operation) {
    const result = genderMutationQueue.then(operation, operation);
    genderMutationQueue = result.then(() => undefined, () => undefined);
    return result;
}

async function getAllGenders() {
    const value = (await store.getSetting('global', GENDER_KEY)) || {};
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

async function saveAllGenders(data) {
    if (typeof store.saveSettingVerified === 'function') {
        if (!await store.saveSettingVerified('global', GENDER_KEY, data)) {
            throw new Error('Saved gender could not be verified in storage.');
        }
        return;
    }
    await store.saveSetting('global', GENDER_KEY, data);
}

function findGenderForIdentity(all, aliases) {
    for (const key of aliases) {
        if (typeof all[key] === 'string') return all[key];
    }
    return null;
}

async function persistGender(userId, gender, sock, { allowChange = false } = {}) {
    const normalizedGender = String(gender || '').toLowerCase();
    if (normalizedGender !== 'guy' && normalizedGender !== 'lady') {
        return { ok: false, reason: 'invalid_gender' };
    }

    return withGenderMutationLock(async () => {
        // Resolve storage and WhatsApp identity concurrently, then perform one
        // read/modify/write cycle instead of repeating both lookups.
        const [all, identity] = await Promise.all([
            getAllGenders(),
            getWhatsAppIdentity(sock, userId)
        ]);
        if (!identity.canonical) return { ok: false, reason: 'identity' };

        const existing = findGenderForIdentity(all, identity.aliases);
        if (existing && existing !== normalizedGender && !allowChange) {
            return { ok: false, reason: 'locked', existing };
        }

        all[identity.canonical] = normalizedGender;
        for (const key of identity.aliases) {
            if (!String(key).includes('@') || key.endsWith('@lid')) {
                all[key] = normalizedGender;
            }
        }

        await saveAllGenders(all);
        return { ok: true, existing };
    });
}

export async function getUserGender(userId, sock = global.__forgeSock) {
    const [all, identity] = await Promise.all([
        getAllGenders(),
        getWhatsAppIdentity(sock, userId)
    ]);
    return findGenderForIdentity(all, identity.aliases);
}

export async function setUserGender(userId, gender, sock = global.__forgeSock) {
    const result = await persistGender(userId, gender, sock, { allowChange: true });
    return result.ok;
}

export async function getOppositeGender(userId) {
    const g = await getUserGender(userId);
    if (g === 'guy') return 'lady';
    if (g === 'lady') return 'guy';
    return null;
}

function resumeGenderDependentGames(sock, chatId, target, message, channelInfo) {
    // The gender confirmation is the command's critical response. Game
    // continuation is secondary work and must not hold the command queue open.
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

        // Admin changing someone else: .gender @user guy
        const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (mentioned.length && (arg1 === 'guy' || arg1 === 'lady' || arg0 === 'guy' || arg0 === 'lady')) {
            if (!isAdmin) {
                return sock.sendMessage(chatId, {
                    text: 'Only admins can change another member\'s gender.',
                    ...channelInfo
                }, { quoted: message });
            }

            const target = mentioned[0];
            const gender = (arg1 === 'guy' || arg1 === 'lady') ? arg1 : arg0;
            const result = await persistGender(target, gender, sock, { allowChange: true });
            if (!result.ok) {
                return sock.sendMessage(chatId, {
                    text: 'I could not resolve that member\'s WhatsApp identity. Please try again.',
                    ...channelInfo
                }, { quoted: message });
            }

            await sock.sendMessage(chatId, {
                text: `✅ Gender for @${target.split('@')[0]} set to *${gender}* (admin).`,
                mentions: [target],
                ...channelInfo
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
            return sock.sendMessage(chatId, {
                text: 'Use: *.gender guy* or *.gender lady*',
                ...channelInfo
            }, { quoted: message });
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

/**
 * Gender memory system
 * .gender guy | .gender lady | .gender
 * Stored per user and reused across games + chatbot
 */
import store from '../lib/lightweight_store.js';

const GENDER_KEY = 'userGenders';

function cleanId(jid) {
    return (jid || '').split(':')[0].split('@')[0];
}

async function getAllGenders() {
    return (await store.getSetting('global', GENDER_KEY)) || {};
}

async function saveAllGenders(data) {
    await store.saveSetting('global', GENDER_KEY, data);
}

export async function getUserGender(userId) {
    const all = await getAllGenders();
    const key = cleanId(userId);
    return all[key] || all[userId] || null; // 'guy' | 'lady' | null
}

export async function setUserGender(userId, gender) {
    const g = (gender || '').toLowerCase();
    if (g !== 'guy' && g !== 'lady') return false;
    const all = await getAllGenders();
    const key = cleanId(userId);
    all[key] = g;
    await saveAllGenders(all);
    return true;
}

export async function getOppositeGender(userId) {
    const g = await getUserGender(userId);
    if (g === 'guy') return 'lady';
    if (g === 'lady') return 'guy';
    return null;
}

export default {
    command: 'gender',
    aliases: ['setgender', 'mygender'],
    category: 'general',
    description: 'Set or check your gender for games',
    usage: '.gender guy | .gender lady | .gender',
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo } = context;
        const arg = (args[0] || '').toLowerCase();

        if (!arg) {
            const current = await getUserGender(senderId);
            if (current) {
                return sock.sendMessage(chatId, {
                    text: `Your saved gender is: *${current}*\n\nChange with:\n.gender guy\n.gender lady`,
                    ...channelInfo
                }, { quoted: message });
            }
            return sock.sendMessage(chatId, {
                text: `No gender saved yet.\n\nSet it with:\n*.gender guy*\n*.gender lady*\n\nThis is used for Truth/Dare, Devil's Basket and more.`,
                ...channelInfo
            }, { quoted: message });
        }

        if (arg !== 'guy' && arg !== 'lady') {
            return sock.sendMessage(chatId, {
                text: 'Use: *.gender guy* or *.gender lady*',
                ...channelInfo
            }, { quoted: message });
        }

        await setUserGender(senderId, arg);
        await sock.sendMessage(chatId, {
            text: `✅ Gender set to *${arg}*.\n\nGames will now use the correct list for you.`,
            ...channelInfo
        }, { quoted: message });
    }
};

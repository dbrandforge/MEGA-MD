/**
 * Gender memory
 * Members can set ONCE. After that only admins can change.
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
    return all[key] || all[userId] || null;
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
            const g = (arg1 === 'guy' || arg1 === 'lady') ? arg1 : arg0;
            await setUserGender(target, g);
            try { const { resumeHotSeatPlayer } = await import('./hotseat.js'); await resumeHotSeatPlayer(sock, chatId, target); } catch (error) { console.error('Hot Seat gender resume failed:', error.message); }
            return sock.sendMessage(chatId, {
                text: `✅ Gender for @${target.split('@')[0]} set to *${g}* (admin).`,
                mentions: [target],
                ...channelInfo
            }, { quoted: message });
        }

        if (!arg0) {
            const current = await getUserGender(senderId);
            if (current) {
                return sock.sendMessage(chatId, {
                    text: `Your gender: *${current}*\n\nTo change it, ask an admin.\nAdmin: *.gender @you guy/lady*`,
                    ...channelInfo
                }, { quoted: message });
            }
            return sock.sendMessage(chatId, {
                text: `No gender saved.\n\nSet once with:\n*.gender guy*\n*.gender lady*\n\nAfter that only admins can change it.`,
                ...channelInfo
            }, { quoted: message });
        }

        if (arg0 !== 'guy' && arg0 !== 'lady') {
            return sock.sendMessage(chatId, {
                text: 'Use: *.gender guy* or *.gender lady*',
                ...channelInfo
            }, { quoted: message });
        }

        const existing = await getUserGender(senderId);
        if (existing && existing !== arg0 && !isAdmin) {
            return sock.sendMessage(chatId, {
                text: `Your gender is already set to *${existing}*.\n\nOnly an *admin* can change it.\nAsk them: *.gender @you ${arg0}*`,
                ...channelInfo
            }, { quoted: message });
        }

        await setUserGender(senderId, arg0);
        try { const { resumeHotSeatPlayer } = await import('./hotseat.js'); await resumeHotSeatPlayer(sock, chatId, senderId); } catch (error) { console.error('Hot Seat gender resume failed:', error.message); }
        await sock.sendMessage(chatId, {
            text: existing && isAdmin
                ? `✅ Gender updated to *${arg0}* (admin).`
                : `✅ Gender set to *${arg0}*.\nGames will use the correct list for you.`,
            ...channelInfo
        }, { quoted: message });
    }
};

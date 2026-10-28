/**
 * Soft Mute System
 * - .mute @user  → mute for 10 hours (deletes their messages)
 * - .unmute @user
 * - Auto-mute after 3 warnings
 * Works without special WhatsApp restrict permission
 */
import store from '../lib/lightweight_store.js';
import config from '../config.js';

const MUTE_KEY = 'softMutes';
const MUTE_MS = (config.muteDurationHours || 10) * 60 * 60 * 1000;

function mention(jid) {
    return `@${(jid || '').split('@')[0]}`;
}

function cleanId(jid) {
    return (jid || '').split(':')[0];
}

async function getMutes(chatId) {
    return (await store.getSetting(chatId, MUTE_KEY)) || {};
}

async function saveMutes(chatId, data) {
    await store.saveSetting(chatId, MUTE_KEY, data);
}

export async function isSoftMuted(chatId, userId) {
    const mutes = await getMutes(chatId);
    const key = cleanId(userId);
    const entry = mutes[key] || mutes[userId];
    if (!entry) return false;
    if (Date.now() > entry.until) {
        // expired
        delete mutes[key];
        delete mutes[userId];
        await saveMutes(chatId, mutes);
        return false;
    }
    return true;
}

export async function softMuteUser(sock, chatId, userId, hours = null) {
    const duration = hours ? hours * 60 * 60 * 1000 : MUTE_MS;
    const mutes = await getMutes(chatId);
    const key = cleanId(userId);
    mutes[key] = {
        until: Date.now() + duration,
        mutedAt: Date.now(),
        original: userId
    };
    await saveMutes(chatId, mutes);
    return duration;
}

export async function softUnmuteUser(chatId, userId) {
    const mutes = await getMutes(chatId);
    const key = cleanId(userId);
    delete mutes[key];
    delete mutes[userId];
    await saveMutes(chatId, mutes);
}

/**
 * Call this on every group message - delete if user is soft-muted
 */
export async function handleSoftMuteMessage(sock, chatId, message, senderId) {
    try {
        if (!chatId?.endsWith('@g.us')) return false;
        if (message.key.fromMe) return false;

        const muted = await isSoftMuted(chatId, senderId);
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
    command: 'mute',
    aliases: ['softmute'],
    category: 'admin',
    description: 'Mute a user for 10 hours (soft mute - deletes their messages)',
    usage: '.mute @user',
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

        const hours = config.muteDurationHours || 10;
        await softMuteUser(sock, chatId, userToMute, hours);

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

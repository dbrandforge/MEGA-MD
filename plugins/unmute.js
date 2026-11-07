import { softUnmuteUser } from './softmute.js';
import store from '../lib/lightweight_store.js';
import { hasMaturedMindedFeatures } from '../lib/groupFeatureAccess.js';
import { setManualGroupUnlockOverride } from './grouplock.js';

function mention(jid) {
    return `@${(jid || '').split('@')[0]}`;
}

export default {
    command: 'unmute',
    aliases: ['unsoftmute'],
    category: 'admin',
    description: 'Unlock the group or unmute a soft-muted user',
    usage: '.unmute | .unmute @user',
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
            const previousMuteState = await store.getSetting(chatId, 'timedGroupMute');
            if (!await store.saveSettingVerified(chatId, 'timedGroupMute', { until: null, clearedAt: Date.now() })) {
                return sock.sendMessage(chatId, {
                    text: '❌ Could not persist the group-unlock state. The group was not changed.',
                    ...channelInfo
                }, { quoted: message });
            }
            try {
                await sock.groupSettingUpdate(chatId, 'not_announcement');
            } catch (error) {
                await store.saveSettingVerified(chatId, 'timedGroupMute', previousMuteState || { until: null, clearedAt: Date.now() });
                console.error('[UNMUTE] Could not unlock group:', error.message);
                return sock.sendMessage(chatId, {
                    text: '❌ Could not unlock the group. The previous mute record was restored. Make sure the bot is a group admin.',
                    ...channelInfo
                }, { quoted: message });
            }
            // Only the Matured Minded package owns the daily lock/unlock schedule.
            if (await hasMaturedMindedFeatures(chatId)) {
                try { await setManualGroupUnlockOverride(chatId); }
                catch (error) { console.error('[UNMUTE] Manual schedule override could not be saved:', error.message); }
            }
            return sock.sendMessage(chatId, {
                text: '🔊 The group has been unlocked. Members can send messages again.',
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

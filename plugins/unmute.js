import { softUnmuteUser } from './softmute.js';
import store from '../lib/lightweight_store.js';
import { isFeatureGroup } from '../lib/featureGroups.js';
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
            try {
                await sock.groupSettingUpdate(chatId, 'not_announcement');
                await store.saveSetting(chatId, 'timedGroupMute', { until: null, clearedAt: Date.now() });
                // Prevent the feature-group night scheduler from immediately reversing
                // a deliberate admin unlock performed with the inverse of .mute.
                if (isFeatureGroup(chatId)) await setManualGroupUnlockOverride(chatId);
                return sock.sendMessage(chatId, {
                    text: '🔊 The group has been unlocked. Members can send messages again.',
                    ...channelInfo
                }, { quoted: message });
            } catch (error) {
                console.error('[UNMUTE] Could not unlock group:', error.message);
                return sock.sendMessage(chatId, {
                    text: '❌ Could not unlock the group. Check the bot admin permissions and try again.',
                    ...channelInfo
                }, { quoted: message });
            }
        }

        await softUnmuteUser(chatId, user);

        await sock.sendMessage(chatId, {
            text: `🔊 ${mention(user)} has been unmuted.`,
            mentions: [user],
            ...channelInfo
        }, { quoted: message });
    }
};

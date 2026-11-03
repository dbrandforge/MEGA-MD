import { softMuteUser } from './softmute.js';
import config from '../config.js';
import store from '../lib/lightweight_store.js';
import { trackGroup } from './schedule.js';

export default {
    command: 'mute',
    aliases: ['silence'],
    category: 'admin',
    description: 'Mute the group, or soft-mute a tagged/replied user',
    usage: '.mute [duration in minutes] | .mute @user',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo } = context;
        const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const repliedUser = message.message?.extendedTextMessage?.contextInfo?.participant;
        const userToMute = mentioned[0] || repliedUser;

        // A target means individual soft mute; no target means group-wide mute.
        if (userToMute) {
            const botId = `${sock.user?.id?.split(':')[0] || ''}@s.whatsapp.net`;
            if (userToMute === botId || userToMute.endsWith('@g.us')) {
                return sock.sendMessage(chatId, { text: '❌ That account cannot be muted with this command.', ...channelInfo }, { quoted: message });
            }
            const hours = Number(config.muteDurationHours) > 0 ? Number(config.muteDurationHours) : 10;
            await softMuteUser(sock, chatId, userToMute, hours);
            return sock.sendMessage(chatId, {
                text: `🔇 @${userToMute.split('@')[0]} has been *soft-muted for ${hours} hours*. Their messages will be deleted automatically. Use *.unmute @user* to lift the mute early.`,
                mentions: [userToMute],
                ...channelInfo
            }, { quoted: message });
        }

        const durationInMinutes = args[0] ? Number(args[0]) : undefined;
        if (args[0] && (!Number.isInteger(durationInMinutes) || durationInMinutes <= 0 || durationInMinutes > 10080)) {
            return sock.sendMessage(chatId, { text: 'Use `.mute` to lock the group, `.mute 30` to lock it for 30 minutes, or `.mute @user` to mute one member.', ...channelInfo }, { quoted: message });
        }
        const previousMuteState = await store.getSetting(chatId, 'timedGroupMute');
        const nextMuteState = durationInMinutes !== undefined
            ? { until: Date.now() + durationInMinutes * 60 * 1000, startedAt: Date.now() }
            : { until: null, clearedAt: Date.now() };

        try {
            // Persist expiry before applying the WhatsApp lock so a database
            // failure cannot leave a timed mute without an unlock record.
            if (!await store.saveSettingVerified(chatId, 'timedGroupMute', nextMuteState)) {
                throw new Error('Group-mute state could not be persisted.');
            }
            try {
                await sock.groupSettingUpdate(chatId, 'announcement');
            } catch (updateError) {
                await store.saveSettingVerified(chatId, 'timedGroupMute', previousMuteState || { until: null, clearedAt: Date.now() });
                throw updateError;
            }
            await trackGroup(chatId);
            await sock.sendMessage(chatId, {
                text: durationInMinutes !== undefined
                    ? `The group has been muted for ${durationInMinutes} minutes.`
                    : 'The group has been muted.',
                ...channelInfo
            }, { quoted: message });
        } catch (error) {
            console.error('Error muting the group:', error);
            await sock.sendMessage(chatId, {
                text: 'An error occurred while muting/unmuting the group. Please try again.',
                ...channelInfo
            }, { quoted: message });
        }
        }
    }
};

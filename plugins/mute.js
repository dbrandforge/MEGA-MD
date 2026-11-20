import { softMuteUser, parseMuteDuration, formatMuteDuration } from './softmute.js';
import config from '../config.js';
import store from '../lib/lightweight_store.js';
import { trackGroup } from './schedule.js';

export default {
    command: 'mute',
    aliases: ['silence'],
    category: 'admin',
    description: 'Mute the group, or soft-mute a tagged/replied user for a chosen duration',
    usage: '.mute [30m|1h] | .mute @user [15m|1h|1h30m|2d]',
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
            const durationToken = [...args].reverse().find(arg => /^\d+(?:[dhms]\d*)*$/i.test(String(arg)));
            const durationMs = durationToken ? parseMuteDuration(durationToken) : null;
            if (durationToken && !durationMs) {
                return sock.sendMessage(chatId, { text: 'Invalid duration. Use 15m, 1h, 1h30m or 2d (maximum 7 days).', ...channelInfo }, { quoted: message });
            }
            const duration = await softMuteUser(sock, chatId, userToMute, durationMs);
            return sock.sendMessage(chatId, {
                text: `🔇 @${userToMute.split('@')[0]} has been *soft-muted for ${formatMuteDuration(duration)}*. Their messages will be deleted automatically. Use *.unmute @user* to lift the mute early.`,
                mentions: [userToMute],
                ...channelInfo
            }, { quoted: message });
        }

        if (context.isBotAdmin === false) {
            return sock.sendMessage(chatId, {
                text: '❌ I cannot lock this group because the bot is not a group admin. Promote the bot to admin, then retry. Individual soft-mutes do not require this permission.',
                ...channelInfo
            }, { quoted: message });
        }

        const durationToken = args[0];
        const durationMs = durationToken ? parseMuteDuration(durationToken) : null;
        if (durationToken && !durationMs) {
            return sock.sendMessage(chatId, { text: 'Use `.mute` to lock the group, `.mute 30m` to lock it for 30 minutes, or `.mute @user 15m` to soft-mute one member.', ...channelInfo }, { quoted: message });
        }
        const previousMuteState = await store.getSetting(chatId, 'timedGroupMute');
        const nextMuteState = durationMs !== null
            ? { until: Date.now() + durationMs, startedAt: Date.now() }
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
                text: durationMs !== null
                    ? `The group has been muted for ${formatMuteDuration(durationMs)}.`
                    : 'The group has been muted.',
                ...channelInfo
            }, { quoted: message });
        } catch (error) {
            console.error('Error muting the group:', error);
            await sock.sendMessage(chatId, {
                text: context.isBotAdmin === false
                    ? '❌ Group lock failed: the bot needs group-admin permission to change who can send messages.'
                    : `❌ Group lock error: ${String(error.message || 'WhatsApp rejected the group-setting update').slice(0, 180)}. Check that the bot is a group admin and try again.`,
                ...channelInfo
            }, { quoted: message });
        }
    }
};

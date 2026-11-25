import { handleWelcome } from '../lib/welcome.js';
import { sendWelcomePack, startWelcomeCampaign, getPendingIntroductionList, sendPendingIntroductionReminder, buildPendingIntroductionListMessages } from './sincity-welcome.js';
import { hasMaturedMindedFeatures } from '../lib/groupFeatureAccess.js';


export default {
    command: 'welcome',
    aliases: ['setwelcome', 'greet', 'welcomemember'],
    category: 'admin',
    description: 'Welcome a member or configure welcome',
    usage: '.welcome @user | .welcome log | .welcome on/off/set',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo } = context;
        const arg0 = (args[0] || '').toLowerCase();

        if (arg0 === 'pendingintro' || arg0 === 'pending') {
            const entries = await getPendingIntroductionList(chatId);
            if (!entries.length) return sock.sendMessage(chatId, { text: '✅ There are currently no pending introductions.', ...channelInfo }, { quoted: message });
            const messages = buildPendingIntroductionListMessages(entries, 40);
            await sock.sendMessage(chatId, { text: `📋 *${entries.length} MEMBERS STILL PENDING INTRODUCTION*\\n\\nThis list excludes members who have already cleared their pending status.`, ...channelInfo }, { quoted: message });
            for (let index = 0; index < messages.length; index++) {
                await sock.sendMessage(chatId, { text: messages[index], ...channelInfo });
                if (index < messages.length - 1) await new Promise(resolve => setTimeout(resolve, 500));
            }
            return;
        }
        if (arg0 === 'remindintro' || arg0 === 'introremind') {
            const result = await sendPendingIntroductionReminder(sock, chatId);
            const text = result.reason === 'not-configured'
                ? 'This group has not been registered for the Forge Guard Mature Minded profile.'
                : result.count === 0
                    ? '✅ Nobody is currently pending introduction. No reminder was sent.'
                    : `✅ Reminder sent to ${result.count} pending members in ${result.batches} message batch(es). The list remains live and will shrink as members introduce themselves.`;
            return sock.sendMessage(chatId, { text, ...channelInfo }, { quoted: message });
        }
        // .welcome test remains a test-only path and never starts a group campaign.
        if (arg0 === 'test') {
            if (!await hasMaturedMindedFeatures(chatId)) {
                return sock.sendMessage(chatId, { text: 'This group has not been registered for the Forge Guard feature profile.', ...channelInfo }, { quoted: message });
            }
            const result = await sendWelcomePack(sock, chatId, [context.senderId]);
            if (!result.sent) return sock.sendMessage(chatId, { text: result.reason === 'disabled' ? 'The welcome pack is currently disabled for this group.' : 'The welcome pack could not be sent for this group.' , ...channelInfo }, { quoted: message });
            return;
        }

        // .welcome log → daily log
        if (arg0 === 'log' || arg0 === 'logs' || arg0 === 'list') {
            const { default: welcomelog } = await import('./welcomelog.js');
            return welcomelog.handler(sock, message, args.slice(1), context);
        }

        const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        let userId = mentioned[0];
        if (!userId && message.message?.extendedTextMessage?.contextInfo?.participant) {
            const quoted = message.message.extendedTextMessage.contextInfo;
            if (quoted.participant && !['on', 'off', 'set'].includes(arg0)) {
                userId = quoted.participant;
            }
        }

        if (userId) {
            if (!await hasMaturedMindedFeatures(chatId)) {
                return sock.sendMessage(chatId, {
                    text: 'Full welcome pack is for Mature minded only.',
                    ...channelInfo
                }, { quoted: message });
            }
            const result = await sendWelcomePack(sock, chatId, [userId]);
            if (!result.sent) return sock.sendMessage(chatId, { text: result.reason === 'disabled' ? 'The welcome pack is currently disabled for this group.' : 'The welcome pack could not be sent for this group.', ...channelInfo }, { quoted: message });
            return;
        }

        const matchText = args.join(' ');
        if (!matchText) {
            const result = await startWelcomeCampaign(sock, chatId);
            if (!result.started) {
                const text = result.reason === 'not-configured'
                    ? 'This group has not been registered for the Forge Guard Mature Minded profile.'
                    : result.reason === 'already-active'
                        ? `⚠️ A welcome campaign is already running for ${result.count} members. The 10-minute window is still active.`
                        : 'No group members were available to include in the welcome campaign.';
                return sock.sendMessage(chatId, { text, ...channelInfo }, { quoted: message });
            }
            return sock.sendMessage(chatId, {
                text: `✅ Group introduction campaign started. ${result.count} current members were tagged. Anyone who sends a message in the next 10 minutes is counted as introduced for this campaign; members who remain silent will receive one consolidated reminder.`,
                ...channelInfo
            }, { quoted: message });
        }

        if (arg0 === 'help') {
            return sock.sendMessage(chatId, {
                text: `*Welcome commands*\n\n• *.welcome* — start a 10-minute group introduction campaign\n• *.welcome @user* — send an individual welcome\n• *.welcome test* / *.testwelcome* — test the welcome flow\n• *.welcome log* — view today's welcome log\n• *.welcome on/off/set* — configure simple join welcomes`,
                ...channelInfo
            }, { quoted: message });
        }

        await handleWelcome(sock, chatId, message, matchText);
    }
};

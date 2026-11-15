import { handleWelcome } from '../lib/welcome.js';
import { handleNewMember, startWelcomeCampaign } from './sincity-welcome.js';
import { dailyActivities } from '../data/dailyActivities.js';
import { hasMaturedMindedFeatures } from '../lib/groupFeatureAccess.js';


function getLagosDay() {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const str = new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' });
    return days[new Date(str).getDay()];
}

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

        // .welcome test remains a test-only path and never starts a group campaign.
        if (arg0 === 'test') {
            if (!await hasMaturedMindedFeatures(chatId)) {
                return sock.sendMessage(chatId, { text: 'This group has not been registered for the Forge Guard feature profile.', ...channelInfo }, { quoted: message });
            }
            await handleNewMember(sock, chatId, [context.senderId]);
            return sock.sendMessage(chatId, { text: '✅ Full welcome test sent for your account.', ...channelInfo }, { quoted: message });
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
            await handleNewMember(sock, chatId, [userId]);
            try {
                const day = getLagosDay();
                const activity = dailyActivities[day];
                if (activity?.full) {
                    await new Promise(r => setTimeout(r, 800));
                    await sock.sendMessage(chatId, { text: activity.full });
                }
            } catch {}
            return sock.sendMessage(chatId, {
                text: `✅ Full welcome sent to @${userId.split('@')[0]}`,
                mentions: [userId],
                ...channelInfo
            }, { quoted: message });
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

import { handleWelcome } from '../lib/welcome.js';
import { handleNewMember } from './sincity-welcome.js';
import { dailyActivities } from '../data/dailyActivities.js';

const TARGET_GROUP = '120363405434471171@g.us';

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
            if (chatId !== TARGET_GROUP) {
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
            return sock.sendMessage(chatId, {
                text: `*Welcome*\n\n• *.welcome @user* — full intro + rules + activity\n• *.welcome log* — who was welcomed today\n• *.welcome on/off/set* — simple system`,
                ...channelInfo
            }, { quoted: message });
        }

        await handleWelcome(sock, chatId, message, matchText);
    }
};

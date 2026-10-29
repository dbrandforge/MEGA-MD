/**
 * Unified welcome command
 * .welcome @user     → send full Mature minded welcome pack
 * .welcome on/off    → toggle generic welcome (other groups)
 * .welcome set ...   → custom message for generic system
 */
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
    usage: '.welcome @user | .welcome on/off/set',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo } = context;

        // Prefer mention / reply → full Sin City welcome pack
        const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        let userId = mentioned[0];
        if (!userId && message.message?.extendedTextMessage?.contextInfo?.participant) {
            // reply to someone
            const quoted = message.message.extendedTextMessage.contextInfo;
            if (quoted.participant && args[0]?.toLowerCase() !== 'on' && args[0]?.toLowerCase() !== 'off' && args[0]?.toLowerCase() !== 'set') {
                userId = quoted.participant;
            }
        }

        if (userId) {
            if (chatId !== TARGET_GROUP) {
                return sock.sendMessage(chatId, {
                    text: 'Full welcome pack is for Mature minded only. Use .welcome on/set here.',
                    ...channelInfo
                }, { quoted: message });
            }

            await handleNewMember(sock, chatId, [userId]);

            // Also send today's activity as 3rd message
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

        // No mention → old on/off/set system
        const matchText = args.join(' ');
        if (!matchText) {
            return sock.sendMessage(chatId, {
                text: `*Welcome*

• *.welcome @user* — send full intro + rules + today's activity
• *.welcome on* — enable simple welcome
• *.welcome off* — disable
• *.welcome set your message* — custom simple welcome

For Mature minded, always use *.welcome @user* for the full pack.`,
                ...channelInfo
            }, { quoted: message });
        }

        await handleWelcome(sock, chatId, message, matchText);
    }
};

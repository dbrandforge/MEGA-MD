import { dailyActivities } from '../data/dailyActivities.js';
import { hasMaturedMindedFeatures } from '../lib/groupFeatureAccess.js';
import { sendGroupAll } from '../lib/groupMentions.js';

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export function buildAllActivitiesMessage() {
    const sections = DAY_ORDER.map(day => {
        const activity = dailyActivities[day];
        if (!activity) return null;
        const details = String(activity.full || '').replace(/^\\*Today is [^*]+\\*\\s*/i, '').trim();
        const heading = day.toUpperCase() + ' — ' + (activity.title || 'Group Activities');
        return `*📌 ${heading}*\\n\\n${details}`;
    }).filter(Boolean);
    return `🗓️ *FULL WEEKLY GROUP ACTIVITIES*\\n\\n${sections.join('\\n\\n━━━━━━━━━━━━━━━━━━\\n\\n')}`;
}

export default {
    command: 'activities',
    aliases: ['allactivities', 'activitylist'],
    category: 'general',
    description: 'Shows the complete weekly group activity schedule in one message.',
    usage: '.activities',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const replyChatId = context.replyChatId || chatId;
        const replyMessage = context.replyMessage || message;
        const channelInfo = context.channelInfo || {};

        if (!await hasMaturedMindedFeatures(chatId)) {
            return sock.sendMessage(replyChatId, {
                text: 'The weekly group activity schedule is part of the Matured Minded Room package and is not enabled in this group.',
                ...channelInfo
            }, { quoted: replyMessage });
        }

        return sendGroupAll(sock, replyChatId, buildAllActivitiesMessage(), channelInfo, { quoted: replyMessage });
    }
};

import { dailyActivities } from '../data/dailyActivities.js';

/**
 * Lets anyone (admin or not) check today's scheduled activity on demand,
 * independent of the group lock/unlock cycle.
 */

function getLagosNow() {
    const str = new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' });
    return new Date(str);
}

function getCurrentDay() {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[getLagosNow().getDay()];
}

export default {
    command: 'activity',
    aliases: ['today', 'todaysactivity'],
    category: 'general',
    description: "Shows today's scheduled group activity",
    usage: '.activity',
    async handler(sock, message, args, context) {
        const { chatId, channelInfo } = context;

        const day = getCurrentDay();
        const activity = dailyActivities[day];
        const activityText = activity
            ? activity.full
            : `*Today is ${day.charAt(0).toUpperCase() + day.slice(1)}*\n\nEnjoy the group!`;

        await sock.sendMessage(chatId, {
            text: `📅 *Today's Activity*\n\n${activityText}`,
            ...channelInfo
        }, { quoted: message });
    }
};

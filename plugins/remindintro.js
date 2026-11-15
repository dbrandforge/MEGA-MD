import { sendPendingIntroductionReminder } from './sincity-welcome.js';

export default {
    command: 'remindintro',
    aliases: ['introremind'],
    category: 'admin',
    description: 'Tag and remind only members still pending introduction',
    usage: '.remindintro',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo } = context;
        const result = await sendPendingIntroductionReminder(sock, chatId);
        const text = result.reason === 'not-configured'
            ? 'This group has not been registered for the Forge Guard Mature Minded profile.'
            : result.count === 0
                ? '✅ Nobody is currently pending introduction. No reminder was sent.'
                : `✅ Reminder sent to ${result.count} pending members in ${result.batches} message batch(es). The list remains live and will shrink as members introduce themselves.`;
        return sock.sendMessage(chatId, { text, ...channelInfo }, { quoted: message });
    }
};

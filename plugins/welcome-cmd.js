import { handleNewMember } from './sincity-welcome.js';

const TARGET_GROUP = '120363405434471171@g.us';

export default {
    command: 'welcome',
    aliases: ['greet', 'welcomemember'],
    category: 'admin',
    description: 'Manually send welcome + rules to a member',
    usage: '.welcome @user',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo } = context;

        if (chatId !== TARGET_GROUP) {
            return sock.sendMessage(chatId, {
                text: 'Only works in the Mature minded group.',
                ...channelInfo
            }, { quoted: message });
        }

        const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        let userId = mentioned[0];

        if (!userId && message.message?.extendedTextMessage?.contextInfo?.participant) {
            userId = message.message.extendedTextMessage.contextInfo.participant;
        }

        if (!userId) {
            return sock.sendMessage(chatId, {
                text: 'Tag the member:\n*.welcome @user*',
                ...channelInfo
            }, { quoted: message });
        }

        await handleNewMember(sock, chatId, [userId]);
        await sock.sendMessage(chatId, {
            text: `✅ Welcome sent to @${userId.split('@')[0]}`,
            mentions: [userId],
            ...channelInfo
        }, { quoted: message });
    }
};

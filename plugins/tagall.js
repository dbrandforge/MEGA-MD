import { sendGroupAll } from '../lib/groupMentions.js';

export default {
    command: 'tagall',
    aliases: ['everyone', 'all'],
    category: 'admin',
    description: 'Tag all group members with their usernames',
    usage: '.tagall',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo } = context;
        try {
            return await sendGroupAll(sock, chatId, '🔊 *Hello everyone:* Please check the latest group announcement.', channelInfo);\n        }
        catch (error) {
            console.error('Error in tagall command:', error);
            await sock.sendMessage(chatId, {
                text: 'Failed to tag all members.',
                ...channelInfo
            }, { quoted: message });
        }
    }
};

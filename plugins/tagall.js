import { sendGroupAll } from '../lib/groupMentions.js';

export default {
    command: 'tagall',
    aliases: ['everyone', 'all'],
    category: 'admin',
    description: 'Use WhatsApp native @all to notify the group',
    usage: '.tagall',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo } = context;
        return sendGroupAll(sock, chatId, '🔊 *Hello everyone:* Please check the latest group announcement.', channelInfo, { quoted: message });
    }
};
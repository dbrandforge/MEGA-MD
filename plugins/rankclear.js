import store from '../lib/lightweight_store.js';

export default {
    command: 'rankclear',
    aliases: ['clear-rank'],
    category: 'owner',
    description: 'Clear only this group’s all-time ranking records.',
    groupOnly: true,
    strictOwnerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        try {
            const removed = await store.clearMessageCounts(chatId);
            return sock.sendMessage(chatId, {
                text: `🧹 *ALL-TIME RANKING CLEARED*\nRemoved records for ${removed} members. Weekly rankings and four-week consistency history were preserved.`
            }, { quoted: message });
        } catch (error) {
            console.error('[RANK] Clear failed:', error);
            return sock.sendMessage(chatId, { text: '❌ Could not clear the all-time ranking. No weekly records were changed.' }, { quoted: message });
        }
    }
};

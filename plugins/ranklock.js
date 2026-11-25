import store from '../lib/lightweight_store.js';

export default {
    command: 'ranklock',
    aliases: ['rankinglock'],
    category: 'owner',
    description: 'Lock ranking commands in this group.',
    groupOnly: true,
    strictOwnerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        await store.saveSetting(chatId, 'rankingLocked', true);
        return sock.sendMessage(chatId, { text: '🔒 Ranking system locked. No one can run ranking displays until the creator unlocks it.' }, { quoted: message });
    }
};

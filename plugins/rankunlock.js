import store from '../lib/lightweight_store.js';

export default {
    command: 'rankunlock',
    aliases: ['rankingunlock'],
    category: 'owner',
    description: 'Unlock ranking commands in this group.',
    strictOwnerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        await store.saveSetting('global', 'rankingLocked', false);
        return sock.sendMessage(chatId, { text: '🔓 Ranking system unlocked. All ranking commands are available again.' }, { quoted: message });
    }
};

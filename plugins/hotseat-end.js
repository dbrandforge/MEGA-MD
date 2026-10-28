import store from '../lib/lightweight_store.js';

const HOTSEAT_KEY = 'hotseatSession';

function mention(jid) {
    return `@${(jid || '').split('@')[0]}`;
}

export default {
    command: 'endhotseat',
    aliases: ['stophotseat', 'endhs'],
    category: 'games',
    description: 'End the current Hot Seat session',
    usage: '.endhotseat',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo } = context;
        const session = (await store.getSetting(chatId, HOTSEAT_KEY)) || null;

        if (!session || session.status !== 'active') {
            return sock.sendMessage(chatId, {
                text: 'No active Hot Seat session.',
                ...channelInfo
            }, { quoted: message });
        }

        await store.saveSetting(chatId, HOTSEAT_KEY, null);

        await sock.sendMessage(chatId, {
            text: `🛑 *Hot Seat has ended*\n\nPlayers: ${(session.players || []).map(mention).join(', ')}`,
            mentions: session.players || [],
            ...channelInfo
        }, { quoted: message });
    }
};

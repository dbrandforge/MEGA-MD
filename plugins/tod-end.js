import store from '../lib/lightweight_store.js';

const SESSIONS_KEY = 'todSessions';

async function getSessions(chatId) {
    return (await store.getSetting(chatId, SESSIONS_KEY)) || {};
}

async function saveSessions(chatId, sessions) {
    await store.saveSetting(chatId, SESSIONS_KEY, sessions);
}

function mention(jid) {
    return `@${(jid || '').split('@')[0]}`;
}

export default {
    command: 'endtod',
    aliases: ['stoptod', 'endtruth'],
    category: 'games',
    description: 'End your Truth or Dare session',
    usage: '.endtod',
    groupOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo } = context;
        const sessions = await getSessions(chatId);

        const entry = Object.entries(sessions).find(([_, s]) =>
            s.players?.includes(senderId) && ['active', 'choosing_mode'].includes(s.status)
        );

        if (!entry) {
            return sock.sendMessage(chatId, {
                text: 'You are not in any active Truth or Dare session.',
                ...channelInfo
            }, { quoted: message });
        }

        const session = entry[1];
        session.status = 'ended';
        await saveSessions(chatId, sessions);

        const names = session.players.map(p => mention(p)).join(' & ');

        await sock.sendMessage(chatId, {
            text: `🛑 *Truth or Dare session ended*\n\n${names}\n\nSession ended by a player.`,
            mentions: session.players,
            ...channelInfo
        }, { quoted: message });
    }
};

import store from '../lib/lightweight_store.js';

const TARGET_GROUP = '120363405434471171@g.us';
const PENDING_INTRO_KEY = 'pendingIntros';

export default {
    command: 'pendingintro',
    aliases: ['notintroduced', 'pendingintros'],
    category: 'admin',
    description: 'List members who have not sent their first group message',
    usage: '.pendingintro',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo } = context;
        if (chatId !== TARGET_GROUP) {
            return sock.sendMessage(chatId, { text: 'This command is configured for Mature minded only.', ...channelInfo }, { quoted: message });
        }
        const pending = (await store.getSetting(chatId, PENDING_INTRO_KEY)) || {};
        const entries = Object.entries(pending).filter(([, record]) => record && record.introduced !== true);
        if (!entries.length) {
            return sock.sendMessage(chatId, { text: '✅ Everyone currently tracked has introduced themselves.', ...channelInfo }, { quoted: message });
        }
        const lines = entries.map(([jid], index) => `${index + 1}. @${jid.split('@')[0]}`);
        return sock.sendMessage(chatId, {
            text: `⏳ *Members yet to introduce*\n\n${lines.join('\n')}\n\nTotal: ${entries.length}`,
            mentions: entries.map(([jid]) => jid),
            ...channelInfo
        }, { quoted: message });
    }
};

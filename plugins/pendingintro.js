import store from '../lib/lightweight_store.js';

const TARGET_GROUP = '120363405434471171@g.us';
const PENDING_INTRO_KEY = 'pendingIntros_v2';

function getMentionedUsers(message) {
    const context = message.message?.extendedTextMessage?.contextInfo;
    return [...new Set(context?.mentionedJid || [])];
}

export default {
    command: 'pendingintro',
    aliases: ['notintroduced', 'pendingintros'],
    category: 'admin',
    description: 'List and manage members who have not sent their first group message',
    usage: '.pendingintro | .pendingintro done @member | .pendingintro clear',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo } = context;
        const reply = (text, extra = {}) => sock.sendMessage(
            chatId, { text, ...extra, ...channelInfo }, { quoted: message }
        );

        if (chatId !== TARGET_GROUP) {
            return reply('This command is configured for Mature minded only.');
        }

        const action = (args[0] || '').toLowerCase();
        const pending = (await store.getSetting(chatId, PENDING_INTRO_KEY)) || {};

        if (action === 'clear' || action === 'reset') {
            const count = Object.keys(pending).length;
            await store.saveSetting(chatId, PENDING_INTRO_KEY, {});
            return reply(`✅ Pending-introduction list cleared. ${count} record(s) removed. New join events will be tracked from a clean slate.`);
        }

        if (action === 'done' || action === 'introduced' || action === 'remove') {
            const targets = getMentionedUsers(message);
            if (!targets.length) {
                return reply('Tag the member who has introduced themselves.\nUsage: .pendingintro done @member');
            }
            let removed = 0;
            for (const jid of targets) {
                if (pending[jid]) {
                    delete pending[jid];
                    removed++;
                }
            }
            await store.saveSetting(chatId, PENDING_INTRO_KEY, pending);
            if (!removed) return reply('That member is not currently on the pending-introduction list.');
            return reply(`✅ Marked ${removed} member(s) as introduced and removed ${removed} record(s) from the list.`);
        }

        const entries = Object.entries(pending).filter(([, record]) =>
            record && record.introduced !== true && record.status !== 'inactive'
        );

        if (!entries.length) {
            return reply('✅ No tracked members are currently waiting to introduce themselves.');
        }

        const lines = entries.map(([jid], index) => {
            const joinedAt = Number(entries[index][1]?.joinedAt);
            const date = Number.isFinite(joinedAt) && joinedAt > 0
                ? new Date(joinedAt).toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos' })
                : '';
            return `${index + 1}. @${jid.split('@')[0]}${date ? ` — joined ${date}` : ''}`;
        });

        return sock.sendMessage(chatId, {
            text: `⏳ *Members yet to introduce*\n\n${lines.join('\n')}\n\nTotal: ${entries.length}\n\nAdmin controls:\n• .pendingintro done @member\n• .pendingintro clear`,
            mentions: entries.map(([jid]) => jid),
            ...channelInfo
        }, { quoted: message });
    }
};

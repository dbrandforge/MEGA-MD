/**
 * Daily welcome log
 * .welcomelog — who was welcomed today (Lagos time)
 */
import store from '../lib/lightweight_store.js';

const TARGET_GROUP = '120363405434471171@g.us';
const LOG_KEY = 'welcomeDailyLog';

function lagosDateKey() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' }); // YYYY-MM-DD
}

export async function logWelcome(chatId, userId) {
    if (chatId !== TARGET_GROUP) return;
    const key = lagosDateKey();
    const all = (await store.getSetting(chatId, LOG_KEY)) || {};
    if (!all[key]) all[key] = [];
    const id = userId.split('@')[0];
    if (!all[key].includes(userId) && !all[key].includes(id)) {
        all[key].push(userId);
    }
    // keep last 14 days only
    const keys = Object.keys(all).sort();
    while (keys.length > 14) {
        delete all[keys.shift()];
    }
    await store.saveSetting(chatId, LOG_KEY, all);
}

export default {
    command: 'welcomelog',
    aliases: ['wlog', 'welcomed'],
    category: 'admin',
    description: 'List members welcomed today',
    usage: '.welcomelog',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo } = context;
        if (chatId !== TARGET_GROUP) {
            return sock.sendMessage(chatId, { text: 'Only for Mature minded.', ...channelInfo }, { quoted: message });
        }
        const key = lagosDateKey();
        const all = (await store.getSetting(chatId, LOG_KEY)) || {};
        const list = all[key] || [];
        if (!list.length) {
            return sock.sendMessage(chatId, {
                text: `📋 *Welcome log — ${key}*\n\nNo welcomes recorded today.`,
                ...channelInfo
            }, { quoted: message });
        }
        const lines = list.map((u, i) => `${i + 1}. @${String(u).split('@')[0]}`);
        await sock.sendMessage(chatId, {
            text: `📋 *Welcome log — ${key}*\n\n${lines.join('\n')}\n\nTotal: ${list.length}`,
            mentions: list.map(u => (String(u).includes('@') ? u : `${u}@s.whatsapp.net`)),
            ...channelInfo
        }, { quoted: message });
    }
};

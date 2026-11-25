import store from '../lib/lightweight_store.js';
import { getLagosWeekKey, isRankingLocked } from './rank.js';

function getRecentWeekKeys(count = 4) {
    const current = getLagosWeekKey();
    const [year, week] = current.split('-W').map(Number);
    const monday = new Date(Date.UTC(year, 0, 4 + (week - 1) * 7));
    const day = monday.getUTCDay() || 7;
    monday.setUTCDate(monday.getUTCDate() - day + 1);
    const keys = [];
    for (let offset = count - 1; offset >= 0; offset--) {
        const date = new Date(monday);
        date.setUTCDate(date.getUTCDate() - offset * 7);
        keys.push(getLagosWeekKey(new Date(date.getTime() - 60 * 60 * 1000)));
    }
    return keys;
}

function cleanName(value) {
    return (value || '').toString().replace(/[\r\n@]/g, '').trim().split(/\s+/)[0] || 'Member';
}

export default {
    command: 'rankstreak',
    aliases: ['rankconsistent', 'rank4weeks'],
    category: 'group',
    description: 'Show members in the weekly top five for four consecutive weeks.',
    groupOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        if (await isRankingLocked(chatId)) {
            return sock.sendMessage(chatId, { text: '🔒 Ranking commands are temporarily locked by the creator.' }, { quoted: message });
        }
        const weeks = getRecentWeekKeys(4);
        const weekly = await Promise.all(weeks.map(key => store.getWeeklyMessageCounts(chatId, key)));
        const topFive = weekly.map(counts => new Set(Object.entries(counts)
            .map(([id, count]) => [id, Number(count) || 0]).filter(([, count]) => count > 0)
            .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id)));
        const consistent = [...topFive[3]].filter(id => topFive.every(set => set.has(id)));
        if (!consistent.length) {
            return sock.sendMessage(chatId, { text: '🏅 No member has appeared in the weekly top five for four consecutive weeks yet.' }, { quoted: message });
        }
        const metadata = await sock.groupMetadata(chatId).catch(() => null);
        const participants = metadata?.participants || [];
        const mentions = [];
        let output = `🏅 *FOUR-WEEK RANKING STREAK*\n${weeks.join(' → ')}\n\n`;
        for (const rawId of consistent) {
            const participant = participants.find(p => p.id === rawId || p.lid === rawId) || {};
            const id = participant.id || rawId;
            const contact = sock.store?.contacts?.[id] || {};
            const name = cleanName(contact.name || contact.notify || participant.notify || participant.name || await Promise.resolve(sock.getName(id)).catch(() => ''));
            const totals = weekly.map(counts => Number(counts[rawId]) || 0);
            output += `🏆 *${name}*\n@${id.split('@')[0]}\n💬 ${totals.map(value => value.toLocaleString()).join(' / ')} messages\n\n`;
            mentions.push(id);
        }
        output += '_Consistent means a top-five position in each of the last four consecutive weeks._';
        return sock.sendMessage(chatId, { text: output, mentions }, { quoted: message });
    }
};

import store from '../lib/lightweight_store.js';
import { getLagosWeekKey, isRankingLocked } from './rank.js';

function cleanName(value) {
    return (value || '').toString().replace(/[\r\n@]/g, '').trim().split(/\s+/)[0] || 'Member';
}

export default {
    command: 'rankweek',
    aliases: ['weeklyrank', 'weekrank'],
    category: 'group',
    description: 'Show this week’s top five group contributors.',
    groupOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        if (await isRankingLocked(chatId)) {
            return sock.sendMessage(chatId, { text: '🔒 Ranking commands are temporarily locked by the creator.' }, { quoted: message });
        }
        const weekKey = getLagosWeekKey();
        const counts = await store.getWeeklyMessageCounts(chatId, weekKey);
        const sorted = Object.entries(counts).map(([id, count]) => [id, Number(count) || 0])
            .filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
        if (!sorted.length) return sock.sendMessage(chatId, { text: '📊 No weekly activity has been recorded yet.' }, { quoted: message });
        const metadata = await sock.groupMetadata(chatId).catch(() => null);
        const participants = metadata?.participants || [];
        const lidMap = {};
        for (const participant of participants) {
            if (participant.lid && participant.id) lidMap[participant.lid] = participant.id;
            if (participant.id) lidMap[participant.id] = participant.id;
        }
        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
        const mentions = [];
        let output = `📅 *WEEKLY GROUP TOP 5* — ${weekKey}\n\n`;
        for (let i = 0; i < sorted.length; i++) {
            const [rawId, count] = sorted[i];
            const id = lidMap[rawId] || rawId;
            const contact = sock.store?.contacts?.[id] || {};
            const participant = participants.find(p => p.id === id || p.lid === rawId) || {};
            const name = cleanName(contact.name || contact.notify || participant.notify || participant.name || await Promise.resolve(sock.getName(id)).catch(() => ''));
            output += `${medals[i]} *${name}*\n@${id.split('@')[0]}\n💬 *${count.toLocaleString()} messages*\n\n`;
            mentions.push(id);
        }
        output += '_Weekly counts reset naturally each Monday. All-time records are unaffected._';
        return sock.sendMessage(chatId, { text: output, mentions }, { quoted: message });
    }
};

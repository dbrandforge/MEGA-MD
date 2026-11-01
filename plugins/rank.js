import store from '../lib/lightweight_store.js';
import { getUserGender } from './gender.js';

export function getLagosWeekKey(date = new Date()) {
    const local = new Date(date.getTime() + 60 * 60 * 1000);
    const day = local.getUTCDay() || 7;
    local.setUTCDate(local.getUTCDate() + 4 - day);
    const year = local.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil((((local - yearStart) / 86400000) + 1) / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
}

const TITLES = {
    guy: ['King of the Group', 'Chairman of the Week', 'Chief of Cruise', 'Top G of the Week', 'Vibe General'],
    lady: ['Queen of the Group', 'Madam of the Week', 'Duchess of Vibes', 'Queen of Cruise', 'Group Sweetheart'],
    unknown: ['Group Champion', 'Top Contributor', 'Conversation Starter', 'Active Member', 'Group Regular']
};

function cleanName(value) {
    return (value || '').toString().replace(/[\r\n@]/g, '').trim().split(/\s+/)[0] || 'Member';
}

export default {
    command: 'rank',
    aliases: ['top', 'topusers', 'leaderboard', 'ranks'],
    category: 'group',
    description: 'Show the top five group contributors for the current Lagos week.',
    usage: '.rank',
    groupOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        try {
            const weekKey = getLagosWeekKey();
            const counts = await store.getWeeklyMessageCounts(chatId, weekKey);
            const entries = Object.entries(counts).filter(([, count]) => Number(count) > 0);
            const metadata = await sock.groupMetadata(chatId).catch(() => null);
            const participants = metadata?.participants || [];
            const lidMap = {};
            for (const participant of participants) {
                if (participant.lid && participant.id) lidMap[participant.lid] = participant.id;
                if (participant.id) lidMap[participant.id] = participant.id;
            }
            const resolved = {};
            for (const [id, count] of entries) {
                const userId = lidMap[id] || id;
                resolved[userId] = (resolved[userId] || 0) + Number(count);
            }
            const sorted = Object.entries(resolved).sort((a, b) => b[1] - a[1]).slice(0, 5);
            if (!sorted.length) {
                return sock.sendMessage(chatId, {
                    text: '📊 *No weekly activity recorded yet.*\n\nMessages count from Monday to Sunday (Lagos time). Stickers do not count.'
                }, { quoted: message });
            }
            const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
            let output = `🏆 *WEEKLY GROUP RANKING*\n📅 ${weekKey} · Lagos time\n\n`;
            const mentions = [];
            for (let i = 0; i < sorted.length; i++) {
                const [userId, count] = sorted[i];
                const contact = sock.store?.contacts?.[userId] || {};
                const participant = participants.find(p => p.id === userId || p.lid === userId) || {};
                const rawName = (message.key.participant === userId ? message.pushName : '') ||
                    contact.name || contact.notify || participant.notify || participant.name ||
                    await Promise.resolve(sock.getName(userId)).catch(() => '');
                const name = cleanName(rawName);
                const gender = await getUserGender(userId).catch(() => null);
                const title = (TITLES[gender] || TITLES.unknown)[Math.min(i, 4)];
                output += `${medals[i]} *${title} — ${name}*\\n@${userId.split('@')[0]}\\n💬 *${count.toLocaleString()} messages*\\n\\n`;
                mentions.push(userId);
            }
            output += '_Weekly scores reset automatically at the start of each new week. Stickers are excluded._';
            return sock.sendMessage(chatId, { text: output, mentions }, { quoted: message });
        } catch (error) {
            console.error('[RANK] Weekly leaderboard error:', error);
            return sock.sendMessage(chatId, { text: '❌ Could not load the weekly ranking. Please try again.' }, { quoted: message });
        }
    }
};

import store from '../lib/lightweight_store.js';
import { isFeatureGroup } from '../lib/featureGroups.js';

const BOARDS = Object.freeze({
  trivia: { key: 'triviaRecords', label: 'TRIVIA', metric: record => Number(record?.points) || 0, unit: 'points' },
  math: { key: 'mathRecords', label: 'MATHS', metric: record => Number(record?.points) || 0, unit: 'points' },
  maths: { key: 'mathRecords', label: 'MATHS', metric: record => Number(record?.points) || 0, unit: 'points' },
  hangman: { key: 'hangmanHighScores', label: 'HANGMAN', metric: record => typeof record === 'number' ? record : Number(record?.totalSolved ?? record?.highestScore) || 0, unit: 'words solved' }
});
const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

function mention(jid) {
  return '@' + String(jid || '').split('@')[0].split(':')[0];
}
function cleanName(value) {
  return String(value || '').replace(/[\\r\\n@]/g, '').trim().split(/\\s+/)[0] || 'Member';
}
function recordStats(record, board) {
  if (board.label === 'HANGMAN') return { score: board.metric(record), matches: Number(record?.rounds) || 0, wins: 0 };
  return { score: board.metric(record), matches: Number(record?.matches) || 0, wins: Number(record?.wins) || 0 };
}

export default {
  command: 'gamerank',
  aliases: ['grank', 'gameranking', 'gameleaderboard'],
  category: 'games',
  description: 'Show an all-time top ten leaderboard for Trivia, Maths or Hangman.',
  usage: '.gamerank trivia|math|hangman',
  groupOnly: true,
  async handler(sock, message, args, context) {
    const chatId = context.chatId || message.key.remoteJid;
    const channelInfo = context.channelInfo || {};
    if (!isFeatureGroup(chatId)) {
      return sock.sendMessage(chatId, { text: 'Game rankings are available in the designated Forge Guard game groups.', ...channelInfo }, { quoted: message });
    }
    const selected = String(args?.[0] || '').toLowerCase();
    const board = BOARDS[selected];
    if (!board) {
      return sock.sendMessage(chatId, {
        text: '🏆 *FORGE GUARD — GAME RANKINGS*\\n\\nChoose an all-time leaderboard:\\n• *.gamerank trivia*\\n• *.gamerank math*\\n• *.gamerank hangman*\\n\\nEach board shows the group’s top 10 cumulative performers. There are no weekly rankings.',
        ...channelInfo
      }, { quoted: message });
    }
    try {
      const records = (await store.getSetting(chatId, board.key)) || {};
      const ranked = Object.entries(records)
        .filter(([id]) => !['groupRecord', 'groupRecordHolder'].includes(id))
        .map(([id, record]) => ({ id, record, ...recordStats(record, board) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score || b.wins - a.wins || b.matches - a.matches)
        .slice(0, 10);
      if (!ranked.length) {
        return sock.sendMessage(chatId, { text: `🏆 *${board.label} — ALL-TIME TOP 10*\\n\\nNo recorded scores yet. Complete a match to enter the leaderboard.`, ...channelInfo }, { quoted: message });
      }
      const metadata = await sock.groupMetadata(chatId).catch(() => null);
      const participants = metadata?.participants || [];
      const mentions = ranked.map(item => item.id);
      const lines = [];
      for (let i = 0; i < ranked.length; i++) {
        const item = ranked[i];
        const contact = sock.store?.contacts?.[item.id] || {};
        const participant = participants.find(p => p.id === item.id || p.lid === item.id) || {};
        const rawName = (message.key.participant === item.id ? message.pushName : '')
          || contact.name || contact.notify || participant.notify || participant.name
          || await Promise.resolve(sock.getName(item.id)).catch(() => '');
        const name = cleanName(rawName);
        const detail = board.label === 'HANGMAN'
          ? `${item.score.toLocaleString()} words solved · ${item.matches} rounds`
          : `${item.score.toLocaleString()} points · ${item.wins} wins · ${item.matches} matches`;
        lines.push(`${MEDALS[i]} *${name}*\\n${mention(item.id)}\\n📊 ${detail}`);
      }
      const text = `🏆 *${board.label} — ALL-TIME TOP 10*\\n📍 Group leaderboard · cumulative records\\n\\n${lines.join('\\n\\n')}\\n\\n_Records are permanent and ranked by total ${board.unit}. No weekly reset._`;
      return sock.sendMessage(chatId, { text, mentions, ...channelInfo }, { quoted: message });
    } catch (error) {
      console.error('[GAME RANK] Leaderboard error:', error);
      return sock.sendMessage(chatId, { text: 'Could not load this all-time game ranking. Please try again.', ...channelInfo }, { quoted: message });
    }
  }
};

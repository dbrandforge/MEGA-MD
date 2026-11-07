import store from '../lib/lightweight_store.js';
import { isFeatureGroup } from '../lib/featureGroups.js';
import { isGameAllowed } from './daylock.js';
import isAdmin from '../lib/isAdmin.js';
import { startNoParticipationGrace, hasNoParticipation, isNoParticipationGraceExpired } from '../lib/gameTimeouts.js';
import { generateMathQuestion, getMathNegativeQuestionCount } from '../lib/mathQuestionEngine.js';
import { TRIVIA_DIFFICULTY_SECONDS, getTriviaMatchQuestionCount } from './trivia.js';

const STATE_KEY = 'mathGame';
const RECORD_KEY = 'mathRecords';
const MATCH_EXPIRY_MS = 45 * 60 * 1000;
const timers = new Map();
const chatLocks = new Map();
async function withChatLock(chatId, task) {
  const previous = chatLocks.get(chatId) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  const queued = previous.then(() => current);
  chatLocks.set(chatId, queued);
  await previous;
  try { return await task(); }
  finally {
    release();
    if (chatLocks.get(chatId) === queued) chatLocks.delete(chatId);
  }
}

export const MATH_MODES = Object.freeze({
  noob: { time: TRIVIA_DIFFICULTY_SECONDS.easy * 1000 },
  easy: { time: TRIVIA_DIFFICULTY_SECONDS.easy * 1000 },
  normal: { time: TRIVIA_DIFFICULTY_SECONDS.normal * 1000 },
  hard: { time: TRIVIA_DIFFICULTY_SECONDS.hard * 1000 },
  extreme: { time: TRIVIA_DIFFICULTY_SECONDS.expert * 1000 },
  impossible: { time: TRIVIA_DIFFICULTY_SECONDS.expert * 1000 },
  impossible2: { time: TRIVIA_DIFFICULTY_SECONDS.expert * 1000 }
});
const mention = jid => '@' + String(jid || '').split('@')[0].split(':')[0];
export { generateMathQuestion, getMathNegativeQuestionCount };
export function getMathMatchQuestionCount(mode = 'normal') {
  const difficulty = mode === 'noob' || mode === 'easy' ? 'easy'
    : mode === 'normal' ? 'normal' : mode === 'hard' ? 'hard' : 'expert';
  return getTriviaMatchQuestionCount('maths', difficulty);
}

async function readGame(chatId) {
  const game = await store.getSetting(chatId, STATE_KEY);
  if (!game?.active) return null;
  // Let the persisted no-participation deadline win over the general match expiry after a restart.
  if (isNoParticipationGraceExpired(game)) return game;
  if (game.matchExpiresAt && game.matchExpiresAt <= Date.now()) {
    await store.saveSettingVerified(chatId, STATE_KEY, { ...game, active: false, endedAt: Date.now(), reason: 'expired' });
    clearTimer(chatId);
    return null;
  }
  return game;
}
async function saveGame(chatId, game) {
  if (!await store.saveSettingVerified(chatId, STATE_KEY, game)) throw new Error('Math game state could not be persisted.');
}
function clearTimer(chatId) {
  const timer = timers.get(chatId);
  if (timer) clearTimeout(timer);
  timers.delete(chatId);
}

async function saveMatchRecords(chatId, game) {
  const records = (await store.getSetting(chatId, RECORD_KEY)) || {};
  const playerIds = new Set([...Object.keys(game.participants || {}), ...Object.keys(game.scores || {})]);
  for (const jid of playerIds) {
    const score = game.scores?.[jid] || 0;
    const previous = records[jid] || { points: 0, matches: 0, wins: 0 };
    records[jid] = {
      ...previous,
      points: (previous.points || 0) + score,
      matches: (previous.matches || 0) + 1,
      wins: (previous.wins || 0) + (jid === game.winner ? 1 : 0),
      lastScore: score,
      lastPlayedAt: Date.now()
    };
  }
  if (!await store.saveSettingVerified(chatId, RECORD_KEY, records)) throw new Error('Math leaderboard could not be persisted.');
  return records;
}

function formatScores(scores, limit = 5) {
  return Object.entries(scores || {}).sort((a, b) => b[1] - a[1]).slice(0, limit)
    .map(([jid, score], index) => `${index + 1}. ${mention(jid)} — ${score} pts`);
}

async function endMatch(sock, chatId, game, reason = 'completed', quoted) {
  clearTimer(chatId);
  game.active = false;
  game.endedAt = Date.now();
  game.reason = reason;
  const ranking = Object.entries(game.scores || {}).sort((a, b) => b[1] - a[1]);
  game.winner = ranking[0]?.[0] || null;
  await saveGame(chatId, game);
  await saveMatchRecords(chatId, game);
  const lines = formatScores(game.scores, 10);
  await sock.sendMessage(chatId, {
    text: `🏁 *MATHS ARENA — MATCH ${reason === 'completed' ? 'COMPLETE' : 'ENDED'}*\n\n${reason === 'no-participation' ? 'No player submitted an answer. The match ended after the five-minute waiting period.\n\n' : ''}${lines.join('\n') || 'No points were scored.'}\n\n🏆 Champion: ${game.winner ? mention(game.winner) : 'No winner'}`,
    mentions: ranking.map(([jid]) => jid)
  }, quoted ? { quoted } : undefined);
}

async function closeQuestion(sock, chatId, roundToken, reason = 'timeout') {
  return withChatLock(chatId, async () => {
    const game = await readGame(chatId);
    if (!game || game.roundToken !== roundToken || game.questionClosed) return false;
    clearTimer(chatId);
    game.questionClosed = true;
    await saveGame(chatId, game);
    const winnerText = game.roundWinner ? `⚡ ${mention(game.roundWinner)} got it first!` : 'No correct answer this round.';
    await sock.sendMessage(chatId, {
      text: `⏱️ *Round ${game.round}/${game.totalRounds} closed.*\n${winnerText}\nCorrect answer: *${game.answer}*`,
      mentions: game.roundWinner ? [game.roundWinner] : []
    });
    if (hasNoParticipation(game.attemptedBy)) {
      Object.assign(game, startNoParticipationGrace(game));
      await saveGame(chatId, game);
      await sock.sendMessage(chatId, {
        text: '⏸️ *MATHS ARENA ON HOLD*\n\nNobody submitted an answer for this question. The match is paused for *5 minutes*. No new question will be generated during this period.\n\nThe match will end automatically when the five-minute hold expires.'
      });
      armTimer(sock, chatId, game);
      return true;
    }
    if (game.round >= game.totalRounds) {
      await endMatch(sock, chatId, game, 'completed');
      return true;
    }
    setTimeout(async () => {
      const latest = await readGame(chatId);
      if (!latest || latest.roundToken !== roundToken || !latest.questionClosed) return;
      await postNextQuestion(sock, chatId, latest);
    }, 1800);
    return true;
  });
}

function armTimer(sock, chatId, game) {
  if (!game?.active || timers.has(chatId)) return;
  const token = game.roundToken;
  if (game.questionClosed && game.noParticipationExpiresAt) {
    const delay = Math.max(0, game.noParticipationExpiresAt - Date.now());
    timers.set(chatId, setTimeout(() => withChatLock(chatId, async () => {
      const latest = await readGame(chatId);
      if (!latest || latest.roundToken !== token || !latest.questionClosed || !latest.noParticipationExpiresAt || latest.noParticipationExpiresAt > Date.now()) return;
      await endMatch(sock, chatId, latest, 'no-participation');
    }).catch(error => console.error('[MATH] No-participation timer error:', error.message)), delay));
    return;
  }
  if (game.questionClosed || !game.expiresAt) return;
  const delay = Math.max(0, game.expiresAt - Date.now());
  timers.set(chatId, setTimeout(() => closeQuestion(sock, chatId, token).catch(error => console.error('[MATH] Timer error:', error.message)), delay));
}

async function postNextQuestion(sock, chatId, game) {
  game.round += 1;
  game.questionClosed = false;
  game.roundWinner = null;
  game.roundStartedAt = Date.now();
  game.attemptedBy = {};
  const question = generateMathQuestion(game.mode, { includeNegative: (game.negativeRounds || []).includes(game.round) });
  game.expression = question.expression;
  game.answer = question.answer;
  game.questionTime = question.time;
  game.expiresAt = Date.now() + question.time;
  game.roundToken = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const sent = await sock.sendMessage(chatId, {
    text: `🧮 *FORGE GUARD — MATHS ARENA*\n\n*Question ${game.round}/${game.totalRounds}* · ${game.mode.toUpperCase()}\n\nHow much is:\n\n*${game.expression} = ?*\n\n⏱️ ${Math.round(question.time / 1000)} seconds\n\nReply directly to this question with your answer. First correct answer earns the round points.\n🏆 ${formatScores(game.scores, 3).join(' | ') || 'No scores yet'}`
  });
  game.questionMessageId = sent?.key?.id || null;
  await saveGame(chatId, game);
  armTimer(sock, chatId, game);
}

async function playerCanEnd(sock, chatId, senderId, context, message, game) {
  let admin = !!(context.isSenderAdmin || context.senderIsOwnerOrSudo || context.isOwnerOrSudoCheck || message.key.fromMe);
  if (!admin) {
    try { admin = !!(await isAdmin(sock, chatId, senderId)).isSenderAdmin; } catch {}
  }
  return admin || !!game.participants?.[senderId] || (game.attemptedBy?.[senderId] || 0) > 0;
}

export async function handleMathContinuity(sock, chatId, message, senderId) {
  if (!chatId?.endsWith('@g.us') || message?.key?.fromMe || !isFeatureGroup(chatId)) return false;
  const pendingGame = await readGame(chatId);
  if (!pendingGame) return false;
  armTimer(sock, chatId, pendingGame);
  const contextInfo = message.message?.extendedTextMessage?.contextInfo || message.message?.imageMessage?.contextInfo || {};
  if (!contextInfo.stanzaId) return false;
  const result = await withChatLock(chatId, async () => {
    const game = await readGame(chatId);
    if (!game) return false;
    armTimer(sock, chatId, game);
    if (contextInfo.stanzaId !== game.questionMessageId) return false;
    const access = await isGameAllowed(chatId, 'math');
    if (!access.ok) {
      await sock.sendMessage(chatId, { text: access.msg }, { quoted: message });
      return true;
    }
    if (game.questionClosed || game.roundWinner) return true;
    if (Date.now() >= game.expiresAt) return { handled: true, closeToken: game.roundToken };
    const body = String(message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim().replace(/,/g, '');
    if (!/^-?\d+$/.test(body)) return false;
    if (game.attemptedBy?.[senderId]) {
      await sock.sendMessage(chatId, { text: 'You have already submitted an answer for this question.' }, { quoted: message });
      return true;
    }
    game.attemptedBy = game.attemptedBy || {};
    game.attemptedBy[senderId] = 1;
    game.participants = game.participants || {};
    game.participants[senderId] = true;
    if (body === game.answer) {
      game.roundWinner = senderId;
      const remaining = Math.max(0, game.expiresAt - Date.now());
      const bonus = Math.floor((remaining / game.questionTime) * 5);
      const points = 10 + bonus;
      game.scores = game.scores || {};
      game.scores[senderId] = (game.scores[senderId] || 0) + points;
      await saveGame(chatId, game);
      await sock.sendMessage(chatId, {
        text: `✅ *Correct, ${mention(senderId)}!*\n+*${points} points* (including speed bonus).\n\nThe round is now closed.`,
        mentions: [senderId]
      }, { quoted: message });
      return { handled: true, closeToken: game.roundToken };
    }
    await saveGame(chatId, game);
    await sock.sendMessage(chatId, { text: '❌ Not quite. Your answer is recorded; other players can still compete.' }, { quoted: message });
    return true;
  });
  if (result?.closeToken) await closeQuestion(sock, chatId, result.closeToken, 'correct');
  return result === true || !!result?.handled;
}

export default {
  command: 'math',
  aliases: ['maths', 'ganit'],
  category: 'games',
  description: 'Compete in timed multiplayer Maths Arena rounds.',
  usage: '.math <difficulty> | .math status | .math score | .math stop',
  groupOnly: true,
  async handler(sock, message, args, context) {
    const { chatId, senderId, config, channelInfo } = context;
    if (!isFeatureGroup(chatId)) return sock.sendMessage(chatId, { text: 'Maths Arena is available in the designated Forge Guard game groups.', ...channelInfo }, { quoted: message });
    const action = String(args[0] || '').toLowerCase();
    const access = await isGameAllowed(chatId, 'math');
    if (!['stop', 'end', 'status', 'score'].includes(action) && !access.ok) {
      return sock.sendMessage(chatId, { text: access.msg, ...channelInfo }, { quoted: message });
    }
    let game = await readGame(chatId);
    if (game) armTimer(sock, chatId, game);
    if (['stop', 'end'].includes(action)) {
      if (!game) return sock.sendMessage(chatId, { text: 'There is no active Maths Arena match.', ...channelInfo }, { quoted: message });
      if (!await playerCanEnd(sock, chatId, senderId, context, message, game)) {
        return sock.sendMessage(chatId, { text: 'Only an admin can end the match until you have participated in a question.', ...channelInfo }, { quoted: message });
      }
      return endMatch(sock, chatId, game, 'stopped', message);
    }
    if (action === 'status') {
      if (!game) return sock.sendMessage(chatId, { text: 'No active Maths Arena match. Start with *.math normal*.', ...channelInfo }, { quoted: message });
      const onHold = game.questionClosed && game.noParticipationExpiresAt;
      const statusText = onHold
        ? '🧮 *MATHS ARENA STATUS*\nQuestion ' + game.round + '/' + game.totalRounds + ' · ' + game.mode + '\nStatus: ON HOLD — no submissions\nMatch ends in: ' + Math.max(0, Math.ceil((game.noParticipationExpiresAt - Date.now()) / 1000)) + 's\n\n' + (formatScores(game.scores, 10).join('\n') || 'No scores yet.')
        : '🧮 *MATHS ARENA STATUS*\nQuestion ' + game.round + '/' + game.totalRounds + ' · ' + game.mode + '\nTime left: ' + Math.max(0, Math.ceil((game.expiresAt - Date.now()) / 1000)) + 's\n\n' + (formatScores(game.scores, 10).join('\n') || 'No scores yet.');
      return sock.sendMessage(chatId, { text: statusText, ...channelInfo }, { quoted: message });
    }
    if (action === 'score' || action === 'scores' || action === 'leaderboard') {
      const records = (await store.getSetting(chatId, RECORD_KEY)) || {};
      const ranking = Object.entries(records).sort((a, b) => (b[1].points || 0) - (a[1].points || 0)).slice(0, 10);
      return sock.sendMessage(chatId, { text: `🏆 *MATHS ARENA — GROUP LEADERBOARD*\n\n${ranking.map(([jid, r], i) => `${i + 1}. ${mention(jid)} — ${r.points || 0} pts · ${r.wins || 0} wins`).join('\n') || 'No completed matches yet.'}`, mentions: ranking.map(([jid]) => jid), ...channelInfo }, { quoted: message });
    }
    if (game) return sock.sendMessage(chatId, { text: 'A Maths Arena match is already active. Use *.math status* or *.math stop*.', ...channelInfo }, { quoted: message });
    const mode = action === 'start' ? String(args[1] || 'normal').toLowerCase() : action;
    if (!Object.hasOwn(MATH_MODES, mode)) {
      return sock.sendMessage(chatId, { text: `🧮 *MATHS ARENA DIFFICULTIES*\n\n${Object.keys(MATH_MODES).join(' · ')}\n\nExample: ${config.prefix}math normal\n10 questions · first correct answer wins each round · speed bonus · group leaderboard.`, ...channelInfo }, { quoted: message });
    }
    const totalRounds = getMathMatchQuestionCount(mode);
    const negativeQuestionCount = getMathNegativeQuestionCount(mode, totalRounds);
    const roundOrder = Array.from({ length: totalRounds }, (_, index) => index + 1);
    for (let i = roundOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roundOrder[i], roundOrder[j]] = [roundOrder[j], roundOrder[i]];
    }
    const negativeRounds = roundOrder.slice(0, negativeQuestionCount).sort((a, b) => a - b);
    game = {
      active: true, mode, round: 0, totalRounds, negativeRounds,
      scores: {}, attemptedBy: {}, participants: {}, startedBy: senderId,
      startedAt: Date.now(), matchExpiresAt: Date.now() + MATCH_EXPIRY_MS
    };
    await saveGame(chatId, game);
    await sock.sendMessage(chatId, { text: `🎮 *MATHS ARENA MATCH STARTED*\n\nDifficulty: *${mode.toUpperCase()}*\nQuestions: *${totalRounds}*\nPlayers: everyone in this group can join.\n\nFirst correct answer wins each round. Reply directly to each question.\n🏆 ${config.prefix}math score · ${config.prefix}math status · ${config.prefix}math stop`, ...channelInfo }, { quoted: message });
    await postNextQuestion(sock, chatId, game);
  }
};

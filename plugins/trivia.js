import store from '../lib/lightweight_store.js';
import { isFeatureGroup } from '../lib/featureGroups.js';
import { isGameAllowed } from './daylock.js';
import isAdmin from '../lib/isAdmin.js';
import { NIGERIA_TRIVIA, TRIVIA_CATEGORIES } from '../data/nigeriaTrivia.js';

const STATE_KEY = 'triviaArenaV2';
const RECORD_KEY = 'triviaRecords';
const QUESTIONS_PER_MATCH = 10;
const ANSWER_WINDOW_MS = 20000;
const MATCH_EXPIRY_MS = 30 * 60 * 1000;
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

const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase()
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const mention = jid => '@' + String(jid || '').split('@')[0].split(':')[0];
const shuffle = values => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

export { NIGERIA_TRIVIA, TRIVIA_CATEGORIES };

async function readGame(chatId) {
  const game = await store.getSetting(chatId, STATE_KEY);
  if (!game?.active) return null;
  if (game.matchExpiresAt && game.matchExpiresAt <= Date.now()) {
    await store.saveSettingVerified(chatId, STATE_KEY, { ...game, active: false, endedAt: Date.now(), reason: 'expired' });
    clearTimer(chatId);
    return null;
  }
  return game;
}
async function saveGame(chatId, game) {
  if (!await store.saveSettingVerified(chatId, STATE_KEY, game)) throw new Error('Trivia state could not be persisted.');
}
function clearTimer(chatId) {
  const timer = timers.get(chatId);
  if (timer) clearTimeout(timer);
  timers.delete(chatId);
}
function formatScores(scores, limit = 5) {
  return Object.entries(scores || {}).sort((a, b) => b[1] - a[1]).slice(0, limit)
    .map(([jid, score], i) => `${i + 1}. ${mention(jid)} — ${score} pts`);
}
function getQuestion(game) {
  const used = new Set(game.usedQuestions || []);
  let pool = NIGERIA_TRIVIA.filter(q =>
    (!game.category || game.category === 'all' || q.category === game.category) &&
    (!game.difficulty || q.difficulty === game.difficulty) &&
    !used.has(q.id)
  );
  if (!pool.length) {
    game.usedQuestions = [];
    pool = NIGERIA_TRIVIA.filter(q =>
      (!game.category || game.category === 'all' || q.category === game.category) &&
      (!game.difficulty || q.difficulty === game.difficulty)
    );
  }
  if (!pool.length) {
    // A category may not yet have questions at every difficulty. Keep the selected category
    // and fall back to its full difficulty range rather than failing the match.
    pool = NIGERIA_TRIVIA.filter(q =>
      (!game.category || game.category === 'all' || q.category === game.category) &&
      !used.has(q.id)
    );
  }\n  if (!pool.length) throw new Error('No questions are available for this category.');
  const source = pool[Math.floor(Math.random() * pool.length)];
  game.usedQuestions.push(source.id);
  const choices = shuffle(source.options.map((text, index) => ({ text, correct: index === source.answer })));
  return {
    questionId: source.id,
    categoryName: source.category,
    difficulty: source.difficulty,
    question: source.question,
    options: choices.map(item => item.text),
    answerIndex: choices.findIndex(item => item.correct),
    answer: choices.find(item => item.correct).text
  };
}
function renderQuestion(game) {
  return [
    '🇳🇬 *FORGE GUARD — NAIJA TRIVIA ARENA*',
    `📚 ${game.categoryName.toUpperCase()} · ${game.difficulty.toUpperCase()}`,
    `*QUESTION ${game.round}/${game.totalRounds}*`,
    '',
    game.question,
    '',
    ...game.options.map((option, i) => `${String.fromCharCode(65 + i)}. ${option}`),
    '',
    `⏱️ ${Math.round(ANSWER_WINDOW_MS / 1000)} seconds. Reply directly with A, B, C, D or the full answer.`,
    'One answer per player. Results are revealed when the timer closes.',
    `🏆 ${formatScores(game.scores, 3).join(' | ') || 'No scores yet'}`
  ].join('\n');
}

async function saveMatchRecords(chatId, game) {
  const records = (await store.getSetting(chatId, RECORD_KEY)) || {};
  const playerIds = new Set([...Object.keys(game.participants || {}), ...Object.keys(game.scores || {})]);
  for (const jid of playerIds) {
    const score = game.scores?.[jid] || 0;
    const old = records[jid] || { points: 0, matches: 0, wins: 0 };
    records[jid] = {
      ...old,
      points: (old.points || 0) + score,
      matches: (old.matches || 0) + 1,
      wins: (old.wins || 0) + (jid === game.winner ? 1 : 0),
      lastScore: score,
      lastPlayedAt: Date.now()
    };
  }
  if (!await store.saveSettingVerified(chatId, RECORD_KEY, records)) throw new Error('Trivia leaderboard could not be persisted.');
  return records;
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
  await sock.sendMessage(chatId, {
    text: `🏁 *NAIJA TRIVIA — ${reason === 'completed' ? 'MATCH COMPLETE' : 'MATCH ENDED'}*\n\n${formatScores(game.scores, 10).join('\n') || 'No points were scored.'}\n\n🏆 Champion: ${game.winner ? mention(game.winner) : 'No winner'}`,
    mentions: ranking.map(([jid]) => jid)
  }, quoted ? { quoted } : undefined);
}

async function closeQuestion(sock, chatId, roundToken, reason = 'timeout') {
  return withChatLock(chatId, async () => {
    const game = await readGame(chatId);
    if (!game || game.roundToken !== roundToken || game.questionClosed) return false;
    clearTimer(chatId);
    game.questionClosed = true;
    const correctPlayers = [];
    const answerRows = Object.entries(game.answers || {});
    for (const [jid, answer] of answerRows) {
      if (!answer.correct) continue;
      const elapsed = Math.max(0, answer.answeredAt - game.roundStartedAt);
      const speedBonus = Math.max(0, Math.floor(5 * (1 - elapsed / ANSWER_WINDOW_MS)));
      const points = 10 + speedBonus;
      game.scores[jid] = (game.scores[jid] || 0) + points;
      correctPlayers.push({ jid, points });
    }
    correctPlayers.sort((a, b) => b.points - a.points);
    await saveGame(chatId, game);
    const winners = correctPlayers.map(item => item.jid);
    const result = correctPlayers.length
      ? correctPlayers.map(item => `✅ ${mention(item.jid)} +${item.points}`).join('\n')
      : 'No correct answers this round.';
    await sock.sendMessage(chatId, {
      text: `⏱️ *QUESTION ${game.round} CLOSED*\n\nCorrect answer: *${game.answer}*\n\n${result}\n\n${answerRows.length} player(s) submitted.`,
      mentions: winners
    });
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
  if (!game?.active || game.questionClosed || !game.closesAt || timers.has(chatId)) return;
  const delay = Math.max(0, game.closesAt - Date.now());
  const token = game.roundToken;
  timers.set(chatId, setTimeout(() => closeQuestion(sock, chatId, token).catch(error => console.error('[TRIVIA] Timer error:', error.message)), delay));
}

async function postNextQuestion(sock, chatId, game) {
  game.round += 1;
  game.questionClosed = false;
  game.roundStartedAt = Date.now();
  game.closesAt = game.roundStartedAt + ANSWER_WINDOW_MS;
  game.answers = {};
  Object.assign(game, getQuestion(game));
  game.roundToken = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const sent = await sock.sendMessage(chatId, { text: renderQuestion(game) });
  game.questionMessageId = sent?.key?.id || null;
  await saveGame(chatId, game);
  armTimer(sock, chatId, game);
}

function parseAnswer(raw, game) {
  const value = normalize(raw);
  const letter = ['a', 'b', 'c', 'd'].indexOf(value);
  if (letter >= 0) return letter === game.answerIndex;
  return value === normalize(game.answer);
}

function mentionBot(sock, message) {
  const botNumber = String(sock.user?.id || '').split(':')[0].split('@')[0];
  const mentions = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  return mentions.some(jid => String(jid).split(':')[0].split('@')[0] === botNumber);
}

export async function handleTriviaContinuity(sock, chatId, message, senderId) {
  if (!chatId?.endsWith('@g.us') || message?.key?.fromMe || !isFeatureGroup(chatId)) return false;
  const pendingGame = await readGame(chatId);
  if (!pendingGame) return false;
  armTimer(sock, chatId, pendingGame);
  const contextInfo = message.message?.extendedTextMessage?.contextInfo || message.message?.imageMessage?.contextInfo || {};
  const replied = !!contextInfo.stanzaId;
  const tagged = mentionBot(sock, message);
  if (!replied && !tagged) return false;
  const result = await withChatLock(chatId, async () => {
    const game = await readGame(chatId);
    if (!game) return false;
    armTimer(sock, chatId, game);
    const isCurrentQuestion = !!(contextInfo.stanzaId && game.questionMessageId && contextInfo.stanzaId === game.questionMessageId);
    if (!isCurrentQuestion && !tagged) return false;
    const access = await isGameAllowed(chatId, 'trivia');
    if (!access.ok) {
      await sock.sendMessage(chatId, { text: access.msg }, { quoted: message });
      return true;
    }
    if (tagged && !isCurrentQuestion) return { handled: true, closeToken: game.roundToken, reason: 'skipped' };
    if (game.questionClosed || Date.now() >= game.closesAt) {
      return { handled: true, closeToken: game.roundToken, reason: 'timeout' };
    }
    const sender = senderId || message.key.participant;
    if (!sender) return true;
    if (game.answers?.[sender]) {
      await sock.sendMessage(chatId, { text: 'Your answer for this question has already been submitted.' }, { quoted: message });
      return true;
    }
    const raw = message.message?.conversation || message.message?.extendedTextMessage?.text ||
      message.message?.imageMessage?.caption || message.message?.videoMessage?.caption || '';
    if (!raw.trim()) return true;
    game.answers = game.answers || {};
    game.answers[sender] = { correct: parseAnswer(raw, game), submitted: normalize(raw), answeredAt: Date.now() };
    game.participants = game.participants || {};
    game.participants[sender] = true;
    await saveGame(chatId, game);
    await sock.sendMessage(chatId, {
      text: `📝 Answer received, ${mention(sender)}. Results will be revealed when the timer closes.`,
      mentions: [sender]
    }, { quoted: message });
    return true;
  });
  if (result?.closeToken) await closeQuestion(sock, chatId, result.closeToken, result.reason);
  return result === true || !!result?.handled;
}

async function canEnd(sock, chatId, senderId, context, message, game) {
  let admin = !!(context.isSenderAdmin || context.senderIsOwnerOrSudo || context.isOwnerOrSudoCheck || message.key.fromMe);
  if (!admin) {
    try { admin = !!(await isAdmin(sock, chatId, senderId)).isSenderAdmin; } catch {}
  }
  return admin || !!game.participants?.[senderId];
}

export default {
  command: 'trivia',
  aliases: ['quiz'],
  category: 'games',
  description: 'Play Nigeria-focused multiplayer group trivia.',
  usage: '.trivia [start <category> <difficulty>] | .trivia status | .trivia score | .trivia stop',
  groupOnly: true,
  async handler(sock, message, args, context) {
    const { chatId, senderId, channelInfo } = context;
    if (!isFeatureGroup(chatId)) return sock.sendMessage(chatId, { text: 'Naija Trivia is available in the designated Forge Guard game groups.', ...channelInfo }, { quoted: message });
    const rawAction = String(args[0] || 'start').toLowerCase();
    const access = await isGameAllowed(chatId, 'trivia');
    if (!['stop', 'end', 'status', 'score', 'scores', 'leaderboard'].includes(rawAction) && !access.ok) {
      return sock.sendMessage(chatId, { text: access.msg, ...channelInfo }, { quoted: message });
    }
    let game = await readGame(chatId);
    if (['stop', 'end'].includes(rawAction)) {
      if (!game) return sock.sendMessage(chatId, { text: 'There is no active Naija Trivia match.', ...channelInfo }, { quoted: message });
      if (!await canEnd(sock, chatId, senderId, context, message, game)) {
        return sock.sendMessage(chatId, { text: 'Only an admin can end the match until you have participated in a question.', ...channelInfo }, { quoted: message });
      }
      return endMatch(sock, chatId, game, 'stopped', message);
    }
    if (rawAction === 'status') {
      if (!game) return sock.sendMessage(chatId, { text: 'No active Naija Trivia match. Start with *.trivia*.', ...channelInfo }, { quoted: message });
      return sock.sendMessage(chatId, { text: `🇳🇬 *NAIJA TRIVIA STATUS*\nQuestion ${game.round}/${game.totalRounds}\nCategory: ${game.category}\nTime left: ${Math.max(0, Math.ceil((game.closesAt - Date.now()) / 1000))}s\nAnswers submitted: ${Object.keys(game.answers || {}).length}\n\n${formatScores(game.scores, 10).join('\n') || 'No scores yet.'}`, ...channelInfo }, { quoted: message });
    }
    if (['score', 'scores', 'leaderboard'].includes(rawAction)) {
      const records = (await store.getSetting(chatId, RECORD_KEY)) || {};
      const ranking = Object.entries(records).sort((a, b) => (b[1].points || 0) - (a[1].points || 0)).slice(0, 10);
      return sock.sendMessage(chatId, { text: `🏆 *NAIJA TRIVIA — GROUP LEADERBOARD*\n\n${ranking.map(([jid, r], i) => `${i + 1}. ${mention(jid)} — ${r.points || 0} pts · ${r.wins || 0} wins`).join('\n') || 'No completed matches yet.'}`, mentions: ranking.map(([jid]) => jid), ...channelInfo }, { quoted: message });
    }
    if (game) return sock.sendMessage(chatId, { text: 'A Naija Trivia match is already active. Reply to its question, or use *.trivia status*.', ...channelInfo }, { quoted: message });

    const startArgs = rawAction === 'start' ? args.slice(1) : args;
    let category = 'all';
    let difficulty = null;
    for (const value of startArgs.map(v => String(v).toLowerCase())) {
      if (TRIVIA_CATEGORIES.includes(value)) category = value;
      else if (['easy', 'medium', 'hard'].includes(value)) difficulty = value;
    }
    game = {
      active: true, category, difficulty, round: 0, totalRounds: QUESTIONS_PER_MATCH,
      scores: {}, answers: {}, participants: {}, usedQuestions: [],
      startedBy: senderId, startedAt: Date.now(), matchExpiresAt: Date.now() + MATCH_EXPIRY_MS
    };
    await saveGame(chatId, game);
    await sock.sendMessage(chatId, {
      text: `🇳🇬 *NAIJA TRIVIA MATCH STARTED*\n\nCategory: *${category.toUpperCase()}*\nDifficulty: *${(difficulty || 'MIXED').toUpperCase()}*\nQuestions: *${QUESTIONS_PER_MATCH}*\n\nEveryone can play. Each player gets one answer per question. You have 20 seconds; scores are revealed after the window closes.\n\n*.trivia status* · *.trivia score* · *.trivia stop*`,
      ...channelInfo
    }, { quoted: message });
    try {
      await postNextQuestion(sock, chatId, game);
    } catch (error) {
      game.active = false;
      game.endedAt = Date.now();
      game.reason = 'question-bank-error';
      await saveGame(chatId, game);
      return sock.sendMessage(chatId, { text: '⚠️ Trivia could not load a question for that selection. Choose another category or difficulty.', ...channelInfo }, { quoted: message });
    }
  }
};

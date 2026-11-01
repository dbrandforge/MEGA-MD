import store from '../lib/lightweight_store.js';
import { isFeatureGroup } from '../lib/featureGroups.js';
import { isGameAllowed } from './daylock.js';
import isAdmin from '../lib/isAdmin.js';
import { WORDS } from '../data/hangmanWords.js';
export { WORDS };

const STATE_KEY = 'hangmanGame';
const USED_KEY = 'hangmanUsedWords';
const RECORD_KEY = 'hangmanHighScores';
const MAX_WRONG = 6;
export const QUESTIONS_PER_ROUND = 20;

// Mature, adult-oriented vocabulary suited to the feature groups.
// Word list lives in data/hangmanWords.js (500 explicit entries).

const normalize = value => String(value || '').toLowerCase().replace(/[^a-z]/g, '');
const maskWord = (word, guessed) => [...word].map(char => guessed.includes(char) ? char : '_');
const pick = values => values[Math.floor(Math.random() * values.length)];
const getRecords = async chatId => (await store.getSetting(chatId, RECORD_KEY)) || {};
const saveRecords = (chatId, records) => store.saveSetting(chatId, RECORD_KEY, records);

async function readGame(chatId) {
  const game = await store.getSetting(chatId, STATE_KEY);
  if (!game || game.status !== 'active') return null;
  if (game.expiresAt && game.expiresAt <= Date.now()) {
    await store.saveSetting(chatId, STATE_KEY, {...game, status:'ended', endedAt:Date.now(), reason:'expired'});
    return null;
  }
  return game;
}
const writeGame = (chatId, game) => store.saveSetting(chatId, STATE_KEY, game);

async function selectRoundWords(chatId) {
  let used = (await store.getSetting(chatId, USED_KEY)) || [];
  let available = WORDS.filter(item => !used.includes(item.word));
  // Preserve the tail of a cycle instead of repeating unused words just to fill twenty.
  if (!available.length) {
    used = [];
    available = [...WORDS];
  }
  const selected = [];
  const roundSize = Math.min(QUESTIONS_PER_ROUND, available.length);
  while (selected.length < roundSize && available.length) {
    const item = pick(available);
    selected.push(item);
    available = available.filter(entry => entry.word !== item.word);
    used.push(item.word);
  }
  await store.saveSetting(chatId, USED_KEY, used);
  return selected;
}

function renderBoard(game, intro = '') {
  const word = maskWord(game.word, game.guessed);
  const misses = game.wrong.length + (game.wrongWordGuesses || 0);
  const revealed = game.hintsRevealed || 0;
  const lines = [
    intro,
    `🧩 *FORGE GUARD — HANGMAN · QUESTION ${game.questionNumber}/${game.roundWords?.length || QUESTIONS_PER_ROUND}*`,
    `Category: *${game.category}*  |  Letters: *${game.word.length}*`,
    '',
    `*Word:*  ${word.join(' ')}`,
    `*Wrong guesses:* ${misses}/${MAX_WRONG}`,
    `*Guessed letters:* ${game.guessed.length ? game.guessed.join(', ').toUpperCase() : '—'}`,
    '',
    `💡 *Hint:* ${game.hint}`,
  ];
  if (revealed >= 1 && game.synonymHint) lines.push(`💡 *Synonym hint:* ${game.synonymHint}`);
  if (game.extraHints?.length) {
    for (let i = 0; i < Math.min(revealed, game.extraHints.length); i++) {
      lines.push(`💡 *Extra:* ${game.extraHints[i]}`);
    }
  }
  lines.push('', '_Type *.guess <letter>* or *.guess <whole-word>*_');
  return lines.filter(Boolean).join('\n');
}

async function awardPoint(chatId, solverId, game) {
  game.scores = game.scores || {};
  game.scores[solverId] = (game.scores[solverId] || 0) + 1;
  const records = await getRecords(chatId);
  const previous = records[solverId];
  const totalSolved = typeof previous === 'number' ? previous : (previous?.totalSolved || previous?.highestScore || 0);
  records[solverId] = {
    ...(typeof previous === 'object' && previous ? previous : {}),
    totalSolved: totalSolved + 1
  };
  await saveRecords(chatId, records);
}

async function advanceOrEnd(sock, chatId, game, message, channelInfo, solvedBy) {
  const idx = game.questionNumber;
  if (idx >= QUESTIONS_PER_ROUND || !game.roundWords || idx >= game.roundWords.length) {
    game.status = 'ended';
    game.endedAt = Date.now();
    game.reason = 'completed';
    await writeGame(chatId, game);
    const scores = Object.entries(game.scores || {}).sort((a, b) => b[1] - a[1]);
    const records = await getRecords(chatId);
    for (const [jid, score] of scores) {
      const previous = records[jid];
      const totalSolved = typeof previous === 'number' ? previous : (previous?.totalSolved || previous?.highestScore || 0);
      const bestRoundScore = Math.max(previous?.bestRoundScore || previous?.highestScore || 0, score);
      records[jid] = {
        ...(typeof previous === 'object' && previous ? previous : {}),
        totalSolved,
        bestRoundScore,
        highestScore: bestRoundScore,
        rounds: (previous?.rounds || 0) + 1,
        lastRoundScore: score,
        lastPlayedAt: Date.now()
      };
    }
    const leader = scores[0];
    if (leader && leader[1] > (records.groupRecord || 0)) {
      records.groupRecord = leader[1];
      records.groupRecordHolder = leader[0];
    }
    await saveRecords(chatId, records);
    const scoreLines = scores.length
      ? scores.map(([id, n], i) => `${i + 1}. @${id.split('@')[0]} — *${n}/${game.roundWords?.length || QUESTIONS_PER_ROUND}*`).join('\n')
      : '_No points this round._';
    const mentions = scores.map(([id]) => id);
    await sock.sendMessage(chatId, {
      text: `🏁 *HANGMAN ROUND COMPLETE*\n\n${solvedBy ? `Last word solved by @${solvedBy.split('@')[0]}.\n\n` : ''}*Round scores:*\n${scoreLines}\n\n_Use *.hangman* for another 20-question round._`,
      mentions,
      ...channelInfo
    }, { quoted: message });
    return;
  }
  const next = game.roundWords[idx];
  game.questionNumber = idx + 1;
  game.word = next.word;
  game.category = next.category;
  game.hint = next.hint;
  game.synonymHint = next.synonymHint;
  game.extraHints = next.extraHints || [];
  game.hintsRevealed = 0;
  game.guessed = [];
  game.wrong = [];
  game.wrongWordGuesses = 0;
  game.wordGuesses = [];
  game.lastMoveAt = Date.now();
  game.expiresAt = Date.now() + 30 * 60 * 1000;
  await writeGame(chatId, game);
  await sock.sendMessage(chatId, {
    text: renderBoard(game, solvedBy ? `✅ @${solvedBy.split('@')[0]} solved it. Next question:\n` : ''),
    mentions: solvedBy ? [solvedBy] : [],
    ...channelInfo
  }, { quoted: message });
}

export async function handleHangmanGuess(sock, chatId, message, senderId, guessRaw, channelInfo = {}) {
  if (!chatId?.endsWith('@g.us') || message?.key?.fromMe) return false;
  if (!isFeatureGroup(chatId)) return false;
  const game = await readGame(chatId);
  if (!game) return false;
  const access = await isGameAllowed(chatId, 'hangman');
  if (!access.ok) {
    await sock.sendMessage(chatId, { text: access.msg, ...channelInfo }, { quoted: message });
    return true;
  }
  const guess = normalize(guessRaw);
  if (!guess) return true;
  game.attemptedBy = game.attemptedBy || {};
  game.lastMoveAt = Date.now();
  game.expiresAt = Date.now() + 30 * 60 * 1000;

  if (guess.length === 1) {
    if (game.guessed.includes(guess) || game.wrong.includes(guess)) {
      await sock.sendMessage(chatId, { text: `Already tried *${guess.toUpperCase()}*.`, ...channelInfo }, { quoted: message });
      return true;
    }
    if (game.word.includes(guess)) {
      game.guessed.push(guess);
      await writeGame(chatId, game);
      const done = [...game.word].every(ch => game.guessed.includes(ch));
      if (done) {
        await awardPoint(chatId, senderId, game);
        await sock.sendMessage(chatId, { text: `✅ *${game.word.toUpperCase()}* — point for @${senderId.split('@')[0]}!`, mentions: [senderId], ...channelInfo }, { quoted: message });
        await advanceOrEnd(sock, chatId, game, message, channelInfo, senderId);
      } else {
        await sock.sendMessage(chatId, { text: renderBoard(game, `✅ *${guess.toUpperCase()}* is in the word.\n`), ...channelInfo }, { quoted: message });
      }
    } else {
      game.wrong.push(guess);
      await writeGame(chatId, game);
      const misses = game.wrong.length + (game.wrongWordGuesses || 0);
      if (misses >= MAX_WRONG) {
        await sock.sendMessage(chatId, { text: `💀 Out of guesses. The word was *${game.word}*.`, ...channelInfo }, { quoted: message });
        await advanceOrEnd(sock, chatId, game, message, channelInfo, null);
      } else {
        await sock.sendMessage(chatId, { text: renderBoard(game, `❌ *${guess.toUpperCase()}* is not in the word.\n`), ...channelInfo }, { quoted: message });
      }
    }
    return true;
  }

  // whole word guess
  game.wordGuesses = game.wordGuesses || [];
  if (game.wordGuesses.includes(guess)) {
    await sock.sendMessage(chatId, { text: 'That whole-word guess was already tried.', ...channelInfo }, { quoted: message });
    return true;
  }
  game.wordGuesses.push(guess);
  if (guess === game.word) {
    game.guessed = [...new Set(game.word)];
    await awardPoint(chatId, senderId, game);
    await writeGame(chatId, game);
    await sock.sendMessage(chatId, { text: `✅ *${game.word.toUpperCase()}* — point for @${senderId.split('@')[0]}!`, mentions: [senderId], ...channelInfo }, { quoted: message });
    await advanceOrEnd(sock, chatId, game, message, channelInfo, senderId);
  } else {
    game.wrongWordGuesses = (game.wrongWordGuesses || 0) + 1;
    await writeGame(chatId, game);
    const misses = game.wrong.length + game.wrongWordGuesses;
    if (misses >= MAX_WRONG) {
      await sock.sendMessage(chatId, { text: `💀 Out of guesses. The word was *${game.word}*.`, ...channelInfo }, { quoted: message });
      await advanceOrEnd(sock, chatId, game, message, channelInfo, null);
    } else {
      await sock.sendMessage(chatId, { text: renderBoard(game, `❌ *${guess}* is not the word.\n`), ...channelInfo }, { quoted: message });
    }
  }
  return true;
}

export default {
  command: 'hangman',
  aliases: ['hm'],
  category: 'games',
  description: 'Mature Hangman with shared board and scoring',
  usage: '.hangman | .hangman status | .hangman hint | .hangman score | .hangman stop',
  groupOnly: true,
  async handler(sock, message, args, context) {
    const chatId = context.chatId || message.key.remoteJid;
    const senderId = context.senderId || message.key.participant || message.key.remoteJid;
    const channelInfo = context.channelInfo || {};
    if (!isFeatureGroup(chatId)) {
      return sock.sendMessage(chatId, { text: 'Hangman is available in the designated game groups.', ...channelInfo }, { quoted: message });
    }
    const access = await isGameAllowed(chatId, 'hangman');
    if (!access.ok) return sock.sendMessage(chatId, { text: access.msg, ...channelInfo }, { quoted: message });
    const action = (args[0] || '').toLowerCase();
    const current = await readGame(chatId);
    if (action === 'score' || action === 'scores' || action === 'record') {
      const records = await getRecords(chatId);
      const ranked = Object.entries(records)
        .filter(([id]) => !['groupRecord', 'groupRecordHolder'].includes(id))
        .sort((a, b) => {
          const av = typeof a[1] === 'number' ? a[1] : (a[1]?.totalSolved || 0);
          const bv = typeof b[1] === 'number' ? b[1] : (b[1]?.totalSolved || 0);
          return bv - av;
        }).slice(0, 10);
      const text = ranked.length
        ? ranked.map(([id, record], i) => {
            const total = typeof record === 'number' ? record : (record.totalSolved || 0);
            const best = typeof record === 'number' ? record : (record.bestRoundScore || record.highestScore || 0);
            return `${i + 1}. @${id.split('@')[0]} — ${total} solved · best round ${best}/${QUESTIONS_PER_ROUND}`;
          }).join('\n')
        : '_No scores yet._';
      const holder = records.groupRecordHolder ? `\n\nGroup record: @${records.groupRecordHolder.split('@')[0]} — ${records.groupRecord}/${QUESTIONS_PER_ROUND}` : '';
      return sock.sendMessage(chatId, { text: `🏆 *HANGMAN ALL-TIME RECORDS*\n\n${text}${holder}`, mentions: [...ranked.map(([id]) => id), ...(records.groupRecordHolder ? [records.groupRecordHolder] : [])], ...channelInfo }, { quoted: message });
    }
    if (action === 'stop' || action === 'end') {
      if (!current) return sock.sendMessage(chatId, { text: 'There is no active Hangman round to stop.', ...channelInfo }, { quoted: message });
      let admin = !!(context.isSenderAdmin || context.senderIsOwnerOrSudo || context.isOwnerOrSudoCheck || message.key.fromMe);
      if (!admin) { try { admin = !!(await isAdmin(sock, chatId, senderId)).isSenderAdmin; } catch {} }
      if (!admin) return sock.sendMessage(chatId, { text: 'Only an admin can stop an active Hangman round.', ...channelInfo }, { quoted: message });
      current.status = 'ended'; current.endedAt = Date.now(); current.reason = 'admin-stopped';
      await writeGame(chatId, current);
      return sock.sendMessage(chatId, { text: `🛑 Hangman stopped. The word was *${current.word}*.`, ...channelInfo }, { quoted: message });
    }
    if (action === 'status' || action === 'hint') {
      if (!current) return sock.sendMessage(chatId, { text: 'No active round. Start one with *.hangman*.', ...channelInfo }, { quoted: message });
      if (action === 'hint' && current.extraHints?.length && current.hintsRevealed < current.extraHints.length) {
        current.hintsRevealed += 1;
        await writeGame(chatId, current);
      }
      return sock.sendMessage(chatId, { text: renderBoard(current), ...channelInfo }, { quoted: message });
    }
    if (current) return sock.sendMessage(chatId, { text: 'A Hangman round is already active. Use *.hangman status*, *.hangman hint*, *.hangman score* or *.hangman stop*.', ...channelInfo }, { quoted: message });
    const roundWords = await selectRoundWords(chatId);
    const first = roundWords[0];
    const game = {
      status: 'active', roundWords, questionNumber: 1, word: first.word, category: first.category,
      hint: first.hint, synonymHint: first.synonymHint, extraHints: first.extraHints || [],
      hintsRevealed: 0, difficulty: 'mature', guessed: [], wrong: [], wrongWordGuesses: 0,
      wordGuesses: [], scores: {}, attemptedBy: {}, startedAt: Date.now(), lastMoveAt: Date.now(),
      expiresAt: Date.now() + 30 * 60 * 1000
    };
    await writeGame(chatId, game);
    return sock.sendMessage(chatId, {
      text: `🎮 *FORGE GUARD — HANGMAN CHALLENGE*\n\nTwenty questions. Shared board. Points per solved word. Pool: *${WORDS.length}* mature words.\n\n${renderBoard(game)}\n\n_Type *.guess <letter>* or *.guess <whole-word>*._`,
      ...channelInfo
    }, { quoted: message });
  }
};

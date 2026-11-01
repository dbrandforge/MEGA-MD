import axios from 'axios';
import store from '../lib/lightweight_store.js';
import { isFeatureGroup } from '../lib/featureGroups.js';
import { isGameAllowed } from './daylock.js';
import isAdmin from '../lib/isAdmin.js';

const KEY = 'triviaGame';
const EXPIRY_MS = 45 * 60 * 1000;
const decode = value => String(value ?? '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'")
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&eacute;/g, 'é').replace(/&rsquo;|&lsquo;/g, "'")
  .replace(/&ldquo;|&rdquo;/g, '"');

const shuffle = values => [...values].sort(() => Math.random() - 0.5);
const normalize = value => decode(value).normalize('NFKC').toLowerCase()
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

async function getGame(chatId) {
  const game = await store.getSetting(chatId, KEY);
  if (!game?.active) return null;
  if (game.expiresAt && game.expiresAt < Date.now()) {
    await store.saveSetting(chatId, KEY, { active: false, endedAt: Date.now(), reason: 'expired', scores: game.scores || {} });
    return null;
  }
  return game;
}
const saveGame = (chatId, game) => store.saveSetting(chatId, KEY, game);

async function fetchQuestion(category, difficulty) {
  const params = { amount: 1, type: 'multiple' };
  if (category && /^\d+$/.test(category)) params.category = Number(category);
  if (['easy','medium','hard'].includes(difficulty)) params.difficulty = difficulty;
  const response = await axios.get('https://opentdb.com/api.php', { params, timeout: 10000 });
  const item = response.data?.results?.[0];
  if (!item?.question || !item?.correct_answer || !Array.isArray(item.incorrect_answers)) throw new Error('Invalid trivia response');
  return {
    question: decode(item.question),
    answer: decode(item.correct_answer),
    options: shuffle([...item.incorrect_answers, item.correct_answer].map(decode)),
    categoryName: decode(item.category || 'General Knowledge'),
    difficulty: item.difficulty || difficulty || 'mixed'
  };
}
function mentionBot(sock, message) {
  const number = (sock.user?.id || '').split(':')[0].split('@')[0];
  return (message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [])
    .some(jid => jid.split('@')[0].split(':')[0] === number);
}
function textOf(message) {
  return (message.message?.conversation || message.message?.extendedTextMessage?.text ||
    message.message?.imageMessage?.caption || message.message?.videoMessage?.caption || '').trim();
}
function render(game, intro = '') {
  return [
    intro,
    '🧠 *FORGE GUARD — TRIVIA ARENA*',
    `📚 *${game.categoryName}*  ·  ${String(game.difficulty).toUpperCase()}`,
    '',
    game.question,
    '',
    ...game.options.map((option, i) => `${String.fromCharCode(65+i)}. ${option}`),
    '',
    '_Reply to this question with A, B, C, D or the full answer. Tag the bot to skip._',
    `🏆 Leader: ${Object.entries(game.scores || {}).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'No scores yet'}`
  ].filter(Boolean).join('\n');
}
async function postQuestion(sock, chatId, game, quoted) {
  const question = await fetchQuestion(game.category, game.difficulty);
  Object.assign(game, question, { questionMessageId: null, expiresAt: Date.now() + EXPIRY_MS });
  const sent = await sock.sendMessage(chatId, { text: render(game) }, quoted ? { quoted } : undefined);
  game.questionMessageId = sent?.key?.id || null;
  await saveGame(chatId, game);
}
async function advance(sock, chatId, message, senderId, answer, skip = false) {
  const access = await isGameAllowed(chatId, 'trivia');
  if (!access.ok) { await sock.sendMessage(chatId, { text: access.msg }, { quoted: message }); return true; }
  const access = await isGameAllowed(chatId, 'trivia');
  if (!access.ok) { await sock.sendMessage(chatId, { text: access.msg }, { quoted: message }); return true; }
  const game = await getGame(chatId);
  if (!game) return false;
  let feedback = '⏭️ Question skipped.';
  if (!skip) {
    game.attempts = game.attempts || {};
    game.attempts[senderId] = (game.attempts[senderId] || 0) + 1;
    const key = normalize(answer);
    const index = ['a','b','c','d'].indexOf(key);
    const selected = index >= 0 ? game.options[index] : answer;
    if (normalize(selected) === normalize(game.answer)) {
      game.scores = game.scores || {};
      game.scores[senderId] = (game.scores[senderId] || 0) + 1;
      feedback = `✅ Correct, @${senderId.split('@')[0]}! *${game.answer}*\n🏆 Your score: *${game.scores[senderId]}*`;
    } else {
      feedback = `❌ Not quite. The correct answer was *${game.answer}*.`;
    }
  }
  await saveGame(chatId, game);
  await sock.sendMessage(chatId, { text: feedback, mentions: skip ? [] : [senderId] }, { quoted: message });
  try { await postQuestion(sock, chatId, game, message); }
  catch (error) {
    game.active = false; game.endedAt = Date.now(); game.reason = 'provider-unavailable';
    await saveGame(chatId, game);
    await sock.sendMessage(chatId, { text: '⚠️ Trivia provider is temporarily unavailable. The round is paused; your scores are محفوظ.' }, { quoted: message });
  }
  return true;
}

export async function handleTriviaContinuity(sock, chatId, message, senderId) {
  if (!chatId?.endsWith('@g.us') || message?.key?.fromMe || !isFeatureGroup(chatId)) return false;
  const game = await getGame(chatId);
  if (!game) return false;
  const ctx = message.message?.extendedTextMessage?.contextInfo || message.message?.imageMessage?.contextInfo || {};
  const replied = !!(ctx.stanzaId && game.questionMessageId && ctx.stanzaId === game.questionMessageId);
  const tagged = mentionBot(sock, message);
  if (!replied && !tagged) return false;
  const answer = textOf(message);
  return advance(sock, chatId, message, senderId || message.key.participant, answer, tagged && !replied);
}

export default {
  command: 'trivia',
  aliases: ['quiz'],
  category: 'games',
  description: 'Play persistent group trivia with categories, difficulty and scoring.',
  usage: '.trivia [start|stop|status|score] [easy|medium|hard]',
  groupOnly: true,
  async handler(sock, message, args, context) {
    const { chatId, senderId, channelInfo } = context;
    if (!isFeatureGroup(chatId)) return sock.sendMessage(chatId, { text: 'Trivia is available in the designated game groups.', ...channelInfo }, { quoted: message });
    const action = (args[0] || 'start').toLowerCase();
    if (!['stop', 'end', 'status', 'score'].includes(action)) {
      const access = await isGameAllowed(chatId, 'trivia');
      if (!access.ok) return sock.sendMessage(chatId, { text: access.msg, ...channelInfo }, { quoted: message });
    }
    let game = await getGame(chatId);
    if (['stop','end'].includes(action)) {
      if (!game) return sock.sendMessage(chatId, { text: 'There is no active trivia round.', ...channelInfo }, { quoted: message });
      let admin = !!(context.isSenderAdmin || context.senderIsOwnerOrSudo || context.isOwnerOrSudoCheck || message.key.fromMe);
      if (!admin) { try { admin = !!(await isAdmin(sock, chatId, senderId)).isSenderAdmin; } catch {} }
      if (!admin && !(game.attempts?.[senderId] > 0)) return sock.sendMessage(chatId, { text: 'Only an admin can end Trivia independently. Players can end it after answering at least one question.', ...channelInfo }, { quoted: message });
      game.active = false; game.endedAt = Date.now(); game.reason = admin ? 'admin-stopped' : 'player-stopped';
      await saveGame(chatId, game);
      const scores = Object.entries(game.scores || {}).sort((a,b)=>b[1]-a[1]).slice(0,5);
      return sock.sendMessage(chatId, { text: `🛑 *Trivia ended.*\n\n🏆 *Top scores*\n${scores.map(([id,n],i)=>`${i+1}. @${id.split('@')[0]} — ${n}`).join('\n') || 'No scores recorded.'}`, mentions: scores.map(([id])=>id), ...channelInfo }, { quoted: message });
    }
    if (action === 'status' || action === 'score') {
      if (!game) return sock.sendMessage(chatId, { text: 'No active trivia game. Start with *.trivia*.', ...channelInfo }, { quoted: message });
      const scores = Object.entries(game.scores || {}).sort((a,b)=>b[1]-a[1]).slice(0,10);
      return sock.sendMessage(chatId, { text: `📊 *TRIVIA SCOREBOARD*\n${scores.map(([id,n],i)=>`${i+1}. @${id.split('@')[0]} — ${n}`).join('\n') || 'No scores yet.'}`, mentions: scores.map(([id])=>id), ...channelInfo }, { quoted: message });
    }
    if (game) return sock.sendMessage(chatId, { text: 'A trivia round is already active. Reply to its question, or use *.trivia stop* to end it.', ...channelInfo }, { quoted: message });
    game = { active: true, category: null, difficulty: ['easy','medium','hard'].includes(action) ? action : (['easy','medium','hard'].includes(args[1]) ? args[1] : null), scores: {}, startedAt: Date.now() };
    await saveGame(chatId, game);
    try { await postQuestion(sock, chatId, game, message); }
    catch (error) {
      game.active = false; game.reason = 'provider-unavailable'; await saveGame(chatId, game);
      return sock.sendMessage(chatId, { text: '⚠️ Could not load a trivia question right now. Please try again shortly.', ...channelInfo }, { quoted: message });
    }
  }
};

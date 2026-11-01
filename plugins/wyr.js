import axios from 'axios';
import store from '../lib/lightweight_store.js';
import { isFeatureGroup } from '../lib/featureGroups.js';
import { isGameAllowed } from './daylock.js';
import { FALLBACK } from '../data/wyrPairs.js';
import isAdmin from '../lib/isAdmin.js';

const KEY = 'wouldYouRatherSessions';
const EXPIRY_MS = 30 * 60 * 1000;
export const MAX_QUESTIONS_PER_SESSION = 20;
const USED_KEY = 'wouldYouRatherUsedQuestions';

const questionKey = options => options.map(value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()).sort().join('|');
const choose = values => values[Math.floor(Math.random() * values.length)];

async function getSessions(chatId) {
  return (await store.getSetting(chatId, KEY)) || {};
}
async function saveSessions(chatId, sessions) {
  await store.saveSetting(chatId, KEY, sessions);
}

function botMentioned(sock, message) {
  const botNum = (sock.user?.id || '').split(':')[0];
  const botLid = sock.user?.lid || null;
  const ctx = message.message?.extendedTextMessage?.contextInfo
    || message.message?.imageMessage?.contextInfo
    || message.message?.videoMessage?.contextInfo
    || {};
  const mentions = ctx.mentionedJid || [];
  return mentions.some(j => {
    const n = String(j || '');
    return (botNum && n.startsWith(botNum)) || (botLid && n === botLid);
  });
}

async function fetchOptions() {
  // Live API optional; mature group prefers local FALLBACK bank
  return null;
}

async function chooseFreshOptions(chatId) {
  let used = (await store.getSetting(chatId, USED_KEY)) || [];
  try {
    const options = await fetchOptions();
    if (options?.length === 2) {
      const key = questionKey(options);
      if (!used.includes(key)) {
        used.push(key);
        if (used.length > FALLBACK.length) used.splice(0, used.length - FALLBACK.length);
        await store.saveSetting(chatId, USED_KEY, used);
        return { options, source: 'live question' };
      }
    }
  } catch {}
  let available = FALLBACK.filter(options => !used.includes(questionKey(options)));
  if (!available.length) {
    available = [...FALLBACK];
    await store.saveSetting(chatId, USED_KEY, []);
  }
  const options = choose(available);
  const key = questionKey(options);
  used.push(key);
  if (used.length > FALLBACK.length) used.splice(0, used.length - FALLBACK.length);
  await store.saveSetting(chatId, USED_KEY, used);
  return { options, source: `local bank (${FALLBACK.length})` };
}

async function sendQuestion(sock, chatId, senderId, quoted) {
  const { options, source } = await chooseFreshOptions(chatId);
  const sent = await sock.sendMessage(chatId, {
    text: `😈 *WOULD YOU RATHER? — AFTER DARK*\n\n🅰️ ${options[0]}\n\n🅱️ ${options[1]}\n\n_Choose your poison. Reply to this message for another dilemma, or tag me._\n\n_Source: ${source}_`
  }, quoted ? { quoted } : undefined);
  const sessions = await getSessions(chatId);
  sessions[senderId] = {
    questionMessageId: sent?.key?.id || null,
    updatedAt: Date.now(),
    expiresAt: Date.now() + EXPIRY_MS
  };
  await saveSessions(chatId, sessions);
}

export async function handleWyrContinuity(sock, chatId, message, senderId) {
  if (!chatId?.endsWith('@g.us') || message?.key?.fromMe || !isFeatureGroup(chatId)) return false;
  const sessions = await getSessions(chatId);
  const session = sessions[senderId];
  if (!session) return false;
  const access = await isGameAllowed(chatId, 'wyr');
  if (!access.ok) {
    await sock.sendMessage(chatId, { text: access.msg }, { quoted: message });
    return true;
  }
  if (session.expiresAt && session.expiresAt < Date.now()) {
    delete sessions[senderId];
    await saveSessions(chatId, sessions);
    return false;
  }
  const ctx = message.message?.extendedTextMessage?.contextInfo
    || message.message?.imageMessage?.contextInfo
    || {};
  const replied = !!(ctx.stanzaId && session.questionMessageId && ctx.stanzaId === session.questionMessageId);
  if (!replied && !botMentioned(sock, message)) return false;
  await sendQuestion(sock, chatId, senderId, message);
  return true;
}

export default {
  command: 'wyr',
  aliases: ['wouldyourather'],
  category: 'games',
  description: 'Mature Would You Rather with 20-dilemma sessions and group-wide duplicate prevention.',
  usage: '.wyr | .wyr stop',
  groupOnly: true,
  async handler(sock, message, args, context) {
    const chatId = context.chatId || message.key.remoteJid;
    const senderId = context.senderId || message.key.participant || message.key.remoteJid;
    if (!isFeatureGroup(chatId)) {
      return sock.sendMessage(chatId, { text: 'Would You Rather is available in the designated game groups.' }, { quoted: message });
    }
    const access = await isGameAllowed(chatId, 'wyr');
    if (!access.ok) return sock.sendMessage(chatId, { text: access.msg }, { quoted: message });
    const sessions = await getSessions(chatId);
    if (sessions[senderId]?.expiresAt > Date.now()) {
      return sock.sendMessage(chatId, { text: 'You already have an active dilemma. Reply to it or tag me for another.' }, { quoted: message });
    }
    try {
      await sendQuestion(sock, chatId, senderId, message);
    } catch (error) {
      console.error('WYR send failed:', error);
      await sock.sendMessage(chatId, { text: 'Could not send a Would You Rather question. Please try again.' }, { quoted: message });
    }
  }
};

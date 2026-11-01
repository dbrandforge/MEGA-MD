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
  return (ctx.mentionedJid || []).some(j => {
    const n = String(j || '');
    return (botNum && n.startsWith(botNum)) || (botLid && n === botLid);
  });
}

async function chooseFreshOptions(chatId) {
  let used = (await store.getSetting(chatId, USED_KEY)) || [];
  let available = FALLBACK.filter(options => !used.includes(questionKey(options)));
  if (!available.length) {
    // Start a new cycle only after every pair in the bank has been used.
    used = [];
    available = [...FALLBACK];
  }
  const options = choose(available);
  used.push(questionKey(options));
  // Keep the complete 500-question cycle so no earlier dilemma leaks back in.
  await store.saveSetting(chatId, USED_KEY, used);
  return options;
}

async function sendQuestion(sock, chatId, senderId, quoted) {
  const options = await chooseFreshOptions(chatId);
  const sent = await sock.sendMessage(chatId, {
    text: `😈 *WOULD YOU RATHER? — MATURE MINDED*\n\n🅰️ ${options[0]}\n\n🅱️ ${options[1]}\n\n_Choose A or B. Reply to this question or tag me for the next dilemma. Your session has a 20-question limit._`
  }, quoted ? { quoted } : undefined);
  const sessions = await getSessions(chatId);
  const previous = sessions[senderId] || {};
  sessions[senderId] = {
    ...previous,
    questionMessageId: sent?.key?.id || null,
    questionsAsked: (previous.questionsAsked || 0) + 1,
    questionsAttempted: previous.questionsAttempted || 0,
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

  session.questionsAttempted = (session.questionsAttempted || 0) + 1;
  session.updatedAt = Date.now();
  if (session.questionsAttempted >= MAX_QUESTIONS_PER_SESSION) {
    delete sessions[senderId];
    await saveSessions(chatId, sessions);
    await sock.sendMessage(chatId, {
      text: `🏁 *WYR SESSION COMPLETE*\n\nYou have attempted all *${MAX_QUESTIONS_PER_SESSION}* dilemmas. Use *.wyr* to start a fresh session.`
    }, { quoted: message });
    return true;
  }
  await saveSessions(chatId, sessions);
  await sendQuestion(sock, chatId, senderId, message);
  return true;
}

export default {
  command: 'wyr',
  aliases: ['wouldyourather'],
  category: 'games',
  description: 'Mature Minded Would You Rather with 20-question sessions and group-wide no-repeat tracking.',
  usage: '.wyr | .wyr stop',
  groupOnly: true,
  async handler(sock, message, args, context) {
    const chatId = context.chatId || message.key.remoteJid;
    const senderId = context.senderId || message.key.participant || message.key.remoteJid;
    const channelInfo = context.channelInfo || {};
    if (!isFeatureGroup(chatId)) {
      return sock.sendMessage(chatId, { text: 'Would You Rather is available in the designated game groups.', ...channelInfo }, { quoted: message });
    }
    const access = await isGameAllowed(chatId, 'wyr');
    if (!access.ok) return sock.sendMessage(chatId, { text: access.msg, ...channelInfo }, { quoted: message });

    const sessions = await getSessions(chatId);
    const action = (args[0] || '').toLowerCase();
    if (action === 'stop' || action === 'end') {
      let admin = !!(context.isSenderAdmin || context.senderIsOwnerOrSudo || context.isOwnerOrSudoCheck || message.key.fromMe);
      if (!admin) {
        try { admin = !!(await isAdmin(sock, chatId, senderId)).isSenderAdmin; } catch {}
      }
      if (admin) {
        await saveSessions(chatId, {});
        return sock.sendMessage(chatId, { text: '🛑 Admin ended all active WYR sessions in this group.', ...channelInfo }, { quoted: message });
      }
      if (!sessions[senderId]) return sock.sendMessage(chatId, { text: 'You do not have an active WYR session.', ...channelInfo }, { quoted: message });
      if (!(sessions[senderId].questionsAttempted > 0)) {
        return sock.sendMessage(chatId, { text: 'Attempt your current dilemma first. You can end your session after attempting at least one question.', ...channelInfo }, { quoted: message });
      }
      delete sessions[senderId];
      await saveSessions(chatId, sessions);
      return sock.sendMessage(chatId, { text: '✅ Your WYR session has ended. Use *.wyr* to start again.', ...channelInfo }, { quoted: message });
    }

    if (sessions[senderId]?.expiresAt > Date.now()) {
      return sock.sendMessage(chatId, { text: `You have an active WYR session: *${sessions[senderId].questionsAttempted || 0}/${MAX_QUESTIONS_PER_SESSION} attempted*. Reply to the current dilemma or tag me for the next one.`, ...channelInfo }, { quoted: message });
    }
    // A new command after expiry starts a clean session, not a continuation.
    if (sessions[senderId]) {
      delete sessions[senderId];
      await saveSessions(chatId, sessions);
    }
    try {
      await sendQuestion(sock, chatId, senderId, message);
    } catch (error) {
      console.error('WYR send failed:', error);
      await sock.sendMessage(chatId, { text: 'Could not send a Would You Rather question. Please try again.', ...channelInfo }, { quoted: message });
    }
  }
};

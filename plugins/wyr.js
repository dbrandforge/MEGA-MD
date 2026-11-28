import store from '../lib/lightweight_store.js';
import { isFeatureGroup } from '../lib/featureGroups.js';
import { isGameAllowed } from './daylock.js';
import { FALLBACK } from '../data/wyrPairs.js';
import isAdmin from '../lib/isAdmin.js';
import { getUserGender } from './gender.js';
import { savePendingGenderGame } from '../lib/genderGameContinuation.js';

const KEY = 'wouldYouRatherSessions';
const EXPIRY_MS = 30 * 60 * 1000;
export const MAX_QUESTIONS_PER_SESSION = 20;
const USED_KEY = 'wouldYouRatherUsedQuestions';

const questionKey = options => options.map(value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()).sort().join('|');
const choose = values => values[Math.floor(Math.random() * values.length)];

async function getSessions(chatId, { allowResume = false } = {}) {
  const value = allowResume && store.getSettingForGameResume
    ? await store.getSettingForGameResume(chatId, KEY)
    : await store.getSetting(chatId, KEY);
  return value || {};
}
async function saveSessions(chatId, sessions) {
  if (!await store.saveSettingVerified(chatId, KEY, sessions)) throw new Error('WYR session state could not be persisted.');
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
    used = [];
    available = [...FALLBACK];
  }
  const options = choose(available);
  used.push(questionKey(options));
  if (!await store.saveSettingVerified(chatId, USED_KEY, used)) throw new Error('WYR used-question history could not be persisted.');
  return options;
}

export function personalizeWyrOptions(options, gender) {
  const partnerLabel = gender === 'guy' ? 'female partner' : 'male partner';
  const playerLabel = gender === 'guy' ? 'boy' : 'girl';
  return options.map(option => String(option)
    .replace(/\bpartner\b/gi, partnerLabel)
    .replace(/\bgood (?:boy|girl)\b/gi, `good ${playerLabel}`));
}

async function sendQuestion(sock, chatId, senderId, quoted, gender) {
  const rawOptions = await chooseFreshOptions(chatId);
  const options = personalizeWyrOptions(rawOptions, gender);
  const sent = await sock.sendMessage(chatId, {
    text: `😈 *WOULD YOU RATHER? — MATURE MINDED*\n\n@${senderId.split('@')[0]}, this dilemma is for you.\n\n🅰️ ${options[0]}\n\n🅱️ ${options[1]}\n\n_Choose A or B. Reply to this question or tag me with your choice for the next dilemma. Session limit: 20 questions._`,
    mentions: [senderId]
  }, quoted ? { quoted } : undefined);
  const sessions = await getSessions(chatId);
  const previous = sessions[senderId] || {};
  sessions[senderId] = {
    ...previous,
    status: 'active',
    gender,
    currentOptions: options,
    questionMessageId: sent?.key?.id || null,
    questionsAsked: (previous.questionsAsked || 0) + 1,
    questionsAttempted: previous.questionsAttempted || 0,
    answers: previous.answers || [],
    updatedAt: Date.now(),
    expiresAt: Date.now() + EXPIRY_MS
  };
  await saveSessions(chatId, sessions);
}

export async function handleWyrContinuity(sock, chatId, message, senderId) {
  if (!chatId?.endsWith('@g.us') || message?.key?.fromMe || !isFeatureGroup(chatId)) return false;
  const ctx = message.message?.extendedTextMessage?.contextInfo
    || message.message?.imageMessage?.contextInfo
    || {};
  const tagged = botMentioned(sock, message);
  if (!ctx.stanzaId && !tagged) return false;

  const sessions = await getSessions(chatId);
  const session = sessions[senderId];
  if (!session) return false;

  if (session.expiresAt && session.expiresAt <= Date.now()) {
    session.status = 'expired';
    session.expiredAt = Number(session.expiresAt);
    session.recoveryDeadlineAt = Number(session.expiresAt) + 15 * 60 * 1000;
    await saveSessions(chatId, sessions);
    return false;
  }

  const replied = !!(ctx.stanzaId && session.questionMessageId && ctx.stanzaId === session.questionMessageId);
  if (!replied && !tagged) return false;

  // Only intercept a message that actually addresses the active WYR prompt.
  // A manual lock must not swallow the player's unrelated group messages.
  const access = await isGameAllowed(chatId, 'wyr');
  if (!access.ok) {
    await sock.sendMessage(chatId, { text: access.msg }, { quoted: message });
    return true;
  }

  const body = message.message?.conversation
    || message.message?.extendedTextMessage?.text
    || message.message?.imageMessage?.caption
    || message.message?.videoMessage?.caption
    || '';
  const answerMatch = body.match(/(?:^|\b)(?:option\s*)?([ab12])(?:\b|$)/i);
  if (!answerMatch) {
    await sock.sendMessage(chatId, {
      text: 'Choose *A* or *B* in your reply, then I will serve the next dilemma.'
    }, { quoted: message });
    return true;
  }

  const answer = answerMatch[1].toUpperCase();
  session.answers = session.answers || [];
  session.answers.push(answer);
  session.questionsAttempted = (session.questionsAttempted || 0) + 1;
  session.updatedAt = Date.now();

  if (session.questionsAttempted >= MAX_QUESTIONS_PER_SESSION) {
    delete sessions[senderId];
    await saveSessions(chatId, sessions);
    const countA = session.answers.filter(v => v === 'A' || v === '1').length;
    const countB = session.answers.filter(v => v === 'B' || v === '2').length;
    await sock.sendMessage(chatId, {
      text: `🏁 *WYR SESSION COMPLETE*\n\nYou completed all *${MAX_QUESTIONS_PER_SESSION}* dilemmas.\nA: *${countA}* · B: *${countB}*\n\nUse *.wyr* to start a fresh session.`
    }, { quoted: message });
    return true;
  }

  await saveSessions(chatId, sessions);
  const gender = session.gender || await getUserGender(senderId, sock);
  if (!gender) {
    await sock.sendMessage(chatId, { text: 'Set your gender first with *.gender guy* or *.gender lady* to continue WYR.' }, { quoted: message });
    return true;
  }
  await sendQuestion(sock, chatId, senderId, message, gender);
  return true;
}

export async function resumeWyrSessions(sock, chatId) {
  if (!isFeatureGroup(chatId)) return 0;
  const sessions = await getSessions(chatId, { allowResume: true });
  const active = Object.entries(sessions).filter(([, session]) =>
    session?.status === 'active' && Array.isArray(session.currentOptions) &&
    session.currentOptions.length === 2 && Number(session.expiresAt || 0) > Date.now()
  );
  if (!active.length) return 0;
  const access = await isGameAllowed(chatId, 'wyr');
  if (!access.ok) return 0;
  let resumed = 0;
  for (const [playerId, session] of active) {
    const sent = await sock.sendMessage(chatId, {
      text: `▶️ *WOULD YOU RATHER? — RESUMED*\n\n@${playerId.split('@')[0]}, your saved dilemma is back:\n\n🅰️ ${session.currentOptions[0]}\n\n🅱️ ${session.currentOptions[1]}\n\nChoose A or B. Your answers and question count are preserved.`,
      mentions: [playerId]
    });
    session.questionMessageId = sent?.key?.id || null;
    session.updatedAt = Date.now();
    session.expiresAt = Date.now() + EXPIRY_MS;
    resumed++;
  }
  await saveSessions(chatId, sessions);
  return resumed;
}

export async function recoverWyrPlayer(sock, chatId, playerId) {
  if (!isFeatureGroup(chatId)) return false;
  const sessions = await getSessions(chatId, { allowResume: true });
  if (Object.keys(sessions).length) await saveSessions(chatId, sessions);
  const session = sessions[playerId];
  if (!session) return false;
  if (!['expired', 'replaced'].includes(session.status) && Number(session.expiresAt || 0) <= Date.now()) {
    session.status = 'expired';
    session.expiredAt = Number(session.expiresAt);
    session.recoveryDeadlineAt = Number(session.expiresAt) + 15 * 60 * 1000;
    await saveSessions(chatId, sessions);
  }
  if (!['expired', 'replaced'].includes(session.status) || !session.recoveryDeadlineAt || Date.now() >= Number(session.recoveryDeadlineAt)) return false;
  if (!Array.isArray(session.currentOptions) || session.currentOptions.length !== 2) return false;

  const sent = await sock.sendMessage(chatId, {
    text: `▶️ *WYR SESSION RESUMED*\n\n@${playerId.split('@')[0]}, your previous dilemma is restored:\n\n🅰️ ${session.currentOptions[0]}\n\n🅱️ ${session.currentOptions[1]}\n\nChoose A or B. Your previous answers and question count are preserved.`,
    mentions: [playerId]
  });
  session.status = 'active';
  session.expiredAt = null;
  session.recoveryDeadlineAt = null;
  session.updatedAt = Date.now();
  session.expiresAt = Date.now() + EXPIRY_MS;
  session.questionMessageId = sent?.key?.id || null;
  sessions[playerId] = session;
  await saveSessions(chatId, sessions);
  return true;
}

export async function replaceWyrPlayer(sock, chatId, removedId, replacementId) {
  if (!isFeatureGroup(chatId)) return false;
  const sessions = await getSessions(chatId);
  const removed = sessions[removedId];
  if (!removed) return false;
  if (removed.status !== 'replaced' && removed.status !== 'expired' && Number(removed.expiresAt || 0) <= Date.now()) {
    removed.status = 'expired';
    removed.expiredAt = Number(removed.expiresAt);
    removed.recoveryDeadlineAt = Number(removed.expiresAt) + 15 * 60 * 1000;
    await saveSessions(chatId, sessions);
  }
  if (!['expired', 'replaced'].includes(removed.status) || !removed.recoveryDeadlineAt || Date.now() >= Number(removed.recoveryDeadlineAt)) return false;
  const existingReplacement = sessions[replacementId];
  if (existingReplacement && (
    Number(existingReplacement.expiresAt || 0) > Date.now()
    || (['expired', 'replaced'].includes(existingReplacement.status) && Number(existingReplacement.recoveryDeadlineAt || 0) > Date.now())
  )) return false;
  const gender = await getUserGender(replacementId, sock);
  if (!gender) return false;

  removed.status = 'replaced';
  removed.replacedBy = replacementId;
  if (existingReplacement) delete sessions[replacementId];
  await saveSessions(chatId, sessions);
  await sendQuestion(sock, chatId, replacementId, null, gender);
  return true;
}

export default {
  command: 'wyr',
  aliases: ['wouldyourather'],
  category: 'games',
  description: 'Mature Minded Would You Rather with 20-question sessions and group-wide no-repeat tracking.',
  usage: '.wyr | .wyr status | .wyr stop',
  groupOnly: true,
  async handler(sock, message, args, context) {
    const chatId = context.chatId || message.key.remoteJid;
    const senderId = context.senderId || message.key.participant || message.key.remoteJid;
    const channelInfo = context.channelInfo || {};
    if (!isFeatureGroup(chatId)) {
      return sock.sendMessage(chatId, { text: 'Would You Rather is available in the designated game groups.', ...channelInfo }, { quoted: message });
    }

    const sessions = await getSessions(chatId);
    const action = (args[0] || '').toLowerCase();
    const access = await isGameAllowed(chatId, 'wyr');
    // A lock prevents new/continued play, not a player's own end action or
    // an admin's ability to clear sessions.
    if (!access.ok && !['status', 'stop', 'end'].includes(action)) {
      return sock.sendMessage(chatId, { text: access.msg, ...channelInfo }, { quoted: message });
    }

    if (action === 'status') {
      const session = sessions[senderId];
      const countA = (session?.answers || []).filter(v => v === 'A' || v === '1').length;
      const countB = (session?.answers || []).filter(v => v === 'B' || v === '2').length;
      return sock.sendMessage(chatId, {
        text: session
          ? `📊 *WYR SESSION*\n\nAttempted: *${session.questionsAttempted || 0}/${MAX_QUESTIONS_PER_SESSION}*\nQuestions issued: *${session.questionsAsked || 1}*\nA: *${countA}* · B: *${countB}*`
          : 'No active WYR session. Use *.wyr* to start.',
        ...channelInfo
      }, { quoted: message });
    }

    if (action === 'stop' || action === 'end') {
      let admin = !!(context.isSenderAdmin || context.senderIsOwnerOrSudo || context.isOwnerOrSudoCheck || message.key.fromMe);
      if (!admin) {
        try { admin = !!(await isAdmin(sock, chatId, senderId)).isSenderAdmin; } catch {}
      }
      if (admin) {
        await saveSessions(chatId, {});
        return sock.sendMessage(chatId, { text: '🛑 Admin ended all active WYR sessions in this group.', ...channelInfo }, { quoted: message });
      }
      if (!sessions[senderId]) {
        return sock.sendMessage(chatId, { text: 'You do not have an active WYR session.', ...channelInfo }, { quoted: message });
      }
      if (!(sessions[senderId].questionsAttempted > 0)) {
        return sock.sendMessage(chatId, { text: 'Attempt your current dilemma first. You can end your session after attempting at least one question.', ...channelInfo }, { quoted: message });
      }
      delete sessions[senderId];
      await saveSessions(chatId, sessions);
      return sock.sendMessage(chatId, { text: '✅ Your WYR session has ended. Use *.wyr* to start again.', ...channelInfo }, { quoted: message });
    }

    if (sessions[senderId]?.expiresAt > Date.now()) {
      return sock.sendMessage(chatId, {
        text: `You have an active WYR session: *${sessions[senderId].questionsAttempted || 0}/${MAX_QUESTIONS_PER_SESSION} attempted*. Reply to the current dilemma with *A* or *B*, or tag me with your choice.`,
        ...channelInfo
      }, { quoted: message });
    }

    if (sessions[senderId]) {
      // Starting a new WYR session is an explicit reset and forfeits recovery
      // of the previous expired session.
      delete sessions[senderId];
      await saveSessions(chatId, sessions);
    }
    const gender = await getUserGender(senderId, sock);
    if (!gender) {
      await savePendingGenderGame(chatId, senderId, { command: 'wyr', args: [], requester: senderId, pushName: message.pushName });
      return sock.sendMessage(chatId, { text: 'Set your gender first with *.gender guy* or *.gender lady*. Your WYR request will resume automatically after registration.', ...channelInfo }, { quoted: message });
    }
    try {
      await sendQuestion(sock, chatId, senderId, message, gender);
    } catch (error) {
      console.error('WYR send failed:', error);
      await sock.sendMessage(chatId, { text: 'Could not send a Would You Rather question. Please try again.', ...channelInfo }, { quoted: message });
    }
  }
};

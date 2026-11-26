import store from '../lib/lightweight_store.js';
import { getUserGender } from './gender.js';
import { buildPickYourSinBank, normalizePickYourSinPrompt } from '../data/pickYourSinBank.js';
import { isGameAllowed } from './daylock.js';
import { isFeatureGroup } from '../lib/featureGroups.js';
import { sameWhatsAppUser, canonicalWhatsAppUserId } from '../lib/whatsappIdentity.js';
import { getPickYourSinMediaKind, getPickYourSinMessageContext, validatePickYourSinTruthAnswer } from '../lib/pickYourSinResponse.js';

const KEY = 'pickYourSinSessions';
const DAILY_KEY = 'pickYourSinDailyCompletions';
const COOLDOWN_MS = 30_000;
const NO_ANSWER_REMINDER_MS = 5 * 60 * 1000;
const PLAYER_INACTIVITY_MS = 10 * 60 * 1000;
const REPLACEMENT_WINDOW_MS = 5 * 60 * 1000;
const chatQueues = new Map();
const inactivityTimers = new Map();
const replacementTimers = new Map();
async function withChatLock(chatId, task) {
  const previous = chatQueues.get(chatId) || Promise.resolve();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const queued = previous.then(() => gate);
  chatQueues.set(chatId, queued);
  await previous;
  try { return await task(); }
  finally {
    release();
    if (chatQueues.get(chatId) === queued) chatQueues.delete(chatId);
  }
}
const COLORS = {
  red: { emoji: '❤️', label: 'RED' },
  yellow: { emoji: '💛', label: 'YELLOW' },
  orange: { emoji: '🧡', label: 'ORANGE' },
  ash: { emoji: '🩶', label: 'ASH' },
  // Legacy active sessions may still contain GREEN; render them as ASH.
  green: { emoji: '🩶', label: 'ASH' }
};

const ACTION_DARES = [
  'Record a 15-second voice note delivering your boldest consensual flirt line. Post it here.',
  'Write and post a five-line confession about a desire you have never admitted aloud.',
  'Send a voice note naming one adult fantasy you would genuinely consider exploring with a consenting partner.',
  'Post a confident 20-second spoken invitation to a date, as if asking your secret crush.',
  'Write a direct, respectful message you would send to someone you are attracted to. Share the wording here.',
  'Record a voice note describing three things that make intimacy feel exciting and safe for you.',
  'Post a short scene-setting message for a consensual romantic fantasy. Keep it imaginative and specific.',
  'Give the group a 30-second voice-note explanation of one boundary you would never compromise.',
  'Write a bold but respectful opening line you would use to express attraction. Post it here.',
  'Record a voice note reading your most daring romantic confession with confidence.',
  'Describe a consensual date you would plan to turn mutual attraction into chemistry. Include three concrete steps.',
  'Post a three-line invitation to someone you would like to know better, without naming or pressuring anyone.',
  'Share a voice note explaining one fantasy you are curious about and the consent conversation it would require.',
  'Write a short, confident personal ad describing the kind of chemistry you want with another consenting adult.',
  'Post a voice note giving your best flirtatious compliment without targeting or embarrassing a group member.',
  'Create and post a six-line fictional scene built around tension, anticipation and mutual consent.',
  'Record a voice note acting out the opening line of a private, consensual fantasy you would like to explore.',
  'Post a three-step plan for asking a partner to try something new while making consent explicit.',
  'Deliver a 20-second voice-note confession about the boldest thought you have had about someone you were attracted to.',
  'Write and post a daring but respectful invitation to a private date, with a clear opt-in.',
  'Record a voice note describing the kind of teasing conversation that would genuinely affect you.',
  'Post a short monologue admitting one intimate curiosity you have never voiced to a partner.',
  'Create a five-line fictional flirt exchange and perform both voices in a voice note.',
  'Post three specific questions you would ask a consenting partner before exploring a new fantasy.',
  'Record a confident voice note describing your ideal build-up to an intimate evening.',
  'Write a direct confession about a past romantic risk you took and post it to the group.',
  'Act out a 15-second dramatic confession of attraction in a voice note.',
  'Post a short, specific description of the most daring consensual date you would actually agree to.',
  'Record a voice note explaining one desire you would only explore with trust and clear boundaries.',
  'Write a bold invitation to a fictional adult crush and read it aloud in a voice note.',
  'Post a five-line scene in which two adults negotiate a daring fantasy with mutual consent.',
  'Give a 30-second voice-note pitch for the most adventurous date you would plan with a willing partner.'
];

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function colorFromText(value) {
  const raw = String(value || '').normalize('NFKC').trim().toLowerCase();
  const text = raw.split(/\s+/).pop()?.replace(/[.,!?;:()[\]{}*_~`]/g, '') || '';
  const aliases = {
    red: 'red', '❤️': 'red', '❤': 'red', '🔴': 'red',
    yellow: 'yellow', '💛': 'yellow', '🟡': 'yellow',
    orange: 'orange', '🧡': 'orange', '🟠': 'orange',
    ash: 'ash', 'grey': 'ash', 'gray': 'ash', '🩶': 'ash', '⚪': 'ash',
    green: 'ash', '💚': 'ash', '🟢': 'ash'
  };
  return aliases[text] || null;
}
function questionType(step) {
  return step === 5 || step === 11 ? 'dare' : 'truth';
}
function mention(jid) { return '@' + String(jid || '').split('@')[0]; }
function lagosDateKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}
async function sendColorPrompt(sock, chatId, session, playerId) {
  const state = session.playerStates[playerId];
  if (!state || state.status !== 'active') return false;
  state.waiting = false;
  state.awaitingColor = true;
  state.questionMessageId = null;
  const previous = state.lastColor ? ` Your previous colour was ${COLORS[state.lastColor].label}; choose a different one.` : '';
  await sock.sendMessage(chatId, {
    text: `🎨 @${playerId.split('@')[0]}, choose your next folder: ❤️ RED · 💛 YELLOW · 🧡 ORANGE · 🩶 ASH.${previous}`,
    mentions: [playerId]
  });
  const latest = await getSessions(chatId);
  latest[session.id] = session;
  await saveSessions(chatId, latest);
  return true;
}

async function getSessions(chatId) {
  return (await store.getSetting(chatId, KEY)) || {};
}
async function saveSessions(chatId, sessions) {
  if (!await store.saveSettingVerified(chatId, KEY, sessions)) {
    throw new Error('Pick Your Sin session state could not be persisted.');
  }
}
function scheduleReplacementExpiry(sock, chatId, sessionId, playerId, deadline) {
  const key = `${sessionId}:${playerId}:${deadline}`;
  if (replacementTimers.has(key)) return;
  const timer = setTimeout(async () => {
    replacementTimers.delete(key);
    try {
      await withChatLock(chatId, async () => {
        const latest = await getSessions(chatId);
        const current = latest[sessionId];
        const currentState = current?.playerStates?.[playerId];
        if (!current || current.status !== 'active' || !currentState || currentState.status !== 'out' || !currentState.waitingForReplacement || currentState.replacementDeadlineAt !== deadline) return;
        currentState.waitingForReplacement = false;
        currentState.replacementExpired = true;
        latest[sessionId] = current;
        await saveSessions(chatId, latest);
        await sock.sendMessage(chatId, { text: `⌛ The replacement window for ${mention(playerId)} has expired. PICK YOUR SIN continues with the remaining players.` });
        if (current.players.every(id => ['complete', 'out'].includes(current.playerStates?.[id]?.status))) {
          current.status = 'complete';
          current.completedAt = Date.now();
          latest[sessionId] = current;
          await saveSessions(chatId, latest);
          await sock.sendMessage(chatId, { text: '🔥 *PICK YOUR SIN is complete.* All remaining players have finished or been removed.' });
        }
      });
    } catch (error) { console.error('[PICK YOUR SIN] Replacement-window expiry failed:', error); }
  }, Math.max(0, deadline - Date.now()));
  replacementTimers.set(key, timer);
}

async function schedulePlayerInactivity(sock, chatId, sessionId, playerId, token, waitingSince) {
  if (!token || inactivityTimers.has(token)) return;
  const reminderDelay = Math.max(0, waitingSince + NO_ANSWER_REMINDER_MS - Date.now());
  const removalDelay = Math.max(0, waitingSince + PLAYER_INACTIVITY_MS - Date.now());
  const reminderTimer = setTimeout(async () => {
    try {
      await withChatLock(chatId, async () => {
        const sessions = await getSessions(chatId);
        const session = sessions[sessionId];
        const state = session?.playerStates?.[playerId];
        if (!session || session.status !== 'active' || !state || state.status !== 'active' || !state.waiting || state.inactivityToken !== token || Date.now() >= waitingSince + PLAYER_INACTIVITY_MS) return;
        await sock.sendMessage(chatId, { text: `⏰ ${mention(playerId)}, your PICK YOUR SIN prompt is still unanswered. You have five more minutes before you are removed from this session.`, mentions: [playerId] });
      });
    } catch (error) { console.error('[PICK YOUR SIN] Reminder failed:', error); }
  }, reminderDelay);
  const removalTimer = setTimeout(async () => {
    inactivityTimers.delete(token);
    try {
      await withChatLock(chatId, async () => {
        const sessions = await getSessions(chatId);
        const session = sessions[sessionId];
        const state = session?.playerStates?.[playerId];
        if (!session || session.status !== 'active' || !state || state.status !== 'active' || !state.waiting || state.inactivityToken !== token) return;
        state.status = 'out';
        state.waiting = false;
        state.inactivityToken = null;
        state.waitingSince = null;
        state.removedAt = Date.now();
        state.waitingForReplacement = true;
        state.replacementDeadlineAt = Date.now() + REPLACEMENT_WINDOW_MS;
        sessions[sessionId] = session;
        await saveSessions(chatId, sessions);
        await sock.sendMessage(chatId, { text: `⌛ ${mention(playerId)} has been removed after 10 minutes without an answer. An admin has five minutes to replace them with *.picksin replace @${playerId.split('@')[0]} @replacement*. Other players continue normally.`, mentions: [playerId] });
        scheduleReplacementExpiry(sock, chatId, sessionId, playerId, state.replacementDeadlineAt);
      });
    } catch (error) { console.error('[PICK YOUR SIN] Inactivity removal failed:', error); }
  }, removalDelay);
  inactivityTimers.set(token, [reminderTimer, removalTimer]);
}

export async function resumePickYourSinSessions(sock, chatId) {
  const sessions = await getSessions(chatId);
  const pendingInactivity = [];
  const pendingReplacement = [];
  let changed = false;
  for (const session of Object.values(sessions)) {
    if (session.status !== 'active') continue;
    for (const [playerId, state] of Object.entries(session.playerStates || {})) {
      if (state.status === 'active' && state.waiting) {
        if (!state.inactivityToken) {
          state.waitingSince = Number(state.waitingSince || Date.now());
          state.inactivityToken = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          changed = true;
        }
        pendingInactivity.push({ sessionId: session.id, playerId, token: state.inactivityToken, waitingSince: state.waitingSince });
      }
      if (state.status === 'out' && state.waitingForReplacement && state.replacementDeadlineAt) {
        pendingReplacement.push({ sessionId: session.id, playerId, deadline: state.replacementDeadlineAt });
      }
    }
  }
  if (changed) await saveSessions(chatId, sessions);
  for (const item of pendingInactivity) await schedulePlayerInactivity(sock, chatId, item.sessionId, item.playerId, item.token, item.waitingSince);
  for (const item of pendingReplacement) scheduleReplacementExpiry(sock, chatId, item.sessionId, item.playerId, item.deadline);
  return pendingInactivity.length + pendingReplacement.length;
}
async function replaceInactivePlayer(sock, chatId, message, session) {
  const tagged = await Promise.all(getMentions(message).map(async id => (await canonicalWhatsAppUserId(sock, id)) || id));
  const uniqueTags = [...new Set(tagged)];
  if (uniqueTags.length !== 2 || uniqueTags.length !== tagged.length) return sock.sendMessage(chatId, { text: 'Tag the removed participant first and the replacement second: *.picksin replace @removed @replacement*.', quoted: message });
  const [removedId, replacementId] = uniqueTags;
  const removedState = session.playerStates?.[removedId];
  if (!session.players.includes(removedId) || !removedState || removedState.status !== 'out' || !removedState.waitingForReplacement || Date.now() > Number(removedState.replacementDeadlineAt || 0)) return sock.sendMessage(chatId, { text: 'That participant is not within an active five-minute replacement window.', quoted: message });
  if (session.players.includes(replacementId)) return sock.sendMessage(chatId, { text: 'The replacement is already in this PICK YOUR SIN session.', quoted: message });
  const daily = (await store.getSetting(chatId, DAILY_KEY)) || {};
  if ((daily[lagosDateKey()] || []).includes(replacementId)) return sock.sendMessage(chatId, { text: 'That replacement has already completed PICK YOUR SIN today and cannot take another daily slot.', quoted: message });
  const replacementTimerKey = `${session.id}:${removedId}:${removedState.replacementDeadlineAt}`;
  const replacementTimer = replacementTimers.get(replacementTimerKey);
  if (replacementTimer) clearTimeout(replacementTimer);
  replacementTimers.delete(replacementTimerKey);
  const gender = await getUserGender(replacementId, sock);
  const nextState = { ...removedState, status: 'active', gender: gender || null, waitingForGender: !gender, color: null, lastColor: null, awaitingColor: true, waiting: false, questionMessageId: null, currentCard: null, currentType: null, waitingSince: null, inactivityToken: null, waitingForReplacement: false, replacementDeadlineAt: null, replacementExpired: false, removedAt: null, cooldownUntil: null, nextPromptToken: null, replacedPlayer: removedId };
  session.players = session.players.map(id => id === removedId ? replacementId : id);
  delete session.playerStates[removedId];
  session.playerStates[replacementId] = nextState;
  const sessions = await getSessions(chatId);
  sessions[session.id] = session;
  await saveSessions(chatId, sessions);
  await sock.sendMessage(chatId, { text: `🔁 ${mention(replacementId)} has replaced ${mention(removedId)} and will continue from the same game progress.`, mentions: [replacementId, removedId] });
  if (nextState.waitingForGender) await sock.sendMessage(chatId, { text: `${mention(replacementId)}, register your gender with *.gender guy* or *.gender lady*, then choose a colour.`, mentions: [replacementId] });
  else await sendColorPrompt(sock, chatId, session, replacementId);
  return true;
}
function buildDecks() {
  return buildPickYourSinBank();
}

async function findPlayerKey(sock, players, userId) {
  for (const player of players || []) {
    if (player === userId || await sameWhatsAppUser(sock, player, userId)) return player;
  }
  return null;
}
async function sendPrompt(sock, chatId, session, playerId) {
  const state = session.playerStates[playerId];
  if (!state || state.status !== 'active') return false;
  if (state.step >= 12) {
    state.status = 'complete';
    state.completedAt = Date.now();
    const daily = (await store.getSetting(chatId, DAILY_KEY)) || {};
    const dayKey = lagosDateKey();
    daily[dayKey] = [...new Set([...(daily[dayKey] || []), playerId])];
    await store.saveSettingVerified(chatId, DAILY_KEY, daily);
    const latestSessions = await getSessions(chatId);
    latestSessions[session.id] = session;
    await saveSessions(chatId, latestSessions);
    await sock.sendMessage(chatId, {
      text: `🏁 ${mention(playerId)} has completed PICK YOUR SIN — 10 truths and 2 dares.`,
      mentions: [playerId]
    });
    if (session.players.every(id => ['complete', 'out'].includes(session.playerStates[id]?.status))) {
      session.status = 'complete';
      session.completedAt = Date.now();
      const completedSessions = await getSessions(chatId);
      completedSessions[session.id] = session;
      await saveSessions(chatId, completedSessions);
      await sock.sendMessage(chatId, { text: '🔥 *PICK YOUR SIN is complete.* All remaining players have finished or been removed.' });
    }
    return true;
  }
  const type = questionType(state.step);
  const deck = session.decks[`${state.gender}:${state.color}`] || (state.color === 'ash' ? session.decks[`${state.gender}:green`] : null);
  if (!deck) throw new Error(`Missing PICK YOUR SIN deck for ${state.gender}/${state.color}.`);
  const cards = type === 'truth' ? deck.truths : deck.dares;
  if (!Array.isArray(session.usedPromptKeys)) session.usedPromptKeys = [];
  if (!Array.isArray(session.usedPromptIds)) session.usedPromptIds = [];
  const usedKeys = new Set(session.usedPromptKeys);
  const card = cards.find(item => !usedKeys.has(normalizePickYourSinPrompt(typeof item === 'string' ? item : item.text)));
  if (!card) {
    state.status = 'out';
    state.waiting = false;
    const latest = await getSessions(chatId);
    latest[session.id] = session;
    await saveSessions(chatId, latest);
    await sock.sendMessage(chatId, { text: `⚠️ ${mention(playerId)} has no unused ${type} cards left in this colour. The rest of the players can continue.`, mentions: [playerId] });
    return false;
  }
  const cardText = typeof card === 'string' ? card : card.text;
  const cardId = typeof card === 'string' ? normalizePickYourSinPrompt(cardText) : card.id;
  session.usedPromptKeys.push(normalizePickYourSinPrompt(cardText));
  if (cardId) session.usedPromptIds.push(cardId);
  state.currentType = type;
  state.awaitingColor = false;
  state.currentCard = cardText;
  state.waiting = true;
  state.cooldownUntil = null;
  const label = type === 'truth' ? '🔥 *TRUTH*' : '💀 *DARE — ACTION REQUIRED*';
  const progress = type === 'truth' ? `Truth ${state.step < 5 ? state.step + 1 : state.step - 5}/5` : `Dare ${state.step === 5 ? 1 : 2}/2`;
  const sent = await sock.sendMessage(chatId, {
    text: `🎭 *PICK YOUR SIN* — ${COLORS[state.color].emoji} ${COLORS[state.color].label}\n${mention(playerId)}, this prompt is for you.\n${label} · ${progress}\n\n${cardText}\n\n_Reply to this prompt or tag the bot when you've completed it._ ${type === 'truth' ? 'A TRUTH requires a proper written answer with real details (at least 12 words). One-word replies, yes/no, “done” and similar shortcuts will not count.' : 'A DARE is completed only by sending a voice note, photo or video. Text replies will not count.'} You may use your one session pass on a TRUTH only. You have 30 seconds between prompts.`,
    mentions: [playerId]
  });
  state.questionMessageId = sent?.key?.id || null;
  const latestSessions = await getSessions(chatId);
  latestSessions[session.id] = session;
  await saveSessions(chatId, latestSessions);
  state.waitingSince = Date.now();
  state.inactivityToken = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  latestSessions[session.id] = session;
  await saveSessions(chatId, latestSessions);
  await schedulePlayerInactivity(sock, chatId, session.id, playerId, state.inactivityToken, state.waitingSince);
  return true;
}

const SELECTION_KEY = 'pickYourSinSelection';
const SELECTION_MS = 10 * 60 * 1000;
function getMentions(message) {
  const context = message?.message?.extendedTextMessage?.contextInfo
    || message?.message?.imageMessage?.contextInfo
    || message?.message?.videoMessage?.contextInfo || {};
  return context.mentionedJid || [];
}
async function getSelection(chatId) {
  return (await store.getSetting(chatId, SELECTION_KEY)) || null;
}
async function saveSelection(chatId, selection) {
  if (!await store.saveSettingVerified(chatId, SELECTION_KEY, selection)) {
    throw new Error('PICK YOUR SIN selection could not be persisted.');
  }
}
async function startSelection(sock, chatId, senderId) {
  const access = await isGameAllowed(chatId, 'pickyoursin');
  if (!access.ok) return sock.sendMessage(chatId, { text: access.msg });
  const active = await getSessions(chatId);
  if (Object.values(active).some(item => item.status === 'active')) {
    return sock.sendMessage(chatId, { text: 'A PICK YOUR SIN session is already active.' });
  }
  const existing = await getSelection(chatId);
  if (existing && ['pending', 'ready'].includes(existing.status)) {
    return sock.sendMessage(chatId, { text: existing.status === 'ready'
      ? 'Participants are already locked in. Use *.picksin open* when you are ready.'
      : 'PICK YOUR SIN selection is already open. Use *.picksin list*.' });
  }
  const selection = {
    status: 'pending', players: [], startedBy: senderId,
    createdAt: Date.now(), adjustmentEndsAt: Date.now() + SELECTION_MS
  };
  await saveSelection(chatId, selection);
  await sock.sendMessage(chatId, {
    text: '🎭 *PICK YOUR SIN — SELECTION OPEN*\n\nSelect 2–5 participants using *.picksin add @user1 @user2 @user3 @user4 @user5* (minimum 2, maximum 5).\n\nYou have 10 minutes to add, replace or rearrange participants.\n*.picksin list* · *.picksin change @current @replacement* · *.picksin arrange @user1 @user2 @user3 @user4 @user5* · *.picksin start*'
  });
  setTimeout(async () => {
    try {
      await withChatLock(chatId, async () => {
        const latest = await getSelection(chatId);
        if (latest?.status !== 'pending' || latest.createdAt !== selection.createdAt) return;
        if (latest.players.length >= 2 && latest.players.length <= 5) {
          await saveSelection(chatId, { ...latest, status: 'ready' });
          await sock.sendMessage(chatId, {
            text: '⏳ *PICK YOUR SIN — PARTICIPANTS LOCKED*\n\nThe selected participants are locked in. The game has NOT started yet. When you are ready, send *.picksin open* to officially open the game.'
          });
        } else {
          await saveSelection(chatId, { ...latest, status: 'expired' });
          await sock.sendMessage(chatId, { text: '⌛ PICK YOUR SIN selection expired: at least two participants were not selected.' });
        }
      });
    } catch (error) {
      console.error('[PICK YOUR SIN] Selection auto-start failed:', error);
    }
  }, SELECTION_MS);
}
async function sendSelectionList(sock, chatId, selection) {
  const remaining = Math.max(0, Math.ceil((selection.adjustmentEndsAt - Date.now()) / 60000));
  const players = selection.players.length
    ? selection.players.map((id, i) => `${i + 1}. ${mention(id)}`).join('\n')
    : 'No participants selected yet.';
  return sock.sendMessage(chatId, {
    text: `🎭 *PICK YOUR SIN SELECTION*\n\n${players}\n\nSelected: *${selection.players.length}/5* (minimum 2)\nTime remaining: *${remaining} minute(s)*\n\n*.picksin add @users* · *.picksin change @current @replacement* · *.picksin arrange @all-selected* · *.picksin open* (after 2–5 are selected)`,
    mentions: selection.players
  });
}
async function handleSelectionCommand(sock, message, args, context, chatId) {
  const sub = String(args?.[0] || '').toLowerCase();
  const senderId = context.senderId || message.key.participant || message.key.remoteJid;
  if (sub === 'start' || !sub) {
    if (!sub) return sock.sendMessage(chatId, { text: 'Use *.picksin start* to open participant selection.' }, { quoted: message });
    return startSelection(sock, chatId, senderId);
  }
  let selection = await getSelection(chatId);
  if (sub === 'open') {
    if (!selection || !['pending', 'ready'].includes(selection.status)) {
      return sock.sendMessage(chatId, { text: 'There is no completed PICK YOUR SIN selection to open. Start with *.picksin start*.' }, { quoted: message });
    }
    if (selection.players.length < 2 || selection.players.length > 5) {
      return sock.sendMessage(chatId, { text: `Select 2–5 participants first. Current selection: *${selection.players.length}/5*.` }, { quoted: message });
    }
    if (Date.now() >= selection.adjustmentEndsAt && selection.status === 'pending') {
      selection.status = 'ready';
      await saveSelection(chatId, selection);
    }
    selection.status = 'starting';
    await saveSelection(chatId, selection);
    try {
      const started = await beginPickYourSinSession(sock, chatId, selection.players, selection.startedBy);
      if (started === false) {
        selection.status = 'ready';
        await saveSelection(chatId, selection);
        return;
      }
      selection.status = 'started';
      selection.openedAt = Date.now();
      await saveSelection(chatId, selection);
    } catch (error) {
      selection.status = 'ready';
      await saveSelection(chatId, selection);
      throw error;
    }
    return;
  }
  if (sub === 'endselection' || sub === 'cancel') {
    if (!selection || selection.status !== 'pending') return sock.sendMessage(chatId, { text: 'No open PICK YOUR SIN selection.' }, { quoted: message });
    selection.status = 'cancelled';
    await saveSelection(chatId, selection);
    return sock.sendMessage(chatId, { text: '🛑 PICK YOUR SIN selection cancelled.' }, { quoted: message });
  }
  if (!selection || !['pending', 'ready'].includes(selection.status)) {
    return sock.sendMessage(chatId, { text: 'No open selection. Start one with *.picksin start*.' }, { quoted: message });
  }
  if (Date.now() >= selection.adjustmentEndsAt && selection.status === 'pending') {
    selection.status = selection.players.length >= 2 && selection.players.length <= 5 ? 'ready' : 'expired';
    await saveSelection(chatId, selection);
    if (selection.status === 'expired') {
      return sock.sendMessage(chatId, { text: 'The 10-minute selection window has closed before the minimum of two participants was selected.' }, { quoted: message });
    }
    if (sub !== 'list') {
      return sock.sendMessage(chatId, { text: 'The selection window has closed. The selected 2–5 participants are locked in; use *.picksin open* when ready.' }, { quoted: message });
    }
  }
  if (selection.status === 'ready' && !['list'].includes(sub)) {
    return sock.sendMessage(chatId, { text: 'Participants are locked. Use *.picksin open* to officially open the game.' }, { quoted: message });
  }
  if (sub === 'list') return sendSelectionList(sock, chatId, selection);
  const tagged = await Promise.all(getMentions(message).map(async id => (await canonicalWhatsAppUserId(sock, id)) || id));
  const uniqueTags = [...new Set(tagged)];
  if (sub === 'add') {
    if (!uniqueTags.length) return sock.sendMessage(chatId, { text: 'Tag up to five participants: *.picksin add @user1 @user2 @user3 @user4 @user5*.' }, { quoted: message });
    if (uniqueTags.length !== tagged.length || uniqueTags.length > 5) return sock.sendMessage(chatId, { text: 'Tag no more than five different participants per command.' }, { quoted: message });
    const additions = uniqueTags.filter(id => !selection.players.includes(id));
    if (selection.players.length + additions.length > 5) return sock.sendMessage(chatId, { text: 'PICK YOUR SIN allows 2–5 participants. Use *.picksin list* to check the current selection.' }, { quoted: message });
    selection.players.push(...additions);
    await saveSelection(chatId, selection);
    return sendSelectionList(sock, chatId, selection);
  }
  if (sub === 'change') {
    if (uniqueTags.length !== 2) return sock.sendMessage(chatId, { text: 'Tag the current participant and replacement: *.picksin change @current @replacement*.' }, { quoted: message });
    const [current, replacement] = uniqueTags;
    const index = selection.players.indexOf(current);
    if (index < 0) return sock.sendMessage(chatId, { text: 'The first tagged person is not in the current selection.' }, { quoted: message });
    if (selection.players.includes(replacement)) return sock.sendMessage(chatId, { text: 'The replacement is already selected.' }, { quoted: message });
    selection.players[index] = replacement;
    await saveSelection(chatId, selection);
    return sendSelectionList(sock, chatId, selection);
  }
  if (sub === 'arrange' || sub === 'order') {
    if (uniqueTags.length !== selection.players.length || selection.players.length < 2 || selection.players.length > 5 || new Set(selection.players).size !== selection.players.length || !selection.players.every(id => uniqueTags.includes(id))) {
      return sock.sendMessage(chatId, { text: 'Tag every selected participant exactly once, in the intended order.' }, { quoted: message });
    }
    selection.players = uniqueTags;
    await saveSelection(chatId, selection);
    return sendSelectionList(sock, chatId, selection);
  }
  return sock.sendMessage(chatId, { text: 'PICK YOUR SIN commands: *.picksin start*, *.picksin add*, *.picksin list*, *.picksin change*, *.picksin arrange*, *.picksin open*, *.picksin status*, *.picksin end*.' }, { quoted: message });
}


async function beginPickYourSinSessionLocked(sock, chatId, players, startedBy) {
  if (!isFeatureGroup(chatId)) throw new Error('PICK YOUR SIN is enabled only in authorized feature groups.');
  const access = await isGameAllowed(chatId, 'pickyoursin');
  if (!access.ok) {
    await sock.sendMessage(chatId, { text: access.msg });
    return false;
  }
  if (!Array.isArray(players) || players.length < 2 || players.length > 5) {
    throw new Error('PICK YOUR SIN requires between two and five selected participants.');
  }
  const dayKey = lagosDateKey();
  const daily = (await store.getSetting(chatId, DAILY_KEY)) || {};
  const completedToday = new Set(daily[dayKey] || []);
  const alreadyPlayed = [];
  const states = {};
  for (const rawId of players) {
    const playerId = (await canonicalWhatsAppUserId(sock, rawId)) || rawId;
    if (completedToday.has(playerId)) alreadyPlayed.push(playerId);
    const gender = await getUserGender(playerId, sock);
    states[playerId] = {
      status: 'active',
      gender: gender || null,
      waitingForGender: !gender,
      color: null,
      lastColor: null,
      awaitingColor: true,
      step: 0,
      truthIndex: 0,
      dareIndex: 0,
      passUsed: false,
      waiting: false,
      questionMessageId: null,
      cooldownUntil: null
    };
  }
  if (alreadyPlayed.length) {
    throw new Error(`These selected participants have already completed PICK YOUR SIN today and cannot play again: ${alreadyPlayed.map(mention).join(', ')}.`);
  }
  const session = {
    id: `pys_${Date.now()}`,
    status: 'active',
    createdAt: Date.now(),
    startedBy,
    players: Object.keys(states),
    playerStates: states,
    decks: buildDecks(),
    usedPromptKeys: [],
    usedPromptIds: []
  };
  const sessions = await getSessions(chatId);
  if (Object.values(sessions).some(item => item.status === 'active')) {
    throw new Error('Another PICK YOUR SIN session is already active in this group.');
  }
  sessions[session.id] = session;
  await saveSessions(chatId, sessions);
  await sock.sendMessage(chatId, {
    text: `🔥 *PICK YOUR SIN — THE FOUR FOLDERS ARE OPEN*\n\n${session.players.length} participants are in: ${session.players.map(mention).join(' ')}\nEach player plays independently. The four folders contain different hidden intensity levels — the colour never reveals the level.\n\nChoose one folder by typing its name or sending its emoji:\n❤️ RED · 💛 YELLOW · 🧡 ORANGE · 🩶 ASH\n\nYour gender selects the question bank; your folder selects the hidden intensity. Each player gets two rounds: five truths and one action dare per round. One pass per session. 30-second cooldown between prompts.`,
    mentions: session.players
  });
  for (const [playerId, state] of Object.entries(states)) {
    if (state.waitingForGender) {
      await sock.sendMessage(chatId, {
        text: `@ ${playerId.split('@')[0]}, register your gender with *.gender guy* or *.gender lady*, then choose your colour.`,
        mentions: [playerId]
      });
    }
  }
  return true;
}

export async function beginPickYourSinSession(sock, chatId, players, startedBy) {
  return withChatLock(chatId, () => beginPickYourSinSessionLocked(sock, chatId, players, startedBy));
}

async function handlePickYourSinMessageLocked(sock, chatId, message, text, senderId) {
  if (!chatId?.endsWith('@g.us') || message?.key?.fromMe || !senderId) return false;
  const sessions = await getSessions(chatId);
  const session = Object.values(sessions).find(item => item.status === 'active');
  if (!session) return false;
  const playerId = await findPlayerKey(sock, session.players, senderId);
  if (!playerId) return false;
  const state = session.playerStates[playerId];
  if (!state || state.status !== 'active') return false;

  if (!state.gender) {
    const gender = await getUserGender(playerId, sock);
    if (!gender) {
      if (colorFromText(text)) {
        await sock.sendMessage(chatId, { text: 'Register your gender first with *.gender guy* or *.gender lady*, then choose your colour.' }, { quoted: message });
        return true;
      }
      return false;
    }
    state.gender = gender;
    state.waitingForGender = false;
    await saveSessions(chatId, sessions);
  }

  const access = await isGameAllowed(chatId, 'pickyoursin');
  if (!access.ok) {
    await sock.sendMessage(chatId, { text: access.msg }, { quoted: message });
    return true;
  }

  if (!state.color) {
    const color = colorFromText(text);
    if (!color) return false;
    if (state.cooldownUntil && Date.now() < state.cooldownUntil) {
      const remaining = Math.ceil((state.cooldownUntil - Date.now()) / 1000);
      await sock.sendMessage(chatId, { text: `⏳ Your next colour choice unlocks in *${remaining} seconds*.` }, { quoted: message });
      return true;
    }
    if (color === state.lastColor) {
      await sock.sendMessage(chatId, { text: `🚫 You just used ${COLORS[color].label}. Choose a different colour for this turn.` }, { quoted: message });
      return true;
    }
    state.color = color;
    state.lastColor = color;
    state.awaitingColor = false;
    await saveSessions(chatId, sessions);
    await sendPrompt(sock, chatId, session, playerId);
    return true;
  }

  const context = getPickYourSinMessageContext(message);
  const botId = String(sock.user?.id || '').split(':')[0].split('@')[0];
  const mentioned = (context.mentionedJid || []).some(id => String(id).split(':')[0].split('@')[0] === botId);
  const replied = Boolean(state.questionMessageId && context.stanzaId === state.questionMessageId);
  if (!replied && !mentioned) return false;

  if (state.cooldownUntil && Date.now() < state.cooldownUntil) {
    const remaining = Math.ceil((state.cooldownUntil - Date.now()) / 1000);
    await sock.sendMessage(chatId, { text: `⏳ Your next prompt unlocks in *${remaining} seconds*.` }, { quoted: message });
    return true;
  }
  if (!state.waiting && state.cooldownUntil && Date.now() >= state.cooldownUntil) {
    await sendPrompt(sock, chatId, session, playerId);
    return true;
  }
  if (!state.waiting) return true;

  const isPass = /^(pass|skip|use pass)$/i.test(String(text || '').trim());
  if (isPass && state.currentType !== 'truth') {
    await sock.sendMessage(chatId, { text: '🚫 Your pass can only be used on a TRUTH. Complete the dare to continue.' }, { quoted: message });
    return true;
  }
  if (isPass && state.passUsed) {
    await sock.sendMessage(chatId, { text: 'Your one pass for this session has already been used.' }, { quoted: message });
    return true;
  }

  const mediaKind = getPickYourSinMediaKind(message);
  if (state.currentType === 'dare') {
    if (!['voice', 'image', 'video'].includes(mediaKind)) {
      await sock.sendMessage(chatId, {
        text: '🚫 A dare response must be a voice note, image or video. Text messages and ordinary audio files do not count. Your dare is still waiting.',
      }, { quoted: message });
      return true;
    }
  } else if (!isPass && mediaKind !== 'text') {
    await sock.sendMessage(chatId, {
      text: '✍️ A truth must be answered in writing. Send a proper written answer with the actual story or details; media alone will not count.',
    }, { quoted: message });
    return true;
  } else if (!isPass) {
    const validation = validatePickYourSinTruthAnswer(text);
    if (!validation.accepted) {
      await sock.sendMessage(chatId, {
        text: '🚫 That is not a complete truth answer. One-word replies, yes/no, “done”, “I have”, “I have not” and similar shortcuts will not count. Answer the actual prompt in at least 12 words and include real details. Your turn is still active.',
      }, { quoted: message });
      return true;
    }
  }

  if (state.inactivityToken) {
    for (const timer of inactivityTimers.get(state.inactivityToken) || []) clearTimeout(timer);
    inactivityTimers.delete(state.inactivityToken);
  }
  if (isPass) state.passUsed = true;
  else state.step += 1;
  state.inactivityToken = null;
  state.waitingSince = null;

  state.waiting = false;
  state.color = null;
  state.awaitingColor = true;
  state.cooldownUntil = Date.now() + COOLDOWN_MS;
  state.nextPromptToken = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const token = state.nextPromptToken;
  await saveSessions(chatId, sessions);
  await sock.sendMessage(chatId, {
    text: isPass
      ? `↪️ Pass used. A replacement ${state.currentType} will arrive in 30 seconds.`
      : `✅ Response recorded. Your next prompt arrives in 30 seconds.`,
    mentions: [playerId]
  }, { quoted: message });

  setTimeout(async () => {
    try {
      await withChatLock(chatId, async () => {
        const latest = await getSessions(chatId);
        const current = latest[session.id];
        const currentState = current?.playerStates?.[playerId];
        if (!current || current.status !== 'active' || !currentState || currentState.nextPromptToken !== token) return;
        if (currentState.step >= 12) await sendPrompt(sock, chatId, current, playerId);
        else await sendColorPrompt(sock, chatId, current, playerId);
      });
    } catch (error) {
      console.error('[PICK YOUR SIN] Could not deliver next prompt:', error);
    }
  }, COOLDOWN_MS);
  return true;
}

export async function handlePickYourSinMessage(sock, chatId, message, text, senderId) {
  return withChatLock(chatId, () => handlePickYourSinMessageLocked(sock, chatId, message, text, senderId));
}

export default {
  command: 'picksin',
  aliases: ['pickyoursin'],
  category: 'games',
  description: 'Start and manage PICK YOUR SIN participant selection and sessions.',
  groupOnly: true,
  adminOnly: true,
  async handler(sock, message, args, context) {
    const chatId = context.chatId || message.key.remoteJid;
    const sub = String(args?.[0] || '').toLowerCase();
    const sessions = await getSessions(chatId);
    const session = Object.values(sessions).find(item => item.status === 'active');
    if (sub === 'replace' && session) return replaceInactivePlayer(sock, chatId, message, session);
    if (sub === 'end' || sub === 'stop') {
      if (!session) {
        const pending = await getSelection(chatId);
        if (pending?.status === 'pending') { pending.status = 'cancelled'; await saveSelection(chatId, pending); return sock.sendMessage(chatId, { text: '🛑 PICK YOUR SIN selection cancelled.' }, { quoted: message }); }
        return sock.sendMessage(chatId, { text: 'There is no active PICK YOUR SIN session or open selection.' }, { quoted: message });
      }
      session.status = 'ended';
      session.endedAt = Date.now();
      await saveSessions(chatId, sessions);
      return sock.sendMessage(chatId, { text: '🛑 Admin ended PICK YOUR SIN.' }, { quoted: message });
    }
    if (sub === 'start' || sub === 'add' || sub === 'list' || sub === 'change' || sub === 'arrange' || sub === 'order' || sub === 'open' || sub === 'cancel' || sub === 'endselection') return handleSelectionCommand(sock, message, args, context, chatId);
    if (sub === 'status' && !session) { const pending = await getSelection(chatId); if (pending && ['pending', 'ready'].includes(pending.status)) return sendSelectionList(sock, chatId, pending); }
    if (!session) return sock.sendMessage(chatId, { text: 'No active PICK YOUR SIN session. Open selection with *.picksin start*.' }, { quoted: message });
    const lines = session.players.map(id => {
      const state = session.playerStates[id];
      return `${mention(id)} — ${state.status === 'complete' ? 'DONE TODAY' : (state.color || 'choosing colour')} — ${state.step}/12 — ${state.passUsed ? 'pass used' : 'pass available'}`;
    });
    return sock.sendMessage(chatId, { text: `🎭 *PICK YOUR SIN STATUS*\n\n${lines.join('\n')}`, mentions: session.players }, { quoted: message });
  }
};

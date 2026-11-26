import store from '../lib/lightweight_store.js';
import { getUserGender } from './gender.js';
import { getTruths } from '../data/todLists.js';
import { isGameAllowed } from './daylock.js';
import { isFeatureGroup } from '../lib/featureGroups.js';
import { sameWhatsAppUser, canonicalWhatsAppUserId } from '../lib/whatsappIdentity.js';

const KEY = 'pickYourSinSessions';
const DAILY_KEY = 'pickYourSinDailyCompletions';
const COOLDOWN_MS = 30_000;
const chatQueues = new Map();
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
  green: { emoji: '💚', label: 'GREEN' },
  yellow: { emoji: '💛', label: 'YELLOW' },
  orange: { emoji: '🧡', label: 'ORANGE' }
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
  const text = String(value || '').trim().toLowerCase();
  const aliases = {
    red: 'red', '❤️': 'red', '❤': 'red', '🔴': 'red',
    green: 'green', '💚': 'green', '🟢': 'green',
    yellow: 'yellow', '💛': 'yellow', '🟡': 'yellow',
    orange: 'orange', '🧡': 'orange', '🟠': 'orange'
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
    text: `🎨 @${playerId.split('@')[0]}, choose your next colour: ❤️ RED · 💚 GREEN · 💛 YELLOW · 🧡 ORANGE.${previous}`,
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
function buildDecks() {
  const decks = {};
  for (const gender of ['guy', 'lady']) {
    const truths = shuffle([...new Set(getTruths(gender).filter(Boolean).map(String))]);
    const dares = shuffle(ACTION_DARES);
    const truthFallback = [
      'What intimate desire have you kept private because you fear being judged?',
      'What is one adult fantasy you have seriously considered but never discussed?',
      'What is the most personal truth about your attraction patterns that you rarely admit?',
      'What boundary or desire took you the longest to understand about yourself?'
    ];
    for (const [colorIndex, color] of Object.keys(COLORS).entries()) {
      const truthCards = [];
      const dareCards = [];
      for (let i = 0; i < 42; i++) {
        const sourceIndex = colorIndex * 42 + i;
        truthCards.push(truths[sourceIndex % Math.max(1, truths.length)] || truthFallback[i % truthFallback.length]);
      }
      for (let i = 0; i < 8; i++) dareCards.push(dares[(colorIndex * 8 + i) % dares.length]);
      decks[`${gender}:${color}`] = { truths: truthCards, dares: dareCards };
    }
  }
  return decks;
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
    if (session.players.every(id => session.playerStates[id]?.status === 'complete')) {
      session.status = 'complete';
      session.completedAt = Date.now();
      const completedSessions = await getSessions(chatId);
      completedSessions[session.id] = session;
      await saveSessions(chatId, completedSessions);
      await sock.sendMessage(chatId, { text: '🔥 *PICK YOUR SIN is complete.* All five selected players have finished.' });
    }
    return true;
  }
  const type = questionType(state.step);
  const deck = session.decks[`${state.gender}:${state.color}`];
  const indexKey = type === 'truth' ? 'truthIndex' : 'dareIndex';
  const cards = type === 'truth' ? deck.truths : deck.dares;
  const card = cards[state[indexKey] % cards.length];
  state[indexKey] += 1;
  state.currentType = type;
  state.awaitingColor = false;
  state.currentCard = card;
  state.waiting = true;
  state.cooldownUntil = null;
  const label = type === 'truth' ? '🔥 *TRUTH*' : '💀 *DARE — ACTION REQUIRED*';
  const progress = type === 'truth'
    ? `Truth ${state.step < 5 ? state.step + 1 : state.step - 5}/5`
    : `Dare ${state.step === 5 ? 1 : 2}/2`;
  const sent = await sock.sendMessage(chatId, {
    text: `🎭 *PICK YOUR SIN* — ${COLORS[state.color].emoji} ${COLORS[state.color].label}\n${label} · ${progress}\n\n${card}\n\n_Reply to this prompt or tag the bot when you've completed it. You may use your one session pass on a TRUTH only. You have 30 seconds between prompts._`,
    mentions: [playerId]
  });
  state.questionMessageId = sent?.key?.id || null;
  const latestSessions = await getSessions(chatId);
  latestSessions[session.id] = session;
  await saveSessions(chatId, latestSessions);
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
  if (existing?.status === 'pending') {
    return sock.sendMessage(chatId, { text: 'PICK YOUR SIN selection is already open. Use *.picksin list*.' });
  }
  const selection = {
    status: 'pending', players: [], startedBy: senderId,
    createdAt: Date.now(), adjustmentEndsAt: Date.now() + SELECTION_MS
  };
  await saveSelection(chatId, selection);
  await sock.sendMessage(chatId, {
    text: '🎭 *PICK YOUR SIN — SELECTION OPEN*\\n\\nSelect exactly five participants using *.picksin add @user1 @user2 @user3 @user4 @user5*.\\n\\nYou have 10 minutes to add, replace or rearrange participants.\\n*.picksin list* · *.picksin change @current @replacement* · *.picksin arrange @user1 @user2 @user3 @user4 @user5* · *.picksin start*'
  });
  setTimeout(async () => {
    try {
      await withChatLock(chatId, async () => {
        const latest = await getSelection(chatId);
        if (latest?.status !== 'pending' || latest.createdAt !== selection.createdAt) return;
        if (latest.players.length === 5) {
          await saveSelection(chatId, { ...latest, status: 'starting' });
          await beginPickYourSinSessionLocked(sock, chatId, latest.players, latest.startedBy);
          await saveSelection(chatId, { ...latest, status: 'started' });
        } else {
          await saveSelection(chatId, { ...latest, status: 'expired' });
          await sock.sendMessage(chatId, { text: '⌛ PICK YOUR SIN selection expired: exactly five participants were not selected.' });
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
    ? selection.players.map((id, i) => `${i + 1}. ${mention(id)}`).join('\\n')
    : 'No participants selected yet.';
  return sock.sendMessage(chatId, {
    text: `🎭 *PICK YOUR SIN SELECTION*\\n\\n${players}\\n\\nSelected: *${selection.players.length}/5*\\nTime remaining: *${remaining} minute(s)*\\n\\n*.picksin add @users* · *.picksin change @current @replacement* · *.picksin arrange @all-five* · *.picksin start*`,
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
  if (sub === 'endselection' || sub === 'cancel') {
    if (!selection || selection.status !== 'pending') return sock.sendMessage(chatId, { text: 'No open PICK YOUR SIN selection.' }, { quoted: message });
    selection.status = 'cancelled';
    await saveSelection(chatId, selection);
    return sock.sendMessage(chatId, { text: '🛑 PICK YOUR SIN selection cancelled.' }, { quoted: message });
  }
  if (!selection || selection.status !== 'pending') {
    return sock.sendMessage(chatId, { text: 'No open selection. Start one with *.picksin start*.' }, { quoted: message });
  }
  if (Date.now() >= selection.adjustmentEndsAt) {
    if (selection.players.length === 5) {
      selection.status = 'starting';
      await saveSelection(chatId, selection);
      await beginPickYourSinSession(sock, chatId, selection.players, selection.startedBy);
      selection.status = 'started';
      await saveSelection(chatId, selection);
    } else {
      selection.status = 'expired';
      await saveSelection(chatId, selection);
    }
    return sock.sendMessage(chatId, { text: 'The 10-minute selection window has closed.' }, { quoted: message });
  }
  if (sub === 'list') return sendSelectionList(sock, chatId, selection);
  const tagged = await Promise.all(getMentions(message).map(async id => (await canonicalWhatsAppUserId(sock, id)) || id));
  const uniqueTags = [...new Set(tagged)];
  if (sub === 'add') {
    if (!uniqueTags.length) return sock.sendMessage(chatId, { text: 'Tag up to five participants: *.picksin add @user1 @user2 @user3 @user4 @user5*.' }, { quoted: message });
    if (uniqueTags.length !== tagged.length || uniqueTags.length > 5) return sock.sendMessage(chatId, { text: 'Tag no more than five different participants per command.' }, { quoted: message });
    const additions = uniqueTags.filter(id => !selection.players.includes(id));
    if (selection.players.length + additions.length > 5) return sock.sendMessage(chatId, { text: 'PICK YOUR SIN requires exactly five participants. Use *.picksin list* to check the current selection.' }, { quoted: message });
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
    if (uniqueTags.length !== 5 || new Set(selection.players).size !== 5 || !selection.players.every(id => uniqueTags.includes(id))) {
      return sock.sendMessage(chatId, { text: 'Tag all five selected participants exactly once, in the intended order.' }, { quoted: message });
    }
    selection.players = uniqueTags;
    await saveSelection(chatId, selection);
    return sendSelectionList(sock, chatId, selection);
  }
  if (sub === 'startnow' || sub === 'begin') {
    if (selection.players.length !== 5) return sock.sendMessage(chatId, { text: 'Exactly five participants must be selected before starting.' }, { quoted: message });
    selection.status = 'starting';
    await saveSelection(chatId, selection);
    await beginPickYourSinSession(sock, chatId, selection.players, selection.startedBy);
    selection.status = 'started';
    await saveSelection(chatId, selection);
    return;
  }
  return sock.sendMessage(chatId, { text: 'PICK YOUR SIN commands: *.picksin start*, *.picksin add*, *.picksin list*, *.picksin change*, *.picksin arrange*, *.picksin startnow*, *.picksin status*, *.picksin end*.' }, { quoted: message });
}


const SELECTION_KEY = 'pickYourSinSelection';
const SELECTION_MS = 10 * 60 * 1000;
function getMentions(message) {
  const context = message?.message?.extendedTextMessage?.contextInfo || message?.message?.imageMessage?.contextInfo || message?.message?.videoMessage?.contextInfo || {};
  return context.mentionedJid || [];
}
async function getSelection(chatId) { return (await store.getSetting(chatId, SELECTION_KEY)) || null; }
async function saveSelection(chatId, selection) {
  if (!await store.saveSettingVerified(chatId, SELECTION_KEY, selection)) throw new Error('PICK YOUR SIN selection could not be persisted.');
}
async function startSelection(sock, chatId, senderId) {
  const access = await isGameAllowed(chatId, 'pickyoursin');
  if (!access.ok) return sock.sendMessage(chatId, { text: access.msg });
  const active = await getSessions(chatId);
  if (Object.values(active).some(item => item.status === 'active')) return sock.sendMessage(chatId, { text: 'A PICK YOUR SIN session is already active.' });
  const existing = await getSelection(chatId);
  if (existing?.status === 'pending') return sock.sendMessage(chatId, { text: 'PICK YOUR SIN selection is already open. Use *.picksin list*.' });
  const selection = { status: 'pending', players: [], startedBy: senderId, createdAt: Date.now(), adjustmentEndsAt: Date.now() + SELECTION_MS };
  await saveSelection(chatId, selection);
  await sock.sendMessage(chatId, { text: '🎭 *PICK YOUR SIN — SELECTION OPEN*\n\nSelect exactly five participants using *.picksin add @user1 @user2 @user3 @user4 @user5*.\n\nYou have 10 minutes to add, replace or rearrange participants.\n*.picksin list* · *.picksin change @current @replacement* · *.picksin arrange @user1 @user2 @user3 @user4 @user5* · *.picksin startnow*' });
  setTimeout(async () => {
    try {
      await withChatLock(chatId, async () => {
        const latest = await getSelection(chatId);
        if (latest?.status !== 'pending' || latest.createdAt !== selection.createdAt) return;
        if (latest.players.length === 5) {
          latest.status = 'starting'; await saveSelection(chatId, latest);
          await beginPickYourSinSessionLocked(sock, chatId, latest.players, latest.startedBy);
          latest.status = 'started'; await saveSelection(chatId, latest);
        } else {
          latest.status = 'expired'; await saveSelection(chatId, latest);
          await sock.sendMessage(chatId, { text: '⌛ PICK YOUR SIN selection expired: exactly five participants were not selected.' });
        }
      });
    } catch (error) { console.error('[PICK YOUR SIN] Selection auto-start failed:', error); }
  }, SELECTION_MS);
}
async function sendSelectionList(sock, chatId, selection) {
  const remaining = Math.max(0, Math.ceil((selection.adjustmentEndsAt - Date.now()) / 60000));
  const players = selection.players.length ? selection.players.map((id, i) => `${i + 1}. ${mention(id)}`).join('\n') : 'No participants selected yet.';
  return sock.sendMessage(chatId, { text: `🎭 *PICK YOUR SIN SELECTION*\n\n${players}\n\nSelected: *${selection.players.length}/5*\nTime remaining: *${remaining} minute(s)*\n\n*.picksin add @users* · *.picksin change @current @replacement* · *.picksin arrange @all-five* · *.picksin startnow*`, mentions: selection.players });
}
async function handleSelectionCommand(sock, message, args, context, chatId) {
  const sub = String(args?.[0] || '').toLowerCase();
  const senderId = context.senderId || message.key.participant || message.key.remoteJid;
  if (sub === 'start') return startSelection(sock, chatId, senderId);
  let selection = await getSelection(chatId);
  if (sub === 'cancel' || sub === 'endselection') {
    if (!selection || selection.status !== 'pending') return sock.sendMessage(chatId, { text: 'No open PICK YOUR SIN selection.' }, { quoted: message });
    selection.status = 'cancelled'; await saveSelection(chatId, selection);
    return sock.sendMessage(chatId, { text: '🛑 PICK YOUR SIN selection cancelled.' }, { quoted: message });
  }
  if (!selection || selection.status !== 'pending') return sock.sendMessage(chatId, { text: 'No open selection. Start one with *.picksin start*.' }, { quoted: message });
  if (Date.now() >= selection.adjustmentEndsAt) return sock.sendMessage(chatId, { text: 'The 10-minute selection window has closed.' }, { quoted: message });
  if (sub === 'list') return sendSelectionList(sock, chatId, selection);
  const tagged = await Promise.all(getMentions(message).map(async id => (await canonicalWhatsAppUserId(sock, id)) || id));
  const uniqueTags = [...new Set(tagged)];
  if (sub === 'add') {
    if (!uniqueTags.length) return sock.sendMessage(chatId, { text: 'Tag up to five participants: *.picksin add @user1 @user2 @user3 @user4 @user5*.' }, { quoted: message });
    if (uniqueTags.length !== tagged.length || uniqueTags.length > 5) return sock.sendMessage(chatId, { text: 'Tag no more than five different participants per command.' }, { quoted: message });
    const additions = uniqueTags.filter(id => !selection.players.includes(id));
    if (selection.players.length + additions.length > 5) return sock.sendMessage(chatId, { text: 'PICK YOUR SIN requires exactly five participants. Check *.picksin list*.' }, { quoted: message });
    selection.players.push(...additions); await saveSelection(chatId, selection); return sendSelectionList(sock, chatId, selection);
  }
  if (sub === 'change') {
    if (uniqueTags.length !== 2) return sock.sendMessage(chatId, { text: 'Tag the current participant and replacement: *.picksin change @current @replacement*.' }, { quoted: message });
    const [current, replacement] = uniqueTags, index = selection.players.indexOf(current);
    if (index < 0) return sock.sendMessage(chatId, { text: 'The first tagged person is not in the current selection.' }, { quoted: message });
    if (selection.players.includes(replacement)) return sock.sendMessage(chatId, { text: 'The replacement is already selected.' }, { quoted: message });
    selection.players[index] = replacement; await saveSelection(chatId, selection); return sendSelectionList(sock, chatId, selection);
  }
  if (sub === 'arrange' || sub === 'order') {
    if (uniqueTags.length !== 5 || new Set(selection.players).size !== 5 || !selection.players.every(id => uniqueTags.includes(id))) return sock.sendMessage(chatId, { text: 'Tag all five selected participants exactly once, in the intended order.' }, { quoted: message });
    selection.players = uniqueTags; await saveSelection(chatId, selection); return sendSelectionList(sock, chatId, selection);
  }
  if (sub === 'startnow' || sub === 'begin') {
    if (selection.players.length !== 5) return sock.sendMessage(chatId, { text: 'Exactly five participants must be selected before starting.' }, { quoted: message });
    selection.status = 'starting'; await saveSelection(chatId, selection);
    await beginPickYourSinSession(sock, chatId, selection.players, selection.startedBy);
    selection.status = 'started'; await saveSelection(chatId, selection); return;
  }
  return sock.sendMessage(chatId, { text: 'Commands: *.picksin start*, *.picksin add*, *.picksin list*, *.picksin change*, *.picksin arrange*, *.picksin startnow*, *.picksin status*, *.picksin end*.' }, { quoted: message });
}
async function beginPickYourSinSessionLocked(sock, chatId, players, startedBy) {
  if (!isFeatureGroup(chatId)) throw new Error('PICK YOUR SIN is enabled only in authorized feature groups.');
  const access = await isGameAllowed(chatId, 'pickyoursin');
  if (!access.ok) {
    await sock.sendMessage(chatId, { text: access.msg });
    return false;
  }
  if (!Array.isArray(players) || players.length !== 5) {
    throw new Error('PICK YOUR SIN requires exactly five selected participants.');
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
    decks: buildDecks()
  };
  const sessions = await getSessions(chatId);
  if (Object.values(sessions).some(item => item.status === 'active')) {
    throw new Error('Another PICK YOUR SIN session is already active in this group.');
  }
  sessions[session.id] = session;
  await saveSessions(chatId, sessions);
  await sock.sendMessage(chatId, {
    text: `🔥 *PICK YOUR SIN — SELECTION COMPLETE*\n\nFive participants are in. Each player is playing independently and simultaneously.\n\nChoose one colour by typing its name or sending its emoji:\n❤️ RED · 💚 GREEN · 💛 YELLOW · 🧡 ORANGE\n\nEach player gets two rounds: five truths and one action dare per round. One pass per session. 30-second cooldown between prompts.`,
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

  const context = message?.message?.extendedTextMessage?.contextInfo
    || message?.message?.imageMessage?.contextInfo
    || message?.message?.videoMessage?.contextInfo
    || {};
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
  if (isPass) state.passUsed = true;
  else state.step += 1;

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
    if (sub === 'start' || sub === 'add' || sub === 'list' || sub === 'change' || sub === 'arrange' || sub === 'order' || sub === 'startnow' || sub === 'begin' || sub === 'cancel' || sub === 'endselection') return handleSelectionCommand(sock, message, args, context, chatId);
    if (sub === 'status' && !session) { const pending = await getSelection(chatId); if (pending?.status === 'pending') return sendSelectionList(sock, chatId, pending); }
    if (!session) return sock.sendMessage(chatId, { text: 'No active PICK YOUR SIN session. Open selection with *.picksin start*.' }, { quoted: message });
    const lines = session.players.map(id => {
      const state = session.playerStates[id];
      return `${mention(id)} — ${state.status === 'complete' ? 'DONE TODAY' : (state.color || 'choosing colour')} — ${state.step}/12 — ${state.passUsed ? 'pass used' : 'pass available'}`;
    });
    return sock.sendMessage(chatId, { text: `🎭 *PICK YOUR SIN STATUS*\n\n${lines.join('\n')}`, mentions: session.players }, { quoted: message });
  }
};

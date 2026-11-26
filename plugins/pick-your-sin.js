import store from '../lib/lightweight_store.js';
import { getUserGender } from './gender.js';
import { getTruths } from '../data/todLists.js';
import { isGameAllowed } from './daylock.js';
import { isFeatureGroup } from '../lib/featureGroups.js';
import { sameWhatsAppUser, canonicalWhatsAppUserId } from '../lib/whatsappIdentity.js';

const KEY = 'pickYourSinSessions';
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
    const truths = shuffle(getTruths(gender).filter(Boolean).map(String));
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
  state.currentCard = card;
  state.waiting = true;
  state.cooldownUntil = null;
  const label = type === 'truth' ? '🔥 *TRUTH*' : '💀 *DARE — ACTION REQUIRED*';
  const progress = type === 'truth'
    ? `Truth ${state.step < 5 ? state.step + 1 : state.step - 4}/5`
    : `Dare ${state.step === 5 ? 1 : 2}/2`;
  const sent = await sock.sendMessage(chatId, {
    text: `🎭 *PICK YOUR SIN* — ${COLORS[state.color].emoji} ${COLORS[state.color].label}\n${label} · ${progress}\n\n${card}\n\n_Reply to this prompt or tag the bot when you've completed it. Type *pass* to use your one session pass. You have 30 seconds between prompts._`,
    mentions: [playerId]
  });
  state.questionMessageId = sent?.key?.id || null;
  const latestSessions = await getSessions(chatId);
  latestSessions[session.id] = session;
  await saveSessions(chatId, latestSessions);
  return true;
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
  const states = {};
  for (const rawId of players) {
    const playerId = (await canonicalWhatsAppUserId(sock, rawId)) || rawId;
    const gender = await getUserGender(playerId, sock);
    states[playerId] = {
      status: 'active',
      gender: gender || null,
      waitingForGender: !gender,
      color: null,
      step: 0,
      truthIndex: 0,
      dareIndex: 0,
      passUsed: false,
      waiting: false,
      questionMessageId: null,
      cooldownUntil: null
    };
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
    if (!gender) return false;
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
    state.color = color;
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
  if (isPass && state.passUsed) {
    await sock.sendMessage(chatId, { text: 'Your one pass for this session has already been used.' }, { quoted: message });
    return true;
  }
  if (isPass) state.passUsed = true;
  else state.step += 1;

  state.waiting = false;
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
        await sendPrompt(sock, chatId, current, playerId);
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
  description: 'Admin controls for the active Pick Your Sin session.',
  groupOnly: true,
  adminOnly: true,
  async handler(sock, message, args, context) {
    const chatId = context.chatId || message.key.remoteJid;
    const sub = String(args?.[0] || '').toLowerCase();
    const sessions = await getSessions(chatId);
    const session = Object.values(sessions).find(item => item.status === 'active');
    if (sub === 'end' || sub === 'stop') {
      if (!session) return sock.sendMessage(chatId, { text: 'There is no active PICK YOUR SIN session.' }, { quoted: message });
      session.status = 'ended';
      session.endedAt = Date.now();
      await saveSessions(chatId, sessions);
      return sock.sendMessage(chatId, { text: '🛑 Admin ended PICK YOUR SIN.' }, { quoted: message });
    }
    if (!session) return sock.sendMessage(chatId, { text: 'No active PICK YOUR SIN session. Start selection with *.hotseat sin*.' }, { quoted: message });
    const lines = session.players.map(id => {
      const state = session.playerStates[id];
      return `${mention(id)} — ${state.color || 'choosing colour'} — ${state.step}/12 — ${state.passUsed ? 'pass used' : 'pass available'}`;
    });
    return sock.sendMessage(chatId, { text: `🎭 *PICK YOUR SIN STATUS*\n\n${lines.join('\n')}`, mentions: session.players }, { quoted: message });
  }
};

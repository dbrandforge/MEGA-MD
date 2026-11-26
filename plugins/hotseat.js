import store from '../lib/lightweight_store.js';
import config from '../config.js';
import { isGameAllowed } from './daylock.js';
import { getHotSeatQuestions } from '../data/hotseatQuestions.js';
import { getUserGender } from './gender.js';
import { isFeatureGroup } from '../lib/featureGroups.js';


const HOTSEAT_KEY = 'hotseatSession';
const ADJUSTMENT_MS = Number(config.hotseatAdjustmentMinutes || 10) * 60 * 1000;
const SESSION_MS = Number(config.hotseatSessionHours || 2) * 60 * 60 * 1000;
const ANSWER_TIMEOUT_MS = Number(config.hotseatAnswerMinutes || 5) * 60 * 1000;
const NEXT_QUESTION_MS = Number(config.hotseatNextQuestionSeconds || 60) * 1000;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;
function playerLimits() { return { min: MIN_PLAYERS, max: MAX_PLAYERS }; }
function shuffle(items) { return [...items].sort(() => Math.random() - 0.5); }
function mention(jid) { return '@' + String(jid || '').split('@')[0]; }
function stripDevice(jid) { return String(jid || '').replace(/:\d+(?=@)/, ''); }

async function normalizeHotSeatJid(sock, jid) {
    let normalized = stripDevice(jid);
    if (!normalized) return '';
    if (!normalized.includes('@')) normalized = `${normalized}@s.whatsapp.net`;
    if (normalized.endsWith('@lid')) {
        try {
            const mappedPN = await sock?.signalRepository?.lidMapping?.getPNForLID?.(jid);
            if (typeof mappedPN === 'string' && mappedPN.endsWith('@s.whatsapp.net')) {
                return stripDevice(mappedPN);
            }
        } catch (error) {
            console.warn('[HOTSEAT] Could not resolve participant LID:', error.message);
        }
    }
    return normalized;
}

async function resolveSessionPlayerKey(sock, session, userId) {
    const canonicalId = await normalizeHotSeatJid(sock, userId);
    for (const playerId of session?.players || []) {
        if (playerId === userId) return playerId;
        if (await normalizeHotSeatJid(sock, playerId) === canonicalId) return playerId;
    }
    return userId;
}

export async function resolveHotSeatPlayerKey(sock, session, userId) {
    return resolveSessionPlayerKey(sock, session, userId);
}

async function getNormalizedMentions(sock, message) {
    const mentions = getMentions(message);
    return Promise.all(mentions.map(jid => normalizeHotSeatJid(sock, jid)));
}
async function getSession(chatId) { return (await store.getSetting(chatId, HOTSEAT_KEY)) || null; }
async function saveGameState(chatId, key, value) {
    if (!await store.saveSettingVerified(chatId, key, value)) throw new Error(`Hot Seat state (${key}) could not be persisted.`);
}
async function saveSession(chatId, session) { await saveGameState(chatId, HOTSEAT_KEY, session); }
async function clearSession(chatId) { await saveGameState(chatId, HOTSEAT_KEY, null); }
function getMentions(message) {
    const context = message?.message?.extendedTextMessage?.contextInfo
        || message?.message?.imageMessage?.contextInfo
        || message?.message?.videoMessage?.contextInfo || {};
    return context.mentionedJid || [];
}
function formatPlayers(players) { return players.map((p, i) => `${i + 1}. ${mention(p)}`).join('\n'); }
function unique(items) { return items.length === new Set(items).size; }
async function muteUser(sock, chatId, userId) {
    try {
        const { softMuteUser } = await import('./softmute.js');
        await softMuteUser(sock, chatId, userId);
        return true;
    } catch { return false; }
}
async function scheduleHotSeatTimeout(sock, chatId, player, questionId) {
    const latest = await getSession(chatId);
    const state = latest?.playerStates?.[player];
    if (!latest || latest.status !== 'active' || !state || !state.waiting || state.questionId !== questionId) return false;
    const timeoutToken = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    state.timeoutToken = timeoutToken;
    await saveSession(chatId, latest);
    const elapsed = Math.max(0, Date.now() - Number(state.questionAskedAt || Date.now()));
    const remainingMs = Math.max(0, ANSWER_TIMEOUT_MS - elapsed);
    setTimeout(async () => {
        const current = await getSession(chatId);
        if (!current || current.status !== 'active') return;
        const currentState = current.playerStates?.[player];
        if (!currentState || currentState.status !== 'active' || !currentState.waiting) return;
        if (currentState.questionId !== questionId || currentState.timeoutToken !== timeoutToken) return;
        const access = await isGameAllowed(chatId, 'hotseat');
        if (!access.ok) return;
        currentState.status = 'out';
        currentState.waiting = false;
        currentState.timeoutToken = null;
        await saveSession(chatId, current);
        await muteUser(sock, chatId, player);
        await sock.sendMessage(chatId, {
            text: `⏰ ${mention(player)} did not answer in time → 10-hour mute. Out of Hot Seat.`,
            mentions: [player]
        });
        const remaining = current.players.filter(id => current.playerStates?.[id]?.status === 'active');
        if (!remaining.length) {
            await clearSession(chatId);
            await sock.sendMessage(chatId, { text: '🛑 *Hot Seat ended* — no active players left.' });
        }
    }, remainingMs);
    return true;
}

async function scheduleGenderDeadline(sock, chatId, player) {
    const latest = await getSession(chatId);
    const state = latest?.playerStates?.[player];
    if (!latest || latest.status !== 'active' || !state?.waitingForGender) return false;
    const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    state.genderDeadlineToken = token;
    await saveSession(chatId, latest);
    const remainingMs = Math.max(0, Number(state.genderDeadlineAt || Date.now()) - Date.now());
    setTimeout(async () => {
        const current = await getSession(chatId);
        const currentState = current?.playerStates?.[player];
        if (!current || current.status !== 'active' || !currentState || currentState.status !== 'active') return;
        if (!currentState.waitingForGender || currentState.genderDeadlineToken !== token) return;
        let gender = null;
        try { gender = await getUserGender(player); } catch {}
        if (gender) {
            currentState.waitingForGender = false;
            currentState.genderDeadlineToken = null;
            await saveSession(chatId, current);
            await sendPlayerQuestion(sock, chatId, player);
            return;
        }
        currentState.status = 'out';
        currentState.waitingForGender = false;
        currentState.genderDeadlineToken = null;
        await saveSession(chatId, current);
        await sock.sendMessage(chatId, {
            text: `⌛ ${mention(player)} did not register a gender within 2 minutes and has been removed from Hot Seat.`,
            mentions: [player]
        });
        if (!current.players.some(id => current.playerStates?.[id]?.status === 'active')) {
            await clearSession(chatId);
            await sock.sendMessage(chatId, { text: '🛑 *Hot Seat ended* — no active players left.' });
        }
    }, remainingMs);
    return true;
}

async function scheduleNextQuestion(sock, chatId, player, answeredAt) {
    const latest = await getSession(chatId);
    const state = latest?.playerStates?.[player];
    if (!latest || latest.status !== 'active' || !state || state.status !== 'active' || state.waiting) return false;
    if (state.lastAnsweredAt !== answeredAt) return false;
    const remainingMs = Math.max(0, Number(state.nextQuestionAt || (answeredAt + NEXT_QUESTION_MS)) - Date.now());
    setTimeout(async () => {
        const current = await getSession(chatId);
        const currentState = current?.playerStates?.[player];
        if (!current || current.status !== 'active' || !currentState || currentState.status !== 'active') return;
        if (currentState.lastAnsweredAt !== answeredAt || currentState.waiting) return;
        currentState.nextQuestionAt = null;
        await saveSession(chatId, current);
        await sendPlayerQuestion(sock, chatId, player);
    }, remainingMs);
    return true;
}

async function sendPlayerQuestion(sock, chatId, player) {
    const session = await getSession(chatId);
    if (!session || session.status !== 'active') return;
    const access = await isGameAllowed(chatId, 'hotseat');
    if (!access.ok) {
        await sock.sendMessage(chatId, { text: access.msg });
        return;
    }
    if (Date.now() - session.startedAt >= SESSION_MS) {
        await clearSession(chatId);
        await sock.sendMessage(chatId, { text: '🛑 *Hot Seat ended* — 2-hour limit reached.', mentions: session.players });
        return;
    }
    const state = session.playerStates?.[player];
    if (!state || state.status !== 'active' || state.waiting) return;

    let gender = null;
    try { gender = await getUserGender(await normalizeHotSeatJid(sock, player)); } catch {}
    // If no gender set, prompt once and skip question until they register
    if (!gender) {
        state.waiting = false;
        state.waitingForGender = true;
        state.genderDeadlineAt = state.genderDeadlineAt || (Date.now() + 2 * 60 * 1000);
        await saveSession(chatId, session);
        await sock.sendMessage(chatId, {
            text: `${mention(player)} register your gender within *2 minutes* to continue:\n.gender guy\nor\n.gender lady`,
            mentions: [player]
        });
        await scheduleGenderDeadline(sock, chatId, player);
        return true;
    }
    state.waitingForGender = false;
    state.genderDeadlineAt = null;
    state.genderDeadlineToken = null;
    state.nextQuestionAt = null;
    const bank = getHotSeatQuestions(gender === 'lady' ? 'lady' : 'guy');
    const usedKey = gender === 'lady' ? 'usedLady' : 'usedGuy';
    if (!Array.isArray(session[usedKey])) session[usedKey] = [];
    if (!Array.isArray(session.usedQuestions)) session.usedQuestions = [];
    let pool = bank.filter(q => !session[usedKey].includes(q));
    if (!pool.length) {
        session[usedKey] = [];
        pool = [...bank];
    }
    const question = shuffle(pool)[0];
    session[usedKey].push(question);
    session.usedQuestions.push(question);

    const questionId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    state.waiting = true;
    state.questionId = questionId;
    state.questionAskedAt = Date.now();
    state.currentQuestion = question;
    state.gender = gender;
    await saveSession(chatId, session);

    const sentQuestion = await sock.sendMessage(chatId, {
        text: `🔥 *HOT SEAT — YOUR QUESTION*\n\n${mention(player)}, your question is:\n\n*${question}*\n\n✅ *Reply directly to this question* (swipe/reply), or tag the bot.\nOnly your answer to this active question counts.\n⏰ 5 minutes or 10-hour mute.\n⏳ After answer, next question in *60 seconds*.`,
        mentions: [player]
    });
    state.questionMessageId = sentQuestion?.key?.id || null;
    await saveSession(chatId, session);

    await scheduleHotSeatTimeout(sock, chatId, player, questionId);
    return true;
}


export async function resumeHotSeatPlayer(sock, chatId, player) {
    if (!isFeatureGroup(chatId) || !player) return false;
    const session = await getSession(chatId);
    if (!session || session.status !== 'active') return false;
    const playerKey = await resolveSessionPlayerKey(sock, session, player);
    const state = session.playerStates?.[playerKey];
    if (!state || state.status !== 'active' || (state.waiting && !state.waitingForGender)) return false;
    if (state.waitingForGender) {
        state.genderDeadlineAt = state.genderDeadlineAt || (Date.now() + 2 * 60 * 1000);
        await saveSession(chatId, session);
    }
    await sendPlayerQuestion(sock, chatId, playerKey);
    return true;
}

export async function resumeHotSeatSession(sock, chatId) {
    if (!isFeatureGroup(chatId)) return 0;
    const session = await getSession(chatId);
    if (!session) return 0;
    if (session.status === 'pending') {
        const remaining = Math.max(0, Number(session.adjustmentEndsAt || Date.now()) - Date.now());
        setTimeout(async () => {
            const latest = await getSession(chatId);
            if (latest?.status === 'pending' && latest.createdAt === session.createdAt) {
                if ((latest.players || []).length >= MIN_PLAYERS) await beginGame(sock, chatId, latest);
                else {
                    await clearSession(chatId);
                    await sock.sendMessage(chatId, { text: '⌛ Hot Seat selection expired because fewer than two players were selected.' });
                }
            }
        }, remaining);
        return 1;
    }
    if (session.status !== 'active') return 0;
    const access = await isGameAllowed(chatId, 'hotseat');
    if (!access.ok) {
        await sock.sendMessage(chatId, { text: access.msg });
        return 0;
    }
    let resumed = 0;
    for (const player of session.players || []) {
        const state = session.playerStates?.[player];
        if (!state || state.status !== 'active') continue;
        if (state.waitingForGender) {
            if (await scheduleGenderDeadline(sock, chatId, player)) resumed++;
            continue;
        }
        if (state.waiting && state.questionId) {
            if (await scheduleHotSeatTimeout(sock, chatId, player, state.questionId)) resumed++;
            continue;
        }
        if (state.nextQuestionAt) {
            if (await scheduleNextQuestion(sock, chatId, player, state.lastAnsweredAt)) resumed++;
            continue;
        }
        if (await sendPlayerQuestion(sock, chatId, player)) resumed++;
    }
    return resumed;
}

export async function handleHotSeatAnswer(sock, chatId, message, senderId) {
    if (!isFeatureGroup(chatId) || message?.key?.fromMe) return false;
    if (!message?.message || message.message.protocolMessage) return false;

    // Hot Seat only accepts a bot mention or a reply. Reject ordinary group posts
    // before reading the persisted session document.
    const botNum = (sock.user?.id || '').split(':')[0];
    const botLid = sock.user?.lid || null;
    const mentions = getMentions(message);
    const taggedBot = mentions.some(j => {
        const n = String(j || '');
        return (botNum && n.startsWith(botNum)) || (botLid && n === botLid);
    });
    const ctx = message?.message?.extendedTextMessage?.contextInfo
        || message?.message?.imageMessage?.contextInfo
        || message?.message?.videoMessage?.contextInfo
        || message?.message?.audioMessage?.contextInfo
        || {};
    if (!taggedBot && !ctx.stanzaId) return false;

    const session = await getSession(chatId);
    if (!session || session.status !== 'active') return false;
    const playerKey = await resolveSessionPlayerKey(sock, session, senderId);
    const state = session.playerStates?.[playerKey];
    if (!state || state.status !== 'active' || !state.waiting) return false;

    const repliedToCurrentQuestion = !!(ctx.stanzaId && state.questionMessageId && ctx.stanzaId === state.questionMessageId);
    if (!taggedBot && !repliedToCurrentQuestion) return false;

    const access = await isGameAllowed(chatId, 'hotseat');
    if (!access.ok) {
        await sock.sendMessage(chatId, { text: access.msg }, { quoted: message });
        return true;
    }

    state.waiting = false;
    state.waitingForGender = false;
    state.timeoutToken = null;
    state.lastAnsweredAt = Date.now();
    state.nextQuestionAt = Date.now() + NEXT_QUESTION_MS;
    state.questionsAnswered = (state.questionsAnswered || 0) + 1;
    await saveSession(chatId, session);

    await sock.sendMessage(chatId, {
        text: `✅ ${mention(senderId)} has answered.\n⏳ Next question in *60 seconds*.`,
        mentions: [senderId]
    });

    const answeredAt = state.lastAnsweredAt;
    await scheduleNextQuestion(sock, chatId, playerKey, answeredAt);
    return true;
}

async function beginGame(sock, chatId, session) {
    const limits = playerLimits(session);
    if (!Array.isArray(session.players) || session.players.length < limits.min) {
        await clearSession(chatId);
        await sock.sendMessage(chatId, { text: '⌛ Hot Seat selection ended: an admin must select at least two players before starting.' });
        return false;
    }
    session.status = 'active';
    session.startedAt = Date.now();
    session.adjustmentEndsAt = null;
    session.round = 0;
    session.usedQuestions = [];
    session.usedGuy = [];
    session.usedLady = [];
    session.playerStates = Object.fromEntries(session.players.map(id => [id, {
        status: 'active', waiting: false, waitingForGender: false, questionsAnswered: 0,
        lastAnsweredAt: null, nextQuestionAt: null, genderDeadlineAt: null,
        questionId: null, questionMessageId: null, currentQuestion: null
    }]));
    await saveSession(chatId, session);
    await sock.sendMessage(chatId, {
        text: `🔥 *HOT SEAT STARTED*\n\nPlayers:\n${formatPlayers(session.players)}\n\nGender-based questions (300 each).\nAnswer by *tagging the bot*.\nNext question: *60 seconds* after answer.\n2-hour session max. 5 min timeout = 10h mute.`,
        mentions: session.players
    });
    for (const player of session.players) {
        await sendPlayerQuestion(sock, chatId, player);
        await new Promise(r => setTimeout(r, 800));
    }
}

async function sendList(sock, chatId, session) {
    const remaining = Math.max(0, Math.ceil(((session.adjustmentEndsAt || Date.now()) - Date.now()) / 60000));
    await sock.sendMessage(chatId, {
        text: `🎟️ *HOT SEAT LIST*\n\nCurrent turn order:\n${formatPlayers(session.players)}\n\nStatus: *${session.status}*\nAdjustment time remaining: ${remaining} minute(s).\n\n*.hotseat add @user1 @user2* · *.hotseat change @current @replacement* · *.hotseat arrange @user1 @user2* · *.hotseat start*`,
        mentions: session.players
    });
}
export default {
    command: 'hotseat',
    aliases: ['hs', 'hot'],
    category: 'admin',
    description: 'Start Hot Seat confession game',
    usage: '.hotseat | .hotseat list | .hotseat add @users | .hotseat change @current @replacement | .hotseat arrange @users | .hotseat start | .endhotseat',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        if (!isFeatureGroup(chatId)) {
            return sock.sendMessage(chatId, { text: 'Hot Seat is enabled only in the authorized feature groups.' }, { quoted: message });
        }
        const senderId = context.senderId || message.key.participant || message.key.remoteJid;
        const reply = (text) => sock.sendMessage(chatId, { text }, { quoted: message });
        const sub = (args[0] || '').toLowerCase();
        let session = await getSession(chatId);
        const allowed = await isGameAllowed(chatId, 'hotseat');
        if (!allowed.ok && !(sub || '').includes('end')) return reply(allowed.msg);
        if (sub === 'resume') {
            if (!session || session.status !== 'active') return reply('No active Hot Seat session to resume.');
            const resumed = await resumeHotSeatSession(sock, chatId);
            return reply(resumed ? `▶️ Resumed ${resumed} Hot Seat player(s).` : 'No paused Hot Seat players are waiting to resume.');
        }
        if (sub === 'end' || context.command === 'endhotseat') {
            await clearSession(chatId);
            return reply('🛑 Hot Seat ended by admin.');
        }
        if (sub === 'list') {
            if (!session) return reply('No Hot Seat session.');
            return sendList(sock, chatId, session);
        }
        if (sub === 'add') {
            if (!session || session.status !== 'pending') return reply('Open a Hot Seat selection first with *.hotseat*. Participants can only be added during the 10-minute selection window.');
            if (Date.now() >= session.adjustmentEndsAt) {
                await beginGame(sock, chatId, session);
                return reply('The adjustment window has closed. Hot Seat is starting.');
            }
            const tagged = await getNormalizedMentions(sock, message);
            const limits = playerLimits(session);
            if (!tagged.length) return reply(session.gameType === 'pick_your_sin' ? 'Tag up to five participants: *.hotseat add @user1 @user2 @user3 @user4 @user5*.' : 'Tag 1 to 4 people in the same message: *.hotseat add @user1 @user2 @user3 @user4*');
            if (tagged.length > limits.max || !unique(tagged)) return reply(`Tag no more than ${limits.max} different people per command.`);
            const basePlayers = await Promise.all((session.players || []).map(id => normalizeHotSeatJid(sock, id)));
            const additions = tagged.filter(id => !basePlayers.includes(id));
            if (basePlayers.length + additions.length < MIN_PLAYERS) return reply(`Select at least ${MIN_PLAYERS} players. Tag two or more people in your first add command.`);
            if (basePlayers.length + additions.length > limits.max) return reply(`Hot Seat supports a maximum of ${MAX_PLAYERS} participants. Current list:\n${formatPlayers(basePlayers)}`);
            if (!additions.length) return reply('Those people are already on the Hot Seat list.');
            session.players = [...basePlayers, ...additions];
            session.manualSelection = true;
            await saveSession(chatId, session);
            return sendList(sock, chatId, session);
        }
        if (sub === 'change') {
            if (!session || session.status !== 'pending') return reply('Participants can only be changed during the 10-minute selection window.');
            if (Date.now() >= session.adjustmentEndsAt) {
                await beginGame(sock, chatId, session);
                return reply('The adjustment window has closed. Hot Seat is starting.');
            }
            const tagged = await getNormalizedMentions(sock, message);
            if (tagged.length !== 2) return reply('To replace one participant, tag both the current participant and replacement: *.hotseat change @current @replacement*');
            const [current, replacement] = tagged;
            session.players = await Promise.all(session.players.map(id => normalizeHotSeatJid(sock, id)));
            const index = session.players.indexOf(current);
            if (index === -1) return reply('The first tagged person is not in the current Hot Seat selection. Check *.hotseat list*.');
            if (session.players.includes(replacement)) return reply('The replacement is already on the Hot Seat list.');
            session.players[index] = replacement;
            await saveSession(chatId, session);
            return sendList(sock, chatId, session);
        }
        if (sub === 'arrange' || sub === 'order') {
            if (!session || session.status !== 'pending') return reply('The turn order can only be arranged during the 10-minute selection window.');
            if (Date.now() >= session.adjustmentEndsAt) {
                await beginGame(sock, chatId, session);
                return reply('The adjustment window has closed. Hot Seat is starting.');
            }
            const order = await getNormalizedMentions(sock, message);
            const currentPlayers = await Promise.all(session.players.map(id => normalizeHotSeatJid(sock, id)));
            if (order.length !== currentPlayers.length || !unique(order) || !currentPlayers.every(id => order.includes(id))) {
                return reply(`Tag every selected participant exactly once, in their intended order. Current list:\n${formatPlayers(session.players)}`);
            }
            session.players = order;
            await saveSession(chatId, session);
            return sendList(sock, chatId, session);
        }
        if (sub === 'start') {
            if (!session || session.status !== 'pending') return reply('No selection window to start.');
            const limits = playerLimits(session);
            if (session.players.length < limits.min) return reply(`Need at least ${MIN_PLAYERS} participants.`);
            await beginGame(sock, chatId, session);
            return;
        }
        if (session && ['pending', 'active'].includes(session.status)) {
            return reply(session.status === 'pending' ? 'Selection already open. *.hotseat list*' : 'Already running. *.endhotseat*');
        }
        session = {
            status: 'pending',
            players: [],
            startedBy: senderId,
            createdAt: Date.now(),
            adjustmentEndsAt: Date.now() + ADJUSTMENT_MS,
            manualSelection: true,
            usedQuestions: [], usedGuy: [], usedLady: []
        };
        await saveSession(chatId, session);
        await sock.sendMessage(chatId, {
            text: `🎟️ *HOT SEAT SELECTION OPEN*\n\nAdmin: select 2–4 players using *.hotseat add @user1 @user2*.\n\nYou have 10 minutes to add, replace or rearrange players.\n*.hotseat list* · *.hotseat change @current @replacement* · *.hotseat arrange @user1 @user2* · *.hotseat start*`,
            mentions: session.players
        });
        setTimeout(async () => {
            const latest = await getSession(chatId);
            if (latest?.status === 'pending' && latest.createdAt === session.createdAt) {
                if ((latest.players || []).length >= MIN_PLAYERS) await beginGame(sock, chatId, latest);
                else {
                    await clearSession(chatId);
                    await sock.sendMessage(chatId, { text: '⌛ Hot Seat selection expired because fewer than two players were selected.' });
                }
            }
        }, ADJUSTMENT_MS);
    }
};

export const endhotseat = {
    command: 'endhotseat',
    aliases: ['stophotseat'],
    category: 'admin',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        await clearSession(chatId);
        await sock.sendMessage(chatId, { text: '🛑 Hot Seat ended by admin.' }, { quoted: message });
    }
};

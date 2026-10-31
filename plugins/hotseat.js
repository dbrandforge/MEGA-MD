import store from '../lib/lightweight_store.js';
import config from '../config.js';
import { isGameAllowed } from './daylock.js';

const TARGET_GROUP = '120363405434471171@g.us';
const HOTSEAT_KEY = 'hotseatSession';
const READERS_KEY = 'hotseatRecentReaders';
const READER_WINDOW_MS = Number(config.hotseatReaderWindowHours || 5) * 60 * 60 * 1000;
const ADJUSTMENT_MS = Number(config.hotseatAdjustmentMinutes || 10) * 60 * 1000;
const SESSION_MS = Number(config.hotseatSessionHours || 2) * 60 * 60 * 1000;
const ANSWER_TIMEOUT_MS = Number(config.hotseatAnswerMinutes || 5) * 60 * 1000;
const MUTE_MS = Number(config.hotseatMuteHours || config.muteDurationHours || 10) * 60 * 60 * 1000;
const NEXT_QUESTION_MS = Number(config.hotseatNextQuestionSeconds || 60) * 1000;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;

const questions = [
    "What is one childhood secret you have never told anyone in this group?",
    "Have you ever cheated or been cheated on? Tell the real story.",
    "How old were you when you first had sex, and how was the experience?",
    "What is your body count (be honest)?",
    "What is the freakiest place you have ever had sex?",
    "Who in this group would you actually consider dating if there were no consequences?",
    "What is your biggest sexual fantasy that you have not fulfilled yet?",
    "Have you ever sent nudes to the wrong person? What happened?",
    "Do you prefer to dominate or be dominated? Explain.",
    "What is the most jealous you have ever felt because of someone in this group?",
    "Have you ever had sex with someone from this group or someone the group knows?",
    "What is your biggest turn-on that most people would find strange?",
    "If you had to rate your own sex life out of 10 right now, what would you give and why?",
    "What is the dirtiest text you have ever sent someone?",
    "Who in this group do you secretly find attractive?",
    "What is the longest situationship you have ever been in and why did it not become official?",
    "Have you ever dated two people at the same time? How did you manage it?",
    "What is one lie you have told people in this group?",
    "Have you ever been caught having sex or masturbating? Tell the story.",
    "What is the most toxic thing you have done in a relationship?",
    "What is the wildest thing you have done just to get someone's attention?",
    "Have you ever hooked up with a friend's ex?",
    "What is your go-to move in bed that always works?",
    "Describe the most intense orgasm you have ever had.",
    "Have you ever had a one-night stand you still think about?",
    "What is one sexual boundary you used to have that you no longer have?",
    "Who would you pick for a private truth-or-dare if you could only choose one person here?",
    "Have you ever been in love and refused to admit it?",
    "What is the most embarrassing thing that has happened to you during sex?",
    "If the whole group disappeared for one night and only two of you remained, who would you want it to be and why?"
];

function shuffle(items) { return [...items].sort(() => Math.random() - 0.5); }
function mention(jid) { return '@' + String(jid || '').split('@')[0]; }
async function getSession(chatId) { return (await store.getSetting(chatId, HOTSEAT_KEY)) || null; }
async function saveSession(chatId, session) { await store.saveSetting(chatId, HOTSEAT_KEY, session); }
async function clearSession(chatId) { await store.saveSetting(chatId, HOTSEAT_KEY, null); }
async function getReaders(chatId) {
    const data = (await store.getSetting(chatId, READERS_KEY)) || {};
    const cutoff = Date.now() - READER_WINDOW_MS;
    const clean = Object.fromEntries(Object.entries(data).filter(([, ts]) => Number(ts) >= cutoff));
    if (Object.keys(clean).length !== Object.keys(data).length) await store.saveSetting(chatId, READERS_KEY, clean);
    return clean;
}
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
async function sendPlayerQuestion(sock, chatId, player) {
    const session = await getSession(chatId);
    if (!session || session.status !== 'active') return;
    if (Date.now() - session.startedAt >= SESSION_MS) {
        await clearSession(chatId);
        await sock.sendMessage(chatId, { text: '🛑 *Hot Seat ended* — 2-hour limit reached.', mentions: session.players });
        return;
    }

    const state = session.playerStates?.[player];
    if (!state || state.status !== 'active' || state.waiting) return;

    const questionId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    if (!Array.isArray(session.usedQuestions)) session.usedQuestions = [];
    let pool = questions.filter(q => !session.usedQuestions.includes(q));
    if (!pool.length) {
        session.usedQuestions = [];
        pool = [...questions];
    }
    const question = shuffle(pool)[0];
    session.usedQuestions.push(question);

    state.waiting = true;
    state.questionId = questionId;
    state.questionAskedAt = Date.now();
    state.currentQuestion = question;
    state.cooldownUntil = null;
    await saveSession(chatId, session);

    await sock.sendMessage(chatId, {
        text: `🔥 *HOT SEAT — YOUR QUESTION*\n\n${mention(player)}, your question is:\n\n*${question}*\n\n✅ Answer by *tagging the bot* in your reply.\nOnly *your* tagged message counts as the answer.\n⏰ You have 5 minutes. No answer = 10-hour mute.\n⏳ After you answer, next question drops in *60 seconds*.`,
        mentions: [player]
    });

    setTimeout(async () => {
        const latest = await getSession(chatId);
        if (!latest || latest.status !== 'active') return;
        const st = latest.playerStates?.[player];
        if (!st || st.status !== 'active' || !st.waiting) return;
        if (st.questionId !== questionId) return;
        st.status = 'out';
        st.waiting = false;
        await saveSession(chatId, latest);
        await muteUser(sock, chatId, player);
        await sock.sendMessage(chatId, {
            text: `⏰ ${mention(player)} did not answer within 5 minutes and has received the 10-hour mute penalty. They are now out of this Hot Seat session.`,
            mentions: [player]
        });
        const remaining = latest.players.filter(id => latest.playerStates?.[id]?.status === 'active');
        if (remaining.length === 0) {
            await clearSession(chatId);
            await sock.sendMessage(chatId, { text: '🛑 *Hot Seat ended* — no participants remain active.' });
        }
    }, ANSWER_TIMEOUT_MS);
}

export async function handleHotSeatAnswer(sock, chatId, message, senderId) {
    if (chatId !== TARGET_GROUP || message?.key?.fromMe) return false;
    const session = await getSession(chatId);
    if (!session || session.status !== 'active') return false;
    const state = session.playerStates?.[senderId];
    if (!state || state.status !== 'active' || !state.waiting) return false;
    if (!message?.message || message.message.protocolMessage) return false;

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
    const repliedToBot = !!(ctx.participant && (
        (botNum && String(ctx.participant).startsWith(botNum)) ||
        (botLid && String(ctx.participant) === botLid)
    ));

    if (!taggedBot && !repliedToBot) return false;

    state.waiting = false;
    state.lastAnsweredAt = Date.now();
    state.cooldownUntil = Date.now() + NEXT_QUESTION_MS;
    state.questionsAnswered = (state.questionsAnswered || 0) + 1;
    await saveSession(chatId, session);

    await sock.sendMessage(chatId, {
        text: `✅ ${mention(senderId)} has answered.\n⏳ Next question in *60 seconds*.`,
        mentions: [senderId]
    });

    const answeredAt = state.lastAnsweredAt;
    setTimeout(async () => {
        const latest = await getSession(chatId);
        if (!latest || latest.status !== 'active') return;
        const st = latest.playerStates?.[senderId];
        if (!st || st.status !== 'active') return;
        if (st.lastAnsweredAt !== answeredAt) return;
        if (st.waiting) return;
        await sendPlayerQuestion(sock, chatId, senderId);
    }, NEXT_QUESTION_MS);

    return true;
}

async function beginGame(sock, chatId, session) {
    session.status = 'active';
    session.startedAt = Date.now();
    session.adjustmentEndsAt = null;
    session.round = 0;
    session.waitingFor = null;
    session.usedQuestions = [];
    session.playerStates = Object.fromEntries(session.players.map(id => [id, {
        status: 'active',
        waiting: false,
        questionsAnswered: 0,
        lastAnsweredAt: null,
        questionId: null,
        currentQuestion: null
    }]));
    await saveSession(chatId, session);
    await sock.sendMessage(chatId, {
        text: `🔥 *HOT SEAT STARTED*\n\nPlayers:\n${formatPlayers(session.players)}\n\nEach person gets their own questions.\nAnswer by *tagging the bot*.\nNext question after each answer: *60 seconds*.\nSession lasts up to 2 hours.\nNo answer in 5 minutes = 10-hour mute.`,
        mentions: session.players
    });
    for (const player of session.players) {
        await sendPlayerQuestion(sock, chatId, player);
        await new Promise(r => setTimeout(r, 800));
    }
}

async function eligibleMembers(sock, chatId) {
    try {
        const meta = await sock.groupMetadata(chatId);
        const admins = new Set((meta.participants || []).filter(p => p.admin).map(p => p.id));
        return (meta.participants || []).map(p => p.id).filter(id => !admins.has(id) && !id.includes('status'));
    } catch { return []; }
}

async function sendList(sock, chatId, session) {
    await sock.sendMessage(chatId, {
        text: `🎟️ *HOT SEAT LIST*\n\n${formatPlayers(session.players)}\n\nStatus: *${session.status}*`,
        mentions: session.players
    });
}

export async function trackHotSeatReader(chatId, userId) {
    if (chatId !== TARGET_GROUP || !userId) return;
    try {
        const readers = await getReaders(chatId);
        readers[userId] = Date.now();
        await store.saveSetting(chatId, READERS_KEY, readers);
    } catch {}
}

export default {
    command: 'hotseat',
    aliases: ['hs', 'hot'],
    category: 'admin',
    description: 'Start Hot Seat confession game',
    usage: '.hotseat | .hotseat list | .hotseat add @users | .hotseat start | .endhotseat',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        if (chatId !== TARGET_GROUP) {
            return sock.sendMessage(chatId, { text: 'Hot Seat is only for the main Mature Minded group.' }, { quoted: message });
        }
        const senderId = context.senderId || message.key.participant || message.key.remoteJid;
        const reply = (text) => sock.sendMessage(chatId, { text }, { quoted: message });

        const allowed = await isGameAllowed(chatId, 'hotseat');
        if (!allowed.ok && !(args[0] || '').toLowerCase().includes('end')) {
            return reply(allowed.msg || 'Hot Seat is day-locked.');
        }

        const sub = (args[0] || '').toLowerCase();
        let session = await getSession(chatId);

        if (sub === 'end' || context.command === 'endhotseat') {
            await clearSession(chatId);
            return reply('🛑 Hot Seat ended by admin.');
        }
        if (sub === 'list') {
            if (!session) return reply('No Hot Seat session.');
            return sendList(sock, chatId, session);
        }
        if (sub === 'add') {
            if (!session || session.status !== 'pending') return reply('Open selection first with *.hotseat*');
            const mentions = getMentions(message);
            if (!mentions.length) return reply('Tag users: *.hotseat add @user1 @user2*');
            session.players = [...new Set([...(session.players || []), ...mentions])].slice(0, MAX_PLAYERS);
            session.manualSelection = true;
            await saveSession(chatId, session);
            return sendList(sock, chatId, session);
        }
        if (sub === 'start') {
            if (!session || session.status !== 'pending') return reply('There is no Hot Seat selection window to start.');
            if (session.players.length < MIN_PLAYERS) return reply(`Hot Seat needs at least ${MIN_PLAYERS} participants.`);
            await beginGame(sock, chatId, session);
            return;
        }
        if (session && ['pending', 'active'].includes(session.status)) {
            return reply(session.status === 'pending' ? 'Hot Seat selection is already open. Use *.hotseat list*.' : 'Hot Seat already running. *.endhotseat*');
        }
        const members = await eligibleMembers(sock, chatId);
        if (members.length < MIN_PLAYERS) return reply('Not enough non-admin members.');
        const readers = await getReaders(chatId);
        const recentReaders = Object.keys(readers).filter(id => members.includes(id));
        const pool = recentReaders.length >= MIN_PLAYERS ? recentReaders : members;
        const count = Math.min(pool.length, MIN_PLAYERS + Math.floor(Math.random() * (MAX_PLAYERS - MIN_PLAYERS + 1)));
        session = {
            status: 'pending',
            players: shuffle(pool).slice(0, count),
            startedBy: senderId,
            createdAt: Date.now(),
            adjustmentEndsAt: Date.now() + ADJUSTMENT_MS,
            readerSelectionUsed: recentReaders.length >= MIN_PLAYERS,
            manualSelection: false,
            usedQuestions: []
        };
        await saveSession(chatId, session);
        await sock.sendMessage(chatId, {
            text: `🎟️ *HOT SEAT SELECTION OPEN*\n\nSelected participants:\n${formatPlayers(session.players)}\n\n${session.readerSelectionUsed ? 'Selection prioritised members who read recent bot messages.' : 'Selected randomly from eligible non-admin members.'}\n\nAdmins have 10 minutes to inspect or adjust.\n*.hotseat list* · *.hotseat add @user1 @user2* · *.hotseat start*\n\nThe game starts automatically when the window closes.`,
            mentions: session.players
        });
        setTimeout(async () => {
            const latest = await getSession(chatId);
            if (latest?.status === 'pending' && latest.createdAt === session.createdAt) await beginGame(sock, chatId, latest);
        }, ADJUSTMENT_MS);
    }
};

export const endhotseat = {
    command: 'endhotseat',
    aliases: ['stophotseat'],
    category: 'admin',
    description: 'End Hot Seat session',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        await clearSession(chatId);
        await sock.sendMessage(chatId, { text: '🛑 Hot Seat ended by admin.' }, { quoted: message });
    }
};

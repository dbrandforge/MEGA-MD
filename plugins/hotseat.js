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
    "What is the most toxic thing you have done in a relationship?"
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
    const question = shuffle(questions)[0];
    state.waiting = true;
    state.questionId = questionId;
    state.questionAskedAt = Date.now();
    state.currentQuestion = question;
    await saveSession(chatId, session);

    await sock.sendMessage(chatId, {
        text: `🔥 *HOT SEAT — YOUR QUESTION*\n\n${mention(player)}, your question is:\n\n*${question}*\n\n✅ Answer whenever you're ready. Your next question will arrive immediately after your answer.\n⏰ You have 5 minutes to answer. Failure to answer results in a 10-hour mute.`,
        mentions: [player]
    });

    setTimeout(async () => {
        const latest = await getSession(chatId);
        if (!latest || latest.status !== 'active') return;
        const latestState = latest.playerStates?.[player];
        if (!latestState || latestState.status !== 'active' || !latestState.waiting || latestState.questionId !== questionId) return;

        latestState.waiting = false;
        latestState.status = 'timed_out';
        latestState.timedOutAt = Date.now();
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

    state.waiting = false;
    state.lastAnsweredAt = Date.now();
    state.questionsAnswered = (state.questionsAnswered || 0) + 1;
    await saveSession(chatId, session);

    await sock.sendMessage(chatId, {
        text: `✅ ${mention(senderId)}'s answer has been received. Your next question is coming now.`,
        mentions: [senderId]
    });
    await sendPlayerQuestion(sock, chatId, senderId);
    return true;
}

async function beginGame(sock, chatId, session) {
    session.status = 'active';
    session.startedAt = Date.now();
    session.adjustmentEndsAt = null;
    session.round = 0;
    session.waitingFor = null;
    session.playerStates = Object.fromEntries(session.players.map(player => [player, {
        status: 'active',
        waiting: false,
        questionsAnswered: 0
    }]));
    await saveSession(chatId, session);

    await sock.sendMessage(chatId, {
        text: `🔥 *HOT SEAT STARTED*\n\nAll selected participants will receive their first question at the same time:\n${formatPlayers(session.players)}\n\nEach participant has an independent question flow. Answering sends that person their next question immediately; nobody has to wait for another participant.\n\nMax 2 hours · 5 minutes to answer each question · No answer = 10-hour mute and removal from this session.`,
        mentions: session.players
    });

    // Dispatch each participant's first question together; each then progresses independently.
    await Promise.all(session.players.map(player => sendPlayerQuestion(sock, chatId, player)));
}
async function eligibleMembers(sock, chatId) {
    const meta = await sock.groupMetadata(chatId);
    return (meta.participants || []).filter(p => !p.admin).map(p => p.id).filter(Boolean);
}
async function sendList(sock, chatId, session) {
    const remaining = Math.max(0, Math.ceil((session.adjustmentEndsAt - Date.now()) / 60000));
    await sock.sendMessage(chatId, {
        text: `🎟️ *HOT SEAT — SELECTION WINDOW*\n\nCurrent turn order:\n${formatPlayers(session.players)}\n\n⏳ Adjustment time remaining: ${remaining} minute(s).\n\nReplace one person: *.hotseat change @current @replacement*\nReorder everyone: *.hotseat arrange @user1 @user2 ...*\nStart now: *.hotseat start*`,
        mentions: session.players
    });
}
export default {
    command: 'hotseat',
    aliases: ['hs', 'freakyfriday'],
    category: 'games',
    description: 'Start and manage the Hot Seat confession game',
    usage: '.hotseat [list|change @current @replacement|arrange @user1 @user2|start]',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo } = context;
        const sub = String(args?.[0] || '').toLowerCase();
        const reply = text => sock.sendMessage(chatId, { text, ...channelInfo }, { quoted: message });
        if (chatId !== TARGET_GROUP) return reply('Hot Seat is only for Mature minded.');
        const allowed = await isGameAllowed(chatId, 'hotseat');
        if (!allowed.ok) return reply(allowed.msg);
        let session = await getSession(chatId);

        if (sub === 'list') {
            if (!session || session.status !== 'pending') return reply('There is no Hot Seat selection window open.');
            return sendList(sock, chatId, session);
        }
        if (sub === 'change') {
            if (!session || session.status !== 'pending') return reply('Participants can only be changed during the 10-minute selection window.');
            if (Date.now() >= session.adjustmentEndsAt) {
                await beginGame(sock, chatId, session);
                return reply('The adjustment window has closed. Hot Seat is starting.');
            }
            const tagged = getMentions(message);
            if (tagged.length !== 2) return reply('To replace one specific person, tag both the current participant and the replacement: *.hotseat change @current @replacement*');
            const [current, replacement] = tagged;
            const index = session.players.indexOf(current);
            if (index === -1) return reply('The first tagged person is not in the current Hot Seat selection. Check *.hotseat list* and tag an existing participant first.');
            if (session.players.includes(replacement)) return reply('The replacement is already on the Hot Seat list. Tag a different eligible member.');
            const members = await eligibleMembers(sock, chatId);
            if (!members.includes(replacement)) return reply('The replacement must be a non-admin member of this group.');
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
            const order = getMentions(message);
            if (order.length !== session.players.length || !unique(order) || !session.players.every(id => order.includes(id))) {
                return reply(`Tag every selected participant exactly once, in the order they should play. Current list:\n${formatPlayers(session.players)}\n\nExample: *.hotseat arrange @user2 @user1*`);
            }
            session.players = order;
            await saveSession(chatId, session);
            return sendList(sock, chatId, session);
        }
        if (sub === 'start') {
            if (!session || session.status !== 'pending') return reply('There is no Hot Seat selection window to start.');
            await beginGame(sock, chatId, session);
            return;
        }
        if (session && ['pending', 'active'].includes(session.status)) return reply(session.status === 'pending' ? 'Hot Seat selection is already open. Use *.hotseat list*.' : 'Hot Seat already running. *.endhotseat*');
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
            readerSelectionUsed: recentReaders.length >= MIN_PLAYERS
        };
        await saveSession(chatId, session);
        await sock.sendMessage(chatId, {
            text: `🎟️ *HOT SEAT SELECTION OPEN*\n\nSelected participants:\n${formatPlayers(session.players)}\n\n${session.readerSelectionUsed ? 'Selection prioritised members who read recent bot messages.' : 'Recent read-receipt data was insufficient; selected randomly from eligible non-admin members.'}\n\nAdmins have 10 minutes to inspect or adjust.\n*.hotseat list* · *.hotseat change @current @replacement* · *.hotseat arrange @user1 @user2* · *.hotseat start*\n\nThe game starts automatically when the window closes.`,
            mentions: session.players
        });
        setTimeout(async () => {
            const latest = await getSession(chatId);
            if (latest?.status === 'pending' && latest.createdAt === session.createdAt) await beginGame(sock, chatId, latest);
        }, ADJUSTMENT_MS);
    }
};

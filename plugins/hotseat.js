import store from '../lib/lightweight_store.js';
import config from '../config.js';
import { isGameAllowed } from './daylock.js';

const TARGET_GROUP = '120363405434471171@g.us';
const HOTSEAT_KEY = 'hotseatSession';
const MUTE_MS = (config.muteDurationHours || 10) * 60 * 60 * 1000;
const SESSION_MS = 2 * 60 * 60 * 1000;
const ANSWER_TIMEOUT_MS = 5 * 60 * 1000;

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

function getRandom(arr, n = 1) {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return n === 1 ? shuffled[0] : shuffled.slice(0, n);
}
function mention(jid) {
    return `@${(jid || '').split('@')[0]}`;
}
async function getSession(chatId) {
    return (await store.getSetting(chatId, HOTSEAT_KEY)) || null;
}
async function saveSession(chatId, session) {
    await store.saveSetting(chatId, HOTSEAT_KEY, session);
}
async function clearSession(chatId) {
    await store.saveSetting(chatId, HOTSEAT_KEY, null);
}
async function muteUser(sock, chatId, userId) {
    try {
        const { softMuteUser } = await import('./softmute.js');
        await softMuteUser(sock, chatId, userId);
        return true;
    } catch {
        return false;
    }
}

async function askNextQuestion(sock, chatId, session) {
    if (!session || session.status !== 'active') return;
    if (Date.now() - session.startedAt > SESSION_MS) {
        await clearSession(chatId);
        await sock.sendMessage(chatId, { text: '🛑 Hot Seat ended — 2-hour limit.', mentions: session.players });
        return;
    }
    const currentPlayer = session.players[session.currentIndex];
    if (!currentPlayer) return;
    const question = getRandom(questions);
    session.currentQuestion = question;
    session.waitingFor = currentPlayer;
    session.questionAskedAt = Date.now();
    await saveSession(chatId, session);
    await sock.sendMessage(chatId, {
        text: `🔥 *HOT SEAT*\n\n${mention(currentPlayer)}, you are on the seat.\n\n*Question:*\n${question}\n\n✅ Answer then *.done*\n⏰ 5 minutes`,
        mentions: [currentPlayer]
    });
}

export default {
    command: 'hotseat',
    aliases: ['hs', 'freakyfriday'],
    category: 'games',
    description: 'Hot Seat confession game',
    usage: '.hotseat',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo } = context;

        if (chatId !== TARGET_GROUP) {
            return sock.sendMessage(chatId, { text: 'Hot Seat is only for Mature minded.', ...channelInfo }, { quoted: message });
        }

        const allowed = await isGameAllowed(chatId, 'hotseat');
        if (!allowed.ok) {
            return sock.sendMessage(chatId, { text: allowed.msg, ...channelInfo }, { quoted: message });
        }

        const existing = await getSession(chatId);
        if (existing?.status === 'active') {
            return sock.sendMessage(chatId, { text: 'Hot Seat already running. *.endhotseat*', ...channelInfo }, { quoted: message });
        }

        let participants = [];
        try {
            const meta = await sock.groupMetadata(chatId);
            participants = (meta.participants || []).filter(p => !p.admin).map(p => p.id).filter(Boolean);
        } catch {
            return sock.sendMessage(chatId, { text: 'Could not fetch members.', ...channelInfo }, { quoted: message });
        }
        if (participants.length < 2) {
            return sock.sendMessage(chatId, { text: 'Not enough non-admin members.', ...channelInfo }, { quoted: message });
        }

        const count = Math.min(participants.length, 2 + Math.floor(Math.random() * 3));
        const selected = getRandom(participants, count);
        const session = {
            status: 'active',
            startedAt: Date.now(),
            players: selected,
            currentIndex: 0,
            round: 0,
            startedBy: senderId
        };
        await saveSession(chatId, session);
        await sock.sendMessage(chatId, {
            text: `🔥 *HOT SEAT STARTED*\n\n${selected.map((p, i) => `${i + 1}. ${mention(p)}`).join('\n')}\n\nMax 2 hours · *.done* after answer · Fail = 10h mute`,
            mentions: selected
        });
        setTimeout(() => askNextQuestion(sock, chatId, session), 2500);
    }
};

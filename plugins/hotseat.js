import store from '../lib/lightweight_store.js';
import isAdmin from '../lib/isAdmin.js';
import config from '../config.js';

/**
 * Hot Seat (Freaky Friday)
 * Admin starts with .hotseat
 * 2-4 random active members
 * Confession-style questions only
 * Session lasts max 2 hours
 * Failure to answer while active → 10 hour mute
 */

const TARGET_GROUP = '120363405434471171@g.us';
const HOTSEAT_KEY = 'hotseatSession';
const MUTE_MS = (config.muteDurationHours || 10) * 60 * 60 * 1000;
const SESSION_MS = 2 * 60 * 60 * 1000; // 2 hours
const ANSWER_TIMEOUT_MS = 5 * 60 * 1000; // 5 min to answer each question

const questions = [
    // Personal / Childhood
    "What is one childhood secret you have never told anyone in this group?",
    "What is the most embarrassing thing that happened to you as a child?",
    "Who was your first crush and what did you like about them?",
    "What is one thing your parents still don’t know about you?",
    "Describe the naughtiest thing you did before you turned 18.",

    // Relationships
    "Have you ever cheated or been cheated on? Tell the real story.",
    "What is the longest situationship you have ever been in and why did it not become official?",
    "Have you ever dated two people at the same time? How did you manage it?",
    "What is your biggest red flag in a partner that you still ignore?",
    "Who in this group would you actually consider dating if there were no consequences?",
    "Have you ever kept a relationship secret from your friends? Why?",
    "What is the most toxic thing you have done in a relationship?",

    // Sexual life
    "How old were you when you first had sex, and how was the experience?",
    "What is your body count (be honest)?",
    "What is the freakiest place you have ever had sex?",
    "Have you ever had a one-night stand you still think about?",
    "What is your biggest sexual fantasy that you have not fulfilled yet?",
    "Have you ever sent nudes to the wrong person? What happened?",
    "What is the most adventurous thing you have done in bed?",
    "Do you prefer to dominate or be dominated? Explain.",
    "Have you ever had sex with someone from this group or someone the group knows?",
    "What is your biggest turn-on that most people would find strange?",
    "Have you ever been caught having sex or masturbating? Tell the story.",
    "What is the longest you have gone without sex and how did it affect you?",
    "Have you ever faked an orgasm? Why?",
    "What is the dirtiest text you have ever sent someone?",

    // Social / Confession
    "What is one lie you have told people in this group?",
    "Who in this group do you secretly find attractive?",
    "Have you ever stalked someone from this group online?",
    "What is the most jealous you have ever felt because of someone in this group?",
    "Have you ever screenshot a private chat from this group and sent it to someone else?",
    "What is one thing you pretend to like so you can fit in?",
    "Who in this group would you never trust with a secret and why?",
    "Have you ever had a serious crush on an admin or active member here?",
    "What is the biggest secret someone has told you that you are still keeping?",
    "If you had to rate your own sex life out of 10 right now, what would you give and why?"
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
        await sock.groupParticipantsUpdate(chatId, [userId], 'restrict');
        setTimeout(async () => {
            try {
                await sock.groupParticipantsUpdate(chatId, [userId], 'unrestrict');
                await sock.sendMessage(chatId, {
                    text: `🔊 ${mention(userId)} has been unmuted.`,
                    mentions: [userId]
                });
            } catch (e) {}
        }, MUTE_MS);
        return true;
    } catch (e) {
        console.error('Hotseat mute failed:', e);
        return false;
    }
}

async function askNextQuestion(sock, chatId, session) {
    if (!session || session.status !== 'active') return;

    // Check 2-hour limit
    if (Date.now() - session.startedAt > SESSION_MS) {
        await endHotseat(sock, chatId, session, 'time');
        return;
    }

    const currentPlayer = session.players[session.currentIndex];
    if (!currentPlayer) {
        await endHotseat(sock, chatId, session, 'done');
        return;
    }

    const question = getRandom(questions);
    session.currentQuestion = question;
    session.waitingFor = currentPlayer;
    session.questionAskedAt = Date.now();
    session.warningSent = false;
    await saveSession(chatId, session);

    await sock.sendMessage(chatId, {
        text: `🔥 *HOT SEAT*\n\n${mention(currentPlayer)}, you are on the seat.\n\n*Question:*\n${question}\n\n✅ Reply with your answer, then type *.done*\n⏰ You have 5 minutes.\n🛑 Admins can stop with *.endhotseat*`,
        mentions: [currentPlayer]
    });

    // 5-minute timeout for this question
    setTimeout(async () => {
        const current = await getSession(chatId);
        if (!current || current.status !== 'active') return;
        if (current.waitingFor !== currentPlayer) return;
        if (Date.now() - (current.questionAskedAt || 0) < ANSWER_TIMEOUT_MS - 5000) return;

        // Mute for failure to answer
        await sock.sendMessage(chatId, {
            text: `⏰ ${mention(currentPlayer)} failed to answer in time.\nMuted for ${config.muteDurationHours || 10} hours.`,
            mentions: [currentPlayer]
        });
        await muteUser(sock, chatId, currentPlayer);

        // Move to next player
        current.currentIndex = (current.currentIndex + 1) % current.players.length;
        current.round = (current.round || 0) + 1;
        await saveSession(chatId, current);
        setTimeout(() => askNextQuestion(sock, chatId, current), 2000);
    }, ANSWER_TIMEOUT_MS);
}

async function endHotseat(sock, chatId, session, reason = 'manual') {
    await clearSession(chatId);
    const names = (session?.players || []).map(mention).join(', ');
    let text = `🛑 *Hot Seat has ended*\n\nPlayers: ${names}`;
    if (reason === 'time') text += `\n\n2-hour time limit reached.`;
    await sock.sendMessage(chatId, {
        text,
        mentions: session?.players || []
    });
}

export default {
    command: 'hotseat',
    aliases: ['hs', 'freakyfriday'],
    category: 'games',
    description: 'Start Hot Seat - confession style questions for 2-4 members',
    usage: '.hotseat',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo } = context;

        if (chatId !== TARGET_GROUP) {
            return sock.sendMessage(chatId, {
                text: 'Hot Seat is only available in the Mature minded group.',
                ...channelInfo
            }, { quoted: message });
        }

        const existing = await getSession(chatId);
        if (existing?.status === 'active') {
            return sock.sendMessage(chatId, {
                text: 'Hot Seat is already running.\nUse *.endhotseat* to stop it first.',
                ...channelInfo
            }, { quoted: message });
        }

        // Get group members
        let participants = [];
        try {
            const meta = await sock.groupMetadata(chatId);
            participants = (meta.participants || [])
                .filter(p => !p.admin) // exclude admins
                .map(p => p.id)
                .filter(id => id && !id.includes('status'));
        } catch (e) {
            return sock.sendMessage(chatId, {
                text: 'Could not fetch group members.',
                ...channelInfo
            }, { quoted: message });
        }

        if (participants.length < 2) {
            return sock.sendMessage(chatId, {
                text: 'Not enough non-admin members to start Hot Seat.',
                ...channelInfo
            }, { quoted: message });
        }

        // Pick 2-4 random people
        const count = Math.min(participants.length, 2 + Math.floor(Math.random() * 3)); // 2, 3 or 4
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
            text: `🔥 *HOT SEAT STARTED*\n\n` +
                `Selected members:\n${selected.map((p, i) => `${i + 1}. ${mention(p)}`).join('\n')}\n\n` +
                `• Confession-style questions only\n` +
                `• Session lasts maximum *2 hours*\n` +
                `• Answer then type *.done*\n` +
                `• Fail to answer = 10-hour mute\n\n` +
                `Starting now...`,
            mentions: selected
        });

        setTimeout(() => askNextQuestion(sock, chatId, session), 2500);
    }
};

export const endHotseatCmd = {
    command: 'endhotseat',
    aliases: ['stophotseat', 'endhs'],
    category: 'games',
    description: 'End the current Hot Seat session',
    usage: '.endhotseat',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo } = context;
        const session = await getSession(chatId);
        if (!session || session.status !== 'active') {
            return sock.sendMessage(chatId, {
                text: 'No active Hot Seat session.',
                ...channelInfo
            }, { quoted: message });
        }
        await endHotseat(sock, chatId, session, 'manual');
    }
};

export const hotseatDoneCmd = {
    command: 'hsdone',
    aliases: [],
    category: 'games',
    description: 'Internal - use .done instead',
    async handler() {}
};

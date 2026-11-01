/**
 * Unified .done / .next command
 * Handles both:
 * - Truth or Dare (paired/solo)
 * - Hot Seat
 */
import store from '../lib/lightweight_store.js';
import { advanceTodSession } from './tod.js';

const TOD_KEY = 'todSessions';
const HOTSEAT_KEY = 'hotseatSession';

function mention(jid) {
    return `@${(jid || '').split('@')[0]}`;
}

async function getTodSessions(chatId) {
    return (await store.getSetting(chatId, TOD_KEY)) || {};
}

async function saveTodSessions(chatId, sessions) {
    await store.saveSetting(chatId, TOD_KEY, sessions);
}

async function getHotseat(chatId) {
    return (await store.getSetting(chatId, HOTSEAT_KEY)) || null;
}

async function saveHotseat(chatId, session) {
    await store.saveSetting(chatId, HOTSEAT_KEY, session);
}

export default {
    command: 'done',
    aliases: ['next', 'toddone'],
    category: 'games',
    description: 'Mark your answer as done (Truth or Dare / Hot Seat)',
    usage: '.done',
    groupOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo } = context;

        // ── 1. Hot Seat ──────────────────────────────────────────────
        const hs = await getHotseat(chatId);
        if (hs?.status === 'active' && hs.waitingFor === senderId) {
            hs.lastActivity = Date.now();
            hs.currentIndex = (hs.currentIndex + 1) % hs.players.length;
            hs.round = (hs.round || 0) + 1;
            hs.waitingFor = null;
            await saveHotseat(chatId, hs);

            await sock.sendMessage(chatId, {
                text: `✅ ${mention(senderId)} has answered.\nNext person coming up...`,
                mentions: [senderId]
            });

            // Ask next Hot Seat question after short delay
            setTimeout(async () => {
                try {
                    const current = await getHotseat(chatId);
                    if (!current || current.status !== 'active') return;

                    // 2-hour limit
                    if (Date.now() - current.startedAt > 2 * 60 * 60 * 1000) {
                        await store.saveSetting(chatId, HOTSEAT_KEY, null);
                        await sock.sendMessage(chatId, {
                            text: '🛑 *Hot Seat ended* — 2-hour limit reached.',
                            mentions: current.players
                        });
                        return;
                    }

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

                    const player = current.players[current.currentIndex];
                    const question = questions[Math.floor(Math.random() * questions.length)];
                    current.waitingFor = player;
                    current.questionAskedAt = Date.now();
                    await saveHotseat(chatId, current);

                    await sock.sendMessage(chatId, {
                        text: `🔥 *HOT SEAT*\n\n${mention(player)}, you are on the seat.\n\n*Question:*\n${question}\n\n✅ Reply with your answer, then type *.done*\n⏰ You have 5 minutes.`,
                        mentions: [player]
                    });
                } catch (e) {
                    console.error('Hotseat next error:', e);
                }
            }, 2000);

            return;
        }

        // ── 2. Truth or Dare ─────────────────────────────────────────
        if (await advanceTodSession(sock, chatId, senderId, message)) return;

        // ── Nothing active ───────────────────────────────────────────
        await sock.sendMessage(chatId, {
            text: 'You are not currently expected to answer anything.\n(No active Hot Seat or Truth/Dare turn for you)',
            ...channelInfo
        }, { quoted: message });
    }
};

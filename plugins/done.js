/**
 * Unified .done / .next command
 * Handles both:
 * - Truth or Dare (paired/solo)
 * - Hot Seat
 */
import store from '../lib/lightweight_store.js';

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
        const sessions = await getTodSessions(chatId);
        const session = Object.values(sessions).find(s =>
            s.players?.includes(senderId) && s.status === 'active'
        );

        if (session && session.waitingFor === senderId) {
            session.questionsCompleted = session.questionsCompleted || {};
            session.questionsCompleted[senderId] = (session.questionsCompleted[senderId] || 0) + 1;
            session.lastCompletedBy = senderId;
            session.lastCompletedAt = Date.now();
            session.lastActivity = Date.now();
            session.warningSent = false;
            await saveTodSessions(chatId, sessions);

            await sock.sendMessage(chatId, {
                text: `✅ ${mention(senderId)} is done!\n\nNext round coming up...`,
                mentions: session.players
            });

            // Advance TOD round
            setTimeout(async () => {
                try {
                    const truths = [
                        "What is the most intense orgasm you have ever had, and describe exactly what made it so good in dirty detail.",
                        "Have you ever fucked someone while someone else was in the next room or watching? Tell the full filthy story.",
                        "What is the dirtiest thing you have ever done for money, a dare, or pure lust?",
                        "Which part of your body gets the most attention when you are getting fucked, and how do you love it handled?",
                        "Describe the perfect amount of roughness you like.",
                        "What is your favorite filthy fantasy that you still have not lived out yet?",
                        "Describe how you like your hair pulled and your throat used.",
                        "Have you ever cum from dirty talk alone with no physical touch?",
                        "Describe how you want to be held down and used when you are in a really submissive mood.",
                        "If you could be used by anyone in this group right now, who and what would you want them to do?"
                    ];
                    const dares = [
                        "Send a voice note describing exactly how you like to be fucked.",
                        "Send a close-up photo with a filthy caption.",
                        "Tag someone and tell them how you would ride or suck them.",
                        "Send a voice note moaning as if you are being fucked right now.",
                        "Write a short filthy fantasy involving someone in this group.",
                        "Send a voice note saying “Please fuck me harder” desperately."
                    ];

                    session.round = (session.round || 0) + 1;
                    const type = session.mode === 'solo'
                        ? (Math.random() > 0.5 ? 'truth' : 'dare')
                        : (((session.round - 1) % 3 === 2) ? 'dare' : 'truth');

                    const content = type === 'truth'
                        ? truths[Math.floor(Math.random() * truths.length)]
                        : dares[Math.floor(Math.random() * dares.length)];

                    let answerer;
                    if (session.mode === 'paired') {
                        answerer = session.players[(session.round - 1) % 2];
                    } else {
                        answerer = session.players[0];
                    }

                    session.waitingFor = answerer;
                    session.currentAnswerer = answerer;
                    session.currentType = type;
                    sessions[session.id] = session;
                    await saveTodSessions(chatId, sessions);

                    const typeLabel = type === 'truth' ? '🔥 *TRUTH*' : '💀 *DARE*';
                    let text = `${typeLabel}  —  Round ${session.round}\n\n`;
                    text += `${mention(answerer)}, your ${type}:\n\n${content}\n\n`;
                    text += `✅ When you are done, type *.done* or *.next*\n`;
                    text += `🛑 Type *.endtod* to stop.`;

                    await sock.sendMessage(chatId, {
                        text,
                        mentions: session.players
                    });
                } catch (e) {
                    console.error('TOD next error:', e);
                }
            }, 1500);

            return;
        }

        // ── Nothing active ───────────────────────────────────────────
        await sock.sendMessage(chatId, {
            text: 'You are not currently expected to answer anything.\n(No active Hot Seat or Truth/Dare turn for you)',
            ...channelInfo
        }, { quoted: message });
    }
};

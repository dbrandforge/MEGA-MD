import store from '../lib/lightweight_store.js';

const HOTSEAT_KEY = 'hotseatSession';

function mention(jid) {
    return `@${(jid || '').split('@')[0]}`;
}

async function getSession(chatId) {
    return (await store.getSetting(chatId, HOTSEAT_KEY)) || null;
}

async function saveSession(chatId, session) {
    await store.saveSetting(chatId, HOTSEAT_KEY, session);
}

export default {
    command: 'done',
    aliases: ['next'],
    category: 'games',
    description: 'Mark your answer as done (Hot Seat or TOD)',
    usage: '.done',
    groupOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo } = context;

        // First check Hot Seat
        const session = await getSession(chatId);
        if (session?.status === 'active' && session.waitingFor === senderId) {
            session.lastActivity = Date.now();
            session.currentIndex = (session.currentIndex + 1) % session.players.length;
            session.round = (session.round || 0) + 1;
            session.waitingFor = null;
            await saveSession(chatId, session);

            await sock.sendMessage(chatId, {
                text: `✅ ${mention(senderId)} has answered.\nNext person coming up...`,
                mentions: [senderId]
            });

            // Import and continue
            setTimeout(async () => {
                try {
                    const { default: hotseat } = await import('./hotseat.js');
                    // Re-trigger next question by calling internal flow via a small re-ask
                    // We duplicate minimal next-question logic here for reliability
                    const current = await getSession(chatId);
                    if (!current || current.status !== 'active') return;

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
                        "Who in this group do you secretly find attractive?"
                    ];

                    const player = current.players[current.currentIndex];
                    const question = questions[Math.floor(Math.random() * questions.length)];
                    current.waitingFor = player;
                    current.questionAskedAt = Date.now();
                    await saveSession(chatId, current);

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

        // Fall through to TOD done (handled by tod-done.js if present)
        // If neither, just notify
        const todSessions = (await store.getSetting(chatId, 'todSessions')) || {};
        const todSession = Object.values(todSessions).find(s =>
            s.players?.includes(senderId) && s.status === 'active'
        );

        if (todSession && todSession.waitingFor === senderId) {
            // Let tod-done handle it - trigger by re-import
            try {
                const todDone = await import('./tod-done.js');
                return todDone.default.handler(sock, message, args, context);
            } catch (e) {}
        }

        await sock.sendMessage(chatId, {
            text: 'You are not currently expected to answer anything.\n(No active Hot Seat or Truth/Dare turn)',
            ...channelInfo
        }, { quoted: message });
    }
};

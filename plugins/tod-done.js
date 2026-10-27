import store from '../lib/lightweight_store.js';

const SESSIONS_KEY = 'todSessions';

async function getSessions(chatId) {
    return (await store.getSetting(chatId, SESSIONS_KEY)) || {};
}

async function saveSessions(chatId, sessions) {
    await store.saveSetting(chatId, SESSIONS_KEY, sessions);
}

function mention(jid) {
    return `@${(jid || '').split('@')[0]}`;
}

export default {
    command: 'done',
    aliases: ['next', 'toddone'],
    category: 'games',
    description: 'Mark your Truth/Dare as done and continue to next round',
    usage: '.done',
    groupOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo } = context;

        // Import startRound dynamically to avoid circular issues
        const tod = await import('./tod.js');
        const sessions = await getSessions(chatId);

        const session = Object.values(sessions).find(s =>
            s.players?.includes(senderId) && s.status === 'active'
        );

        if (!session) {
            return sock.sendMessage(chatId, {
                text: 'You are not in an active Truth or Dare session.\nStart one with *.tod solo* or *.tod paired @partner*',
                ...channelInfo
            }, { quoted: message });
        }

        if (session.waitingFor !== senderId) {
            return sock.sendMessage(chatId, {
                text: `It's not your turn right now.\nWaiting for ${mention(session.waitingFor)} to finish.`,
                mentions: [session.waitingFor],
                ...channelInfo
            }, { quoted: message });
        }

        session.lastActivity = Date.now();
        session.warningSent = false;
        await saveSessions(chatId, sessions);

        await sock.sendMessage(chatId, {
            text: `✅ ${mention(senderId)} is done!\n\nNext round coming up...`,
            mentions: session.players
        });

        // Trigger next round via the tod module
        setTimeout(async () => {
            try {
                // Re-fetch and call internal start logic by re-triggering through a small helper
                // For reliability we increment and send next question here too
                const { default: todPlugin } = await import('./tod.js');
                // We call the exported check / we simply re-use the pattern by sending a synthetic continue
                // Easiest reliable way: the main tod.js startRound is not exported, so we duplicate minimal advance here

                const truths = [
                    "Describe the perfect amount of roughness you like.",
                    "What is your favorite filthy fantasy that you still have not lived out yet?",
                    "Describe how you like your hair pulled and your throat used.",
                    "Have you ever cum from dirty talk alone with no physical touch?",
                    "Describe the best facial you have ever received or given.",
                    "What is the nastiest thing you have ever said while you were close to cumming?",
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
                    const idx = (session.round - 1) % 2;
                    answerer = session.players[idx];
                } else {
                    answerer = session.players[0];
                }

                session.waitingFor = answerer;
                session.currentAnswerer = answerer;
                session.currentType = type;
                await saveSessions(chatId, sessions);

                const typeLabel = type === 'truth' ? '🔥 *TRUTH*' : '💀 *DARE*';
                let text = `${typeLabel}  —  Round ${session.round}\n\n`;
                text += `${mention(answerer)}, your ${type}:\n\n${content}\n\n`;
                text += `✅ When you are done, type *.done* or *.next* to continue.\n`;
                text += `🛑 Type *.endtod* to stop the game.`;

                await sock.sendMessage(chatId, {
                    text,
                    mentions: session.players
                });
            } catch (e) {
                console.error('Error advancing TOD round:', e);
            }
        }, 1500);
    }
};

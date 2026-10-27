import store from '../lib/lightweight_store.js';

/**
 * Full Truth or Dare State Machine - Sin City
 * Fixed: Now supports direct arguments (.tod solo / .tod paired @user)
 */

const truths = [
    "What is the most intense orgasm you have ever had, and describe exactly what made it so good in dirty detail.",
    "Have you ever fucked someone while someone else was in the next room or watching? Tell the full filthy story.",
    "What is the dirtiest thing you have ever done for money, a dare, or pure lust?",
    "Which part of your body gets the most attention when you are getting fucked, and how do you love it handled?",
    "Have you ever cum purely from being fingered or eaten out with zero dick involved? Describe how it felt.",
    "What is the biggest cock you have taken, and did it stretch you in the best or worst way?",
    "Have you ever licked cum off someone’s body, out of a condom, or straight from the source? How did it taste?",
    "What is your favorite position when you want to get completely destroyed?",
    "Have you ever recorded yourself getting fucked and watched it later while touching yourself?",
    "What is the most public place you have ever had sex or gotten someone off?",
    "Describe in detail the last time someone made you beg for it.",
    "Have you ever let someone finish inside you without protection just because it felt too good to stop?",
    "What is the nastiest thing someone has ever said to you during sex that made you even wetter/harder?",
    "Have you ever fucked or gotten fucked in front of a mirror just so you could watch?",
    "What is your favorite filthy fantasy that you still have not lived out yet?",
    "Describe how you like your hair pulled and your throat used.",
    "Have you ever woken someone up with your mouth on them? How did they react?",
    "What is the longest you have gone without cumming just to make the orgasm stronger later?",
    "Have you ever let someone use your body however they wanted for a whole night with no limits?",
    "Describe the exact way you like to be talked to when someone is deep inside you.",
    "Have you ever cum from dirty talk alone with no physical touch?",
    "What is the dirtiest roleplay you have ever done?",
    "Describe the best facial you have ever received or given.",
    "Have you ever edged yourself for hours until you were shaking and desperate?",
    "Describe exactly how you like your ass played with.",
    "Have you ever swallowed every drop and then asked for more?",
    "What is the nastiest thing you have ever said while you were close to cumming?",
    "Describe your favorite way to wake up — with someone’s mouth, fingers, or cock already on you.",
    "Have you ever let someone finish on your face and left it there for a while just because it felt dirty?",
    "Describe the perfect way someone should eat you out or suck you off.",
    "What is the filthiest thing you have ever done with food or liquid during sex?",
    "Describe how you want to be held down and used when you are in a really submissive mood.",
    "Have you ever cum so hard you cried or laughed uncontrollably afterward?",
    "If you could be used by anyone in this group right now with zero consequences, who would it be and what exactly would you want them to do to you?",
    "What’s the sluttiest outfit you’ve ever worn with the intention of getting fucked?",
    "Describe the most dominant you’ve ever been in bed and what you did to them.",
    "Have you ever let someone spit in your mouth or on your face during sex?",
    "What’s the most sensitive part of your body that people usually overlook?",
    "Describe the exact sound you make when you’re about to cum hard.",
    "Have you ever been choked during sex? Did you like it?",
    "What’s the dirtiest text you’ve ever sent, and did it work?",
    "Describe a time you got so desperate you begged out loud.",
    "What’s your favorite way to be degraded during sex?",
    "Describe how you like your nipples played with.",
    "What’s the most number of times you’ve cum in one night?",
    "Describe the best creampie you’ve ever given or received.",
    "What’s the filthiest fantasy you’ve masturbated to more than once?",
    "Describe how you want to be fucked when you’re feeling extra needy.",
    "Have you ever let someone use your throat until you were a mess?",
    "Describe the perfect amount of roughness you like."
];

const dares = [
    "Send a voice note describing in filthy detail exactly how you like to be fucked — pace, positions, dirty talk, everything.",
    "Take a photo of your current underwear (or the fact that you are not wearing any) and send it to the group.",
    "Write a short but extremely dirty paragraph about what you would do to the last person who sent a message in this group.",
    "Record a 15-second voice note saying the filthiest thing you have ever wanted to say to someone in this chat.",
    "Send a close-up photo of your thighs, chest, neck, or ass with a caption about how you want it used.",
    "Describe in extreme detail the last time you masturbated — what you were thinking about and how you finished.",
    "Tag someone in the group and tell them exactly how you would suck them off or ride them until they begged.",
    "Send a voice note moaning as if you are being fucked right this second.",
    "Post a photo of yourself biting your lip or looking completely fucked-out with the caption “Use me.”",
    "Write a full fantasy about getting gangbanged by three people from this group and send it here.",
    "Send a voice note of you saying “Please fuck me harder” in the most desperate tone you can manage.",
    "Describe in detail what you would do if the person you are most attracted to in this group walked into your room right now naked.",
    "Take a mirror selfie showing as much skin as you are comfortable with and caption it with one filthy wish.",
    "Write out the dirtiest text you would send if you were trying to make someone cum from words alone.",
    "Send a voice note describing how your body reacts when you are about to orgasm.",
    "Tag two people and create a short filthy scenario involving the three of you.",
    "Describe exactly how you would edge someone for an hour without letting them cum.",
    "Send a photo of your hand or fingers with a caption about what you wish they were doing right now.",
    "Write a confession of the most recent time you got turned on by something someone said in this group.",
    "Record yourself saying “I want to be ruined tonight” and send the voice note.",
    "Describe your ideal way to wake someone up with your mouth.",
    "Send a flirty but extremely explicit message to the group as if you are already halfway to orgasm.",
    "Write a short scene where you are being held down and used exactly how you like it.",
    "Tell the group the most sensitive spot on your body and how you want it treated.",
    "Send a voice note of you breathing heavily and whispering something filthy.",
    "Describe what you would do if someone from this group suddenly pinned you against a wall.",
    "Write the caption you would put under a very explicit photo of yourself if you posted it right now.",
    "Tag someone and dare them to tell you their favorite way to make you moan.",
    "Describe in detail how you like to be kissed when things are already getting sexual.",
    "Send a message that starts with “Right now I am imagining…” and make it as filthy as possible.",
    "Write out the exact dirty talk you want to hear while someone is inside you.",
    "Describe the perfect aftercare you want after being completely used.",
    "Send a voice note saying the name of someone in the group followed by something very naughty.",
    "Write a short fantasy about being watched while you get fucked.",
    "Tell the group one thing you have never admitted out loud about what turns you on.",
    "Describe how you want your hair pulled and your body positioned when someone is taking control.",
    "Send a flirty challenge to the whole group: “Who here would actually fuck me the way I need it?”",
    "Write a detailed description of the last orgasm you had and what triggered it.",
    "Imagine someone from this group is under your desk right now. Describe what they are doing.",
    "Send a message that ends with “and I would not stop until you came.” Make the whole thing filthy.",
    "Describe the most submissive or dominant you have ever felt during sex.",
    "Write a short but intense scene where you are being edged and denied.",
    "Tell the group exactly where on your body you want someone to leave marks.",
    "Send a voice note of you softly saying “Please don’t stop” like you mean it.",
    "Describe what you would do if you had one free night with no rules and someone from this group.",
    "Write the filthiest compliment you can give to someone in this chat.",
    "Imagine the group chat suddenly becomes a private room. What do you do first?",
    "Describe how you want to be looked at while someone is going down on you.",
    "Send a message that makes it clear you are currently turned on and why.",
    "Type the name of the person in this group you would most want to ruin you, and one sentence about how."
];

const SESSIONS_KEY = 'todSessions';
const TIMEOUT_MS = 10 * 60 * 1000;
const WARNING_MS = 7 * 60 * 1000;

async function getSessions(chatId) {
    return (await store.getSetting(chatId, SESSIONS_KEY)) || {};
}

async function saveSessions(chatId, sessions) {
    await store.saveSetting(chatId, SESSIONS_KEY, sessions);
}

function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getPatternType(round) {
    return ((round - 1) % 3 === 2) ? 'dare' : 'truth';
}

function mention(jid) {
    return `@${(jid || '').split('@')[0]}`;
}

async function endSession(sock, chatId, session, reason = 'ended') {
    const sessions = await getSessions(chatId);
    if (sessions[session.id]) {
        sessions[session.id].status = 'ended';
        await saveSessions(chatId, sessions);
    }

    const names = session.players.map(p => mention(p)).join(' & ');
    let text = `🛑 *Truth or Dare session ended*\n\n${names}`;

    if (reason === 'timeout') {
        text += `\n\nSession ended due to 10 minutes of inactivity.`;
    } else if (reason === 'manual') {
        text += `\n\nSession ended by a player.`;
    }

    await sock.sendMessage(chatId, {
        text,
        mentions: session.players
    });
}

async function startRound(sock, chatId, session) {
    session.round += 1;
    session.lastActivity = Date.now();
    session.warningSent = false;

    const type = session.mode === 'solo'
        ? (Math.random() > 0.5 ? 'truth' : 'dare')
        : getPatternType(session.round);

    const content = type === 'truth' ? getRandom(truths) : getRandom(dares);

    let answerer;
    if (session.mode === 'paired') {
        const idx = (session.round - 1) % 2;
        answerer = session.players[idx];
    } else {
        answerer = session.players[0];
    }

    session.currentAnswerer = answerer;
    session.waitingFor = answerer;
    session.currentType = type;

    const sessions = await getSessions(chatId);
    sessions[session.id] = session;
    await saveSessions(chatId, sessions);

    const typeLabel = type === 'truth' ? '🔥 *TRUTH*' : '💀 *DARE*';
    let text = `${typeLabel}  —  Round ${session.round}\n\n`;
    text += `${mention(answerer)}, your ${type}:\n\n${content}\n\n`;
    text += `_Reply when done, or type .endtod to stop._`;

    await sock.sendMessage(chatId, {
        text,
        mentions: session.players
    });
}

async function startSolo(sock, chatId, senderId) {
    const sessions = await getSessions(chatId);
    const sessionId = `tod_${Date.now()}_${senderId.split('@')[0]}`;

    const session = {
        id: sessionId,
        status: 'active',
        starter: senderId,
        players: [senderId],
        mode: 'solo',
        round: 0,
        lastActivity: Date.now(),
        warningSent: false
    };

    sessions[sessionId] = session;
    await saveSessions(chatId, sessions);

    await sock.sendMessage(chatId, {
        text: `✅ *Solo mode* started for ${mention(senderId)}\n\nGet ready...`,
        mentions: [senderId]
    });

    await startRound(sock, chatId, session);
}

async function startPaired(sock, chatId, senderId, partnerId) {
    const sessions = await getSessions(chatId);
    const sessionId = `tod_${Date.now()}_${senderId.split('@')[0]}`;

    const session = {
        id: sessionId,
        status: 'active',
        starter: senderId,
        players: [senderId, partnerId],
        mode: 'paired',
        round: 0,
        lastActivity: Date.now(),
        warningSent: false
    };

    sessions[sessionId] = session;
    await saveSessions(chatId, sessions);

    await sock.sendMessage(chatId, {
        text: `✅ *Paired mode* started!\n\n${mention(senderId)}  vs  ${mention(partnerId)}\n\nForced pattern: Truth → Truth → Dare\n\nStarting Round 1...`,
        mentions: [senderId, partnerId]
    });

    await startRound(sock, chatId, session);
}

export default {
    command: 'tod',
    aliases: ['truthordare'],
    category: 'games',
    description: 'Truth or Dare - Solo or Paired with forced pattern',
    usage: '.tod | .tod solo | .tod paired @user',
    groupOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo } = context;
        const sessions = await getSessions(chatId);

        // Already in a session?
        const existing = Object.values(sessions).find(s =>
            s.players?.includes(senderId) && ['active', 'choosing_mode'].includes(s.status)
        );

        if (existing) {
            return sock.sendMessage(chatId, {
                text: `You are already in an active session.\nUse *.endtod* to end it first.`,
                ...channelInfo
            }, { quoted: message });
        }

        const firstArg = (args[0] || '').toLowerCase();

        // Direct: .tod solo
        if (firstArg === 'solo') {
            return startSolo(sock, chatId, senderId);
        }

        // Direct: .tod paired @user
        if (firstArg === 'paired' || firstArg === 'pair') {
            const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentioned.length === 0) {
                return sock.sendMessage(chatId, {
                    text: `Please tag your partner.\nExample: *.tod paired @partner*`,
                    ...channelInfo
                }, { quoted: message });
            }

            const partner = mentioned[0];
            if (partner === senderId) {
                return sock.sendMessage(chatId, {
                    text: `You cannot pair with yourself.`,
                    ...channelInfo
                }, { quoted: message });
            }

            return startPaired(sock, chatId, senderId, partner);
        }

        // No args → ask for mode
        const sessionId = `tod_${Date.now()}_${senderId.split('@')[0]}`;
        sessions[sessionId] = {
            id: sessionId,
            status: 'choosing_mode',
            starter: senderId,
            players: [senderId],
            mode: null,
            round: 0,
            lastActivity: Date.now(),
            warningSent: false
        };
        await saveSessions(chatId, sessions);

        await sock.sendMessage(chatId, {
            text: `🔥 *Truth or Dare*\n\n${mention(senderId)}, choose mode:\n\n• *.tod solo*\n• *.tod paired @partner*\n\nOr just reply with *solo* / *paired @partner*\n\nEnd anytime with *.endtod*`,
            mentions: [senderId],
            ...channelInfo
        }, { quoted: message });
    }
};

export const endTodCmd = {
    command: 'endtod',
    aliases: ['stoptod', 'endtruth'],
    category: 'games',
    description: 'End your Truth or Dare session',
    usage: '.endtod',
    groupOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo } = context;
        const sessions = await getSessions(chatId);

        const entry = Object.entries(sessions).find(([_, s]) =>
            s.players?.includes(senderId) && ['active', 'choosing_mode'].includes(s.status)
        );

        if (!entry) {
            return sock.sendMessage(chatId, {
                text: 'You are not in any active Truth or Dare session.',
                ...channelInfo
            }, { quoted: message });
        }

        await endSession(sock, chatId, entry[1], 'manual');
    }
};

export async function handleTodReply(sock, chatId, senderId, text, message) {
    const sessions = await getSessions(chatId);
    const session = Object.values(sessions).find(s =>
        s.players?.includes(senderId) && ['choosing_mode', 'active'].includes(s.status)
    );

    if (!session) return false;

    const lower = (text || '').trim().toLowerCase();

    if (session.status === 'choosing_mode') {
        if (lower === 'solo') {
            await startSolo(sock, chatId, senderId);
            return true;
        }

        if (lower.startsWith('paired') || lower.startsWith('pair')) {
            const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentioned.length === 0) {
                await sock.sendMessage(chatId, {
                    text: `Please tag your partner.\nExample: paired @partner`
                });
                return true;
            }

            const partner = mentioned[0];
            if (partner === senderId) {
                await sock.sendMessage(chatId, { text: `You cannot pair with yourself.` });
                return true;
            }

            await startPaired(sock, chatId, senderId, partner);
            return true;
        }

        return false;
    }

    if (session.status === 'active' && session.waitingFor === senderId) {
        session.lastActivity = Date.now();
        session.warningSent = false;
        await saveSessions(chatId, sessions);

        await sock.sendMessage(chatId, {
            text: `✅ Noted. Next round coming up...`,
            mentions: session.players
        });

        setTimeout(() => startRound(sock, chatId, session), 2000);
        return true;
    }

    return false;
}

export async function checkTodTimeouts(sock, chatId) {
    const sessions = await getSessions(chatId);
    const now = Date.now();

    for (const session of Object.values(sessions)) {
        if (session.status !== 'active') continue;

        const inactive = now - (session.lastActivity || 0);

        if (inactive >= TIMEOUT_MS) {
            await endSession(sock, chatId, session, 'timeout');
            continue;
        }

        if (inactive >= WARNING_MS && !session.warningSent) {
            session.warningSent = true;
            await saveSessions(chatId, sessions);

            const remaining = Math.ceil((TIMEOUT_MS - inactive) / 60000);
            await sock.sendMessage(chatId, {
                text: `⚠️ *Timeout Warning*\n\n${session.players.map(mention).join(' & ')}\n\nNo activity for a while. Session will end in ~${remaining} minute(s) if no one responds.`,
                mentions: session.players
            });
        }
    }
}

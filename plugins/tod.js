import store from '../lib/lightweight_store.js';
import { getUserGender } from './gender.js';
import { getTruths, getDares, randomFrom } from '../data/todLists.js';
import { isGameAllowed } from './daylock.js';

const SESSIONS_KEY = 'todSessions';
const TIMEOUT_MS = 10 * 60 * 1000;
const WARNING_MS = 7 * 60 * 1000;

async function getSessions(chatId) {
    return (await store.getSetting(chatId, SESSIONS_KEY)) || {};
}
async function saveSessions(chatId, sessions) {
    await store.saveSetting(chatId, SESSIONS_KEY, sessions);
}
function mention(jid) {
    return `@${(jid || '').split('@')[0]}`;
}
function getPatternType(round) {
    return ((round - 1) % 3 === 2) ? 'dare' : 'truth';
}

async function endSession(sock, chatId, session, reason = 'ended') {
    const sessions = await getSessions(chatId);
    if (sessions[session.id]) {
        sessions[session.id].status = 'ended';
        await saveSessions(chatId, sessions);
    }
    let text = `🛑 *Truth or Dare session ended*\n\n${session.players.map(mention).join(' & ')}`;
    if (reason === 'timeout') text += `\n\nEnded due to 10 minutes inactivity.`;
    else if (reason === 'manual') text += `\n\nEnded by a player.`;
    const sent = await sock.sendMessage(chatId, { text: text + '\n\n_Reply directly to this question (swipe/reply), or tag the bot when you are done._', mentions: session.players });
    session.questionMessageId = sent?.key?.id || null;
    session.lastActivity = Date.now();
    sessions[session.id] = session;
    await saveSessions(chatId, sessions);
}

async function startRound(sock, chatId, session) {
    session.round += 1;
    session.lastActivity = Date.now();
    session.warningSent = false;

    let answerer;
    let gender;

    if (session.mode === 'paired') {
        const idx = (session.round - 1) % 2;
        answerer = session.players[idx];
        // Each participant receives prompts from their own saved gender.
        gender = idx === 0 ? session.starterGender : session.partnerGender;
        if (gender !== 'guy' && gender !== 'lady') {
            await endSession(sock, chatId, session, 'ended');
            return;
        }
    } else {
        answerer = session.players[0];
        gender = session.starterGender;
        if (gender !== 'guy' && gender !== 'lady') {
            await endSession(sock, chatId, session, 'ended');
            return;
        }
    }

    const type = session.mode === 'solo'
        ? (Math.random() > 0.5 ? 'truth' : 'dare')
        : getPatternType(session.round);

    const list = type === 'truth' ? getTruths(gender) : getDares(gender);
    const content = randomFrom(list);

    session.currentAnswerer = answerer;
    session.waitingFor = answerer;
    session.currentType = type;
    session.currentGender = gender;

    const sessions = await getSessions(chatId);
    sessions[session.id] = session;
    await saveSessions(chatId, sessions);

    const typeLabel = type === 'truth' ? '🔥 *TRUTH*' : '💀 *DARE*';
    let text = `${typeLabel}  —  Round ${session.round} (${gender})\n\n`;
    text += `${mention(answerer)}, your ${type}:\n\n${content}\n\n`;
    text += `✅ When done, type *.done*\n🛑 *.endtod* to stop`;

    await sock.sendMessage(chatId, { text, mentions: session.players });
}

async function startSolo(sock, chatId, senderId, gender) {
    const sessions = await getSessions(chatId);
    const sessionId = `tod_${Date.now()}_${senderId.split('@')[0]}`;
    const session = {
        id: sessionId,
        status: 'active',
        starter: senderId,
        players: [senderId],
        mode: 'solo',
        starterGender: gender,
        round: 0,
        lastActivity: Date.now(),
        warningSent: false
    };
    sessions[sessionId] = session;
    await saveSessions(chatId, sessions);
    await sock.sendMessage(chatId, {
        text: `✅ *Solo mode* (${gender}) for ${mention(senderId)}`,
        mentions: [senderId]
    });
    await startRound(sock, chatId, session);
}

async function startPaired(sock, chatId, senderId, partnerId, starterGender, partnerGender) {
    const sessions = await getSessions(chatId);
    const sessionId = `tod_${Date.now()}_${senderId.split('@')[0]}`;
    const session = {
        id: sessionId,
        status: 'active',
        starter: senderId,
        players: [senderId, partnerId],
        mode: 'paired',
        starterGender,
        partnerGender,
        round: 0,
        lastActivity: Date.now(),
        warningSent: false
    };
    sessions[sessionId] = session;
    await saveSessions(chatId, sessions);

    await sock.sendMessage(chatId, {
        text: `✅ *Paired mode*\n\n${mention(senderId)} (${starterGender}) vs ${mention(partnerId)} (${partnerGender})\n\nPattern: Truth → Truth → Dare\n\nStarting...`,
        mentions: [senderId, partnerId]
    });
    await startRound(sock, chatId, session);
}

export default {
    command: 'tod',
    aliases: ['truthordare'],
    category: 'games',
    description: 'Truth or Dare solo/paired with gender lists',
    usage: '.tod solo | .tod paired @user',
    groupOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo } = context;

        const allowed = await isGameAllowed(chatId, 'tod');
        if (!allowed.ok) {
            return sock.sendMessage(chatId, { text: allowed.msg, ...channelInfo }, { quoted: message });
        }

        const gender = await getUserGender(senderId);
        if (!gender) {
            return sock.sendMessage(chatId, {
                text: `Set your gender first:\n*.gender guy*\n*.gender lady*`,
                ...channelInfo
            }, { quoted: message });
        }

        const sessions = await getSessions(chatId);
        const existing = Object.values(sessions).find(s =>
            s.players?.includes(senderId) && ['active', 'choosing_mode'].includes(s.status)
        );
        if (existing) {
            return sock.sendMessage(chatId, {
                text: `Already in a session. *.endtod* or *.done*`,
                ...channelInfo
            }, { quoted: message });
        }

        const firstArg = (args[0] || '').toLowerCase();

        if (firstArg === 'solo') {
            return startSolo(sock, chatId, senderId, gender);
        }

        if (firstArg === 'paired' || firstArg === 'pair') {
            const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (!mentioned.length) {
                return sock.sendMessage(chatId, {
                    text: `Tag partner: *.tod paired @partner*`,
                    ...channelInfo
                }, { quoted: message });
            }
            const partner = mentioned[0];
            if (partner === senderId) {
                return sock.sendMessage(chatId, { text: `Cannot pair with yourself.`, ...channelInfo }, { quoted: message });
            }
            const partnerGender = await getUserGender(partner);
            if (!partnerGender) {
                return sock.sendMessage(chatId, {
                    text: `Your tagged partner must set their gender first:\\n*.gender guy*\\n*.gender lady*\\n\\nAsk them to set it, then start the paired game again.`,
                    ...channelInfo
                }, { quoted: message });
            }
            return startPaired(sock, chatId, senderId, partner, gender, partnerGender);
        }

        await sock.sendMessage(chatId, {
            text: `🔥 *Truth or Dare*\n\nYour gender: *${gender}*\n\n• *.tod solo*\n• *.tod paired @partner*\n\nPaired: each player receives prompts from their own saved-gender list.\nAfter answers: *.done*`,
            ...channelInfo
        }, { quoted: message });
    }
};

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
            await sock.sendMessage(chatId, {
                text: `⚠️ Timeout warning — type *.done* soon or session ends.`,
                mentions: session.players
            });
        }
    }
}

function isBotMentioned(sock, message, text = '') {
    const botId = sock.user?.id || '';
    const botNumber = botId.split(':')[0].split('@')[0];
    const botLid = sock.user?.lid || '';
    const mentions = message?.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    return mentions.some(jid => {
        const id = String(jid || '').split(':')[0].split('@')[0];
        return (botNumber && id === botNumber) || (botLid && jid === botLid);
    }) || (!!botNumber && String(text).includes('@' + botNumber));
}

export async function advanceTodSession(sock, chatId, senderId, quotedMessage = null) {
    const sessions = await getSessions(chatId);
    const entry = Object.entries(sessions).find(([, s]) =>
        s.status === 'active' && s.waitingFor === senderId
    );
    if (!entry) return false;

    const [sessionId, session] = entry;
    // Claim this prompt before advancing so a reply + mention cannot double-advance.
    if (session.advancing) return true;
    session.advancing = true;
    session.lastActivity = Date.now();
    session.warningSent = false;
    sessions[sessionId] = session;
    await saveSessions(chatId, sessions);

    await sock.sendMessage(chatId, {
        text: `✅ ${mention(senderId)} has responded.\n\nNext round coming up...`,
        mentions: [senderId]
    }, quotedMessage ? { quoted: quotedMessage } : undefined);

    await startRound(sock, chatId, session);
    return true;
}

export async function handleTodReply(sock, chatId, senderId, text, message) {
    if (!chatId?.endsWith('@g.us') || message?.key?.fromMe || !senderId) return false;
    const sessions = await getSessions(chatId);
    const session = Object.values(sessions).find(s =>
        s.status === 'active' && s.waitingFor === senderId
    );
    if (!session?.questionMessageId) return false;

    const ctx = message?.message?.extendedTextMessage?.contextInfo
        || message?.message?.imageMessage?.contextInfo
        || message?.message?.videoMessage?.contextInfo || {};
    const replied = ctx.stanzaId === session.questionMessageId;
    const tagged = isBotMentioned(sock, message, text);
    if (!replied && !tagged) return false;
    return advanceTodSession(sock, chatId, senderId, message);
}

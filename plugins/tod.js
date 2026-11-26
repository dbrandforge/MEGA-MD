import store from '../lib/lightweight_store.js';
import { getUserGender } from './gender.js';
import { getTruths, getDares, randomFrom } from '../data/todLists.js';
import { isGameAllowed } from './daylock.js';
import { savePendingGenderGame } from '../lib/genderGameContinuation.js';
import { canonicalWhatsAppUserId, sameWhatsAppUser } from '../lib/whatsappIdentity.js';

const SESSIONS_KEY = 'todSessions';
const TIMEOUT_MS = 10 * 60 * 1000;
const WARNING_MS = 7 * 60 * 1000;
const NEXT_QUESTION_COOLDOWN_MS = 30 * 1000;

async function getSessions(chatId) {
    return (await store.getSetting(chatId, SESSIONS_KEY)) || {};
}
async function saveSessions(chatId, sessions) {
    if (!await store.saveSettingVerified(chatId, SESSIONS_KEY, sessions)) throw new Error('Truth or Dare session state could not be persisted.');
}

export async function hasActiveTodSession(chatId, userId, sock = global.__forgeSock) {
    const sessions = await getSessions(chatId);
    for (const session of Object.values(sessions)) {
        if (!['active', 'choosing_mode'].includes(session.status)) continue;
        for (const player of session.players || []) if (await sameWhatsAppUser(sock, player, userId)) return true;
    }
    return false;
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
    const sent = await sock.sendMessage(chatId, { text, mentions: session.players });
    session.questionMessageId = sent?.key?.id || null;
    const latestSessions = await getSessions(chatId);
    const latest = latestSessions[session.id];
    if (latest?.status === 'active' && latest.round === session.round) {
        latest.questionMessageId = session.questionMessageId;
        latest.advancing = false;
        latestSessions[session.id] = latest;
        await saveSessions(chatId, latestSessions);
    }
}

async function startRound(sock, chatId, session) {
    session.advancing = false;
    session.questionMessageId = null;
    session.round += 1;
    session.nextQuestionAt = null;
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

    const sent = await sock.sendMessage(chatId, { text, mentions: session.players });
    session.questionMessageId = sent?.key?.id || null;
    const latestSessions = await getSessions(chatId);
    const latest = latestSessions[session.id];
    if (latest?.status === 'active' && latest.round === session.round) {
        latest.questionMessageId = session.questionMessageId;
        latestSessions[session.id] = latest;
        await saveSessions(chatId, latestSessions);
    }
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


export async function completeTodTurn(sock, chatId, senderId, options = {}) {
    const sessions = await getSessions(chatId);
    const session = await (async () => {
        for (const candidate of Object.values(sessions)) {
            if (candidate.status !== 'active' || !candidate.waitingFor) continue;
            if (await sameWhatsAppUser(sock, candidate.waitingFor, senderId)) return candidate;
        }
        return null;
    })();
    if (!session) return false;
    if (session.advancing) return true;

    // A manual/day lock blocks further rounds, but a participant who has
    // completed a prompt may still use `.done end` to close their session.
    if (!options.endAfter) {
        const access = await isGameAllowed(chatId, 'tod');
        if (!access.ok) {
            await sock.sendMessage(chatId, { text: access.msg }, options.message ? { quoted: options.message } : undefined);
            return true;
        }
    }

    session.advancing = true;
    session.questionsCompleted = session.questionsCompleted || {};
    const sessionPlayerId = session.waitingFor || senderId;
    session.questionsCompleted[sessionPlayerId] = (session.questionsCompleted[sessionPlayerId] || 0) + 1;
    session.lastCompletedBy = sessionPlayerId;
    session.lastCompletedAt = Date.now();
    session.lastActivity = Date.now();
    session.nextQuestionAt = null;
    session.warningSent = false;

    if (options.endAfter) {
        session.status = 'ended';
        session.endedAt = Date.now();
        session.endedBy = sessionPlayerId;
        sessions[session.id] = session;
        await saveSessions(chatId, sessions);
        await sock.sendMessage(chatId, {
            text: '🛑 Your Truth or Dare session has ended after completing that prompt.',
            mentions: session.players
        }, options.message ? { quoted: options.message } : undefined);
        return true;
    }

    session.nextQuestionAt = Date.now() + NEXT_QUESTION_COOLDOWN_MS;
    sessions[session.id] = session;
    await saveSessions(chatId, sessions);
    await sock.sendMessage(chatId, {
        text: `✅ ${mention(senderId)} is done!\\n\\n⏳ Next question in *30 seconds*.`,
        mentions: session.players
    }, options.message ? { quoted: options.message } : undefined);

    setTimeout(async () => {
        try {
            const latestSessions = await getSessions(chatId);
            const latest = latestSessions[session.id];
            if (!latest || latest.status !== 'active') return;
            await startRound(sock, chatId, latest);
        } catch (error) {
            console.error('TOD next-round error:', error);
        }
    }, NEXT_QUESTION_COOLDOWN_MS);
    return true;
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
        const firstArg = String(args?.[0] || '').toLowerCase();
        if (['stop', 'end', 'cancel'].includes(firstArg)) {
            const sessions = await getSessions(chatId);
            const active = [];
            for (const session of Object.values(sessions)) {
                if (session.status !== 'active') continue;
                for (const player of session.players || []) {
                    if (await sameWhatsAppUser(sock, player, senderId)) { active.push(session); break; }
                }
            }
            if (!active.length) {
                return sock.sendMessage(chatId, { text: 'You do not have an active Truth or Dare session to end.', ...channelInfo }, { quoted: message });
            }
            for (const session of active) {
                session.status = 'ended';
                session.endedAt = Date.now();
                session.endedBy = senderId;
                sessions[session.id] = session;
            }
            await saveSessions(chatId, sessions);
            return sock.sendMessage(chatId, {
                text: '🛑 Your Truth or Dare session has ended.',
                mentions: active.flatMap(session => session.players || []),
                ...channelInfo
            }, { quoted: message });
        }

        const allowed = await isGameAllowed(chatId, 'tod');
        if (!allowed.ok) {
            return sock.sendMessage(chatId, { text: allowed.msg, ...channelInfo }, { quoted: message });
        }

        const gender = await getUserGender(senderId, sock);
        if (!gender) {
            await savePendingGenderGame(chatId, senderId, { command: 'tod', args: Array.isArray(args) ? args : [], requester: senderId, mentionedJids: message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [], pushName: message.pushName });
            return sock.sendMessage(chatId, {
                text: `Set your gender first:\n*.gender guy*\n*.gender lady*\n\nYour Truth or Dare request will resume automatically after registration.`,
                ...channelInfo
            }, { quoted: message });
        }

        const { hasActiveSoloTruthDareSession } = await import('./truth-continue.js');
        if (await hasActiveSoloTruthDareSession(chatId, senderId, sock)) {
            return sock.sendMessage(chatId, { text: 'You already have an active solo Truth/Dare session. Type *stop* or *.truth stop* to finish it before starting TOD.', ...channelInfo }, { quoted: message });
        }
        const sessions = await getSessions(chatId);
        const existing = await (async () => {
            for (const candidate of Object.values(sessions)) {
                if (!['active', 'choosing_mode'].includes(candidate.status)) continue;
                for (const player of candidate.players || []) if (await sameWhatsAppUser(sock, player, senderId)) return candidate;
            }
            return null;
        })();
        if (existing) {
            return sock.sendMessage(chatId, {
                text: `Already in a session. *.endtod* or *.done*`,
                ...channelInfo
            }, { quoted: message });
        }

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
            if (await sameWhatsAppUser(sock, partner, senderId)) {
                return sock.sendMessage(chatId, { text: `Cannot pair with yourself.`, ...channelInfo }, { quoted: message });
            }
            const { hasActiveSoloTruthDareSession } = await import('./truth-continue.js');
            if (await hasActiveSoloTruthDareSession(chatId, partner, sock)) {
                return sock.sendMessage(chatId, { text: 'Your tagged partner is already in a solo Truth/Dare session and must finish it before joining paired TOD.', ...channelInfo }, { quoted: message });
            }
            const partnerGender = await getUserGender(partner, sock);
            if (!partnerGender) {
                await savePendingGenderGame(chatId, partner, { command: 'tod', args: Array.isArray(args) ? args : ['paired'], requester: senderId, mentionedJids: [partner], pushName: message.pushName });
                return sock.sendMessage(chatId, {
                    text: `Your tagged partner must set their gender first:\n*.gender guy*\n*.gender lady*\n\nThe paired game will start automatically once they register.`,
                    ...channelInfo
                }, { quoted: message });
            }
            const canonicalPartner = await canonicalWhatsAppUserId(sock, partner);
            return startPaired(sock, chatId, senderId, canonicalPartner, gender, partnerGender);
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

export async function handleTodReply(sock, chatId, senderId, text, message) {
    if (!chatId?.endsWith('@g.us') || message?.key?.fromMe || !senderId) return false;
    const context = message?.message?.extendedTextMessage?.contextInfo
        || message?.message?.imageMessage?.contextInfo
        || message?.message?.videoMessage?.contextInfo
        || message?.message?.documentMessage?.contextInfo || {};
    const tagged = isBotMentioned(sock, message, text);
    if (!context.stanzaId && !tagged) return false;

    const sessions = await getSessions(chatId);
    const session = await (async () => {
        for (const candidate of Object.values(sessions)) {
            if (candidate.status !== 'active' || !candidate.waitingFor) continue;
            if (await sameWhatsAppUser(sock, candidate.waitingFor, senderId)) return candidate;
        }
        return null;
    })();
    if (!session) return false;
    if (session.advancing) return true;

    const replied = Boolean(session.questionMessageId && context.stanzaId === session.questionMessageId);
    if (!replied && !tagged) return false;

    return completeTodTurn(sock, chatId, senderId, { message });
}

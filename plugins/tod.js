import store from '../lib/lightweight_store.js';
import { getUserGender } from './gender.js';
import { getTruths, getDares, randomFrom } from '../data/todLists.js';
import { isGameAllowed } from './daylock.js';
import { isFeatureGroup } from '../lib/featureGroups.js';
import { savePendingGenderGame } from '../lib/genderGameContinuation.js';
import { canonicalWhatsAppUserId, sameWhatsAppUser } from '../lib/whatsappIdentity.js';

const SESSIONS_KEY = 'todSessions';
const TIMEOUT_MS = 10 * 60 * 1000;
const WARNING_MS = 7 * 60 * 1000;
const NEXT_QUESTION_COOLDOWN_MS = 30 * 1000;
const RECOVERY_WINDOW_MS = 15 * 60 * 1000;

async function getSessions(chatId, { allowResume = false } = {}) {
    const value = allowResume && store.getSettingForGameResume
        ? await store.getSettingForGameResume(chatId, SESSIONS_KEY)
        : await store.getSetting(chatId, SESSIONS_KEY);
    return value || {};
}
async function saveSessions(chatId, sessions) {
    if (!await store.saveSettingVerified(chatId, SESSIONS_KEY, sessions)) throw new Error('Truth or Dare session state could not be persisted.');
}

export async function hasActiveTodSession(chatId, userId, sock = global.__forgeSock) {
    const sessions = await getSessions(chatId);
    for (const session of Object.values(sessions)) {
        if (session.status === 'paused' && Date.now() >= Number(session.recoveryDeadlineAt || 0)) continue;
        if (!['active', 'choosing_mode', 'paused'].includes(session.status)) continue;
        for (const player of session.players || []) if (await sameWhatsAppUser(sock, player, userId)) return true;
        for (const [archivedPlayer, archive] of Object.entries(session.recoveryArchives || {})) {
            if (Number(archive.recoveryDeadlineAt) > Date.now() && await sameWhatsAppUser(sock, archivedPlayer, userId)) return true;
        }
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
    const stored = sessions[session.id];
    if (stored) {
        if (reason === 'timeout') {
            stored.status = 'paused';
            stored.pauseReason = 'inactivity';
            stored.removedPlayer = stored.waitingFor || stored.currentAnswerer || null;
            stored.removedAt = Date.now();
            stored.recoveryDeadlineAt = stored.removedAt + RECOVERY_WINDOW_MS;
            stored.warningSent = false;
        } else {
            stored.status = 'ended';
            stored.endedAt = Date.now();
        }
        await saveSessions(chatId, sessions);
    }
    let text = reason === 'timeout'
        ? `⌛ *Truth or Dare paused*\n\n${session.players.map(mention).join(' & ')}\n\nThe active player did not respond for 10 minutes. An admin has 15 minutes to resume that player or replace them.`
        : `🛑 *Truth or Dare session ended*\n\n${session.players.map(mention).join(' & ')}`;
    if (reason === 'manual') text += `\n\nEnded by a player.`;
    await sock.sendMessage(chatId, { text, mentions: session.players });
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

    session.currentPrompt = content;
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

    const sent = await sock.sendMessage(chatId, { text, mentions: [answerer] });
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
        text: `✅ ${mention(senderId)} is done!\n\n⏳ Next question in *30 seconds*.`,
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

export async function recoverTodPlayer(sock, chatId, playerId) {
    const sessions = await getSessions(chatId, { allowResume: true });
    if (Object.keys(sessions).length) await saveSessions(chatId, sessions);
    const session = Object.values(sessions).find(item =>
        (item.status === 'paused' && item.removedPlayer === playerId)
        || item.recoveryArchives?.[playerId]
    );
    if (!session) return false;
    const archive = session.recoveryArchives?.[playerId];
    const deadline = Number(archive?.recoveryDeadlineAt || session.recoveryDeadlineAt || 0);
    if (!deadline || Date.now() >= deadline) return false;

    if (archive) {
        if (session.status === 'paused' && session.removedPlayer && session.removedPlayer !== playerId) {
            const pausedId = session.removedPlayer;
            session.recoveryArchives = session.recoveryArchives || {};
            session.recoveryArchives[pausedId] = {
                slotIndex: session.players.indexOf(pausedId),
                recoveryDeadlineAt: session.recoveryDeadlineAt,
                round: session.round,
                currentPrompt: session.currentPrompt,
                currentType: session.currentType,
                currentGender: session.currentGender,
                starterGender: session.starterGender,
                partnerGender: session.partnerGender,
                questionsCompleted: Number(session.questionsCompleted?.[pausedId] || 0)
            };
        }
        const slotIndex = Number(archive.slotIndex);
        const displacedPlayer = session.players?.[slotIndex];
        if (!Number.isInteger(slotIndex) || !displacedPlayer) return false;
        session.players[slotIndex] = playerId;
        session.questionsCompleted = session.questionsCompleted || {};
        delete session.questionsCompleted[displacedPlayer];
        session.questionsCompleted[playerId] = Number(archive.questionsCompleted || 0);
        session.round = archive.round;
        session.currentAnswerer = playerId;
        session.waitingFor = playerId;
        session.currentType = archive.currentType;
        session.currentGender = archive.currentGender;
        session.currentPrompt = archive.currentPrompt;
        session.starterGender = archive.starterGender;
        session.partnerGender = archive.partnerGender;
        delete session.recoveryArchives[playerId];
    } else if (!session.currentPrompt || !session.waitingFor) {
        return false;
    }

    session.status = 'active';
    session.pauseReason = null;
    session.removedPlayer = null;
    session.removedAt = null;
    session.recoveryDeadlineAt = null;
    session.lastActivity = Date.now();
    session.warningSent = false;
    session.advancing = false;
    const typeLabel = session.currentType === 'truth' ? '🔥 *TRUTH*' : '💀 *DARE*';
    const sent = await sock.sendMessage(chatId, {
        text: `▶️ *TRUTH OR DARE — RESUMED*\n\n${typeLabel} · Round ${session.round}\n\n${mention(playerId)}, continue with your saved prompt:\n\n${session.currentPrompt}\n\nUse *.done* when finished. Your round and progress are unchanged.`,
        mentions: [playerId]
    });
    session.questionMessageId = sent?.key?.id || null;
    sessions[session.id] = session;
    await saveSessions(chatId, sessions);
    return true;
}

export async function replaceTodPlayer(sock, chatId, removedId, replacementId) {
    const sessions = await getSessions(chatId);
    const session = Object.values(sessions).find(item =>
        item.status === 'paused' && item.removedPlayer === removedId
    );
    if (!session || !session.recoveryDeadlineAt || Date.now() >= Number(session.recoveryDeadlineAt)) return false;
    if (!session.players.includes(removedId) || session.players.includes(replacementId)) return false;
    const gender = await getUserGender(replacementId, sock);
    if (!['guy', 'lady'].includes(gender)) return false;

    const index = session.players.indexOf(removedId);
    session.recoveryArchives = session.recoveryArchives || {};
    session.recoveryArchives[removedId] = {
        slotIndex: index,
        recoveryDeadlineAt: session.recoveryDeadlineAt,
        round: session.round,
        currentPrompt: session.currentPrompt,
        currentType: session.currentType,
        currentGender: session.currentGender,
        starterGender: session.starterGender,
        partnerGender: session.partnerGender,
        questionsCompleted: Number(session.questionsCompleted?.[removedId] || 0)
    };
    session.players[index] = replacementId;
    if (index === 0) session.starterGender = gender;
    else if (index === 1) session.partnerGender = gender;
    session.questionsCompleted = session.questionsCompleted || {};
    delete session.questionsCompleted[removedId];
    session.questionsCompleted[replacementId] = 0;
    if (session.mode === 'solo') session.round = 1;
    const round = session.round;
    const type = session.mode === 'solo'
        ? (Math.random() > 0.5 ? 'truth' : 'dare')
        : getPatternType(round);
    const list = type === 'truth' ? getTruths(gender) : getDares(gender);
    session.currentAnswerer = replacementId;
    session.waitingFor = replacementId;
    session.currentType = type;
    session.currentGender = gender;
    session.currentPrompt = randomFrom(list);
    session.status = 'active';
    session.pauseReason = null;
    session.removedPlayer = null;
    session.removedAt = null;
    session.recoveryDeadlineAt = null;
    session.lastActivity = Date.now();
    session.warningSent = false;
    session.advancing = false;

    const typeLabel = type === 'truth' ? '🔥 *TRUTH*' : '💀 *DARE*';
    const sent = await sock.sendMessage(chatId, {
        text: `🔁 *TRUTH OR DARE — SUBSTITUTE TURN*\n\n${mention(replacementId)}, you are replacing ${mention(removedId)}. Your progress starts fresh.\n${typeLabel} · Round ${session.round}\n\n${session.currentPrompt}\n\nUse *.done* when finished.`,
        mentions: [replacementId, removedId]
    });
    session.questionMessageId = sent?.key?.id || null;
    sessions[session.id] = session;
    await saveSessions(chatId, sessions);
    return true;
}

export async function resumeTodSessions(sock, chatId) {
    if (!isFeatureGroup(chatId)) return 0;
    const sessions = await getSessions(chatId, { allowResume: true });
    const active = Object.values(sessions).filter(session => session?.status === 'active');
    if (!active.length) return 0;
    const access = await isGameAllowed(chatId, 'tod');
    if (!access.ok) return 0;
    await saveSessions(chatId, sessions);
    let resumed = 0;
    for (const session of active) {
        if (session.nextQuestionAt) {
            const scheduledAt = Number(session.nextQuestionAt);
            const delayMs = Math.max(0, scheduledAt - Date.now());
            setTimeout(async () => {
                try {
                    const latestSessions = await getSessions(chatId);
                    const latest = latestSessions[session.id];
                    if (!latest || latest.status !== 'active' || Number(latest.nextQuestionAt) !== scheduledAt) return;
                    await startRound(sock, chatId, latest);
                } catch (error) {
                    console.error('[TOD] Recovered next-round timer failed:', error.message);
                }
            }, delayMs);
            resumed++;
            continue;
        }
        const player = session.waitingFor || session.currentAnswerer;
        if (!player || !session.currentPrompt) continue;
        const typeLabel = session.currentType === 'truth' ? '🔥 *TRUTH*' : '💀 *DARE*';
        const sent = await sock.sendMessage(chatId, {
            text: `▶️ *TRUTH OR DARE — RESUMED*\\n\\n${typeLabel} · Round ${session.round}\\n\\n${mention(player)}, continue with your saved prompt:\\n\\n${session.currentPrompt}\\n\\nUse *.done* when finished. Your progress is unchanged.`,
            mentions: [player]
        });
        session.questionMessageId = sent?.key?.id || null;
        session.lastActivity = Date.now();
        session.warningSent = false;
        resumed++;
    }
    await saveSessions(chatId, sessions);
    return resumed;
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

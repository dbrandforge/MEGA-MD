import { guysBasket, ladiesBasket } from '../data/devilsBasket.js';
import store from '../lib/lightweight_store.js';
import { getUserGender } from './gender.js';
import { isGameAllowed } from './daylock.js';
import config from '../config.js';
import isAdmin from '../lib/isAdmin.js';
import { savePendingGenderGame } from '../lib/genderGameContinuation.js';

const USED_KEY = 'devilsBasketUsed';
const SESSION_KEY = 'devilsBasketSessions';
const GENDER_PROMPT = 'You need to set your gender first before Devil’s Basket.\n\nType:\n.gender guy\nor\n.gender lady\n\n(You can only set this once. After that only an admin can change it.)';

function numMatch(a, b) {
    const x = String(a || '').replace(/\D/g, '');
    const y = String(b || '').replace(/\D/g, '');
    return x && y && (x === y || x.endsWith(y) || y.endsWith(x));
}
async function getUsed(chatId) {
    const saved = (await store.getSetting(chatId, USED_KEY)) || {};
    return { guys: saved.guys || [], ladies: saved.ladies || [] };
}
async function saveUsed(chatId, used) {
    if (!await store.saveSettingVerified(chatId, USED_KEY, used)) throw new Error('Basket history could not be persisted.');
}
function poolFor(gender) {
    const source = gender === 'lady' ? ladiesBasket : guysBasket;
    return Object.values(source);
}
function usedKey(gender) {
    return gender === 'lady' ? 'ladies' : 'guys';
}

function botMentioned(sock, message) {
    const botId = sock.user?.id || '';
    const botNumber = botId.split(':')[0].split('@')[0];
    const botLid = sock.user?.lid || '';
    const mentions = message?.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    return mentions.some(jid => {
        const value = String(jid || '');
        return (botNumber && value.split(':')[0].split('@')[0] === botNumber)
            || (botLid && value === botLid);
    });
}

export async function resumeBasketSession(sock, chatId, senderId, message, channelInfo = {}) {
    if (!chatId?.endsWith('@g.us') || !senderId) return false;
    const sessions = (await store.getSettingForGameResume(chatId, SESSION_KEY)) || {};
    const session = sessions[senderId];
    if (!session?.currentDare) return false;
    const allowed = await isGameAllowed(chatId, 'basket');
    if (!allowed.ok) {
        await sock.sendMessage(chatId, { text: allowed.msg, ...channelInfo }, message ? { quoted: message } : {});
        return true;
    }
    const sent = await sock.sendMessage(chatId, {
        text: `▶️ *DEVIL'S BASKET RESUMED*\\n\\n@${senderId.split('@')[0]} — continue with your saved dare:\\n\\n${session.currentDare}\\n\\nReply to this fresh prompt or tag the bot when complete. Your attempts and used-dare history are preserved.`,
        mentions: [senderId], ...channelInfo
    }, message ? { quoted: message } : undefined);
    session.questionMessageId = sent?.key?.id || null;
    session.updatedAt = Date.now();
    sessions[senderId] = session;
    if (!await store.saveSettingVerified(chatId, SESSION_KEY, sessions)) throw new Error('Basket session could not be resumed.');
    return true;
}

export async function hasActiveBasketSession(chatId, senderId) {
    if (!chatId?.endsWith('@g.us') || !senderId) return false;
    const sessions = (await store.getSetting(chatId, SESSION_KEY)) || {};
    return Boolean(sessions[senderId]?.questionMessageId && sessions[senderId]?.currentDare);
}

export function basketResponseProblem(dare, message) {
    const prompt = String(dare || '').toLowerCase();
    const body = String(message.message?.conversation || message.message?.extendedTextMessage?.text
        || message.message?.imageMessage?.caption || message.message?.videoMessage?.caption || '').trim();
    const hasAudio = Boolean(message.message?.audioMessage);
    const hasImage = Boolean(message.message?.imageMessage);
    const hasVideo = Boolean(message.message?.videoMessage);
    if (/voice note|\bvn\b|audio message|record (?:a )?(?:short )?audio/i.test(prompt) && !hasAudio) {
        return 'This dare requires a voice note. Send an audio/voice-note reply to the dare to complete it.';
    }
    if (/\b(photo|picture|pic|selfie|mirror pic)\b/i.test(prompt) && !hasImage) {
        return 'This dare requires a photo. Attach an image when replying to complete it.';
    }
    if (/\b(video|record yourself)\b/i.test(prompt) && !hasVideo) {
        return 'This dare requires a video. Attach a video when replying to complete it.';
    }
    if (!hasAudio && !hasImage && !hasVideo) {
        if (body.length < 3 && !/^(?:yes|no)$/i.test(body)) {
            return 'That reply is too short to count as completing the dare. Follow the actual instruction and send a meaningful response, or attach the requested media.';
        }
    }
    return null;
}

export async function handleBasketContinuity(sock, chatId, message, senderId) {
    if (!chatId?.endsWith('@g.us') || message?.key?.fromMe) return false;
    const ctx = message.message?.extendedTextMessage?.contextInfo
        || message.message?.imageMessage?.contextInfo
        || message.message?.videoMessage?.contextInfo
        || message.message?.audioMessage?.contextInfo || {};
    const tagged = botMentioned(sock, message);
    if (!ctx.stanzaId && !tagged) return false;

    const sessions = (await store.getSetting(chatId, SESSION_KEY)) || {};
    const session = sessions[senderId];
    if (!session) return false;
    const replied = !!(ctx.stanzaId && session.questionMessageId && ctx.stanzaId === session.questionMessageId);
    if (!replied && !tagged) return false;
    if (replied) {
        const problem = basketResponseProblem(session.currentDare, message);
        if (problem) {
            await sock.sendMessage(chatId, { text: problem }, { quoted: message });
            return true;
        }
    }

    const allowed = await isGameAllowed(chatId, 'basket');
    if (!allowed.ok) {
        await sock.sendMessage(chatId, { text: allowed.msg }, { quoted: message });
        return true;
    }
    const gender = await getUserGender(senderId);
    if (!gender) {
        await sock.sendMessage(chatId, { text: GENDER_PROMPT }, { quoted: message });
        return true;
    }
    const used = await getUsed(chatId);
    const pool = poolFor(gender);
    const key = usedKey(gender);
    const available = pool.map((dare, index) => ({ dare, number: index + 1 }))
        .filter(item => !used[key].includes(item.number));
    if (!available.length) {
        delete sessions[senderId];
        if (!await store.saveSettingVerified(chatId, SESSION_KEY, sessions)) throw new Error('Basket session state could not be persisted.');
        await sock.sendMessage(chatId, {
            text: `All ${gender} Basket dares have been used. Ask an admin to run *.basket reset*.`
        }, { quoted: message });
        return true;
    }
    session.attempts = (session.attempts || 0) + 1;
    session.lastAttemptAt = Date.now();
    const selected = available[Math.floor(Math.random() * available.length)];
    used[key].push(selected.number);
    await saveUsed(chatId, used);
    const sent = await sock.sendMessage(chatId, {
        text: `*Devil’s Basket — ${gender === 'lady' ? 'Ladies' : 'Guys'} #${selected.number}* 🎰\n\n@${senderId.split('@')[0]}\n\n${selected.dare}\n\nComplete this. Failure = 10h mute.\n\n_Reply to this dare or tag the bot for another._`,
        mentions: [senderId]
    }, { quoted: message });
    sessions[senderId] = { questionMessageId: sent?.key?.id || null, currentDare: selected.dare, updatedAt: Date.now(), attempts: session.attempts || 0, lastAttemptAt: session.lastAttemptAt || Date.now() };
    if (!await store.saveSettingVerified(chatId, SESSION_KEY, sessions)) throw new Error('Basket session state could not be persisted.');
    return true;
}

export default {
    command: 'basket',
    aliases: ['devil', 'db', 'devilsbasket'],
    category: 'games',
    description: "Devil's Basket — gender-aware random dare",
    usage: '.basket [number] | list | reset | stop',
    groupOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo, isSenderAdmin, senderIsOwnerOrSudo, isOwnerOrSudoCheck } = context;
        try {
            const input = (args[0] || '').toLowerCase();
            if (['stop', 'end', 'cancel'].includes(input)) {
                const sessions = (await store.getSetting(chatId, SESSION_KEY)) || {};
                if (!sessions[senderId]) {
                    return sock.sendMessage(chatId, { text: "You don't have an active Devil's Basket run to end.", ...channelInfo }, { quoted: message });
                }
                delete sessions[senderId];
                if (!await store.saveSettingVerified(chatId, SESSION_KEY, sessions)) {
                    throw new Error('Basket session state could not be persisted.');
                }
                return sock.sendMessage(chatId, { text: "🛑 Your Devil's Basket run has ended.", ...channelInfo }, { quoted: message });
            }
            let canAdmin = !!(isSenderAdmin || senderIsOwnerOrSudo || isOwnerOrSudoCheck ||
                message.key.fromMe || numMatch(senderId, config.ownerNumber));
            if (!canAdmin && (input === 'list' || input === 'used' || input === 'reset' || input === 'clear')) {
                const status = await isAdmin(sock, chatId, senderId);
                canAdmin = !!status.isSenderAdmin;
            }

            const used = await getUsed(chatId);
            if (input === 'list' || input === 'used') {
                if (!canAdmin) return sock.sendMessage(chatId, { text: 'Only admins / owner can view the used Basket list.', ...channelInfo }, { quoted: message });
                const guysLeft = poolFor('guy').length - used.guys.length;
                const ladiesLeft = poolFor('lady').length - used.ladies.length;
                return sock.sendMessage(chatId, {
                    text: `*Devil’s Basket — Admin status*\n\n*Guys used:* ${used.guys.length} | *Remaining:* ${guysLeft}\n*Ladies used:* ${used.ladies.length} | *Remaining:* ${ladiesLeft}\n\nAdmin reset: *.basket reset*`,
                    ...channelInfo
                }, { quoted: message });
            }
            if (input === 'reset' || input === 'clear') {
                if (!canAdmin) return sock.sendMessage(chatId, { text: "Only admins / owner can reset Devil's Basket.", ...channelInfo }, { quoted: message });
                await saveUsed(chatId, { guys: [], ladies: [] });
                return sock.sendMessage(chatId, { text: "✅ Devil's Basket reset. Both gender pools are available again.", ...channelInfo }, { quoted: message });
            }

            const allowed = await isGameAllowed(chatId, 'basket');
            if (!allowed.ok) return sock.sendMessage(chatId, { text: allowed.msg, ...channelInfo }, { quoted: message });
            if (input === 'resume') {
                const resumed = await resumeBasketSession(sock, chatId, senderId, message, channelInfo);
                return resumed ? undefined : sock.sendMessage(chatId, { text: 'No saved Devil\'s Basket dare is available to resume.', ...channelInfo }, { quoted: message });
            }

            const gender = await getUserGender(senderId);
            if (!gender) {
                await savePendingGenderGame(chatId, senderId, { command: 'basket', args: args || [], requester: senderId, pushName: message.pushName });
                return sock.sendMessage(chatId, { text: `${GENDER_PROMPT}\n\nYour Basket request will resume automatically after registration.`, ...channelInfo }, { quoted: message });
            }

            const pool = poolFor(gender);
            const key = usedKey(gender);
            const available = pool.map((dare, index) => ({ dare, number: index + 1 })).filter(item => !used[key].includes(item.number));
            if (!available.length) return sock.sendMessage(chatId, { text: `All ${gender} Basket dares have been used. Ask an admin to run *.basket reset*.`, ...channelInfo }, { quoted: message });

            let selected;
            if (input) {
                const number = Number.parseInt(input, 10);
                if (!Number.isInteger(number) || number < 1 || number > pool.length) {
                    return sock.sendMessage(chatId, { text: `Your ${gender} Basket has numbers 1–${pool.length}. Use *.basket* for a random dare.`, ...channelInfo }, { quoted: message });
                }
                if (used[key].includes(number)) return sock.sendMessage(chatId, { text: `Your Basket number ${number} has already been used. Try another number or ask an admin to reset.`, ...channelInfo }, { quoted: message });
                selected = { number, dare: pool[number - 1] };
            } else {
                selected = available[Math.floor(Math.random() * available.length)];
            }

            used[key].push(selected.number);
            await saveUsed(chatId, used);
            const sent = await sock.sendMessage(chatId, {
                text: `*Devil’s Basket — ${gender === 'lady' ? 'Ladies' : 'Guys'} #${selected.number}* 🎰\n\n@${senderId.split('@')[0]}\n\n${selected.dare}\n\nComplete this. Failure = 10h mute.\n\n_Reply to this dare or tag the bot for another._`,
                mentions: [senderId], ...channelInfo
            }, { quoted: message });
            const sessions = (await store.getSetting(chatId, SESSION_KEY)) || {};
            sessions[senderId] = { questionMessageId: sent?.key?.id || null, currentDare: selected.dare, updatedAt: Date.now(), attempts: (sessions[senderId]?.attempts || 0), lastAttemptAt: sessions[senderId]?.lastAttemptAt || null };
            if (!await store.saveSettingVerified(chatId, SESSION_KEY, sessions)) throw new Error('Basket session state could not be persisted.');
            return;
        } catch (error) {
            console.error("Devil's Basket error:", error);
            await sock.sendMessage(chatId, { text: 'Something went wrong.', ...channelInfo }, { quoted: message });
        }
    }
};

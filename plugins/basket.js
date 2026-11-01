import { guysBasket, ladiesBasket } from '../data/devilsBasket.js';
import store from '../lib/lightweight_store.js';
import { getUserGender } from './gender.js';
import { isGameAllowed } from './daylock.js';
import config from '../config.js';
import isAdmin from '../lib/isAdmin.js';

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
    await store.saveSetting(chatId, USED_KEY, used);
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

export async function handleBasketContinuity(sock, chatId, message, senderId) {
    if (!chatId?.endsWith('@g.us') || message?.key?.fromMe) return false;
    const sessions = (await store.getSetting(chatId, SESSION_KEY)) || {};
    const session = sessions[senderId];
    if (!session) return false;
    const ctx = message.message?.extendedTextMessage?.contextInfo
        || message.message?.imageMessage?.contextInfo
        || message.message?.videoMessage?.contextInfo || {};
    const replied = !!(ctx.stanzaId && session.questionMessageId && ctx.stanzaId === session.questionMessageId);
    if (!replied && !botMentioned(sock, message)) return false;

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
        await store.saveSetting(chatId, SESSION_KEY, sessions);
        await sock.sendMessage(chatId, {
            text: `All ${gender} Basket dares have been used. Ask an admin to run *.basket reset*.`
        }, { quoted: message });
        return true;
    }
    const selected = available[Math.floor(Math.random() * available.length)];
    used[key].push(selected.number);
    await saveUsed(chatId, used);
    const sent = await sock.sendMessage(chatId, {
        text: `*Devil’s Basket — ${gender === 'lady' ? 'Ladies' : 'Guys'} #${selected.number}* 🎰\\n\\n@${senderId.split('@')[0]}\\n\\n${selected.dare}\\n\\nComplete this. Failure = 10h mute.\\n\\n_Reply to this dare or tag the bot for another._`,
        mentions: [senderId]
    }, { quoted: message });
    sessions[senderId] = { questionMessageId: sent?.key?.id || null, updatedAt: Date.now() };
    await store.saveSetting(chatId, SESSION_KEY, sessions);
    return true;
}

export default {
    command: 'basket',
    aliases: ['devil', 'db', 'devilsbasket'],
    category: 'games',
    description: "Devil's Basket — gender-aware random dare",
    usage: '.basket [number] | list | reset',
    groupOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo, isSenderAdmin, senderIsOwnerOrSudo, isOwnerOrSudoCheck } = context;
        try {
            const input = (args[0] || '').toLowerCase();
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

            const gender = await getUserGender(senderId);
            if (!gender) return sock.sendMessage(chatId, { text: GENDER_PROMPT, ...channelInfo }, { quoted: message });

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
                text: `*Devil’s Basket — ${gender === 'lady' ? 'Ladies' : 'Guys'} #${selected.number}* 🎰\\n\\n@${senderId.split('@')[0]}\\n\\n${selected.dare}\\n\\nComplete this. Failure = 10h mute.\\n\\n_Reply to this dare or tag the bot for another._`,
                mentions: [senderId], ...channelInfo
            }, { quoted: message });
            const sessions = (await store.getSetting(chatId, SESSION_KEY)) || {};
            sessions[senderId] = { questionMessageId: sent?.key?.id || null, updatedAt: Date.now() };
            await store.saveSetting(chatId, SESSION_KEY, sessions);
            return;
        } catch (error) {
            console.error("Devil's Basket error:", error);
            await sock.sendMessage(chatId, { text: 'Something went wrong.', ...channelInfo }, { quoted: message });
        }
    }
};

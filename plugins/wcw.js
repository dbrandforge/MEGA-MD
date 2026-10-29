import store from '../lib/lightweight_store.js';
import { rejectionInstructions } from '../data/wcwRejections.js';
import { isGameAllowed } from './daylock.js';

const WCW_KEY = 'wcwData';

async function getWcwData(chatId) {
    return (await store.getSetting(chatId, WCW_KEY)) || { ladies: {}, shots: {} };
}
async function saveWcwData(chatId, data) {
    await store.saveSetting(chatId, WCW_KEY, data);
}
function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function mention(jid) {
    return `@${(jid || '').split('@')[0]}`;
}

export default {
    command: 'wcw',
    aliases: ['womencrush', 'crushwednesday'],
    category: 'games',
    description: 'Women Crush Wednesday',
    usage: '.wcw | .wcw shot @lady | .wcw accept/reject/switch',
    groupOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo } = context;

        const allowed = await isGameAllowed(chatId, 'wcw');
        if (!allowed.ok) {
            return sock.sendMessage(chatId, { text: allowed.msg, ...channelInfo }, { quoted: message });
        }

        const data = await getWcwData(chatId);
        const action = (args[0] || '').toLowerCase();

        if (!action) {
            return sock.sendMessage(chatId, {
                text: `*Women Crush Wednesday* 💕\n\n1. Ladies post picture + name + location\n2. Guys: *.wcw shot @lady*\n3. Lady: *.wcw accept* / *.wcw switch* / *.wcw reject*\n\nReject = hard View Once instruction.`,
                ...channelInfo
            }, { quoted: message });
        }

        if (action === 'shot') {
            const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (!mentioned.length) {
                return sock.sendMessage(chatId, { text: `Tag the lady: *.wcw shot @lady*`, ...channelInfo }, { quoted: message });
            }
            const ladyId = mentioned[0];
            if (ladyId === senderId) {
                return sock.sendMessage(chatId, { text: `Cannot shoot at yourself.`, ...channelInfo }, { quoted: message });
            }
            const shotId = `${senderId}_${ladyId}_${Date.now()}`;
            data.shots[shotId] = { guy: senderId, lady: ladyId, status: 'pending', at: Date.now() };
            await saveWcwData(chatId, data);
            return sock.sendMessage(chatId, {
                text: `💘 *Shot Fired!*\n\n${mention(senderId)} → ${mention(ladyId)}\n\n${mention(ladyId)}: *.wcw accept* / *.wcw switch* / *.wcw reject*`,
                mentions: [senderId, ladyId], ...channelInfo
            }, { quoted: message });
        }

        if (['accept', 'reject', 'switch'].includes(action)) {
            const pendingShots = Object.entries(data.shots)
                .filter(([_, s]) => s.lady === senderId && s.status === 'pending')
                .sort((a, b) => b[1].at - a[1].at);
            if (!pendingShots.length) {
                return sock.sendMessage(chatId, { text: `No pending shots.`, ...channelInfo }, { quoted: message });
            }
            const [shotId, shot] = pendingShots[0];
            const guyId = shot.guy;

            if (action === 'accept') {
                shot.status = 'accepted';
                await saveWcwData(chatId, data);
                return sock.sendMessage(chatId, {
                    text: `✅ *Accepted!*\n\n${mention(senderId)} accepted ${mention(guyId)}.`,
                    mentions: [senderId, guyId], ...channelInfo
                }, { quoted: message });
            }
            if (action === 'switch') {
                shot.status = 'switched';
                await saveWcwData(chatId, data);
                return sock.sendMessage(chatId, {
                    text: `🔄 *Switched!*\n\n${mention(senderId)} offers the other option to ${mention(guyId)}.`,
                    mentions: [senderId, guyId], ...channelInfo
                }, { quoted: message });
            }
            if (action === 'reject') {
                shot.status = 'rejected';
                await saveWcwData(chatId, data);
                const instruction = getRandom(rejectionInstructions);
                return sock.sendMessage(chatId, {
                    text: `❌ *Rejected!*\n\n${mention(guyId)}, your punishment:\n\n${instruction}\n\nSend as *View Once*.`,
                    mentions: [senderId, guyId], ...channelInfo
                }, { quoted: message });
            }
        }

        await sock.sendMessage(chatId, {
            text: `Use: .wcw | .wcw shot @lady | .wcw accept/reject/switch`,
            ...channelInfo
        }, { quoted: message });
    }
};

import store from '../lib/lightweight_store.js';
import { rejectionInstructions } from '../data/wcwRejections.js';

/**
 * Women Crush Wednesday (WCW) System
 *
 * Flow:
 * 1. Lady posts (we track her as a featured lady for the day)
 * 2. Guy shoots his shot (5 minute window conceptually)
 * 3. Lady chooses: Accept / Switch / Reject
 * 4. On Reject → Bot gives a hard View Once instruction
 */

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
    description: 'Women Crush Wednesday system',
    usage: '.wcw | .wcw shot @lady | .wcw accept/reject/switch',
    groupOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo } = context;
        const data = await getWcwData(chatId);
        const action = (args[0] || '').toLowerCase();

        // Help / status
        if (!action) {
            return sock.sendMessage(chatId, {
                text: `*Women Crush Wednesday* 💕\n\n*How it works:*\n1. Ladies post their picture + name + location\n2. Guys shoot their shot with:\n   *.wcw shot @lady*\n3. The lady then replies with:\n   • *.wcw accept*\n   • *.wcw switch*  (offer the other option)\n   • *.wcw reject*\n\nOn reject, the guy receives a hard View Once instruction.`,
                ...channelInfo
            }, { quoted: message });
        }

        // Guy shoots his shot
        if (action === 'shot') {
            const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentioned.length === 0) {
                return sock.sendMessage(chatId, {
                    text: `Tag the lady you want to shoot your shot at.\nExample: *.wcw shot @lady*`,
                    ...channelInfo
                }, { quoted: message });
            }

            const ladyId = mentioned[0];

            if (ladyId === senderId) {
                return sock.sendMessage(chatId, {
                    text: `You cannot shoot your shot at yourself.`,
                    ...channelInfo
                }, { quoted: message });
            }

            // Record the shot
            const shotId = `${senderId}_${ladyId}_${Date.now()}`;
            data.shots[shotId] = {
                guy: senderId,
                lady: ladyId,
                status: 'pending',
                at: Date.now()
            };
            await saveWcwData(chatId, data);

            return sock.sendMessage(chatId, {
                text: `💘 *Shot Fired!*\n\n${mention(senderId)} has shot his shot at ${mention(ladyId)}!\n\n${mention(ladyId)}, you have 3 options:\n\n• *.wcw accept*\n• *.wcw switch* (offer Relationship ↔ Sneaky link)\n• *.wcw reject*\n\nReply with one of the above.`,
                mentions: [senderId, ladyId],
                ...channelInfo
            }, { quoted: message });
        }

        // Lady responds
        if (['accept', 'reject', 'switch'].includes(action)) {
            // Find the most recent pending shot where this sender is the lady
            const pendingShots = Object.entries(data.shots)
                .filter(([_, s]) => s.lady === senderId && s.status === 'pending')
                .sort((a, b) => b[1].at - a[1].at);

            if (pendingShots.length === 0) {
                return sock.sendMessage(chatId, {
                    text: `You have no pending shots to respond to.`,
                    ...channelInfo
                }, { quoted: message });
            }

            const [shotId, shot] = pendingShots[0];
            const guyId = shot.guy;

            if (action === 'accept') {
                shot.status = 'accepted';
                await saveWcwData(chatId, data);

                return sock.sendMessage(chatId, {
                    text: `✅ *Accepted!*\n\n${mention(senderId)} has accepted ${mention(guyId)}'s shot.\n\nYou two can take it to DM or continue here 🔥`,
                    mentions: [senderId, guyId],
                    ...channelInfo
                }, { quoted: message });
            }

            if (action === 'switch') {
                shot.status = 'switched';
                await saveWcwData(chatId, data);

                return sock.sendMessage(chatId, {
                    text: `🔄 *Option Switched!*\n\n${mention(senderId)} is offering the other option to ${mention(guyId)}.\n\n(Relationship ↔ Sneaky link)\n\nDiscuss and decide.`,
                    mentions: [senderId, guyId],
                    ...channelInfo
                }, { quoted: message });
            }

            if (action === 'reject') {
                shot.status = 'rejected';
                await saveWcwData(chatId, data);

                const instruction = getRandom(rejectionInstructions);

                return sock.sendMessage(chatId, {
                    text: `❌ *Rejected!*\n\n${mention(senderId)} has rejected ${mention(guyId)}.\n\n*${mention(guyId)}, your punishment:*\n\n${instruction}\n\nSend it as *View Once*.`,
                    mentions: [senderId, guyId],
                    ...channelInfo
                }, { quoted: message });
            }
        }

        // Unknown action
        await sock.sendMessage(chatId, {
            text: `Unknown action. Use:\n• *.wcw* for help\n• *.wcw shot @lady*\n• *.wcw accept / reject / switch*`,
            ...channelInfo
        }, { quoted: message });
    }
};

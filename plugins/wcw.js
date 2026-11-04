import store from '../lib/lightweight_store.js';
import { rejectionInstructions } from '../data/wcwRejections.js';
import { isGameAllowed } from './daylock.js';

const WCW_KEY = 'wcwData';

async function getWcwData(chatId) {
    const stored = await store.getSetting(chatId, WCW_KEY);
    return {
        ladies: stored?.ladies && typeof stored.ladies === 'object' ? stored.ladies : {},
        shots: stored?.shots && typeof stored.shots === 'object' ? stored.shots : {}
    };
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

/**
 * Baileys v7 can expose the same participant as either a phone-number JID
 * or a LID. Resolve both forms and retain both aliases so a shot created
 * from a mention can be answered by the same member regardless of which
 * identity form WhatsApp supplies on their reply.
 */
async function getJidAliases(sock, jid) {
    if (typeof jid !== 'string' || !jid) return [];
    const aliases = new Set([jid]);
    const at = jid.lastIndexOf('@');
    if (at > 0) {
        const user = jid.slice(0, at).split(':')[0];
        const server = jid.slice(at + 1);
        if (server === 's.whatsapp.net' || server === 'lid') {
            aliases.add(`${user}@${server}`);
        }
    }

    const normalized = Array.from(aliases)[1] || jid;
    try {
        if (normalized.endsWith('@lid')) {
            const pn = await sock.signalRepository?.lidMapping?.getPNForLID?.(normalized);
            if (typeof pn === 'string' && pn.endsWith('@s.whatsapp.net')) {
                aliases.add(pn);
                aliases.add(`${pn.split('@')[0].split(':')[0]}@s.whatsapp.net`);
            }
        } else if (normalized.endsWith('@s.whatsapp.net')) {
            const lid = await sock.signalRepository?.lidMapping?.getLIDForPN?.(normalized);
            if (typeof lid === 'string' && lid.endsWith('@lid')) {
                aliases.add(lid);
                aliases.add(`${lid.split('@')[0].split(':')[0]}@lid`);
            }
        }
    } catch {
        // Keep the original JID aliases; matching still works when no mapping exists.
    }
    return Array.from(aliases);
}

export default {
    command: 'wcw',
    aliases: ['womencrush', 'crushwednesday'],
    category: 'games',
    description: 'Women Crush Wednesday',
    usage: '.wcw | .wcw shot @lady | .wcw accept/switch | .wcw reject @member',
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
            const ladyAliases = await getJidAliases(sock, ladyId);
            const senderAliases = new Set(await getJidAliases(sock, senderId));
            if (ladyAliases.some(id => senderAliases.has(id))) {
                return sock.sendMessage(chatId, { text: `Cannot shoot at yourself.`, ...channelInfo }, { quoted: message });
            }

            const shotId = `${senderId}_${ladyId}_${Date.now()}`;
            const ladyIds = await getJidAliases(sock, ladyId);
            const guyIds = await getJidAliases(sock, senderId);
            data.shots[shotId] = {
                guy: senderId,
                guyIds,
                lady: ladyIds.find(id => id.endsWith('@s.whatsapp.net')) || ladyId,
                ladyIds,
                status: 'pending',
                at: Date.now()
            };
            await saveWcwData(chatId, data);
            return sock.sendMessage(chatId, {
                text: `💘 *Shot Fired!*\n\n${mention(senderId)} → ${mention(ladyId)}\n\n${mention(ladyId)}: *.wcw accept* / *.wcw switch* / *.wcw reject*`,
                mentions: [senderId, ladyId], ...channelInfo
            }, { quoted: message });
        }

        if (['accept', 'reject', 'switch'].includes(action)) {
            const senderIds = new Set(await getJidAliases(sock, senderId));
            const pendingShots = Object.entries(data.shots)
                .filter(([_, shot]) => {
                    if (shot.status !== 'pending') return false;
                    const targetIds = new Set([
                        ...(Array.isArray(shot.ladyIds) ? shot.ladyIds : []),
                        shot.lady
                    ].filter(Boolean));
                    return Array.from(senderIds).some(id => targetIds.has(id));
                })
                .sort((a, b) => b[1].at - a[1].at);

            if (!pendingShots.length) {
                return sock.sendMessage(chatId, { text: `No pending shots.`, ...channelInfo }, { quoted: message });
            }

            // Optional targeted response: .wcw reject @member
            // Match against the shooter's saved PN/LID aliases, while keeping
            // legacy pending records (which may only contain "guy") usable.
            let selectedShots = pendingShots;
            if (action === 'reject') {
                const mentionedShooters = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                if (mentionedShooters.length) {
                    const targetAliases = new Set();
                    for (const mentionedJid of mentionedShooters) {
                        for (const alias of await getJidAliases(sock, mentionedJid)) targetAliases.add(alias);
                    }

                    selectedShots = [];
                    for (const entry of pendingShots) {
                        const pendingShot = entry[1];
                        const shooterAliases = new Set([
                            ...(Array.isArray(pendingShot.guyIds) ? pendingShot.guyIds : []),
                            pendingShot.guy,
                            ...await getJidAliases(sock, pendingShot.guy)
                        ].filter(Boolean));
                        if (Array.from(targetAliases).some(id => shooterAliases.has(id))) {
                            selectedShots.push(entry);
                        }
                    }

                    if (!selectedShots.length) {
                        return sock.sendMessage(chatId, {
                            text: `No pending shot from the tagged member. Their shot was not changed.`,
                            ...channelInfo
                        }, { quoted: message });
                    }
                } else if (pendingShots.length > 1) {
                    return sock.sendMessage(chatId, {
                        text: `You have multiple pending shots. Tag the person you want to reject: *.wcw reject @member*`,
                        ...channelInfo
                    }, { quoted: message });
                }
            }

            const [shotId, shot] = selectedShots[0];
            const guyId = shot.guy;

            if (action === 'accept') {
                shot.status = 'accepted';
                shot.respondedAt = Date.now();
                await saveWcwData(chatId, data);
                return sock.sendMessage(chatId, {
                    text: `✅ *Accepted!*\n\n${mention(senderId)} accepted ${mention(guyId)}.`,
                    mentions: [senderId, guyId], ...channelInfo
                }, { quoted: message });
            }
            if (action === 'switch') {
                shot.status = 'switched';
                shot.respondedAt = Date.now();
                await saveWcwData(chatId, data);
                return sock.sendMessage(chatId, {
                    text: `🔄 *Switched!*\n\n${mention(senderId)} offers the other option to ${mention(guyId)}.`,
                    mentions: [senderId, guyId], ...channelInfo
                }, { quoted: message });
            }
            if (action === 'reject') {
                shot.status = 'rejected';
                shot.respondedAt = Date.now();
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

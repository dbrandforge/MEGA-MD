import config from '../config.js';
import store from './lightweight_store.js';
import commandHandler from './commandHandler.js';
import { printMessage, printLog } from './print.js';
import { isBanned } from './isBanned.js';
import isOwnerOrSudo, { isOwnerOnly } from './isOwner.js';
import isAdmin from './isAdmin.js';
import { handleAutoread } from '../plugins/autoread.js';
import { handleAutotypingForMessage, showTypingAfterCommand } from '../plugins/autotyping.js';
import { storeMessage, handleMessageRevocation } from '../plugins/antidelete.js';
import { handleBadwordDetection } from './antibadword.js';
import { handleLinkDetection } from '../plugins/antilink.js';
import { handleTagDetection } from '../plugins/antitag.js';
import { handleMentionDetection } from '../plugins/mention.js';
import { handleChatbotResponse } from '../plugins/chatbot.js';
import { handleTicTacToeMove } from '../plugins/tictactoe.js';
import { handleAutoReply } from '../plugins/autoreply.js';
import { handleAntiSpam, invalidateGroupCache } from '../plugins/antispam.js';
import anticall from '../plugins/anticall.js';
import { startSchedulerEngine } from '../plugins/schedule.js';
import { addCommandReaction } from './reactions.js';
import { channelInfo } from './messageConfig.js';
import { processGroupParticipantsUpdate, markMemberIntroduced } from '../plugins/sincity-welcome.js';
import { handleTruthDareContinue } from '../plugins/truth-continue.js';
import { handleSoftMuteMessage } from '../plugins/softmute.js';
import { handleHotSeatAnswer, trackHotSeatReader } from '../plugins/hotseat.js';
import { handleWyrContinuity } from '../plugins/wyr.js';
import { handleTriviaContinuity } from '../plugins/trivia.js';
import { handleTodReply } from '../plugins/tod.js';
import { handleMathContinuity } from '../plugins/math.js';
import { handleBasketContinuity } from '../plugins/basket.js';

function getLagosWeekKey(date = new Date()) {
    const local = new Date(date.getTime() + 60 * 60 * 1000);
    const day = local.getUTCDay() || 7;
    local.setUTCDate(local.getUTCDate() + 4 - day);
    const year = local.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil((((local - yearStart) / 86400000) + 1) / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
}

let schedulerStarted = false;

// Commands forced admin-only even if plugin forgot adminOnly flag
const FORCE_ADMIN_COMMANDS = new Set([
    'sticker', 's', 'stickers', 'ssticker', 'stickersearch',
    'take', 'steal', 'wm', 'emojimix', 'mixemoji', 'emix'
]);

export async function handleGroupParticipantUpdate(sock, update) {
    try {
        global.__forgeSock = sock;
        if (update?.id) invalidateGroupCache(update.id);
        await processGroupParticipantsUpdate(sock, update);
    } catch (e) {
        printLog('error', `Group participant update error: ${e.message}`);
    }
}

export async function handleStatus() {}

export async function handleCall(sock, calls = []) {
    try {
        const state = await anticall.readState();
        if (!Array.isArray(calls)) return;
        for (const call of calls) {
            const caller = call?.from;
            const callId = call?.id;
            if (!caller || !callId || isOwnerOnly(caller) || !anticall.shouldBlockCaller(state, caller)) continue;
            try {
                await sock.sendMessage(caller, {
                    text: '📵 *Anticall is enabled.* Incoming calls are automatically rejected and blocked. Please message the bot instead.'
                });
                await sock.rejectCall(callId, caller);
                await sock.updateBlockStatus(caller, 'block');
            } catch (error) {
                printLog('error', `Anticall handling failed: ${error.message}`);
            }
        }
    } catch (error) {
        printLog('error', `Anticall state could not be read: ${error.message}`);
    }
}

async function handleMessages(sock, messageUpdate) {
    try {
        global.__forgeSock = sock;

        const { messages, type } = messageUpdate;
        if (type !== 'notify') return;
        const message = messages[0];
        if (!message?.message) return;

        printMessage(message, sock).catch(() => {});
        handleAutoread(sock, message).catch(() => {});

        let chatId = message.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        const isSticker = Boolean(message.message?.stickerMessage);

        if (message.message?.protocolMessage?.type === 0) {
            await handleMessageRevocation(sock, message);
            return;
        }

        if (message.pushName && sock.store?.contacts) {
            const pid = message.key.participant || message.key.remoteJid;
            if (pid) {
                sock.store.contacts[pid] = {
                    ...sock.store.contacts[pid],
                    id: pid,
                    notify: message.pushName,
                    name: message.pushName
                };
            }
        }

        const rawSenderId = message.key.participant || message.key.remoteJid;
        let senderId = rawSenderId;

        if (rawSenderId?.includes('@lid')) {
            // Baileys v7 may include the alternate PN directly on the message key.
            // Prefer it, then consult the live Signal LID mapping, then contacts.
            const alternatePN = isGroup ? message.key.participantAlt : message.key.remoteJidAlt;
            if (typeof alternatePN === 'string' && alternatePN.endsWith('@s.whatsapp.net')) {
                senderId = alternatePN;
            }

            if (senderId === rawSenderId) {
                try {
                    const mappedPN = await sock.signalRepository?.lidMapping?.getPNForLID?.(rawSenderId);
                    if (typeof mappedPN === 'string' && mappedPN.endsWith('@s.whatsapp.net')) {
                        senderId = mappedPN;
                    }
                } catch (error) {
                    printLog('warn', `Could not resolve sender LID through Baileys mapping: ${error.message}`);
                }
            }

            // Older contacts stores may contain a usable PN mapping; retain it as fallback.
            if (senderId === rawSenderId && sock.store?.contacts) {
                const contacts = sock.store.contacts;
                const resolved = Object.keys(contacts).find(k =>
                    k.endsWith('@s.whatsapp.net') &&
                    (contacts[k]?.lid === rawSenderId ||
                     contacts[k]?.lid?.split(':')[0] === rawSenderId.split('@')[0])
                );
                if (resolved) senderId = resolved;
            }

            // Keep the original LID as the actual DM destination in Baileys v7.
            // Use the resolved PN only for identity, ownership, bans and permission checks.
            // Rewriting remoteJid to a PN can route replies away from the LID-addressed chat.
            if (!isGroup && senderId !== rawSenderId && senderId.endsWith('@s.whatsapp.net')) {
                printLog('info', 'Resolved private LID for identity checks; retaining LID reply destination');
            } else if (!isGroup) {
                printLog('warn', 'Private message arrived with LID but no PN alternate/mapping was available');
            }
        }

        // Start the scheduler on the first received message and refresh its socket.
        if (!schedulerStarted) {
            schedulerStarted = true;
            try { startSchedulerEngine(sock); } catch {}
        }

        // Enforce individual soft mutes before counters, intro tracking, game flows,
        // prefixless triggers, or command routing can process the muted member's text.
        if (isGroup && !message.key.fromMe) {
            try {
                if (await handleSoftMuteMessage(sock, chatId, message, senderId)) return;
            } catch {}
        }

        // Do not retain muted messages in the anti-delete cache.
        storeMessage(sock, message).catch(() => {});

        if (isGroup && !message.key.fromMe) {
            // Track recent non-admin activity for the Hot Seat reader pool.
            // The tracker throttles persistence to one write per member/minute.
            try { await trackHotSeatReader(chatId, senderId); } catch {}
        }

        if (isGroup && !message.key.fromMe && !isSticker) {
            const weekKey = getLagosWeekKey();
            store.incrementWeeklyMessageCount(chatId, senderId, weekKey).catch(() => {});
        }

        if (isGroup && !message.key.fromMe) {
            markMemberIntroduced(chatId, senderId).catch(() => {});
        }

        const rawText = message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.imageMessage?.caption ||
            message.message?.videoMessage?.caption ||
            message.message?.buttonsResponseMessage?.selectedButtonId ||
            '';
        const messageText = rawText.trim();
        const userMessage = messageText.toLowerCase();

        // Hot Seat: any message from the active player is their answer.
        if (isGroup && !message.key.fromMe) {
            try {
                const advanced = await handleHotSeatAnswer(sock, chatId, message, senderId);
                if (advanced) return;
            } catch (error) {
                printLog('error', 'Hot Seat answer handling failed: ' + error.message);
            }
        }

        if (!message.key.fromMe && isGroup) {
            try {
                if (await handleTruthDareContinue(sock, chatId, message, messageText, senderId)) return;
            } catch {}
        }

        if (!message.key.fromMe && isGroup) {
            try {
                if (await handleWyrContinuity(sock, chatId, message, senderId)) return;
                if (await handleMathContinuity(sock, chatId, message, senderId)) return;
                if (await handleTriviaContinuity(sock, chatId, message, senderId)) return;
                if (await handleTodReply(sock, chatId, senderId, messageText, message)) return;
                if (await handleBasketContinuity(sock, chatId, message, senderId)) return;
            } catch (error) {
                printLog('error', 'Question-game continuity failed: ' + error.message);
            }
        }

        // Game replies take priority over the generic "bot" greeting so an
        // active player can answer a prompt even when their answer contains "bot".
        if (isGroup && !message.key.fromMe && /\bbot\b/i.test(messageText)) {
            await handleChatbotResponse(sock, chatId, message, userMessage, senderId, { forceReply: true });
            return;
        }

        if (!message.key.fromMe) {
            try {
                if (await handleAutoReply(sock, chatId, message, userMessage)) return;
            } catch {}
        }

        const senderIsOwnerOrSudo = await isOwnerOrSudo(senderId, sock, chatId);
        const isOwnerOrSudoCheck = message.key.fromMe || senderIsOwnerOrSudo;
        // Only the configured creator/owner or the bot itself bypasses group-admin checks.
        // Sudo users retain their existing owner-or-sudo privileges, but not creator-level admin bypass.
        const isCreatorOrBot = message.key.fromMe || isOwnerOnly(senderId);

        if (!isOwnerOrSudoCheck) {
            const userBanned = await isBanned(senderId);
            if (userBanned && !userMessage.startsWith('.unban')) return;
        }

        if (/^[1-9]$/.test(userMessage) || userMessage === 'surrender') {
            await handleTicTacToeMove(sock, chatId, senderId, userMessage);
            return;
        }

        if (!message.key.fromMe) {
            store.incrementMessageCount(chatId, senderId, message.pushName).catch(() => {});
        }

        if (isGroup && userMessage && !message.key.fromMe) {
            handleBadwordDetection(sock, chatId, message, userMessage, senderId).catch(() => {});
            handleLinkDetection(sock, chatId, message, userMessage, senderId).catch(() => {});
            try {
                if (await handleAntiSpam(sock, chatId, message, senderId, senderIsOwnerOrSudo)) return;
            } catch {}
        }

        const usedPrefix = config.prefixes?.find(p => userMessage.startsWith(p));
        const command = commandHandler.getCommand(userMessage, config.prefixes);
        if (!isGroup && messageText.startsWith('.')) {
            printLog('info', `Private command routing: prefix=${Boolean(usedPrefix)} matched=${Boolean(command)} botMode=${await store.getBotMode().catch(() => 'unknown')} senderResolved=${senderId !== rawSenderId}`);
        }

        if (!usedPrefix && !command) {
            if (!message.key.fromMe) {
                if (isGroup) {
                    handleTagDetection(sock, chatId, message, senderId).catch(() => {});
                    handleMentionDetection(sock, chatId, message).catch(() => {});
                }
                const botMode = await store.getBotMode().catch(() => 'public');
                const canChat = isGroup
                    ? (botMode === 'public' || botMode === 'groups' || isOwnerOrSudoCheck)
                    : (botMode === 'public' || botMode === 'inbox' || isOwnerOrSudoCheck);
                if (canChat) handleChatbotResponse(sock, chatId, message, userMessage, senderId).catch(() => {});
            }
            return;
        }
        if (!command) return;

        const botMode = await store.getBotMode().catch(() => 'public');
        const isAllowed = (() => {
            if (isOwnerOrSudoCheck) return true;
            switch (botMode) {
                case 'public': return true;
                case 'private':
                case 'self': return false;
                case 'groups': return isGroup;
                case 'inbox': return !isGroup;
                default: return true;
            }
        })();
        if (!isAllowed) return;

        let args;
        if (usedPrefix) {
            args = messageText.slice(usedPrefix.length).trim().split(/\s+/).slice(1);
        } else {
            args = messageText.trim().split(/\s+/).slice(1);
        }

        let isSenderAdmin = false;
        let isBotAdmin = false;

        const needsAdmin =
            command.adminOnly ||
            FORCE_ADMIN_COMMANDS.has(command.command) ||
            (command.aliases || []).some(a => FORCE_ADMIN_COMMANDS.has(a));

        if (needsAdmin && !isGroup && !isOwnerOrSudoCheck) {
            return sock.sendMessage(chatId, {
                text: 'ℹ️ This command requires an authorized group admin and cannot be used from a private chat.',
                ...channelInfo
            }, { quoted: message });
        }

        if (needsAdmin && isGroup) {
            const adminStatus = await isAdmin(sock, chatId, senderId);
            isSenderAdmin = adminStatus.isSenderAdmin;
            isBotAdmin = adminStatus.isBotAdmin;
            if (!isBotAdmin && !isCreatorOrBot) {
                return sock.sendMessage(chatId, {
                    text: 'ℹ️ Make the bot an admin first. The creator/bot account can still manage settings that do not require WhatsApp admin actions.',
                    ...channelInfo
                }, { quoted: message });
            }
            if (!isSenderAdmin && !isCreatorOrBot && !senderIsOwnerOrSudo) {
                return sock.sendMessage(chatId, {
                    text: 'ℹ️ Admins only.',
                    ...channelInfo
                }, { quoted: message });
            }
        }

        if (command.groupOnly && !isGroup) {
            return sock.sendMessage(chatId, {
                text: 'ℹ️ Groups only.',
                ...channelInfo
            }, { quoted: message });
        }

        // Enforce plugin-declared owner permissions centrally; metadata is not merely descriptive.
        if (command.strictOwnerOnly && !message.key.fromMe && !isOwnerOnly(senderId)) {
            return sock.sendMessage(chatId, {
                text: '⛔ This command is restricted to the bot owner.',
                ...channelInfo
            }, { quoted: message });
        }
        if (command.ownerOnly && !message.key.fromMe && !isOwnerOrSudoCheck) {
            return sock.sendMessage(chatId, {
                text: '⛔ This command is restricted to the bot owner and authorized sudo users.',
                ...channelInfo
            }, { quoted: message });
        }

        const context = {
            chatId, senderId, isGroup, isSenderAdmin, isBotAdmin,
            senderIsOwnerOrSudo, isOwnerOrSudoCheck, isCreatorOrBot, channelInfo,
            rawText: messageText, userMessage, messageText, config
        };

        try {
            await command.handler(sock, message, args, context);
            addCommandReaction(sock, message).catch(() => {});
            showTypingAfterCommand(sock, chatId).catch(() => {});
        } catch (error) {
            printLog('error', `Command error: ${error.message}`);
            await sock.sendMessage(chatId, {
                text: `❌ ${error.message}`,
                ...channelInfo
            }, { quoted: message });
        }
    } catch (err) {
        printLog('error', `handleMessages: ${err.message}`);
    }
}

export { handleMessages };

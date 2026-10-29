import config from '../config.js';
import store from './lightweight_store.js';
import commandHandler from './commandHandler.js';
import { printMessage, printLog } from './print.js';
import { isBanned } from './isBanned.js';
import isOwnerOrSudo from './isOwner.js';
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
import { handleAntiSpam } from '../plugins/antispam.js';
import { startSchedulerEngine } from '../plugins/schedule.js';
import { addCommandReaction } from './reactions.js';
import { channelInfo } from './messageConfig.js';
import { processGroupParticipantsUpdate } from '../plugins/sincity-welcome.js';
import { handleTruthDareContinue } from '../plugins/truth-continue.js';
import { handleSoftMuteMessage } from '../plugins/softmute.js';

let schedulerStarted = false;

export async function handleGroupParticipantUpdate(sock, update) {
    try {
        await processGroupParticipantsUpdate(sock, update);
    } catch (e) {
        printLog('error', `Group participant update error: ${e.message}`);
    }
}

export async function handleStatus() {}
export async function handleCall() {}

async function handleMessages(sock, messageUpdate) {
    try {
        const { messages, type } = messageUpdate;
        if (type !== 'notify') return;
        const message = messages[0];
        if (!message?.message) return;

        // Fire-and-forget light tasks (don't block command response)
        printMessage(message, sock).catch(() => {});
        handleAutoread(sock, message).catch(() => {});

        const chatId = message.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');

        if (message.message?.protocolMessage?.type === 0) {
            await handleMessageRevocation(sock, message);
            return;
        }

        // Store message in background
        storeMessage(sock, message).catch(() => {});

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

        if (rawSenderId?.includes('@lid') && sock.store?.contacts) {
            const contacts = sock.store.contacts;
            const resolved = Object.keys(contacts).find(k =>
                contacts[k]?.lid === rawSenderId ||
                contacts[k]?.lid?.split(':')[0] === rawSenderId.split('@')[0]
            );
            if (resolved?.includes('@s.whatsapp.net')) senderId = resolved;
        }

        const rawText = message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.imageMessage?.caption ||
            message.message?.videoMessage?.caption ||
            message.message?.buttonsResponseMessage?.selectedButtonId ||
            '';
        const messageText = rawText.trim();
        const userMessage = messageText.toLowerCase();

        // Start scheduler once, not every message
        if (!schedulerStarted) {
            schedulerStarted = true;
            try { startSchedulerEngine(sock); } catch {}
        }

        // Soft mute (fast path)
        if (isGroup && !message.key.fromMe) {
            try {
                if (await handleSoftMuteMessage(sock, chatId, message, senderId)) return;
            } catch {}
        }

        // TOD continue (only if reply)
        if (!message.key.fromMe && isGroup && message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            try {
                if (await handleTruthDareContinue(sock, chatId, message, messageText, senderId)) return;
            } catch {}
        }

        if (!message.key.fromMe) {
            try {
                if (await handleAutoReply(sock, chatId, message, userMessage)) return;
            } catch {}
        }

        const senderIsOwnerOrSudo = await isOwnerOrSudo(senderId, sock, chatId);
        const isOwnerOrSudoCheck = message.key.fromMe || senderIsOwnerOrSudo;

        // Ban check only if needed
        if (!isOwnerOrSudoCheck) {
            const userBanned = await isBanned(senderId);
            if (userBanned && !userMessage.startsWith('.unban')) return;
        }

        if (/^[1-9]$/.test(userMessage) || userMessage === 'surrender') {
            await handleTicTacToeMove(sock, chatId, senderId, userMessage);
            return;
        }

        // Background count — don't await
        if (!message.key.fromMe) {
            store.incrementMessageCount(chatId, senderId, message.pushName).catch(() => {});
        }

        // Group moderation — only if there is text
        if (isGroup && userMessage && !message.key.fromMe) {
            handleBadwordDetection(sock, chatId, message, userMessage, senderId).catch(() => {});
            handleLinkDetection(sock, chatId, message, userMessage, senderId).catch(() => {});
            try {
                if (await handleAntiSpam(sock, chatId, message, senderId, senderIsOwnerOrSudo)) return;
            } catch {}
        }

        const usedPrefix = config.prefixes?.find(p => userMessage.startsWith(p));
        const command = commandHandler.getCommand(userMessage, config.prefixes);

        // No command — chatbot / tags only
        if (!usedPrefix && !command) {
            if (isGroup && !message.key.fromMe) {
                handleTagDetection(sock, chatId, message, senderId).catch(() => {});
                handleMentionDetection(sock, chatId, message).catch(() => {});
                // Chatbot only when mentioned/replied (handler checks internally)
                const botMode = await store.getBotMode().catch(() => 'public');
                const canChat = botMode === 'public' || botMode === 'groups' || isOwnerOrSudoCheck;
                if (canChat) {
                    handleChatbotResponse(sock, chatId, message, userMessage, senderId).catch(() => {});
                }
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

        if (command.adminOnly && isGroup) {
            const adminStatus = await isAdmin(sock, chatId, senderId);
            isSenderAdmin = adminStatus.isSenderAdmin;
            isBotAdmin = adminStatus.isBotAdmin;
            if (!isBotAdmin) {
                return sock.sendMessage(chatId, {
                    text: 'ℹ️ Make the bot an admin first.',
                    ...channelInfo
                }, { quoted: message });
            }
            if (!isSenderAdmin && !message.key.fromMe && !senderIsOwnerOrSudo) {
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

        const context = {
            chatId, senderId, isGroup, isSenderAdmin, isBotAdmin,
            senderIsOwnerOrSudo, isOwnerOrSudoCheck, channelInfo,
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

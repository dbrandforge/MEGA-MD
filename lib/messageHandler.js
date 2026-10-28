import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import fs from 'fs';
import { dataFile } from './paths.js';
import config from '../config.js';
import store from './lightweight_store.js';
import commandHandler from './commandHandler.js';
import { printMessage, printLog } from './print.js';
import { isBanned } from './isBanned.js';
import { isSudo } from './index.js';
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
import { handleAntiSpam, invalidateGroupCache } from '../plugins/antispam.js';
import { startSchedulerEngine } from '../plugins/schedule.js';
import { addCommandReaction } from './reactions.js';
import { writeErrorLog } from './logger.js';
import { channelInfo } from './messageConfig.js';

// Sin City Welcome
import { processGroupParticipantsUpdate } from '../plugins/sincity-welcome.js';

const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);
const STICKER_FILE = dataFile('sticker_commands.json');

async function getStickerCommands() {
    if (HAS_DB) {
        const data = await store.getSetting('global', 'stickerCommands');
        return data || {};
    } else {
        try {
            if (!fs.existsSync(STICKER_FILE)) return {};
            return JSON.parse(fs.readFileSync(STICKER_FILE, 'utf8'));
        } catch {
            return {};
        }
    }
}

/**
 * Handle group participant updates (join/leave)
 * This is called from index.js on 'group-participants.update'
 */
export async function handleGroupParticipantUpdate(sock, update) {
    try {
        // Run Sin City automatic welcome
        await processGroupParticipantsUpdate(sock, update);
    } catch (e) {
        printLog('error', `Group participant update error: ${e.message}`);
    }
}

export async function handleStatus(sock, chatUpdate) {
    // Keep existing status handling if any
}

export async function handleCall(sock, call) {
    // Keep existing call handling if any
}

async function handleMessages(sock, messageUpdate) {
    try {
        const { messages, type } = messageUpdate;
        if (type !== 'notify') return;
        const message = messages[0];
        if (!message?.message) return;

        await printMessage(message, sock);

        try {
            const ghostMode = await store.getSetting('global', 'stealthMode');
            if (!ghostMode || !ghostMode.enabled) {
                await handleAutoread(sock, message);
            }
        } catch (err) {
            await handleAutoread(sock, message);
        }

        const chatId = message.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');

        if (message.message?.protocolMessage?.type === 0) {
            await handleMessageRevocation(sock, message);
            return;
        }

        await storeMessage(sock, message);

        // Store pushName
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

        startSchedulerEngine(sock);

        // Track group for lock schedule
        try {
            const { trackGroup } = await import('../plugins/schedule.js');
            trackGroup(chatId);
        } catch (e) {}

        if (!message.key.fromMe) {
            const replied = await handleAutoReply(sock, chatId, message, userMessage);
            if (replied) return;
        }

        const senderIsOwnerOrSudo = await isOwnerOrSudo(senderId, sock, chatId);
        const isOwnerOrSudoCheck = message.key.fromMe || senderIsOwnerOrSudo;

        const userBanned = await isBanned(senderId);
        if (userBanned && !userMessage.startsWith('.unban')) {
            return;
        }

        if (/^[1-9]$/.test(userMessage) || userMessage === 'surrender') {
            await handleTicTacToeMove(sock, chatId, senderId, userMessage);
            return;
        }

        if (!message.key.fromMe) {
            await store.incrementMessageCount(chatId, senderId, message.pushName);
        }

        if (isGroup) {
            if (userMessage) {
                await handleBadwordDetection(sock, chatId, message, userMessage, senderId);
            }
            await handleLinkDetection(sock, chatId, message, userMessage, senderId);
        }

        if (isGroup && !message.key.fromMe) {
            const spammed = await handleAntiSpam(sock, chatId, message, senderId, senderIsOwnerOrSudo);
            if (spammed) return;
        }

        const usedPrefix = config.prefixes?.find(p => userMessage.startsWith(p));
        const command = commandHandler.getCommand(userMessage, config.prefixes);

        if (!usedPrefix && !command) {
            await handleAutotypingForMessage(sock, chatId, userMessage);
            if (isGroup) {
                await handleTagDetection(sock, chatId, message, senderId);
                await handleMentionDetection(sock, chatId, message);
                const botMode = await store.getBotMode();
                const canUseChatbot = botMode === 'public' ||
                    (botMode === 'groups' && isGroup) ||
                    (botMode === 'inbox' && !isGroup) ||
                    isOwnerOrSudoCheck;
                if (canUseChatbot) {
                    await handleChatbotResponse(sock, chatId, message, userMessage, senderId);
                }
            }
            return;
        }

        if (!command) {
            if (isGroup) {
                await handleTagDetection(sock, chatId, message, senderId);
                await handleMentionDetection(sock, chatId, message);
            }
            return;
        }

        const botMode = await store.getBotMode();
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
            const originalCommandText = messageText.slice(usedPrefix.length).trim();
            args = originalCommandText.split(/\s+/).slice(1);
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
                return await sock.sendMessage(chatId, {
                    text: 'ℹ️ *Please make the bot an admin to use this command.*',
                    ...channelInfo
                }, { quoted: message });
            }
            if (!isSenderAdmin && !message.key.fromMe && !senderIsOwnerOrSudo) {
                return await sock.sendMessage(chatId, {
                    text: 'ℹ️ *Sorry, only group admins can use this command.*',
                    ...channelInfo
                }, { quoted: message });
            }
        }

        if (command.groupOnly && !isGroup) {
            return await sock.sendMessage(chatId, {
                text: 'ℹ️ *This command can only be used in groups!*',
                ...channelInfo
            }, { quoted: message });
        }

        const context = {
            chatId,
            senderId,
            isGroup,
            isSenderAdmin,
            isBotAdmin,
            senderIsOwnerOrSudo,
            isOwnerOrSudoCheck,
            channelInfo,
            rawText: messageText,
            userMessage,
            messageText,
            config
        };

        try {
            await command.handler(sock, message, args, context);
            await addCommandReaction(sock, message);
            await showTypingAfterCommand(sock, chatId);
        } catch (error) {
            printLog('error', `Command error: ${error.message}`);
            console.error(error.stack);
            await sock.sendMessage(chatId, {
                text: `❌ Error: ${error.message}`,
                ...channelInfo
            }, { quoted: message });
        }

    } catch (err) {
        printLog('error', `Error in handleMessages: ${err.message}`);
        console.error(err);
    }
}

export { handleMessages };

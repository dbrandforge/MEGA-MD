import config from '../config.js';
import store from './lightweight_store.js';
import commandHandler from './commandHandler.js';
import { printMessage, printLog } from './print.js';
import { isBanned } from './isBanned.js';
import isOwnerOrSudo, { isOwnerOnly, invalidateGroupMetadataCache } from './isOwner.js';
import isAdmin from './isAdmin.js';
import { measureSlowOperation } from './diagnosticTiming.js';
import { handleAutoread } from '../plugins/autoread.js';
import { handleAutotypingForMessage, showTypingAfterCommand } from '../plugins/autotyping.js';
import { storeMessage, handleMessageRevocation } from '../plugins/antidelete.js';
import { handleBadwordDetection } from './antibadword.js';
import { handleLinkDetection } from '../plugins/antilink.js';
import { handleTagDetection } from '../plugins/antitag.js';
import { handleMentionDetection } from '../plugins/mention.js';
import { handleChatbotResponse } from '../plugins/chatbot.js';
import { handleChatbotMediaResponse } from './chatbotMedia.js';
import { isDuplicateIncomingMessage } from './messageDeduplication.js';
import { shouldProcessMessageUpsert, isMessageRevoked, isMessageTooOld } from './messageEventPolicy.js';
import { handleTicTacToeMove, hasActiveTicTacToeGame } from '../plugins/tictactoe.js';
import { isGroupGameplayActive, isExplicitAIRequest, pickGameplayCheatReply } from './gameplayGuard.js';
import { handleAutoReply } from '../plugins/autoreply.js';
import { handleAntiSpam, invalidateGroupCache } from '../plugins/antispam.js';
import anticall from '../plugins/anticall.js';
import { startSchedulerEngine } from '../plugins/schedule.js';
import { loadFeatureGroups, PRIMARY_FEATURE_GROUP } from './featureGroups.js';
import { addCommandReaction } from './reactions.js';
import { channelInfo } from './messageConfig.js';
import { processGroupParticipantsUpdate, markMemberIntroduced } from '../plugins/sincity-welcome.js';
import { MEMBER_FEATURES_ENABLED } from './memberFeatures.js';
import { handleTruthDareContinue } from '../plugins/truth-continue.js';
import { handleSoftMuteMessage } from '../plugins/softmute.js';
import { handleHotSeatAnswer } from '../plugins/hotseat.js';
import { handlePickYourSinMessage } from '../plugins/pick-your-sin.js';
import { handleWyrContinuity } from '../plugins/wyr.js';
import { handleTriviaContinuity } from '../plugins/trivia.js';
import { handleTodReply } from '../plugins/tod.js';
import { handleMathContinuity } from '../plugins/math.js';
import { handleBasketContinuity, hasActiveBasketSession } from '../plugins/basket.js';
import { handleCreatorBoundaryReply } from '../plugins/blacklist.js';
import { parseCreatorNaturalCommand } from './creatorNaturalCommands.js';
import { interpretCreatorCommand } from './aiService.js';
import { getPendingCreatorCommand, setPendingCreatorCommand, clearPendingCreatorCommand } from './creatorCommandContext.js';
import { normalizeCreatorCommandMessage } from './creatorCommandMessage.js';

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
const SOFT_MUTE_CHECK_ENABLED = process.env.SOFT_MUTE_CHECK_ENABLED !== 'false';
console.info('[SOFTMUTE] Message enforcement ' + (SOFT_MUTE_CHECK_ENABLED ? 'enabled' : 'disabled by SOFT_MUTE_CHECK_ENABLED=false'));
const contactLidIndexCache = new WeakMap();

function findContactByLid(contacts, rawLid) {
    if (!contacts || typeof contacts !== 'object') return null;
    let index = contactLidIndexCache.get(contacts);
    if (!index) {
        index = new Map();
        // Build at most once per contact-store object. Mongo contact documents
        // intentionally contain display metadata only, but older memory stores
        // may still have LID aliases worth preserving.
        for (const [jid, contact] of Object.entries(contacts)) {
            const lid = typeof contact?.lid === 'string' ? contact.lid : '';
            if (!lid) continue;
            index.set(lid, jid);
            index.set(lid.split('@')[0].split(':')[0], jid);
        }
        contactLidIndexCache.set(contacts, index);
    }
    return index.get(rawLid) || index.get(String(rawLid || '').split('@')[0].split(':')[0]) || null;
}

// Commands forced admin-only even if plugin forgot adminOnly flag
const FORCE_ADMIN_COMMANDS = new Set([
    'sticker', 's', 'stickers', 'ssticker', 'stickersearch',
    'take', 'steal', 'wm', 'emojimix', 'mixemoji', 'emix'
]);

export async function handleGroupParticipantUpdate(sock, update) {
    try {
        global.__forgeSock = sock;
        if (update?.id) {
            invalidateGroupCache(update.id);
            invalidateGroupMetadataCache(update.id);
        }
        await loadFeatureGroups();
        // Lifecycle announcements are scoped by hasMaturedMindedFeatures inside the handler.
        // Do not let the global heavy-member-features switch disable configured welcome/departure events.
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
            const shouldBlock = typeof anticall.shouldBlockCaller === 'function' ? anticall.shouldBlockCaller(state, caller) : state?.enabled === true;
            if (!caller || !callId || isOwnerOnly(caller) || !shouldBlock) continue;
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
    const stageTimings = {};
    let metricStartedAt = 0;
    let metricChatId = 'unknown';
    let metricCommand = 'message';
    const measureStage = async (name, operation) => {
        const startedAt = process.hrtime.bigint();
        try {
            return await operation();
        } finally {
            stageTimings[name] = Number(process.hrtime.bigint() - startedAt) / 1e6;
        }
    };
    try {
        global.__forgeSock = sock;

        const { messages, type } = messageUpdate;
        const message = messages?.[0];
        if (isMessageRevoked(message)) {
            printLog('debug', 'Ignored a WhatsApp message revoked before processing.');
            return;
        }
        if (!shouldProcessMessageUpsert(type, message)) {
            if (type === 'append' && message?.message) {
                printLog('debug', 'Ignored stale or non-inbound WhatsApp append event.');
            }
            return;
        }
        if (isDuplicateIncomingMessage(message)) {
            printLog('debug', 'Ignored duplicate WhatsApp message event.');
            return;
        }

        const messageReceivedAt = Date.now();
        metricStartedAt = messageReceivedAt;
        printMessage(message, sock).catch(() => {});
        handleAutoread(sock, message).catch(() => {});

        let chatId = message.key.remoteJid;
        metricChatId = chatId;
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
                    const mappedPN = await measureSlowOperation('whatsapp.lid_to_pn.message_sender', () => sock.signalRepository?.lidMapping?.getPNForLID?.(rawSenderId));
                    if (typeof mappedPN === 'string' && mappedPN.endsWith('@s.whatsapp.net')) {
                        senderId = mappedPN;
                    }
                } catch (error) {
                    printLog('warn', `Could not resolve sender LID through Baileys mapping: ${error.message}`);
                }
            }

            // Older contacts stores may contain a usable PN mapping; retain it as fallback.
            if (senderId === rawSenderId && sock.store?.contacts) {
                const resolved = findContactByLid(sock.store.contacts, rawSenderId);
                if (resolved?.endsWith('@s.whatsapp.net')) senderId = resolved;
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
        await measureStage('feature_groups', () => loadFeatureGroups());

        // Enforce individual soft mutes before counters, intro tracking, game flows,
        // prefixless triggers, or command routing can process the muted member's text.
        if (SOFT_MUTE_CHECK_ENABLED && isGroup && !message.key.fromMe) {
            try {
                if (await measureStage('soft_mute', () => handleSoftMuteMessage(sock, chatId, message, senderId))) return;
            } catch {}
        }

        // Do not retain muted messages in the anti-delete cache.
        storeMessage(sock, message).catch(() => {});

        const rawText = message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.imageMessage?.caption ||
            message.message?.videoMessage?.caption ||
            message.message?.buttonsResponseMessage?.selectedButtonId ||
            '';
        const messageText = rawText.trim();
        const userMessage = messageText.toLowerCase();
        const usedPrefix = config.prefixes?.find(p => userMessage.startsWith(p));
        const contextInfo = message.message?.extendedTextMessage?.contextInfo
            || message.message?.imageMessage?.contextInfo
            || message.message?.videoMessage?.contextInfo
            || {};
        const botIds = [sock.user?.id, sock.user?.lid]
            .filter(Boolean)
            .map(value => String(value).split(':')[0].split('@')[0]);
        const mentionedBot = (contextInfo.mentionedJid || []).some(jid =>
            botIds.includes(String(jid || '').split(':')[0].split('@')[0])
        );
        const quotedSenders = [contextInfo.participant, contextInfo.participantAlt]
            .filter(value => typeof value === 'string' && value);
        const quotedBot = quotedSenders.some(quotedSender =>
            botIds.includes(quotedSender.split(':')[0].split('@')[0])
        );
        // In private chats, creator messages are inherently addressed to the bot.
        // In groups, everyone—including the creator—must explicitly address it by
        // mention, reply, or a recognised bot prefix before natural-language routing.
        // Creator identity controls permissions, never whether a message is addressed.
        const creatorAddressedToBot = !isGroup || mentionedBot || quotedBot;
        const isCreatorSender = isOwnerOnly(senderId);
        const pendingCreatorContext = isCreatorSender ? getPendingCreatorCommand(senderId, chatId) : null;
        const creatorInstruction = pendingCreatorContext
            ? `${pendingCreatorContext.instruction}\nClarification answer: ${messageText}`
            : messageText;
        let creatorNaturalIntent = isCreatorSender
            ? parseCreatorNaturalCommand(creatorInstruction, { addressedToBot: creatorAddressedToBot })
            : null;

        // The creator can issue commands naturally in the middle of an ordinary
        // conversation. Recognize conversational framing and continue a pending
        // clarification even when the follow-up is only a short answer ("Trivia").
        const looksLikeInstruction = /(?:(?:(?:hey\s+)?please|can|could|would|will)\s+(?:you|we)\b|i\s+(?:need|want)\s+you\s+to\b|i\s+would\s+like\s+you\s+to\b|i['’]d\s+like\s+you\s+to\b|do\s+me\s+a\s+favo[u]?r\s+and\b|make\s+sure\s+you\b|let['’]s\b|we\s+need\s+to\b|i\s+think\s+we\s+should\b|when\s+you\s+get\s+a\s+chance\b|once\s+you['’]re\s+done\b|also\b|(?:do|run|start|stop|end|lock|unlock|disable|enable|remove|kick|ban|unban|tag|mention|schedule|send|show|give|set|turn|mute|unmute|add|delete|clear|reset|check|list|open|close|promote|demote|warn|bypass|cancel|restart|reload|pin|unpin|approve|reject|block|unblock|join|leave|download|upload|change|update|make|create|activate|deactivate)\b)/i.test(messageText);
        if (!creatorNaturalIntent && isCreatorSender && creatorAddressedToBot && (looksLikeInstruction || pendingCreatorContext)) {
            const commandCatalog = Array.from(commandHandler.commands.values()).map(plugin => ({
                command: plugin.command,
                aliases: plugin.aliases,
                description: plugin.description,
                usage: plugin.usage,
                category: plugin.category,
                groupOnly: plugin.groupOnly,
                adminOnly: plugin.adminOnly,
                ownerOnly: plugin.ownerOnly,
                strictOwnerOnly: plugin.strictOwnerOnly
            }));
            creatorNaturalIntent = await interpretCreatorCommand(creatorInstruction, commandCatalog);
        }

        if (creatorNaturalIntent?.action === 'clarify') {
            setPendingCreatorCommand(senderId, chatId, creatorInstruction, creatorNaturalIntent.clarification);
            await sock.sendMessage(chatId, { text: creatorNaturalIntent.clarification }, { quoted: message });
            return;
        }
        if (creatorNaturalIntent && creatorNaturalIntent.action !== 'clarify' && pendingCreatorContext) {
            clearPendingCreatorCommand(senderId, chatId);
        }

        const command = creatorNaturalIntent
            ? commandHandler.getCommand((config.prefixes?.[0] || '.') + creatorNaturalIntent.command, config.prefixes)
            : commandHandler.getCommand(userMessage, config.prefixes);

        // Creator boundary replies short-circuit every inbound message from the
        // configured target, including command-like text, before games or AI.
        if (isGroup && !message.key.fromMe) {
            if (await handleCreatorBoundaryReply(sock, chatId, message, senderId)) return;
        }

        // A casual chat message or command is not an introduction. Only clear
        // pending status when the member shares actual profile/introduction details.
        if (MEMBER_FEATURES_ENABLED && isGroup && !message.key.fromMe) {
            markMemberIntroduced(chatId, senderId, messageText, { hasAnyMessage: Boolean(message.message) }).catch(() => {});
        }

        const isIncomingVoiceNote = message.message?.audioMessage?.ptt === true;
        if (isGroup && !message.key.fromMe && (isSticker || isIncomingVoiceNote)
            && await isGroupGameplayActive(chatId, hasActiveTicTacToeGame(chatId))) {
            if (isIncomingVoiceNote) {
                // Devil's Basket explicitly supports voice-note dares. Other games
                // continue to reject audio answers until their handlers support them.
                const basketSession = await hasActiveBasketSession(chatId, senderId).catch(() => false);
                if (basketSession) {
                    // Let the Basket continuity handler validate this against its active dare.
                } else {
                    await sock.sendMessage(chatId, {
                        text: '🎮 Voice notes are not accepted for this active game. Please follow the game’s supported answer format.'
                    }, { quoted: message });
                    return;
                }
            } else {
                return;
            }
        }

        // During a live group game, block explicit AI/chatbot assistance before
        // game handlers can mistake a cheating prompt for an answer submission.
        // Only the configured creator/owner identity (not sudo/admin) is exempt.
        if (isGroup && !message.key.fromMe && !isOwnerOnly(senderId)) {
            const requestedCommand = commandHandler.getCommand(userMessage, config.prefixes);
            const isAICommand = Boolean(requestedCommand && (
                requestedCommand.category === 'ai'
                || ['gpt', 'ai'].includes(String(requestedCommand.command || '').toLowerCase())
            ));
            const isAIRequest = isExplicitAIRequest({
                text: messageText,
                message,
                sock,
                isAICommand
            });
            if (isAIRequest && await isGroupGameplayActive(chatId, hasActiveTicTacToeGame(chatId))) {
                await sock.sendMessage(chatId, { text: pickGameplayCheatReply() }, { quoted: message });
                return;
            }
        }

        // Game continuations and keyword auto-replies are free-text workflows.
        // Prefix commands bypass these optional handlers so commands such as .ping
        // are not delayed by unrelated game-state/database checks.
        if (!command) {
            if (!message.key.fromMe && isGroup) {
                try {
                    if (await handlePickYourSinMessage(sock, chatId, message, messageText, senderId)) return;
                } catch (error) {
                    printLog('error', 'Pick Your Sin continuation failed: ' + error.message);
                }
            }

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

            if (!message.key.fromMe) {
                try {
                    if (await handleAutoReply(sock, chatId, message, userMessage)) return;
                } catch {}
            }
        }

        const isKnownOwner = message.key.fromMe || isOwnerOnly(senderId);
        // Owner/sudo resolution can involve a WhatsApp group-metadata lookup for
        // unresolved LIDs. Run the independent ban lookup concurrently so a
        // slow identity lookup does not serialize two database/network waits.
        const [senderIsOwnerOrSudo, userBanned] = await measureStage('owner_ban_preflight', () => Promise.all([
            isOwnerOrSudo(senderId, sock, chatId),
            isKnownOwner ? Promise.resolve(false) : isBanned(senderId)
        ]));
        const isOwnerOrSudoCheck = message.key.fromMe || senderIsOwnerOrSudo;
        // Only the configured creator/owner or the bot itself bypasses group-admin checks.
        // Sudo users retain their existing owner-or-sudo privileges, but not creator-level admin bypass.
        const isCreatorOrBot = message.key.fromMe || isOwnerOnly(senderId);

        if (!isOwnerOrSudoCheck && userBanned && !userMessage.startsWith('.unban')) return;

        if (/^[1-9]$/.test(userMessage) || userMessage === 'surrender') {
            await handleTicTacToeMove(sock, chatId, senderId, userMessage);
            return;
        }

        if (!message.key.fromMe) {
            const rankingOrGameCommands = new Set([
                'rank', 'rankweek', 'rankstreak', 'rankclear', 'ranklock', 'rankunlock',
                'hotseat', 'endhotseat'
            ]);
            let countForRanking = !(isGroup && (
                command?.category === 'games' || rankingOrGameCommands.has(command?.command)
            ));
            if (countForRanking && isGroup && !isSticker) {
                const contextInfo = message.message?.extendedTextMessage?.contextInfo
                    || message.message?.imageMessage?.contextInfo
                    || message.message?.videoMessage?.contextInfo
                    || {};
                const botIds = [sock.user?.id, sock.user?.lid].filter(Boolean)
                    .map(value => String(value).split(':')[0].split('@')[0]);
                const mentionedBot = (contextInfo.mentionedJid || []).some(jid =>
                    botIds.includes(String(jid || '').split(':')[0].split('@')[0])
                ) || botIds.some(id => id && messageText.includes('@' + id));
                // Game state is queried only for an explicit bot mention; no polling or background task.
                if (mentionedBot && await isGroupGameplayActive(chatId, hasActiveTicTacToeGame(chatId))) {
                    countForRanking = false;
                }
            }
            if (countForRanking) {
                store.incrementMessageCount(chatId, senderId, message.pushName).catch(() => {});
                if (MEMBER_FEATURES_ENABLED && isGroup && !isSticker) {
                    store.incrementWeeklyMessageCount(chatId, senderId, getLagosWeekKey()).catch(() => {});
                }
            }
        }

        if (isGroup && userMessage && !message.key.fromMe) {
            handleBadwordDetection(sock, chatId, message, userMessage, senderId).catch(() => {});
            handleLinkDetection(sock, chatId, message, userMessage, senderId).catch(() => {});
            if (process.env.ANTISPAM_CHECK_ENABLED !== 'false') {
                try {
                    if (await measureStage('anti_spam', () => handleAntiSpam(sock, chatId, message, senderId, senderIsOwnerOrSudo))) return;
                } catch {}
            }
        }

        if (!isGroup && messageText.startsWith('.')) {
            printLog('info', `Private command routing: prefix=${Boolean(usedPrefix)} matched=${Boolean(command)} senderResolved=${senderId !== rawSenderId}`);
        }

        // Long preflight work must not let a message age into an executable reply.
        if (isMessageRevoked(message) || isMessageTooOld(message)) {
            printLog('debug', 'Dropped a message that became stale or was revoked during processing.');
            return;
        }

        if (!usedPrefix && !command) {
            if (!message.key.fromMe) {
                if (isGroup) {
                    handleTagDetection(sock, chatId, message, senderId).catch(() => {});
                    handleMentionDetection(sock, chatId, message).catch(() => {});
                }
                const botMode = await measureStage('bot_mode_chat', () => store.getBotMode().catch(() => 'public'));
                const canChat = isGroup
                    ? (botMode === 'public' || botMode === 'groups' || isOwnerOrSudoCheck)
                    : (botMode === 'public' || botMode === 'inbox' || isOwnerOrSudoCheck);
                if (canChat && process.env.CHATBOT_ENABLED !== 'false') {
                    const isVoiceNote = message.message?.audioMessage?.ptt === true;
                    if (isSticker && process.env.CHATBOT_STICKER_MODE_ENABLED !== 'false') {
                        handleChatbotMediaResponse(sock, chatId, message, senderId).catch(() => {});
                    } else if (isVoiceNote && process.env.CHATBOT_VOICE_MODE_ENABLED !== 'false') {
                        handleChatbotMediaResponse(sock, chatId, message, senderId).catch(() => {});
                    } else if (!isSticker && !isVoiceNote) {
                        handleChatbotResponse(sock, chatId, message, userMessage, senderId).catch(() => {});
                    }
                }
            }
            return;
        }
        if (!command) return;

        // Creator commands issued in DM may operate on the configured master
        // group. Group-only commands default to Matured Minded Room; explicit
        // commands sent inside a group continue to target that current group.
        const commandRequiresGroup = command.groupOnly || command.command === 'activity' ||
            FORCE_ADMIN_COMMANDS.has(command.command) ||
            (command.aliases || []).some(alias => FORCE_ADMIN_COMMANDS.has(alias));
        const commandChatId = !isGroup && isOwnerOnly(senderId) && commandRequiresGroup
            ? PRIMARY_FEATURE_GROUP
            : chatId;
        const commandIsGroup = commandChatId.endsWith('@g.us');
        const commandPrefix = config.prefixes?.[0] || '.';
        const normalizedCommandText = creatorNaturalIntent
            ? `${commandPrefix}${command.command}${creatorNaturalIntent.args?.length ? ' ' + creatorNaturalIntent.args.join(' ') : ''}`
            : messageText;
        const commandSourceMessage = creatorNaturalIntent
            ? normalizeCreatorCommandMessage(message, { ...creatorNaturalIntent, command: command.command }, commandPrefix)
            : message;
        const commandMessage = commandChatId === chatId
            ? commandSourceMessage
            : {
                ...commandSourceMessage,
                key: { ...commandSourceMessage.key, remoteJid: commandChatId, participant: senderId }
            };

        const botMode = await measureStage('bot_mode_command', () => store.getBotMode().catch(() => 'public'));
        const isAllowed = (() => {
            if (isOwnerOrSudoCheck) return true;
            switch (botMode) {
                case 'public': return true;
                case 'private':
                case 'self': return false;
                case 'groups': return commandIsGroup;
                case 'inbox': return !commandIsGroup;
                default: return true;
            }
        })();
        if (!isAllowed) return;

        let args;
        if (creatorNaturalIntent) {
            args = creatorNaturalIntent.args;
        } else if (usedPrefix) {
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

        if (needsAdmin && !commandIsGroup && !isOwnerOrSudoCheck) {
            return sock.sendMessage(commandChatId, {
                text: 'ℹ️ This command requires an authorized group admin and cannot be used from a private chat.',
                ...channelInfo
            }, { quoted: commandMessage });
        }

        if (needsAdmin && commandIsGroup) {
            const adminCheckSenderId = message.key.fromMe ? (sock.user?.id || senderId) : senderId;
            const adminStatus = await measureStage('admin_metadata', () => isAdmin(sock, commandChatId, adminCheckSenderId));
            isSenderAdmin = adminStatus.isSenderAdmin;
            isBotAdmin = adminStatus.isBotAdmin;
            // Individual soft-mutes and kick target checks can make a safe
            // authorization decision without bot-admin rights. Their handlers
            // enforce WhatsApp's actual permission requirement only when needed.
            const commandChecksBotPermissionInternally = ['mute', 'kick'].includes(String(command.command || '').toLowerCase());
            if (!isBotAdmin && !isCreatorOrBot && !commandChecksBotPermissionInternally) {
                return sock.sendMessage(commandChatId, {
                    text: 'ℹ️ Make the bot an admin first. The creator/bot account can still manage settings that do not require WhatsApp admin actions.',
                    ...channelInfo
                }, { quoted: commandMessage });
            }
            if (!isSenderAdmin && !isCreatorOrBot && !senderIsOwnerOrSudo) {
                return sock.sendMessage(commandChatId, {
                    text: 'ℹ️ Admins only.',
                    ...channelInfo
                }, { quoted: commandMessage });
            }
        }

        if (command.groupOnly && !commandIsGroup) {
            return sock.sendMessage(commandChatId, {
                text: 'ℹ️ Groups only.',
                ...channelInfo
            }, { quoted: commandMessage });
        }

        // Enforce plugin-declared owner permissions centrally; metadata is not merely descriptive.
        if (command.strictOwnerOnly && !message.key.fromMe && !isOwnerOnly(senderId)) {
            return sock.sendMessage(commandChatId, {
                text: '⛔ This command is restricted to the bot owner.',
                ...channelInfo
            }, { quoted: commandMessage });
        }
        if (command.ownerOnly && !message.key.fromMe && !isOwnerOrSudoCheck) {
            return sock.sendMessage(commandChatId, {
                text: '⛔ This command is restricted to the bot owner and authorized sudo users.',
                ...channelInfo
            }, { quoted: commandMessage });
        }

        const context = {
            chatId: commandChatId, senderId, isGroup: commandIsGroup, isSenderAdmin, isBotAdmin,
            senderIsOwnerOrSudo, isOwnerOrSudoCheck, isCreatorOrBot, channelInfo,
            replyChatId: commandChatId !== chatId ? chatId : undefined,
            replyMessage: commandChatId !== chatId ? message : undefined,
            rawText: normalizedCommandText,
            userMessage: normalizedCommandText.toLowerCase(),
            messageText: normalizedCommandText,
            originalMessageText: messageText,
            config
        };

        metricCommand = command.command || 'unknown';
        const commandDispatchLatencyMs = Date.now() - messageReceivedAt;
        if (commandDispatchLatencyMs >= 1000) {
            printLog('warn', `Slow command dispatch: ${command.command || 'unknown'} latency_ms=${commandDispatchLatencyMs} group=${commandIsGroup}`);
        }

        if (isMessageRevoked(message) || isMessageTooOld(message)) {
            printLog('debug', 'Dropped a stale or revoked command immediately before execution.');
            return;
        }

        try {
            await measureStage('command_handler', () => command.handler(sock, commandMessage, args, context));
            addCommandReaction(sock, commandMessage).catch(() => {});
            showTypingAfterCommand(sock, commandChatId).catch(() => {});
        } catch (error) {
            printLog('error', `Command error: ${error.message}`);
            await sock.sendMessage(commandChatId, {
                text: `❌ ${error.message}`,
                ...channelInfo
            }, { quoted: commandMessage });
        }
    } catch (err) {
        printLog('error', `handleMessages: ${err.message}`);
    } finally {
        if (metricStartedAt) {
            const totalMs = Date.now() - metricStartedAt;
            if (totalMs >= 1000) {
                const stages = Object.entries(stageTimings)
                    .filter(([, duration]) => duration >= 25)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([name, duration]) => `${name}=${duration.toFixed(1)}ms`)
                    .join(',');
                printLog('warn', `Message stage timings: command=${metricCommand} jid=${metricChatId} total_ms=${totalMs} stages=${stages || 'none'}`);
            }
        }
    }
}

export { handleMessages };

import store from './lightweight_store.js';
import { normalizeConversationParticipant, createKeyedSerialExecutor } from './chatbotConversationMemory.js';

const runPendingWriteSerial = createKeyedSerialExecutor();

const SETTING = 'pendingGenderGame';
const PENDING_TTL_MS = 15 * 60 * 1000;

function keyFor(senderId) {
    return normalizeConversationParticipant(senderId);
}

async function readPending(chatId) {
    const value = await store.getSetting(chatId, SETTING);
    return value && typeof value === 'object' ? value : {};
}

export async function savePendingGenderGame(chatId, targetUserId, pending) {
    if (!chatId || !targetUserId || !pending?.command) return false;
    const key = keyFor(targetUserId);
    if (!key) return false;
    return runPendingWriteSerial(chatId, async () => {
        const state = await readPending(chatId);
        state[key] = {
            ...pending,
            requester: pending.requester || targetUserId,
            createdAt: Date.now(),
            expiresAt: Date.now() + PENDING_TTL_MS
        };
        if (!await store.saveSettingVerified(chatId, SETTING, state)) {
            throw new Error('Pending gender-gated game could not be saved.');
        }
        return true;
    });
}

export async function resumePendingGenderGame(sock, chatId, registeredUserId, triggerMessage, channelInfo = {}) {
    if (!chatId || !registeredUserId) return false;
    const key = keyFor(registeredUserId);
    if (!key) return false;
    const pending = await runPendingWriteSerial(chatId, async () => {
        const state = await readPending(chatId);
        const value = state[key] || null;
        if (!value) return null;
        delete state[key];
        if (!await store.saveSettingVerified(chatId, SETTING, state)) {
            throw new Error('Pending gender-gated game could not be claimed safely.');
        }
        return value;
    });
    if (!pending) return false;
    if (!pending.expiresAt || pending.expiresAt < Date.now()) {
        await sock.sendMessage(chatId, {
            text: 'Your saved game request has expired. Please run the game command again.',
            ...channelInfo
        }, triggerMessage ? { quoted: triggerMessage } : undefined);
        return true;
    }

    const modules = {
        tod: () => import('../plugins/tod.js'),
        truth: () => import('../plugins/truth.js'),
        dare: () => import('../plugins/dare.js'),
        basket: () => import('../plugins/basket.js')
    };
    const load = modules[String(pending.command).toLowerCase()];
    if (!load) return false;

    const requester = pending.requester || registeredUserId;
    const args = Array.isArray(pending.args) ? pending.args.map(String) : [];
    const mentionedJid = Array.isArray(pending.mentionedJids) ? pending.mentionedJids : [];
    const replayMessage = {
        key: {
            remoteJid: chatId,
            participant: requester,
            fromMe: false,
            id: pending.messageId || triggerMessage?.key?.id || 'gender-resume'
        },
        pushName: pending.pushName || triggerMessage?.pushName || '',
        message: {
            extendedTextMessage: {
                text: [`.${pending.command}`, ...args].join(' '),
                contextInfo: { mentionedJid }
            }
        }
    };
    const plugin = (await load()).default;
    if (typeof plugin?.handler !== 'function') return false;

    try {
        await plugin.handler(sock, replayMessage, args, {
            chatId,
            senderId: requester,
            channelInfo,
            isGroup: String(chatId).endsWith('@g.us'),
            isSenderAdmin: false,
            senderIsOwnerOrSudo: false,
            isOwnerOrSudoCheck: false
        });
        return true;
    } catch (error) {
        const latest = await readPending(chatId);
        latest[key] = pending;
        await store.saveSettingVerified(chatId, SETTING, latest);
        throw error;
    }
}

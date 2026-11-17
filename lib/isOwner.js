import config from '../config.js';
import { isSudo } from './index.js';
import { measureSlowOperation } from './diagnosticTiming.js';
function cleanJid(jid) {
    if (!jid)
        return '';
    return jid.split(':')[0].split('@')[0];
}
const GROUP_METADATA_CACHE_TTL_MS = 30_000;
const GROUP_METADATA_CACHE_MAX = 150;
const groupMetadataCache = new Map();

async function getCachedGroupMetadata(sock, chatId) {
    const now = Date.now();
    const cached = groupMetadataCache.get(chatId);
    if (cached && cached.sock === sock && now - cached.cachedAt < GROUP_METADATA_CACHE_TTL_MS) {
        return cached.promise;
    }

    const entry = {
        sock,
        cachedAt: now,
        promise: measureSlowOperation('whatsapp.group_metadata.owner_lid_fallback', () => sock.groupMetadata(chatId), { cache: 'miss' })
    };
    groupMetadataCache.set(chatId, entry);
    if (groupMetadataCache.size > GROUP_METADATA_CACHE_MAX) {
        const oldestKey = groupMetadataCache.keys().next().value;
        if (oldestKey !== undefined) groupMetadataCache.delete(oldestKey);
    }
    try {
        return await entry.promise;
    } catch (error) {
        if (groupMetadataCache.get(chatId) === entry) groupMetadataCache.delete(chatId);
        throw error;
    }
}

export function invalidateGroupMetadataCache(chatId) {
    if (chatId) groupMetadataCache.delete(chatId);
}

function isConfiguredOwner(senderId, ownerConfig = config) {
    const senderIdClean = cleanJid(senderId);
    const ownerNumbers = [ownerConfig.ownerNumber, ownerConfig.creatorNumber]
        .map(cleanJid)
        .filter(Boolean);
    return Boolean(senderIdClean && ownerNumbers.includes(senderIdClean));
}

/**
 * Check if user is owner or sudo
 */
async function isOwnerOrSudo(senderId, sock = null, chatId = null) {
    if (isConfiguredOwner(senderId)) {
        return true;
    }
    const isSudoUser = await isSudo(senderId);
    if (isSudoUser) {
        return true;
    }
    if (sock && chatId && chatId.endsWith('@g.us') && senderId.includes('@lid')) {
        try {
            const metadata = await getCachedGroupMetadata(sock, chatId);
            const participants = metadata.participants || [];
            const participant = participants.find((p) => p.lid === senderId || p.id === senderId);
            if (participant) {
                if (isConfiguredOwner(participant.id) || await isSudo(participant.id)) {
                    return true;
                }
            }
        }
        catch (e) {
        }
    }
    return false;
}
/**
 * Check if user is ONLY owner
 */
function isOwnerOnly(senderId) {
    return isConfiguredOwner(senderId);
}
/**
 * Helper for commands to show clean names/numbers
 * Usage: getCleanName(jid, sock)
 */
async function getCleanName(jid, sock) {
    if (!jid)
        return 'Unknown';
    const cleanNumber = cleanJid(jid);
    try {
        if (sock) {
            const contact = await sock.onWhatsApp(jid);
            if (contact && contact[0] && contact[0].exists) {
                return cleanNumber;
            }
        }
    }
    catch (e) { }
    return cleanNumber;
}
export default isOwnerOrSudo;
export { isOwnerOnly };
export { cleanJid, isConfiguredOwner };
export { getCleanName };

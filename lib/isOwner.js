import config from '../config.js';
import { isSudo } from './index.js';
function cleanJid(jid) {
    if (!jid)
        return '';
    return jid.split(':')[0].split('@')[0];
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
            const metadata = await sock.groupMetadata(chatId);
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

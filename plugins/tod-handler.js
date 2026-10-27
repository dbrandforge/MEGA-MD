/**
 * TOD Reply Handler - to be called from messageHandler
 * This is a thin wrapper so we can import cleanly.
 */
import { handleTodReply, checkTodTimeouts } from './tod.js';
import { trackGroup } from './schedule.js';

export async function processTodMessage(sock, chatId, senderId, text, message) {
    if (!chatId?.endsWith('@g.us')) return false;

    trackGroup(chatId);

    try {
        return await handleTodReply(sock, chatId, senderId, text, message);
    } catch (e) {
        console.error('TOD handler error:', e);
        return false;
    }
}

export { checkTodTimeouts, trackGroup };

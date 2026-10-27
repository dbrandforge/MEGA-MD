/**
 * TOD Reply Handler - thin wrapper
 */
import { handleTodReply } from './tod.js';

export async function processTodMessage(sock, chatId, senderId, text, message) {
    if (!chatId?.endsWith('@g.us')) return false;

    try {
        // Lazy track group to avoid circular import at top level
        try {
            const { trackGroup } = await import('./schedule.js');
            trackGroup(chatId);
        } catch (e) {}

        return await handleTodReply(sock, chatId, senderId, text, message);
    } catch (e) {
        console.error('TOD handler error:', e);
        return false;
    }
}

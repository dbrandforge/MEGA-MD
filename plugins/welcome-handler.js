/**
 * Welcome Handler - call this on group-participants.update
 */
import { handleNewMember } from './sincity-welcome.js';

export async function processGroupParticipantsUpdate(sock, update) {
    try {
        if (!update || !update.id || !update.participants) return;

        const chatId = update.id;
        const action = update.action; // 'add' | 'remove' | etc.

        if (action === 'add') {
            await handleNewMember(sock, chatId, update.participants);
        }
    } catch (e) {
        console.error('Welcome handler error:', e);
    }
}

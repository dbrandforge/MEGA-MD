import { getUserGender } from './gender.js';
import { getTruths, randomFrom } from '../data/todLists.js';
import { isGameAllowed } from './daylock.js';
import { savePendingGenderGame } from '../lib/genderGameContinuation.js';
import { startSoloSession, setSoloQuestionMessage, endSoloSession } from './truth-continue.js';

export default {
    command: 'truth',
    aliases: ['truthdare'],
    category: 'games',
    description: 'Explicit truth (gender-specific). Reply to continue.',
    usage: '.truth',
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo } = context;
        const action = String(args?.[0] || '').toLowerCase();

        // Session controls must remain available even when Truth/Dare is locked.
        if (action === 'stop' || action === 'end' || action === 'cancel') {
            const ended = await endSoloSession(chatId, senderId);
            return sock.sendMessage(chatId, {
                text: ended
                    ? '🛑 Your Truth session has ended. Use *.truth* when you want to start again.'
                    : 'You do not have an active solo Truth session to end.',
                ...channelInfo
            }, { quoted: message });
        }

        const manualAllowed = await isGameAllowed(chatId, 'truth');
        if (!manualAllowed.ok) return sock.sendMessage(chatId, { text: manualAllowed.msg, ...channelInfo }, { quoted: message });
        const allowed = await isGameAllowed(chatId, 'tod');
        if (!allowed.ok) {
            return sock.sendMessage(chatId, { text: allowed.msg, ...channelInfo }, { quoted: message });
        }

        const gender = await getUserGender(senderId);
        if (!gender) {
            await savePendingGenderGame(chatId, senderId, { command: 'truth', args: [], requester: senderId, pushName: message.pushName });
            return sock.sendMessage(chatId, {
                text: `You need to set your gender first before Truth.\n\nType:\n.gender guy\nor\n.gender lady\n\nYour Truth game will resume automatically after registration.`,
                ...channelInfo
            }, { quoted: message });
        }

        const list = getTruths(gender);
        const truthMessage = randomFrom(list);

        await startSoloSession(chatId, senderId, 'truth', gender);

        const sent = await sock.sendMessage(chatId, {
            text: `🔥 *TRUTH* (${gender}) 🔥\n\n${truthMessage}\n\n_Reply to this message or tag me to get another one. Type *stop* to end._`
        }, { quoted: message });
        await setSoloQuestionMessage(chatId, senderId, sent?.key?.id);
    }
};

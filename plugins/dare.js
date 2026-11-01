import { getUserGender } from './gender.js';
import { getDares, randomFrom } from '../data/todLists.js';
import { isGameAllowed } from './daylock.js';
import { startSoloSession, setSoloQuestionMessage } from './truth-continue.js';

export default {
    command: 'dare',
    aliases: ['challenge'],
    category: 'games',
    description: 'Explicit dare (gender-specific). Reply to continue.',
    usage: '.dare',
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo } = context;

        const manualAllowed = await isGameAllowed(chatId, 'dare');
        if (!manualAllowed.ok) return sock.sendMessage(chatId, { text: manualAllowed.msg, ...channelInfo }, { quoted: message });
        const allowed = await isGameAllowed(chatId, 'tod');
        if (!allowed.ok) {
            return sock.sendMessage(chatId, { text: allowed.msg, ...channelInfo }, { quoted: message });
        }

        const gender = await getUserGender(senderId);
        if (!gender) {
            return sock.sendMessage(chatId, {
                text: `You need to set your gender first before Truth & Dare.\n\nType:\n.gender guy\nor\n.gender lady\n\n(You can only set this once. After that only an admin can change it.)`,
                ...channelInfo
            }, { quoted: message });
        }

        const list = getDares(gender);
        const dareMessage = randomFrom(list);

        await startSoloSession(chatId, senderId, 'dare', gender);

        const sent = await sock.sendMessage(chatId, {
            text: `🔥 *DARE* (${gender}) 🔥\n\n${dareMessage}\n\n_Reply to this message or tag me to get another one. Type *stop* to end._`
        }, { quoted: message });
        await setSoloQuestionMessage(chatId, senderId, sent?.key?.id);
    }
};

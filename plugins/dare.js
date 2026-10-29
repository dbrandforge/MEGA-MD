import { getUserGender } from './gender.js';
import { getDares, randomFrom } from '../data/todLists.js';
import { isGameAllowed } from './daylock.js';
import { startSoloSession } from './truth-continue.js';

export default {
    command: 'dare',
    aliases: ['challenge'],
    category: 'games',
    description: 'Explicit dare (gender-specific). Reply to continue.',
    usage: '.dare',
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo } = context;

        const allowed = await isGameAllowed(chatId, 'tod');
        if (!allowed.ok) {
            return sock.sendMessage(chatId, { text: allowed.msg, ...channelInfo }, { quoted: message });
        }

        const gender = await getUserGender(senderId);
        if (!gender) {
            return sock.sendMessage(chatId, {
                text: `Please set your gender first:\n*.gender guy*\n*.gender lady*\n\nThen use .dare again.`,
                ...channelInfo
            }, { quoted: message });
        }

        const list = getDares(gender);
        const dareMessage = randomFrom(list);

        await startSoloSession(chatId, senderId, 'dare', gender);

        await sock.sendMessage(chatId, {
            text: `🔥 *DARE* (${gender}) 🔥\n\n${dareMessage}\n\n_Reply to this message or tag me to get another one. Type *stop* to end._`
        }, { quoted: message });
    }
};

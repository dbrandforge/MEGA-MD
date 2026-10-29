import { getUserGender } from './gender.js';
import { getTruths, randomFrom } from '../data/todLists.js';
import { isGameAllowed } from './daylock.js';
import { startSoloSession } from './truth-continue.js';

export default {
    command: 'truth',
    aliases: ['truthdare'],
    category: 'games',
    description: 'Explicit truth (gender-specific). Reply to continue.',
    usage: '.truth',
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo } = context;

        const allowed = await isGameAllowed(chatId, 'tod');
        if (!allowed.ok) {
            return sock.sendMessage(chatId, { text: allowed.msg, ...channelInfo }, { quoted: message });
        }

        const gender = await getUserGender(senderId);
        if (!gender) {
            return sock.sendMessage(chatId, {
                text: `Please set your gender first:\n*.gender guy*\n*.gender lady*\n\nThen use .truth again.`,
                ...channelInfo
            }, { quoted: message });
        }

        const list = getTruths(gender);
        const truthMessage = randomFrom(list);

        await startSoloSession(chatId, senderId, 'truth', gender);

        await sock.sendMessage(chatId, {
            text: `🔥 *TRUTH* (${gender}) 🔥\n\n${truthMessage}\n\n_Reply to this message or tag me to get another one. Type *stop* to end._`
        }, { quoted: message });
    }
};

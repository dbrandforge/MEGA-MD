import { guysBasket, ladiesBasket } from '../data/devilsBasket.js';
import store from '../lib/lightweight_store.js';

const USED_KEY = 'devilsBasketUsed';

async function getUsedNumbers(chatId) {
    const data = await store.getSetting(chatId, USED_KEY);
    return data || { guys: [], ladies: [] };
}

async function saveUsedNumbers(chatId, used) {
    await store.saveSetting(chatId, USED_KEY, used);
}

export default {
    command: 'basket',
    aliases: ['devil', 'db', 'devilsbasket'],
    category: 'games',
    description: "Devil's Basket - Choose a number and receive a dare/question",
    usage: '.basket [number] or .basket guys/ladies',
    groupOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo } = context;

        try {
            const used = await getUsedNumbers(chatId);

            // Show help if no args
            if (!args.length) {
                const guysLeft = Object.keys(guysBasket).filter(n => !used.guys.includes(Number(n))).length;
                const ladiesLeft = Object.keys(ladiesBasket).filter(n => !used.ladies.includes(Number(n))).length;

                return sock.sendMessage(chatId, {
                    text: `*Devil's Basket* \ud83c\udfa1\n\nChoose a number:\n\n*Guys:* 1 \u2013 50  (${guysLeft} left)\n*Ladies:* 51 \u2013 100  (${ladiesLeft} left)\n\nUsage:\n\u2022 .basket 23\n\u2022 .basket guys   (random for guys)\n\u2022 .basket ladies (random for ladies)\n\nUsed numbers cannot be chosen again.`,
                    ...channelInfo
                }, { quoted: message });
            }

            const input = args[0].toLowerCase();

            // Random for guys
            if (input === 'guys' || input === 'guy' || input === 'male') {
                const available = Object.keys(guysBasket).filter(n => !used.guys.includes(Number(n)));
                if (available.length === 0) {
                    return sock.sendMessage(chatId, { text: 'All guy numbers have been used!', ...channelInfo }, { quoted: message });
                }
                const num = Number(available[Math.floor(Math.random() * available.length)]);
                used.guys.push(num);
                await saveUsedNumbers(chatId, used);

                return sock.sendMessage(chatId, {
                    text: `*Devil's Basket* \u2014 *Guys #${num}*\n\n@${senderId.split('@')[0]}\n\n${guysBasket[num]}\n\nYou must complete this. Failure = 10 hour mute.`,
                    mentions: [senderId],
                    ...channelInfo
                }, { quoted: message });
            }

            // Random for ladies
            if (input === 'ladies' || input === 'lady' || input === 'female' || input === 'girl') {
                const available = Object.keys(ladiesBasket).filter(n => !used.ladies.includes(Number(n)));
                if (available.length === 0) {
                    return sock.sendMessage(chatId, { text: 'All lady numbers have been used!', ...channelInfo }, { quoted: message });
                }
                const num = Number(available[Math.floor(Math.random() * available.length)]);
                used.ladies.push(num);
                await saveUsedNumbers(chatId, used);

                return sock.sendMessage(chatId, {
                    text: `*Devil's Basket* \u2014 *Ladies #${num}*\n\n@${senderId.split('@')[0]}\n\n${ladiesBasket[num]}\n\nYou must complete this. Failure = 10 hour mute.`,
                    mentions: [senderId],
                    ...channelInfo
                }, { quoted: message });
            }

            // Specific number
            const num = parseInt(input);
            if (isNaN(num) || num < 1 || num > 100) {
                return sock.sendMessage(chatId, { text: 'Please choose a valid number between 1 and 100.', ...channelInfo }, { quoted: message });
            }

            if (num <= 50) {
                if (used.guys.includes(num)) {
                    return sock.sendMessage(chatId, { text: `Number ${num} has already been used.`, ...channelInfo }, { quoted: message });
                }
                used.guys.push(num);
                await saveUsedNumbers(chatId, used);

                return sock.sendMessage(chatId, {
                    text: `*Devil's Basket* \u2014 *Guys #${num}*\n\n@${senderId.split('@')[0]}\n\n${guysBasket[num]}\n\nYou must complete this. Failure = 10 hour mute.`,
                    mentions: [senderId],
                    ...channelInfo
                }, { quoted: message });
            } else {
                if (used.ladies.includes(num)) {
                    return sock.sendMessage(chatId, { text: `Number ${num} has already been used.`, ...channelInfo }, { quoted: message });
                }
                used.ladies.push(num);
                await saveUsedNumbers(chatId, used);

                return sock.sendMessage(chatId, {
                    text: `*Devil's Basket* \u2014 *Ladies #${num}*\n\n@${senderId.split('@')[0]}\n\n${ladiesBasket[num]}\n\nYou must complete this. Failure = 10 hour mute.`,
                    mentions: [senderId],
                    ...channelInfo
                }, { quoted: message });
            }

        } catch (error) {
            console.error('Devil\'s Basket error:', error);
            await sock.sendMessage(chatId, { text: 'Something went wrong with Devil\'s Basket.', ...channelInfo }, { quoted: message });
        }
    }
};

import { guysBasket, ladiesBasket } from '../data/devilsBasket.js';
import store from '../lib/lightweight_store.js';
import { isGameAllowed } from './daylock.js';

const USED_KEY = 'devilsBasketUsed';

async function getUsedNumbers(chatId) {
    return (await store.getSetting(chatId, USED_KEY)) || { guys: [], ladies: [] };
}
async function saveUsedNumbers(chatId, used) {
    await store.saveSetting(chatId, USED_KEY, used);
}

export default {
    command: 'basket',
    aliases: ['devil', 'db', 'devilsbasket'],
    category: 'games',
    description: "Devil's Basket",
    usage: '.basket [number] | .basket guys|ladies',
    groupOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo } = context;

        const allowed = await isGameAllowed(chatId, 'basket');
        if (!allowed.ok) {
            return sock.sendMessage(chatId, { text: allowed.msg, ...channelInfo }, { quoted: message });
        }

        try {
            const used = await getUsedNumbers(chatId);

            if (!args.length) {
                const guysLeft = Object.keys(guysBasket).filter(n => !used.guys.includes(Number(n))).length;
                const ladiesLeft = Object.keys(ladiesBasket).filter(n => !used.ladies.includes(Number(n))).length;
                return sock.sendMessage(chatId, {
                    text: `*Devil's Basket* 🎰\n\n*Guys:* 1–50 (${guysLeft} left)\n*Ladies:* 51–100 (${ladiesLeft} left)\n\n.basket 23\n.basket guys\n.basket ladies`,
                    ...channelInfo
                }, { quoted: message });
            }

            const input = args[0].toLowerCase();

            if (['guys','guy','male'].includes(input)) {
                const available = Object.keys(guysBasket).filter(n => !used.guys.includes(Number(n)));
                if (!available.length) return sock.sendMessage(chatId, { text: 'All guy numbers used!', ...channelInfo }, { quoted: message });
                const num = Number(available[Math.floor(Math.random() * available.length)]);
                used.guys.push(num);
                await saveUsedNumbers(chatId, used);
                return sock.sendMessage(chatId, {
                    text: `*Devil's Basket — Guys #${num}*\n\n@${senderId.split('@')[0]}\n\n${guysBasket[num]}\n\nComplete this. Failure = 10h mute.`,
                    mentions: [senderId], ...channelInfo
                }, { quoted: message });
            }

            if (['ladies','lady','female','girl'].includes(input)) {
                const available = Object.keys(ladiesBasket).filter(n => !used.ladies.includes(Number(n)));
                if (!available.length) return sock.sendMessage(chatId, { text: 'All lady numbers used!', ...channelInfo }, { quoted: message });
                const num = Number(available[Math.floor(Math.random() * available.length)]);
                used.ladies.push(num);
                await saveUsedNumbers(chatId, used);
                return sock.sendMessage(chatId, {
                    text: `*Devil's Basket — Ladies #${num}*\n\n@${senderId.split('@')[0]}\n\n${ladiesBasket[num]}\n\nComplete this. Failure = 10h mute.`,
                    mentions: [senderId], ...channelInfo
                }, { quoted: message });
            }

            const num = parseInt(input);
            if (isNaN(num) || num < 1 || num > 100) {
                return sock.sendMessage(chatId, { text: 'Choose a number 1–100.', ...channelInfo }, { quoted: message });
            }

            if (num <= 50) {
                if (used.guys.includes(num)) return sock.sendMessage(chatId, { text: `Number ${num} already used.`, ...channelInfo }, { quoted: message });
                used.guys.push(num);
                await saveUsedNumbers(chatId, used);
                return sock.sendMessage(chatId, {
                    text: `*Devil's Basket — Guys #${num}*\n\n@${senderId.split('@')[0]}\n\n${guysBasket[num]}\n\nComplete this. Failure = 10h mute.`,
                    mentions: [senderId], ...channelInfo
                }, { quoted: message });
            }

            if (used.ladies.includes(num)) return sock.sendMessage(chatId, { text: `Number ${num} already used.`, ...channelInfo }, { quoted: message });
            used.ladies.push(num);
            await saveUsedNumbers(chatId, used);
            return sock.sendMessage(chatId, {
                text: `*Devil's Basket — Ladies #${num}*\n\n@${senderId.split('@')[0]}\n\n${ladiesBasket[num]}\n\nComplete this. Failure = 10h mute.`,
                mentions: [senderId], ...channelInfo
            }, { quoted: message });

        } catch (error) {
            console.error("Devil's Basket error:", error);
            await sock.sendMessage(chatId, { text: "Something went wrong with Devil's Basket.", ...channelInfo }, { quoted: message });
        }
    }
};

import { resumeTriviaGame } from './trivia.js';
import { resumeMathGame } from './math.js';
import { resumeHangmanGame } from './hangman.js';
import { resumeHotSeatSession } from './hotseat.js';
import { resumePickYourSinSessions } from './pick-your-sin.js';
import { resumeBasketSession } from './basket.js';
import axios from 'axios';
export default {
    command: 'game',
    aliases: ['gaming', 'gameimg'],
    category: 'images',
    description: 'Get a random gaming image',
    usage: '.game | .game resume <trivia|math|hangman|hotseat|picksin|basket>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const action = String(args[0] || '').toLowerCase();
        const target = String(args[1] || '').toLowerCase();
        if (action === 'resume') {
            const channelInfo = context.channelInfo || {};
            try {
            if (target === 'trivia') return resumeTriviaGame(sock, chatId, message, channelInfo);
            if (target === 'math' || target === 'maths') return resumeMathGame(sock, chatId, message, channelInfo);
            if (target === 'hangman') return resumeHangmanGame(sock, chatId, message, channelInfo);
            if (['basket', 'devilsbasket'].includes(target)) {
                const senderId = context.senderId || message.key.participant || message.key.remoteJid;
                const resumed = await resumeBasketSession(sock, chatId, senderId, message, channelInfo);
                return resumed ? undefined : sock.sendMessage(chatId, { text: 'No saved Devil\'s Basket dare is available to resume.', ...channelInfo }, { quoted: message });
            }
            if (target === 'hotseat') {
                const resumed = await resumeHotSeatSession(sock, chatId);
                return sock.sendMessage(chatId, { text: resumed ? `▶️ Resumed ${resumed} Hot Seat player timer(s).` : 'No saved Hot Seat session needs resuming.', ...channelInfo }, { quoted: message });
            }
            if (['picksin', 'pick-your-sin', 'pick your sin'].includes(target)) {
                const resumed = await resumePickYourSinSessions(sock, chatId);
                return sock.sendMessage(chatId, { text: resumed ? `▶️ Resumed ${resumed} PICK YOUR SIN player timer(s).` : 'No saved PICK YOUR SIN players need resuming.', ...channelInfo }, { quoted: message });
            }
            return sock.sendMessage(chatId, { text: 'Use *.game resume trivia*, *.game resume math*, *.game resume hangman*, *.game resume hotseat*, *.game resume picksin*, or *.game resume basket*. For board games, use *.sudoku resume*, *.chess resume* or *.checkers resume*.' }, { quoted: message });
            } catch (error) {
                console.error('[GAME-RESUME] Recovery failed:', error);
                return sock.sendMessage(chatId, { text: '❌ Game recovery could not be completed. Your saved progress has not been intentionally cleared. Please try again or ask an admin to inspect the game session.', ...channelInfo }, { quoted: message });
            }
        }
        try {
            const res = await axios.get('https://raw.githubusercontent.com/GlobalTechInfo/Database/main/images/game.json');
            if (!res.data || !Array.isArray(res.data) || res.data.length === 0) {
                return await sock.sendMessage(chatId, { text: '❌ Failed to fetch image.' }, { quoted: message });
            }
            const randomImage = res.data[Math.floor(Math.random() * res.data.length)];
            await sock.sendMessage(chatId, { image: { url: randomImage }, caption: '🎮 Gaming Image' }, { quoted: message });
        }
        catch (err) {
            console.error('Game image plugin error:', err);
            await sock.sendMessage(chatId, { text: '❌ Error while fetching image.' }, { quoted: message });
        }
    }
};

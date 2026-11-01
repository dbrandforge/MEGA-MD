import axios from 'axios';
const triviaGames = {};

function botMentioned(sock, message) {
    const bot = sock.user?.id || '';
    const botNumber = bot.split(':')[0].split('@')[0];
    const mentions = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    return mentions.some(jid => jid.split('@')[0].split(':')[0] === botNumber);
}

async function sendTriviaQuestion(sock, chatId, quoted = null) {
    const response = await axios.get('https://opentdb.com/api.php?amount=1&type=multiple', { timeout: 12000 });
    const questionData = response.data?.results?.[0];
    if (!questionData) throw new Error('No trivia question returned');
    const game = {
        question: questionData.question,
        correctAnswer: questionData.correct_answer,
        options: [...questionData.incorrect_answers, questionData.correct_answer].sort(),
        questionMessageId: null
    };
    const sent = await sock.sendMessage(chatId, {
        text: `🎯 *Trivia Time!*\n\n*Question:* ${game.question}\n\n*Options:*\n${game.options.join('\n')}\n\n_Reply to this question with your answer, or tag the bot to skip to another question._`
    }, quoted ? { quoted } : undefined);
    game.questionMessageId = sent?.key?.id || null;
    triviaGames[chatId] = game;
}

export async function handleTriviaContinuity(sock, chatId, message) {
    if (!chatId?.endsWith('@g.us') || message?.key?.fromMe || !triviaGames[chatId]) return false;
    const game = triviaGames[chatId];
    const ctx = message.message?.extendedTextMessage?.contextInfo
        || message.message?.imageMessage?.contextInfo
        || message.message?.videoMessage?.contextInfo || {};
    const replied = !!(ctx.stanzaId && game.questionMessageId && ctx.stanzaId === game.questionMessageId);
    const tagged = botMentioned(sock, message);
    if (!replied && !tagged) return false;

    const answer = (message.message?.conversation
        || message.message?.extendedTextMessage?.text
        || message.message?.imageMessage?.caption
        || message.message?.videoMessage?.caption || '').trim();

    let feedback = '⏭️ Question skipped.';
    if (replied && answer) {
        feedback = answer.toLowerCase() === game.correctAnswer.toLowerCase()
            ? `✅ Correct! The answer is *${game.correctAnswer}*.`
            : `❌ Not quite. The correct answer was *${game.correctAnswer}*.`;
    }
    await sock.sendMessage(chatId, { text: feedback }, { quoted: message });
    try {
        await sendTriviaQuestion(sock, chatId, message);
    } catch (error) {
        delete triviaGames[chatId];
        await sock.sendMessage(chatId, { text: '❌ Could not load the next trivia question. Start again with .trivia.' }, { quoted: message });
    }
    return true;
}

export default {
    command: 'trivia',
    aliases: ['quiz'],
    category: 'games',
    description: 'Start trivia; answer by replying to the question or tag the bot to skip',
    usage: '.trivia | reply with answer | tag bot for next question',
    async handler(sock, message, args, context) {
        const { chatId, channelInfo } = context;
        if (args.length === 0) {
            if (triviaGames[chatId]) {
                return sock.sendMessage(chatId, {
                    text: 'A trivia game is already in progress. Reply to its question with your answer or tag the bot to skip.',
                    ...channelInfo
                }, { quoted: message });
            }
            try {
                await sendTriviaQuestion(sock, chatId, message);
            } catch (error) {
                await sock.sendMessage(chatId, {
                    text: 'Error fetching trivia question. Try again later.',
                    ...channelInfo
                }, { quoted: message });
            }
            return;
        }

        if (!triviaGames[chatId]) {
            return sock.sendMessage(chatId, {
                text: 'No trivia game is in progress. Use .trivia to start one!',
                ...channelInfo
            }, { quoted: message });
        }
        const game = triviaGames[chatId];
        const answer = args.join(' ');
        const correct = answer.toLowerCase() === game.correctAnswer.toLowerCase();
        await sock.sendMessage(chatId, {
            text: correct
                ? `✅ Correct! The answer is *${game.correctAnswer}*.`
                : `❌ Wrong! The correct answer was *${game.correctAnswer}*.`,
            ...channelInfo
        }, { quoted: message });
        try {
            await sendTriviaQuestion(sock, chatId, message);
        } catch (error) {
            delete triviaGames[chatId];
            await sock.sendMessage(chatId, { text: '❌ Could not load the next question. Start again with .trivia.' }, { quoted: message });
        }
    }
};

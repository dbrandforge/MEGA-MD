import axios from 'axios';
import store from '../lib/lightweight_store.js';

const WYR_KEY = 'wouldYouRatherSessions';

async function getSessions(chatId) {
    return (await store.getSetting(chatId, WYR_KEY)) || {};
}
async function saveSessions(chatId, sessions) {
    await store.saveSetting(chatId, WYR_KEY, sessions);
}
function botMentioned(sock, message) {
    const bot = sock.user?.id || '';
    const botNumber = bot.split(':')[0].split('@')[0];
    const mentions = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    return mentions.some(jid => jid.split('@')[0].split(':')[0] === botNumber);
}
async function sendQuestion(sock, chatId, senderId, quoted) {
    const res = await axios.get('https://discardapi.dpdns.org/api/quote/wyr?apikey=guru', { timeout: 12000 });
    if (!res.data || res.data.status !== true) throw new Error('Question provider returned an invalid response');
    const opt1 = res.data.question?.option1 || 'Option 1 not found';
    const opt2 = res.data.question?.option2 || 'Option 2 not found';
    const sent = await sock.sendMessage(chatId, {
        text: `🤔 *Would You Rather*\n\n◍ ${opt1}\n◍ ${opt2}\n\n_Reply to this question or tag the bot for another._`
    }, quoted ? { quoted } : undefined);
    const sessions = await getSessions(chatId);
    sessions[senderId] = { questionMessageId: sent?.key?.id || null, updatedAt: Date.now() };
    await saveSessions(chatId, sessions);
}

export async function handleWyrContinuity(sock, chatId, message, senderId) {
    if (!chatId?.endsWith('@g.us') || message?.key?.fromMe) return false;
    const sessions = await getSessions(chatId);
    const session = sessions[senderId];
    if (!session) return false;
    const ctx = message.message?.extendedTextMessage?.contextInfo
        || message.message?.imageMessage?.contextInfo
        || message.message?.videoMessage?.contextInfo || {};
    const replied = !!(ctx.stanzaId && session.questionMessageId && ctx.stanzaId === session.questionMessageId);
    if (!replied && !botMentioned(sock, message)) return false;
    try {
        await sendQuestion(sock, chatId, senderId, message);
    } catch (error) {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch the next question. Try .wyr again.' }, { quoted: message });
    }
    return true;
}

export default {
    command: 'wyr',
    aliases: ['wouldyourather'],
    category: 'games',
    description: 'Get a Would You Rather question; reply or tag the bot for another',
    usage: '.wyr',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const senderId = context.senderId || message.key.participant || message.key.remoteJid;
        try {
            await sendQuestion(sock, chatId, senderId, message);
        } catch (err) {
            console.error('WYR plugin error:', err);
            await sock.sendMessage(chatId, { text: '❌ Error while fetching question.' }, { quoted: message });
        }
    }
};

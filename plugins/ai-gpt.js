import { askFastAI, sanitizeAIResponse } from '../lib/aiService.js';
import { detectMessageLanguage, getLocalizedFailureReply } from '../lib/chatbotLanguage.js';
export { sanitizeAIResponse };

export default {
    command: 'gpt',
    aliases: ['ai', 'chat', 'ask'],
    category: 'ai',
    description: 'Ask a question to AI (updated for 2026)',
    usage: '.gpt <question>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const query = args.join(' ').trim();

        if (!query) {
            return sock.sendMessage(chatId, {
                text: '🤖 *AI Assistant*\n\nUsage: `.gpt <your question>`\nExample: `.gpt who is the current president of Nigeria?`'
            }, { quoted: message });
        }

        const language = detectMessageLanguage(query);
        try {
            await sock.sendMessage(chatId, { react: { text: '🤖', key: message.key } });
            const answer = sanitizeAIResponse(await askFastAI(query, { timeoutMs: 15000, language }), query);
            await sock.sendMessage(chatId, { text: answer }, { quoted: message });
        } catch (error) {
            console.error('AI Command Error:', error.message);
            await sock.sendMessage(chatId, {
                text: '❌ ' + getLocalizedFailureReply(language)
            }, { quoted: message });
        }
    }
};

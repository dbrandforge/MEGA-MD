import axios from 'axios';

const CURRENT_YEAR = 2026;

const AI_APIS = [
    (q) => `https://mistral.stacktoy.workers.dev/?apikey=Suhail&text=${encodeURIComponent(q)}`,
    (q) => `https://llama.gtech-apiz.workers.dev/?apikey=Suhail&text=${encodeURIComponent(q)}`,
    (q) => `https://mistral.gtech-apiz.workers.dev/?apikey=Suhail&text=${encodeURIComponent(q)}`
];

const askAI = async (query) => {
    // Prepend context so the AI knows the current year
    const contextualQuery = `Current year is ${CURRENT_YEAR}. Answer with up-to-date information. Question: ${query}`;

    for (const apiUrl of AI_APIS) {
        try {
            const { data } = await axios.get(apiUrl(contextualQuery), { timeout: 15000 });
            const response = data?.data?.response;
            if (response && typeof response === 'string' && response.trim()) {
                return response.trim();
            }
        } catch {
            continue;
        }
    }
    throw new Error('All AI APIs failed');
};

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

        try {
            await sock.sendMessage(chatId, { react: { text: '🤖', key: message.key } });
            const answer = await askAI(query);
            await sock.sendMessage(chatId, { text: answer }, { quoted: message });
        } catch (error) {
            console.error('AI Command Error:', error.message);
            await sock.sendMessage(chatId, {
                text: '❌ Failed to get AI response. Please try again later.'
            }, { quoted: message });
        }
    }
};

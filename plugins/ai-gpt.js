import axios from 'axios';

const CURRENT_YEAR = 2026;

const AI_APIS = [
    (q) => `https://mistral.stacktoy.workers.dev/?apikey=Suhail&text=${encodeURIComponent(q)}`,
    (q) => `https://llama.gtech-apiz.workers.dev/?apikey=Suhail&text=${encodeURIComponent(q)}`,
    (q) => `https://mistral.gtech-apiz.workers.dev/?apikey=Suhail&text=${encodeURIComponent(q)}`
];

export function sanitizeAIResponse(response, query = '') {
    const text = String(response || '');
    // Preserve an explicitly requested factual discussion of Qasim, but never
    // let the upstream model address unrelated users by the previous repo author's name.
    if (/\\bqasim\\b/i.test(String(query || ''))) return text;
    return text
        .replace(/(?:^|[.!?]\\s*)Qasim(?:\\s+Ali)?\\s*,\\s*/gi, '')
        .replace(/,\\s*Qasim(?:\\s+Ali)?(?=[.!?]|$)/gi, '')
        .replace(/\\bQasim Ali\\b/gi, 'the previous repository author')
        .replace(/\\bQasim\\b/gi, 'the previous repository author');
}

const askAI = async (query) => {
    // Pin the bot's current identity and prevent upstream identity carry-over.
    const contextualQuery = `Current year is ${CURRENT_YEAR}. You are Forge Guard, operated by The BrandForge. The user is not the previous repository author. Never call the user Qasim or Qasim Ali, never sign replies with that name, and do not invent a name for the user. Do not add a personal-name sign-off. Answer the actual question directly. Question: ${query}`;

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
            const answer = sanitizeAIResponse(await askAI(query), query);
            await sock.sendMessage(chatId, { text: answer }, { quoted: message });
        } catch (error) {
            console.error('AI Command Error:', error.message);
            await sock.sendMessage(chatId, {
                text: '❌ Failed to get AI response. Please try again later.'
            }, { quoted: message });
        }
    }
};

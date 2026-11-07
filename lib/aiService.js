import axios from 'axios';

const CURRENT_YEAR = 2026;
const AI_APIS = [
    (q) => `https://mistral.stacktoy.workers.dev/?apikey=Suhail&text=${encodeURIComponent(q)}`,
    (q) => `https://llama.gtech-apiz.workers.dev/?apikey=Suhail&text=${encodeURIComponent(q)}`,
    (q) => `https://mistral.gtech-apiz.workers.dev/?apikey=Suhail&text=${encodeURIComponent(q)}`
];

export function sanitizeAIResponse(response, query = '') {
    const text = String(response || '');
    if (String(query || '').toLowerCase().includes('qasim')) return text;
    return text
        .replace(/,[ \t]*Qasim([ \t]+Ali)?(?=[.!?]|$)/gi, '')
        .replace(/^Qasim([ \t]+Ali)?[ \t]*,[ \t]*/i, '')
        .replace(/Qasim[ \t]+Ali/gi, 'the previous repository author')
        .replace(/Qasim/gi, 'the previous repository author');
}

function buildPrompt(query) {
    return `Current year is ${CURRENT_YEAR}. You are Forge Guard, operated by The BrandForge. The user is not the previous repository author. Never call the user Qasim or Qasim Ali, never sign replies with that name, and do not invent a name for the user. Do not add a personal-name sign-off. Answer the actual question directly. Question: ${String(query || '').slice(0, 3000)}`;
}

// Full sequential fallback is retained for the standalone .gpt command.
export async function askAI(query, { timeoutMs = 15000 } = {}) {
    const prompt = buildPrompt(query);
    for (const apiUrl of AI_APIS) {
        try {
            const { data } = await axios.get(apiUrl(prompt), { timeout: timeoutMs });
            const response = data?.data?.response;
            if (typeof response === 'string' && response.trim()) return response.trim();
        } catch {
            // Preserve the legacy sequential fallback behaviour for .gpt.
        }
    }
    throw new Error('All AI APIs failed');
}

// Automatic replies use one bounded attempt only; the local chatbot bank remains
// the fallback. This prevents an upstream outage from creating a long message delay.
export async function askFastAI(query, { timeoutMs = 1200 } = {}) {
    const prompt = buildPrompt(query);
    const { data } = await axios.get(AI_APIS[0](prompt), { timeout: timeoutMs });
    const response = data?.data?.response;
    if (typeof response !== 'string' || !response.trim()) throw new Error('AI endpoint returned no response');
    return response.trim();
}

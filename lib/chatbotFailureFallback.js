import { pickPersonalityReply } from '../data/forgeBotPersonalityBank.js';

const PERSONALITY_SAFE_INTENTS = new Set([
    'greeting', 'wellbeing', 'thanks', 'apology', 'agreement', 'disagreement',
    'teasing', 'savage', 'flirty', 'empathy', 'boredom', 'pidgin', 'yoruba',
    'humour', 'group'
]);

export function getChatbotFailureFallback(query, options = {}) {
    const {
        language = 'english',
        intent = 'fallback',
        chatId = 'global',
        previousReply = '',
        gender = null
    } = options;

    if (PERSONALITY_SAFE_INTENTS.has(intent)) {
        try {
            const reply = pickPersonalityReply(query, { chatId, previousReply, gender });
            if (reply) return reply;
        } catch (error) {
            console.warn('[Chatbot Fallback] Personality fallback failed:', error.message);
        }
    }

    if (language === 'pidgin') {
        return 'My reply no land properly just now. Abeg, give me another chance make I get this one right. 😅';
    }
    if (language === 'yoruba') {
        return 'Ẹ jọ̀ọ́, ìdáhùn mi kò jáde dáadáa báyìí. Jọ̀ọ́ tún sọ ọ́ fún mi; mo ṣì ń gbọ́ ẹ. 😅';
    }
    return 'That reply got tangled on my end. Give me that one again; I’m still here. 😅';
}

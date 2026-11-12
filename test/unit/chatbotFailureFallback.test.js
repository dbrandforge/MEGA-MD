import { describe, expect, it } from 'vitest';
import { getChatbotFailureFallback } from '../../lib/chatbotFailureFallback.js';

describe('Forge Guard conversational AI-failure fallback', () => {
    it('uses the personality bank for safe social exchanges instead of a generic failure notice', () => {
        const reply = getChatbotFailureFallback('O ti sun mi', {
            language: 'yoruba',
            intent: 'yoruba',
            chatId: 'matured-minded@g.us'
        });
        expect(reply).toBeTruthy();
        expect(reply).not.toMatch(/reliable answer|try again shortly/i);
    });

    it('keeps factual-answer failures honest and language matched', () => {
        expect(getChatbotFailureFallback('Explain photosynthesis', {
            language: 'pidgin',
            intent: 'definition'
        })).toContain('Abeg');
        expect(getChatbotFailureFallback('Explain photosynthesis', {
            language: 'yoruba',
            intent: 'definition'
        })).toContain('Ẹ jọ̀ọ́');
    });

    it('uses a natural, accountable fallback for an unclassified English message', () => {
        const reply = getChatbotFailureFallback('That was useless', { language: 'english', intent: 'fallback' });
        expect(reply).toContain('got tangled');
        expect(reply).not.toMatch(/couldn’t produce a reliable answer/i);
    });
});

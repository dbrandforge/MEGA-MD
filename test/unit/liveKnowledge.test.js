import { describe, expect, it } from 'vitest';
import { isRelevantSearchResult, isTimeSensitiveQuestion } from '../../lib/liveKnowledge.js';

describe('Forge Guard live-information routing', () => {
    it('routes local business recommendations through current evidence', () => {
        expect(isTimeSensitiveQuestion('Where can I get the best shawarma around Ojo?')).toBe(true);
    });

    it('routes task-app payment and eligibility questions through current evidence', () => {
        expect(isTimeSensitiveQuestion('Apps that pay real money for tasks in Nigeria')).toBe(true);
        expect(isTimeSensitiveQuestion('What do you know about Poppo Live app?')).toBe(true);
    });

    it('does not treat ordinary evergreen definitions as live searches', () => {
        expect(isTimeSensitiveQuestion('What is accounting?')).toBe(false);
    });

    it('rejects search results unrelated to the actual query', () => {
        expect(isRelevantSearchResult('testing if you have superpowers', {
            title: 'Snake Clash App Store',
            content: 'A casual mobile game about snakes.'
        })).toBe(false);
    });

    it('retains evidence that matches a local recommendation query', () => {
        expect(isRelevantSearchResult('best shawarma around Ojo', {
            title: 'Shawarma restaurants in Ojo',
            content: 'A local shawarma restaurant serving customers in Ojo, Lagos.'
        })).toBe(true);
    });
});

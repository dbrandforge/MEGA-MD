import { describe, expect, it } from 'vitest';
import { isRelevantSearchResult, isTimeSensitiveQuestion, resolveContextualBusinessFollowup } from '../../lib/liveKnowledge.js';

describe('Forge Guard live-information routing', () => {
    it('routes local business recommendations through current evidence', () => {
        expect(isTimeSensitiveQuestion('Where can I get the best shawarma around Ojo?')).toBe(true);
    });

    it('routes pastry, bakery and Tokunbo dealer discovery through live evidence', () => {
        expect(isTimeSensitiveQuestion('Where can I get the best pastries in Lagos?')).toBe(true);
        expect(isTimeSensitiveQuestion('Where can I get a good Tokunbo car dealer in Ojo?')).toBe(true);
    });

    it('routes Nigerian slang meaning questions through current evidence', () => {
        expect(isTimeSensitiveQuestion('The slang fra in Nigeria means what?')).toBe(true);
    });

    it('resolves a business address follow-up to the first named hotel and its prior area', () => {
        const history = [
            { name: 'You', text: 'Give me list of budget friendly hotels or guest houses around Igando within 10k - 20k' },
            { name: 'Forge Bot', text: 'Check out **De-Orange Hotel & Suites**, **Volf C Hotel**, or **Grandbee Suites** around the Igando/Alimosho axis.' }
        ];
        const resolved = resolveContextualBusinessFollowup('Can you help me check their address?', history);
        expect(resolved).toContain('De-Orange Hotel & Suites');
        expect(resolved).toContain('Igando, Lagos, Nigeria');
        expect(resolved).toContain('street address');
    });

    it('resolves a contact-number follow-up without losing the referenced business', () => {
        const history = [
            { name: 'You', text: 'Give me list of budget friendly hotels around Igando' },
            { name: 'Forge Bot', text: 'Try **De-Orange Hotel & Suites** or **Volf C Hotel**.' }
        ];
        const resolved = resolveContextualBusinessFollowup('Can I get the contact number for the first hotel?', history);
        expect(resolved).toContain('phone number');
        expect(resolved).toContain('De-Orange Hotel & Suites');
        expect(resolved).not.toContain('Volf C Hotel');
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

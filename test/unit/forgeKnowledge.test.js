import { describe, expect, it } from 'vitest';
import { buildForgeKnowledgeContext, buildGroupConversationModeContext, getForgeKnowledgeReply } from '../../lib/forgeKnowledge.js';

describe('Forge Guard verified knowledge and group-aware conversation context', () => {
    it('answers BrandForge questions from verified positioning and services', () => {
        const reply = getForgeKnowledgeReply('What do you remember about The BrandForge?');
        expect(reply).toContain('AB BRANDFORGE ENTERPRISE');
        expect(reply).toContain('premium, strategy-led branding');
        expect(reply).toContain('Forging Brands | Fueling Growth');
        expect(reply).toContain('Your brand should be hard to forget');
    });

    it('returns official channels when someone simply asks for your socials', () => {
        expect(getForgeKnowledgeReply('What are your socials?')).toContain('@dbrandforge');
        expect(getForgeKnowledgeReply('What is your founder’s LinkedIn?')).toContain('linkedin.com/in/abraham-oyetunji');
    });

    it('answers direct questions about the founder with verified professional facts', () => {
        const reply = getForgeKnowledgeReply('Tell me about Forge');
        expect(reply).toContain('Abraham');
        expect(reply).toContain('Creative Director');
        expect(reply).toContain('founder of The BrandForge');
        expect(reply).toContain('linkedin.com/in/abraham-oyetunji');
    });

    it('returns the official BrandForge social handles without inventing separate account names', () => {
        const reply = getForgeKnowledgeReply('What are The BrandForge socials?');
        expect(reply).toContain('@dbrandforge');
        expect(reply).toContain('Instagram, X, Threads and YouTube');
    });

    it('does not guess or expose a phone number when no verified contact is configured', () => {
        const reply = getForgeKnowledgeReply('How can I contact your creator?');
        const personalNumberReply = getForgeKnowledgeReply('What is your personal number?');
        expect(reply).toContain('not configured');
        expect(personalNumberReply).toContain('not configured');
        expect(reply).not.toMatch(/234\d{10}/);
    });

    it('does not attach group conversation mode to private chats', () => {
        expect(buildGroupConversationModeContext(null, '2348000000000@s.whatsapp.net')).toBe('');
    });

    it('keeps adult-oriented group culture scoped to the configured Matured Minded package', () => {
        const mature = buildGroupConversationModeContext({ featureSets: { maturedMinded: true } }, 'some-group@g.us');
        expect(mature).toContain('MATURED MINDED');
        expect(mature).toContain('consenting adults');
        expect(mature).toContain('Do not assume someone is an adult');
        expect(mature).toContain('Do not force mature topics');
        const general = buildGroupConversationModeContext({ featureSets: { general: true } }, 'another-group@g.us');
        expect(general).toContain('GENERAL');
        expect(general).not.toContain('adult-oriented conversational culture');
    });

    it('does not infer business ownership from a mention and treats creator context as identity-only', () => {
        const context = buildForgeKnowledgeContext('hello', { role: 'creator' });
        expect(context).toContain('a person’s business or employer is not their personal name');
        expect(context).toContain('verified Creator and Founder Forge');
    });
});

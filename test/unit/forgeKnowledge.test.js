import { describe, expect, it } from 'vitest';
import { buildForgeKnowledgeContext, buildGroupConversationModeContext, getForgeKnowledgeReply, getVerifiedCreatorProfile } from '../../lib/forgeKnowledge.js';

describe('Forge Guard verified knowledge and group-aware conversation context', () => {
    it('answers BrandForge questions from verified positioning and services', () => {
        const reply = getForgeKnowledgeReply('What do you remember about The BrandForge?');
        expect(reply).toContain('AB BRANDFORGE ENTERPRISE');
        expect(reply).toContain('premium, strategy-led branding');
        expect(reply).toContain('Forging Brands | Fueling Growth');
        expect(reply).toContain('Your brand should be hard to forget');
    });

    it('routes BrandForge company questions to the company answer, not the founder biography', () => {
        for (const question of [
            'Tell me about The BrandForge',
            'Tell me about the company',
            'Tell.me about the company',
            'Tell me about your creators marketing agency',
            'Tell me about your branding agency'
        ]) {
            const reply = getForgeKnowledgeReply(question);
            expect(reply).toContain('The BrandForge operates under AB BRANDFORGE ENTERPRISE');
            expect(reply).toContain('premium, strategy-led branding');
            expect(reply).not.toBe('Forge dcreative (Abraham) is a Creative Director and the founder of The BrandForge.');
        }
    });

    it('keeps explicit founder questions routed to the founder profile', () => {
        expect(getForgeKnowledgeReply('Tell me about Forge')).toContain('Creative Director, business owner');
        expect(getForgeKnowledgeReply('Tell me about Abraham')).toContain('Creative Director');
    });

    it('provides a verified creator profile for preloaded personal context', () => {
        const profile = getVerifiedCreatorProfile();
        expect(profile.roles).toContain('Creative Director');
        expect(profile.professionalFocus).toContain('brand strategy and positioning');
        expect(profile.knownBrandAndClientWork).toContain('AA Yogurt');
        expect(profile.avoid).toContain('generic AI-looking design');
        expect(profile.publicIdentity).not.toContain('Oyetunji');
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
        const brandContactReply = getForgeKnowledgeReply('How can I contact The BrandForge?');
        expect(reply).toContain('not configured');
        expect(personalNumberReply).toContain('not configured');
        expect(brandContactReply).toContain('not configured');
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

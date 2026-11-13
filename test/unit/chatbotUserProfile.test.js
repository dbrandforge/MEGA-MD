import { describe, expect, it } from 'vitest';
import {
    buildUserProfileContext,
    buildUserIdentityReply,
    extractBusinessNames,
    extractUserFacts,
    getUserProfileKey
} from '../../lib/chatbotUserProfile.js';

describe('Forge Guard sender-specific long-term profile memory', () => {
    it('extracts business names only from explicit ownership or brand statements', () => {
        expect(extractBusinessNames("My brand is Ray's Glitz and Glam."))
            .toEqual(["Ray's Glitz and Glam"]);
        expect(extractBusinessNames("I run HavenLynk, a new platform."))
            .toEqual(['HavenLynk']);
        expect(extractBusinessNames("I'm the founder of The BrandForge."))
            .toEqual(['The BrandForge']);
    });

    it('does not infer a business from casual mentions', () => {
        expect(extractBusinessNames("Ray's Glitz and Glam is looking beautiful today."))
            .toEqual([]);
        expect(extractBusinessNames("I wan build u, mad bot."))
            .toEqual([]);
    });

    it('keys long-term profiles by normalized sender identity, not group identity', () => {
        expect(getUserProfileKey('2348011111111:7@s.whatsapp.net'))
            .toBe('user:2348011111111@s.whatsapp.net');
        expect(getUserProfileKey('2348011111111@s.whatsapp.net', '120363000000000000@g.us'))
            .toBe('group:120363000000000000@g.us:user:2348011111111@s.whatsapp.net');
        expect(getUserProfileKey('')).toBeNull();
    });

    it('provides profile context with explicit sender-only isolation instructions', () => {
        const context = buildUserProfileContext({
            businesses: [{ name: "Ray's Glitz and Glam" }]
        });
        expect(context).toContain("Ray's Glitz and Glam");
        expect(context).toContain('this sender, not other group members');
        expect(buildUserProfileContext({ businesses: [] })).toBe('');
    });
    it('extracts additional profile categories from explicit statements', () => {
        const facts = extractUserFacts(
            "I'm a creative director. I'm interested in brand strategy. I'm building a new training platform. I prefer concise answers. Call me Forge."
        );
        expect(facts.professions).toContain('creative director');
        expect(facts.interests).toContain('brand strategy');
        expect(facts.projects).toContain('a new training platform');
        expect(facts.preferences).toContain('concise answers');
        expect(facts.communicationStyles).toContain('concise');
        expect(facts.preferredName).toBe('Forge');
    });

    it('does not save casual chatbot banter as profession, interest or preference', () => {
        const facts = extractUserFacts("I am fine baby what about you. I enjoy you right. I want you to have that stored as my professional role.");
        expect(facts.professions).toEqual([]);
        expect(facts.interests).toEqual([]);
        expect(facts.preferences).toEqual([]);
    });

    it('extracts professional role and a complete multi-service list generically', () => {
        const facts = extractUserFacts("My professional role is marketing agency. At The BrandForge we provide Branding, Brand Strategy, Creative Design, Digital Marketing, Business Consultancy, Training, Business Development, and related creative solutions.");
        expect(facts.professions).toContain('marketing agency');
        expect(facts.businesses).toContain('The BrandForge');
        expect(facts.offerings).toEqual([
            'Branding',
            'Brand Strategy',
            'Creative Design',
            'Digital Marketing',
            'Business Consultancy',
            'Training',
            'Business Development'
        ]);
    });

    it('supports a direct profile command phrased as profession role is', () => {
        expect(extractUserFacts('profession role is marketing agency').professions).toContain('marketing agency');
    });

    it('stores an explicit preferred language without treating the instruction as a preference blob', () => {
        const facts = extractUserFacts('I want you to have that stored as my professional role and my preferred language is English');
        expect(facts.preferredLanguage).toBe('english');
        expect(facts.preferences).toEqual([]);
    });

    it('answers who-am-I from saved facts without inventing details', () => {
        const reply = buildUserIdentityReply({
            preferredName: 'Forge',
            professions: [{ value: 'creative director' }],
            interests: [{ value: 'brand strategy' }]
        });
        expect(reply).toContain('You’re Forge');
        expect(reply).toContain('creative director');
        expect(reply).toContain('brand strategy');
        expect(reply).toContain('not assumptions');
    });

    it('recognises concise and detailed communication preferences', () => {
        expect(extractUserFacts('I prefer detailed explanations.').communicationStyles).toContain('detailed');
        expect(extractUserFacts('I prefer short answers.').communicationStyles).toContain('short');
    });

    it('captures an explicitly requested language separately from observed language', () => {
        expect(extractUserFacts('Please speak to me in Yoruba.').preferredLanguage).toBe('yoruba');
    });

});

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

import { describe, expect, it } from 'vitest';
import {
    buildUserProfileContext,
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
});

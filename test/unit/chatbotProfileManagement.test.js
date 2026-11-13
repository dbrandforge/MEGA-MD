import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/lightweight_store.js', () => ({
    default: {
        getSetting: vi.fn(),
        saveSettingVerified: vi.fn()
    }
}));

import store from '../../lib/lightweight_store.js';
import {
    extractUserFacts,
    getUserProfile,
    buildUserProfileContext,
    removeUserProfileFact,
    clearUserProfile,
    setUserProfileGroupSharing
} from '../../lib/chatbotUserProfile.js';

const sender = '2348011111111@s.whatsapp.net';
let settings;

describe('Forge Guard user-controlled profile facts', () => {
    beforeEach(() => {
        settings = new Map();
        vi.clearAllMocks();
        store.getSetting.mockImplementation(async (key, setting) => settings.get(key + ':' + setting) || null);
        store.saveSettingVerified.mockImplementation(async (key, setting, value) => {
            settings.set(key + ':' + setting, value);
            return true;
        });
    });

    it('extracts explicit business and service information for a member update', () => {
        const facts = extractUserFacts('My business is Ray’s Glitz & Glam. I specialize in bridal makeup.');
        expect(facts.businesses).toContain('Ray’s Glitz & Glam');
        expect(facts.offerings).toContain('bridal makeup');
    });

    it('filters old conversational noise from stored profile facts on read', async () => {
        settings.set('user:2348011111111@s.whatsapp.net:chatbotUserProfile', {
            professions: [{ value: 'fine baby what about you' }],
            interests: [{ value: 'you right' }],
            preferences: [{ value: 'you to have that stored as my professional role' }],
            offerings: [{ value: 'branding' }]
        });
        const profile = await getUserProfile(sender);
        expect(profile.professions).toEqual([]);
        expect(profile.interests).toEqual([]);
        expect(profile.preferences).toEqual([]);
        expect(profile.offerings.map(item => item.value)).toEqual(['branding']);
    });

    it('does not treat observed language alone as a personal profile', () => {
        expect(buildUserProfileContext({ lastObservedLanguage: 'english', languageCounts: { english: 3 } })).toBe('');
    });

    it('captures a member’s explicit preferred language', () => {
        expect(extractUserFacts('I prefer Yoruba').preferredLanguage).toBe('yoruba');
        expect(extractUserFacts('My preferred language is Pidgin').preferredLanguage).toBe('pidgin');
    });

    it('does not mistake a negative preference for a service offering', () => {
        expect(extractUserFacts('I do not like spam messages.').offerings).toEqual([]);
    });

    it('captures Pidgin and Yoruba descriptions of what a member does', () => {
        expect(extractUserFacts('I dey sell wigs.').offerings).toContain('wigs');
        expect(extractUserFacts('Mo n ta aso.').offerings).toContain('aso');
    });

    it('removes only the selected fact when a value is supplied', async () => {
        settings.set('user:2348011111111@s.whatsapp.net:chatbotUserProfile', {
            businesses: [{ value: 'Ray’s Glitz & Glam' }],
            interests: [{ value: 'beauty' }, { value: 'fashion' }]
        });
        const updated = await removeUserProfileFact(sender, 'interests', 'beauty');
        expect(updated.interests.map(item => item.value)).toEqual(['fashion']);
        expect(updated.businesses[0].value).toBe('Ray’s Glitz & Glam');
    });

    it('clears one profile field when no individual value is supplied', async () => {
        settings.set('user:2348011111111@s.whatsapp.net:chatbotUserProfile', {
            interests: [{ value: 'beauty' }],
            projects: [{ value: 'new collection' }]
        });
        const updated = await removeUserProfileFact(sender, 'interests');
        expect(updated.interests).toEqual([]);
        expect(updated.projects).toHaveLength(1);
    });

    it('lets a member explicitly opt private facts into group context', async () => {
        const updated = await setUserProfileGroupSharing(sender, true);
        expect(updated.sharing.groupContext).toBe(true);
        const privateAgain = await setUserProfileGroupSharing(sender, false);
        expect(privateAgain.sharing.groupContext).toBe(false);
    });

    it('clears only the requesting sender profile', async () => {
        await clearUserProfile(sender);
        const profile = await getUserProfile(sender);
        expect(profile.businesses).toEqual([]);
        expect(profile.interests).toEqual([]);
    });
});

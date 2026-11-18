import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    clearUserProfileCache,
    setUserProfileGroupSharing
} from '../../lib/chatbotUserProfile.js';

const sender = '2348011111111@s.whatsapp.net';
let settings;
afterEach(() => vi.restoreAllMocks());

describe('Forge Guard user-controlled profile facts', () => {
    beforeEach(() => {
        clearUserProfileCache();
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
            preferences: [{ value: 'you to have that stored as my professional role and my preferred language is English' }],
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
        expect(extractUserFacts('We provide branding, strategy and design.').offerings)
            .toEqual(['branding', 'strategy', 'design']);
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


describe('bounded user-profile read cache', () => {
    beforeEach(() => {
        clearUserProfileCache();
        settings = new Map();
        vi.clearAllMocks();
        store.getSetting.mockImplementation(async (key, setting) => settings.get(key + ':' + setting) || null);
        store.saveSettingVerified.mockImplementation(async (key, setting, value) => {
            settings.set(key + ':' + setting, value);
            return true;
        });
    });

    it('reuses a warm profile instead of querying MongoDB for every group message', async () => {
        settings.set('user:' + sender + ':chatbotUserProfile', {
            businesses: [{ value: 'Forge Studio' }]
        });
        const first = await getUserProfile(sender);
        const second = await getUserProfile(sender);

        expect(first.businesses[0].value).toBe('Forge Studio');
        expect(second.businesses[0].value).toBe('Forge Studio');
        expect(store.getSetting).toHaveBeenCalledTimes(1);
    });

    it('waits seven days of returning activity before refreshing an automatic profile', async () => {
        const start = 1_800_000_000_000;
        const clock = vi.spyOn(Date, 'now').mockReturnValue(start);

        const first = await (await import('../../lib/chatbotUserProfile.js')).updateUserProfileFromMessage(
            sender, 'My business is Forge Studio.'
        );
        expect(first.businesses).toEqual([]);
        expect(first.firstSeenAt).toBe(start);
        expect(first.lastProfileRefreshAt).toBeNull();
        expect(store.saveSettingVerified).toHaveBeenCalledTimes(1);

        clock.mockReturnValue(start + 6 * 24 * 60 * 60 * 1000);
        const daySix = await (await import('../../lib/chatbotUserProfile.js')).updateUserProfileFromMessage(
            sender, 'My business is Forge Studio.'
        );
        expect(daySix.businesses).toEqual([]);
        expect(store.saveSettingVerified).toHaveBeenCalledTimes(1);

        clock.mockReturnValue(start + 7 * 24 * 60 * 60 * 1000);
        const daySeven = await (await import('../../lib/chatbotUserProfile.js')).updateUserProfileFromMessage(
            sender, 'My business is Forge Studio.'
        );
        expect(daySeven.businesses.map(item => item.value)).toContain('Forge Studio');
        expect(daySeven.lastProfileRefreshAt).toBe(start + 7 * 24 * 60 * 60 * 1000);
        expect(store.saveSettingVerified).toHaveBeenCalledTimes(2);
    });

    it('allows a user-requested profile edit to bypass the seven-day wait', async () => {
        const start = 1_810_000_000_000;
        vi.spyOn(Date, 'now').mockReturnValue(start);
        const { updateUserProfileFromMessage } = await import('../../lib/chatbotUserProfile.js');
        const profile = await updateUserProfileFromMessage(sender, 'My business is Forge Studio.', { force: true });
        expect(profile.businesses.map(item => item.value)).toContain('Forge Studio');
        expect(profile.lastProfileRefreshAt).toBe(start);
    });

    it('updates the cache immediately after an explicit privacy change', async () => {
        await setUserProfileGroupSharing(sender, true);
        const profile = await getUserProfile(sender);
        expect(profile.sharing.groupContext).toBe(true);
        expect(store.getSetting).toHaveBeenCalledTimes(1);
    });
});


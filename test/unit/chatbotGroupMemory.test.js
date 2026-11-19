import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/lightweight_store.js', () => ({
    default: {
        getSetting: vi.fn(),
        saveSetting: vi.fn(),
        saveSettingVerified: vi.fn()
    }
}));

import store from '../../lib/lightweight_store.js';
import {
    clearGroupMemoryCache,
    flushPendingGroupRosterWrites,
    recordGroupInteraction,
    getGroupMemberProfile,
    buildGroupContinuityContext
} from '../../lib/chatbotGroupMemory.js';

describe('Forge Guard group-wide member memory is disabled', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearGroupMemoryCache();
    });

    it('does not record individual group messages or create roster writes', async () => {
        expect(await recordGroupInteraction(
            '120363000000000000@g.us',
            '2348011111111@s.whatsapp.net',
            'Member',
            'A message from an ordinary member',
            'english'
        )).toBeNull();
        expect(await flushPendingGroupRosterWrites()).toBe(0);
        expect(store.getSetting).not.toHaveBeenCalled();
        expect(store.saveSetting).not.toHaveBeenCalled();
        expect(store.saveSettingVerified).not.toHaveBeenCalled();
    });

    it('does not expose group member profiles or continuity history', async () => {
        expect(await getGroupMemberProfile(
            '120363000000000000@g.us',
            '2348011111111@s.whatsapp.net'
        )).toBeNull();
        expect(await buildGroupContinuityContext(
            '120363000000000000@g.us',
            '2348022222222@s.whatsapp.net',
            'What did that member say?'
        )).toBe('');
        expect(store.getSetting).not.toHaveBeenCalled();
    });
});

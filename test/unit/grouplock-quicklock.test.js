import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mockStore = vi.hoisted(() => {
    const values = new Map();
    return {
        values,
        getSetting: vi.fn(async (chatId, key) => values.get(`${chatId}:${key}`) ?? null),
        saveSettingVerified: vi.fn(async (chatId, key, value) => {
            values.set(`${chatId}:${key}`, value);
            return true;
        })
    };
});

vi.mock('../../lib/lightweight_store.js', () => ({ default: mockStore }));
vi.mock('../../lib/groupFeatureAccess.js', () => ({
    hasMaturedMindedFeatures: vi.fn(async () => true)
}));
vi.mock('../../lib/featureGroups.js', () => ({
    PRIMARY_FEATURE_GROUP: '120363000000000001@g.us'
}));
vi.mock('../../data/dailyActivities.js', () => ({
    dailyActivities: {},
    lockSchedule: {
        default: { lock: '01:00', unlock: '06:00' },
        sunday: { lock: '01:00', unlock: '12:00' }
    }
}));
vi.mock('../../data/groupLifecycleMessages.js', () => ({
    goodnightMessages: [],
    goodmorningMessages: [],
    pickRotatingMessage: vi.fn()
}));
vi.mock('../../config.js', () => ({ default: {} }));

import { checkGroupLockSchedule } from '../../plugins/grouplock.js';

const GROUP = '120363000000000001@g.us';
const QUICK_LOCK_KEY = 'groupQuickLock_v1';

describe('quicklock scheduler lifecycle', () => {
    beforeEach(() => {
        mockStore.values.clear();
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('does not let the recurring daily lock activate a future quicklock early', async () => {
        // 02:30 in Lagos, inside the regular 01:00-06:00 lock window.
        vi.setSystemTime(new Date('2026-11-25T01:30:00.000Z'));
        await mockStore.saveSettingVerified(GROUP, QUICK_LOCK_KEY, {
            status: 'scheduled',
            startAt: Date.parse('2026-11-25T02:00:00.000Z'),
            durationMs: 120000
        });

        const sock = {
            groupSettingUpdate: vi.fn(async () => {}),
            sendMessage: vi.fn(async () => {})
        };

        await checkGroupLockSchedule(sock, GROUP);

        expect(sock.groupSettingUpdate).not.toHaveBeenCalled();
        expect(sock.sendMessage).not.toHaveBeenCalled();
    });

    it('starts the quicklock duration only after activation succeeds', async () => {
        vi.setSystemTime(new Date('2026-11-25T02:01:00.000Z'));
        await mockStore.saveSettingVerified(GROUP, QUICK_LOCK_KEY, {
            status: 'scheduled',
            startAt: Date.parse('2026-11-25T02:00:00.000Z'),
            durationMs: 120000
        });

        const sock = {
            groupSettingUpdate: vi.fn(async () => {}),
            sendMessage: vi.fn(async () => {})
        };

        await checkGroupLockSchedule(sock, GROUP);

        const saved = await mockStore.getSetting(GROUP, QUICK_LOCK_KEY);
        expect(sock.groupSettingUpdate).toHaveBeenCalledTimes(1);
        expect(sock.groupSettingUpdate).toHaveBeenCalledWith(GROUP, 'announcement');
        expect(saved.status).toBe('locked');
        expect(saved.lockedAt).toBe(Date.now());
        expect(saved.endAt).toBe(Date.now() + 120000);
        expect(await mockStore.getSetting(GROUP, 'groupLockState')).toEqual(
            expect.objectContaining({ locked: true, source: 'quicklock' })
        );
        expect(sock.sendMessage).toHaveBeenCalledTimes(1);
    });
});

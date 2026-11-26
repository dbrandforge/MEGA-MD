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

import groupLockCommand, { checkGroupLockSchedule } from '../../plugins/grouplock.js';

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
        expect(sock.sendMessage.mock.calls[0][1]).toMatchObject({ mentionAll: true });
        expect(sock.sendMessage.mock.calls[0][1].text).toContain('2 minutes');
        expect(sock.sendMessage.mock.calls[0][1].text).toContain('Automatic unlock');
        expect(sock.sendMessage.mock.calls[0][1]).not.toHaveProperty('mentions');

        // The group remains locked until the duration really expires.
        await vi.advanceTimersByTimeAsync(120000);
        await checkGroupLockSchedule(sock, GROUP);

        const completed = await mockStore.getSetting(GROUP, QUICK_LOCK_KEY);
        expect(completed.status).toBe('completed');
        expect(completed.completedWithDailyLockPreserved).toBe(true);
        expect(sock.groupSettingUpdate).toHaveBeenCalledTimes(1);
        expect(sock.sendMessage).toHaveBeenCalledTimes(2);
        expect(sock.sendMessage.mock.calls[1][1].text).toContain('regular group lock remains active');
    });

    it('announces every manual lock with native @all even if the nightly announcement was already sent', async () => {
        vi.setSystemTime(new Date('2026-11-25T02:01:00.000Z'));
        await mockStore.saveSettingVerified(GROUP, 'groupLockGoodnightSent', {
            date: '2026-11-25',
            sentAt: Date.now() - 60000
        });
        const sock = {
            groupSettingUpdate: vi.fn(async () => {}),
            sendMessage: vi.fn(async () => {})
        };
        const message = { key: { remoteJid: GROUP }, message: { conversation: '.lock' } };

        await groupLockCommand.handler(sock, message, ['lock'], {
            chatId: GROUP,
            channelInfo: {},
            senderId: '2348000000001@s.whatsapp.net'
        });

        expect(sock.groupSettingUpdate).toHaveBeenCalledWith(GROUP, 'announcement');
        expect(sock.sendMessage).toHaveBeenCalledTimes(1);
        expect(sock.sendMessage.mock.calls[0][1]).toMatchObject({ mentionAll: true });
        expect(sock.sendMessage.mock.calls[0][1].text).toContain('locked by an admin');
        expect(sock.sendMessage.mock.calls[0][1]).not.toHaveProperty('mentions');
    });

});

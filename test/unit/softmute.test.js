import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockStore = vi.hoisted(() => {
    const values = new Map();
    return {
        values,
        getSetting: vi.fn(async (chatId, key) => values.get(`${chatId}:${key}`) ?? null),
        saveSetting: vi.fn(async (chatId, key, value) => {
            values.set(`${chatId}:${key}`, value);
        })
    };
});

vi.mock('../../lib/lightweight_store.js', () => ({ default: mockStore }));
vi.mock('../../config.js', () => ({ default: { muteDurationHours: 10 } }));

import store from '../../lib/lightweight_store.js';
import {
    cleanExpiredSoftMutes,
    isSoftMuted,
    softMuteUser,
    softUnmuteUser
} from '../../plugins/softmute.js';

const GROUP = '120363000000000001@g.us';

describe('soft mute expiry and scheduler registration', () => {
    beforeEach(() => {
        mockStore.values.clear();
        vi.clearAllMocks();
    });

    it('removes expired and malformed mute records but preserves active records', async () => {
        const activeUntil = Date.now() + 60_000;
        await store.saveSetting(GROUP, 'softMutes', {
            expired: { until: Date.now() - 1 },
            malformed: { mutedAt: Date.now() },
            active: { until: activeUntil }
        });

        const removed = await cleanExpiredSoftMutes(GROUP);

        expect(removed).toBe(2);
        expect(await store.getSetting(GROUP, 'softMutes')).toEqual({
            active: { until: activeUntil }
        });
    });

    it('treats a malformed mute record as unmuted and cleans it', async () => {
        await store.saveSetting(GROUP, 'softMutes', {
            '2348000000000@s.whatsapp.net': { mutedAt: Date.now() }
        });

        await expect(isSoftMuted(GROUP, '2348000000000@s.whatsapp.net')).resolves.toBe(false);
        expect(await store.getSetting(GROUP, 'softMutes')).toEqual({});
    });

    it('matches LID mentions to PN-resolved messages and removes both aliases on unmute', async () => {
        const lid = '123456789@lid';
        const pn = '2348000000000@s.whatsapp.net';
        const sock = {
            signalRepository: {
                lidMapping: {
                    getPNForLID: vi.fn(async () => pn)
                }
            }
        };

        await softMuteUser(sock, GROUP, lid, 10);
        expect(await isSoftMuted(GROUP, pn)).toBe(true);
        const saved = await store.getSetting(GROUP, 'softMutes');
        expect(saved[lid]).toBeTruthy();
        expect(saved[pn]).toBeTruthy();

        await softUnmuteUser(GROUP, lid);
        expect(await store.getSetting(GROUP, 'softMutes')).toEqual({});
    });

    it('registers a group with the scheduler whenever a member is soft-muted', async () => {
        await softMuteUser({}, GROUP, '2348000000000@s.whatsapp.net', 10);

        expect(await store.getSetting('global', 'forgeGuardTrackedGroups')).toContain(GROUP);
        const mutes = await store.getSetting(GROUP, 'softMutes');
        expect(mutes['2348000000000@s.whatsapp.net'].until).toBeGreaterThan(Date.now());
    });
});

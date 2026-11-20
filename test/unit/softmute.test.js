import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockStore = vi.hoisted(() => {
    const values = new Map();
    return {
        values,
        getSetting: vi.fn(async (chatId, key) => values.get(`${chatId}:${key}`) ?? null),
        saveSetting: vi.fn(async (chatId, key, value) => {
            values.set(`${chatId}:${key}`, value);
        }),
        saveSettingVerified: vi.fn(async (chatId, key, value) => {
            values.set(`${chatId}:${key}`, value);
            return true;
        })
    };
});

vi.mock('../../lib/lightweight_store.js', () => ({ default: mockStore }));
vi.mock('../../config.js', () => ({ default: { muteDurationHours: 10 } }));
vi.mock('../../plugins/schedule.js', () => ({ trackGroup: vi.fn(async () => true) }));

import store from '../../lib/lightweight_store.js';
import { trackGroup } from '../../plugins/schedule.js';
import {
    cleanExpiredSoftMutes,
    getSoftMuteDurationHours,
    isSoftMuted,
    softMuteUser,
    invalidateSoftMuteCache,
    softUnmuteUser,
    handleSoftMuteMessage
} from '../../plugins/softmute.js';

const GROUP = '120363000000000001@g.us';

describe('soft mute expiry and scheduler registration', () => {
    beforeEach(() => {
        mockStore.values.clear();
        invalidateSoftMuteCache();
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

    it('uses the group-specific soft-mute duration when no explicit duration is passed', async () => {
        await store.saveSetting(GROUP, 'softMuteDurationHours', 3);
        await expect(getSoftMuteDurationHours(GROUP)).resolves.toBe(3);
        const startedAt = Date.now();
        await softMuteUser({}, GROUP, '2348000000000@s.whatsapp.net');
        const mute = (await store.getSetting(GROUP, 'softMutes'))['2348000000000@s.whatsapp.net'];
        expect(mute.until - startedAt).toBeGreaterThanOrEqual(3 * 60 * 60 * 1000 - 100);
        expect(mute.until - startedAt).toBeLessThanOrEqual(3 * 60 * 60 * 1000 + 100);
    });

    it('deletes messages from an actively muted member', async () => {
        const user = '2348000000000@s.whatsapp.net';
        await softMuteUser({}, GROUP, user, 10);
        const message = { key: { id: 'muted-message', remoteJid: GROUP, participant: user, fromMe: false } };
        const sock = { sendMessage: vi.fn(async () => ({})) };

        await expect(handleSoftMuteMessage(sock, GROUP, message, user)).resolves.toBe(true);
        expect(sock.sendMessage).toHaveBeenCalledWith(GROUP, { delete: message.key });
    });

    it('normalizes device-qualified PN JIDs without losing the JID domain', async () => {
        const deviceJid = '2348000000000:12@s.whatsapp.net';
        const plainJid = '2348000000000@s.whatsapp.net';

        await softMuteUser({}, GROUP, deviceJid, 10);

        expect(await isSoftMuted(GROUP, plainJid)).toBe(true);
        await softUnmuteUser(GROUP, plainJid);
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

    it('matches legacy LID-only mute records to PN senders after identity mapping', async () => {
        const lid = '123456789@lid';
        const pn = '2348000000000@s.whatsapp.net';
        await store.saveSetting(GROUP, 'softMutes', {
            [lid]: { until: Date.now() + 60_000, original: lid, canonical: lid }
        });
        const sock = {
            signalRepository: {
                lidMapping: { getPNForLID: vi.fn(async () => pn) }
            },
            sendMessage: vi.fn(async () => ({}))
        };
        const message = { key: { id: 'legacy-muted', remoteJid: GROUP, participant: pn, fromMe: false } };

        await expect(handleSoftMuteMessage(sock, GROUP, message, pn)).resolves.toBe(true);
        expect(sock.sendMessage).toHaveBeenCalledWith(GROUP, { delete: message.key });
    });

    it('registers a group with the scheduler whenever a member is soft-muted', async () => {
        await softMuteUser({}, GROUP, '2348000000000@s.whatsapp.net', 10);

        expect(trackGroup).toHaveBeenCalledWith(GROUP);
        const mutes = await store.getSetting(GROUP, 'softMutes');
        expect(mutes['2348000000000@s.whatsapp.net'].until).toBeGreaterThan(Date.now());
    });

    it('deletes messages from a member who arrives as a LID when the mute was stored under their PN', async () => {
        const lid = '555000111@lid';
        const pn = '2348000000000@s.whatsapp.net';
        await store.saveSetting(GROUP, 'softMutes', {
            [pn]: { until: Date.now() + 60_000, original: pn, canonical: pn }
        });
        const sock = {
            signalRepository: { lidMapping: { getPNForLID: vi.fn(async () => pn) } },
            sendMessage: vi.fn(async () => ({}))
        };
        const message = { key: { id: 'lid-sender', remoteJid: GROUP, participant: lid, fromMe: false } };

        await expect(handleSoftMuteMessage(sock, GROUP, message, lid)).resolves.toBe(true);
        expect(sock.sendMessage).toHaveBeenCalledWith(GROUP, { delete: message.key });
    });

    it('matches on the alternate PN carried by the message key without any mapping lookup', async () => {
        const lid = '555000111@lid';
        const pn = '2348000000000@s.whatsapp.net';
        await store.saveSetting(GROUP, 'softMutes', {
            [pn]: { until: Date.now() + 60_000, original: pn, canonical: pn }
        });
        const getPNForLID = vi.fn(async () => null);
        const sock = { signalRepository: { lidMapping: { getPNForLID } }, sendMessage: vi.fn(async () => ({})) };
        const message = { key: { id: 'alt', remoteJid: GROUP, participant: lid, participantAlt: pn, fromMe: false } };

        await expect(handleSoftMuteMessage(sock, GROUP, message, lid)).resolves.toBe(true);
        expect(getPNForLID).not.toHaveBeenCalled();
    });

    it('does no identity lookups at all when the group has no active mutes', async () => {
        const getPNForLID = vi.fn(async () => null);
        const sock = { signalRepository: { lidMapping: { getPNForLID } }, sendMessage: vi.fn(async () => ({})) };
        const message = { key: { id: 'free', remoteJid: GROUP, participant: '777@lid', fromMe: false } };

        await expect(handleSoftMuteMessage(sock, GROUP, message, '777@lid')).resolves.toBe(false);
        expect(getPNForLID).not.toHaveBeenCalled();
    });

    it('caches identity lookups so a busy group does not repeat them for the same member', async () => {
        await store.saveSetting(GROUP, 'softMutes', {
            '2348000000000@s.whatsapp.net': { until: Date.now() + 60_000 }
        });
        const getPNForLID = vi.fn(async () => '2349999999999@s.whatsapp.net');
        const sock = { signalRepository: { lidMapping: { getPNForLID } }, sendMessage: vi.fn(async () => ({})) };
        const lid = '888000222@lid';
        for (let i = 0; i < 5; i++) {
            const message = { key: { id: `chat-${i}`, remoteJid: GROUP, participant: lid, fromMe: false } };
            await expect(handleSoftMuteMessage(sock, GROUP, message, lid)).resolves.toBe(false);
        }
        expect(getPNForLID).toHaveBeenCalledTimes(1);
    });

    it('stores the opposite identity format when it can be resolved at mute time', async () => {
        const pn = '2348000000000@s.whatsapp.net';
        const lid = '999000333@lid';
        const sock = { signalRepository: { lidMapping: { getLIDForPN: vi.fn(async () => lid) } } };

        await softMuteUser(sock, GROUP, pn, 10);

        const saved = await store.getSetting(GROUP, 'softMutes');
        expect(saved[pn]).toBeTruthy();
        expect(saved[lid]).toBeTruthy();
        expect(await isSoftMuted(GROUP, lid)).toBe(true);
    });

    it('announces expiry in the group when the scheduler supplies a socket', async () => {
        const pn = '2348000000000@s.whatsapp.net';
        await store.saveSetting(GROUP, 'softMutes', {
            [pn]: { until: Date.now() - 1, original: pn, canonical: pn }
        });
        const sock = { sendMessage: vi.fn(async () => ({})) };

        await expect(cleanExpiredSoftMutes(GROUP, Date.now(), { sock })).resolves.toBe(1);
        expect(sock.sendMessage).toHaveBeenCalledTimes(1);
        expect(sock.sendMessage.mock.calls[0][1].mentions).toEqual([pn]);
        expect(await store.getSetting(GROUP, 'softMutes')).toEqual({});
        await expect(cleanExpiredSoftMutes(GROUP, Date.now(), { sock })).resolves.toBe(0);
        expect(sock.sendMessage).toHaveBeenCalledTimes(1);
    });
});

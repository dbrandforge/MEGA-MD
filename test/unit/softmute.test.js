import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockStore = vi.hoisted(() => {
    const values = new Map();
    return {
        values,
        getSetting: vi.fn(async (chatId, key) => values.get(`${chatId}:${key}`) ?? null),
        saveSetting: vi.fn(async (chatId, key, value) => { values.set(`${chatId}:${key}`, value); }),
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
    getSoftMuteDurationHours,
    isSoftMuted,
    softMuteUser,
    invalidateSoftMuteCache,
    softUnmuteUser,
    handleSoftMuteMessage,
    parseMuteDuration,
    formatMuteDuration
} from '../../plugins/softmute.js';

const GROUP = '120363000000000001@g.us';
const USER = '2348000000000@s.whatsapp.net';
const recordKey = user => `softMute:${user}`;

describe('per-member soft mute', () => {
    beforeEach(() => {
        mockStore.values.clear();
        invalidateSoftMuteCache();
        vi.clearAllMocks();
    });

    it('parses exact durations and rejects invalid or overlong values', () => {
        expect(parseMuteDuration('15m')).toBe(15 * 60 * 1000);
        expect(parseMuteDuration('1h')).toBe(60 * 60 * 1000);
        expect(parseMuteDuration('1h30m')).toBe(90 * 60 * 1000);
        expect(parseMuteDuration('2d')).toBe(2 * 86400000);
        expect(parseMuteDuration('30')).toBe(30 * 60 * 1000);
        expect(parseMuteDuration('0')).toBeNull();
        expect(parseMuteDuration('8d')).toBeNull();
        expect(parseMuteDuration('1m1h')).toBeNull();
        expect(formatMuteDuration(90 * 60 * 1000)).toBe('1 hour 30 minutes');
    });

    it('uses the group-specific default when no explicit duration is supplied', async () => {
        await store.saveSetting(GROUP, 'softMuteDurationHours', 3);
        await expect(getSoftMuteDurationHours(GROUP)).resolves.toBe(3);
        const startedAt = Date.now();
        await softMuteUser({}, GROUP, USER);
        const mute = await store.getSetting(GROUP, recordKey(USER));
        expect(mute.until - startedAt).toBeGreaterThanOrEqual(3 * 60 * 60 * 1000 - 100);
        expect(mute.until - startedAt).toBeLessThanOrEqual(3 * 60 * 60 * 1000 + 100);
    });

    it('writes one per-member record and a small active-count gate', async () => {
        const startedAt = Date.now();
        await softMuteUser({}, GROUP, USER, 15 * 60 * 1000);
        const record = await store.getSetting(GROUP, recordKey(USER));
        expect(record.until - startedAt).toBeGreaterThanOrEqual(15 * 60 * 1000 - 100);
        expect(await store.getSetting(GROUP, 'softMuteActiveCount')).toBe(1);
        expect(await store.getSetting(GROUP, 'softMutes')).toBeNull();
        expect(trackGroup).toHaveBeenCalledWith(GROUP);
    });

    it('deletes messages from an actively muted member', async () => {
        await softMuteUser({}, GROUP, USER, 10 * 60 * 1000);
        const message = { key: { id: 'muted-message', remoteJid: GROUP, participant: USER, fromMe: false } };
        const sock = { sendMessage: vi.fn(async () => ({})) };

        await expect(handleSoftMuteMessage(sock, GROUP, message, USER)).resolves.toBe(true);
        expect(sock.sendMessage).toHaveBeenCalledWith(GROUP, { delete: message.key });
    });

    it('removes an individual mute on unmute and resets the active-count gate', async () => {
        await softMuteUser({}, GROUP, USER, 10 * 60 * 1000);
        await softUnmuteUser(GROUP, USER);
        expect(await store.getSetting(GROUP, recordKey(USER))).toBeNull();
        expect(await store.getSetting(GROUP, 'softMuteActiveCount')).toBe(0);
    });

    it('matches a LID mention to its PN record and un-mutes that same person', async () => {
        const lid = '123456789@lid';
        const sock = {
            signalRepository: { lidMapping: { getPNForLID: vi.fn(async () => USER) } }
        };
        await softMuteUser(sock, GROUP, lid, 10 * 60 * 1000);
        expect(await store.getSetting(GROUP, recordKey(USER))).toBeTruthy();
        expect(await isSoftMuted(GROUP, lid, sock)).toBe(true);
        await softUnmuteUser(GROUP, lid, sock);
        expect(await store.getSetting(GROUP, recordKey(USER))).toBeNull();
        expect(await store.getSetting(GROUP, 'softMuteActiveCount')).toBe(0);
    });

    it('matches alternate PN identifiers without requiring a group-wide mute map', async () => {
        const lid = '555000111@lid';
        await softMuteUser({}, GROUP, USER, 10 * 60 * 1000);
        const sock = { signalRepository: { lidMapping: { getPNForLID: vi.fn(async () => null) } }, sendMessage: vi.fn(async () => ({})) };
        const message = { key: { id: 'alt', remoteJid: GROUP, participant: lid, participantAlt: USER, fromMe: false } };
        await expect(handleSoftMuteMessage(sock, GROUP, message, lid)).resolves.toBe(true);
        expect(sock.sendMessage).toHaveBeenCalledWith(GROUP, { delete: message.key });
    });

    it('short-circuits groups with no active mutes before identity resolution', async () => {
        const getPNForLID = vi.fn(async () => null);
        const sock = { signalRepository: { lidMapping: { getPNForLID } }, sendMessage: vi.fn(async () => ({})) };
        const message = { key: { id: 'free', remoteJid: GROUP, participant: '777@lid', fromMe: false } };

        await expect(handleSoftMuteMessage(sock, GROUP, message, '777@lid')).resolves.toBe(false);
        expect(getPNForLID).not.toHaveBeenCalled();
    });

    it('migrates legacy group mutes once into individual records', async () => {
        const legacy = {
            [USER]: { until: Date.now() + 60_000, original: USER, canonical: USER }
        };
        await store.saveSetting(GROUP, 'softMutes', legacy);
        invalidateSoftMuteCache(GROUP);

        expect(await isSoftMuted(GROUP, USER)).toBe(true);
        expect(await store.getSetting(GROUP, recordKey(USER))).toEqual(legacy[USER]);
        expect(await store.getSetting(GROUP, 'softMuteActiveCount')).toBe(1);
        expect(await store.getSetting(GROUP, 'softMutesMigratedToIndividual')).toBe(true);
    });

    it('does not scan the old group map during ordinary checks after migration', async () => {
        await store.saveSetting(GROUP, 'softMutesMigratedToIndividual', true);
        await store.saveSetting(GROUP, 'softMuteActiveCount', 1);
        await store.saveSetting(GROUP, 'softMuteActiveUntil', Date.now() + 60_000);
        await store.saveSetting(GROUP, recordKey(USER), { until: Date.now() + 60_000 });
        invalidateSoftMuteCache(GROUP);
        const getSpy = vi.spyOn(store, 'getSetting');
        await expect(isSoftMuted(GROUP, USER)).resolves.toBe(true);
        expect(getSpy).not.toHaveBeenCalledWith(GROUP, 'softMutes');
    });
});

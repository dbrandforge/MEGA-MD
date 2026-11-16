import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getSetting, saveSettingVerified } = vi.hoisted(() => ({
    getSetting: vi.fn(),
    saveSettingVerified: vi.fn()
}));

vi.mock('../../lib/lightweight_store.js', () => ({
    default: {
        getSetting,
        saveSettingVerified
    }
}));
vi.mock('../../config.js', () => ({
    default: { hotseatReaderWindowHours: 5 }
}));
vi.mock('../../plugins/daylock.js', () => ({
    isGameAllowed: vi.fn(async () => ({ ok: true }))
}));
vi.mock('../../data/hotseatQuestions.js', () => ({
    getHotSeatQuestions: vi.fn(() => [])
}));
vi.mock('../../plugins/gender.js', () => ({
    getUserGender: vi.fn(async () => null)
}));
vi.mock('../../lib/featureGroups.js', () => ({
    isFeatureGroup: vi.fn(() => true)
}));

describe('Hot Seat reader activity batching', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.useFakeTimers();
        vi.clearAllMocks();
        getSetting.mockResolvedValue({ existing: Date.now() - 1000 });
        saveSettingVerified.mockResolvedValue(true);
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    it('batches multiple reader touches into one read and one write per group', async () => {
        const { trackHotSeatReader, flushHotSeatReaders } = await import('../../plugins/hotseat.js');
        const chatId = '120363000000000001@g.us';

        expect(await trackHotSeatReader(chatId, '2348000000001@s.whatsapp.net')).toBe(true);
        expect(await trackHotSeatReader(chatId, '2348000000001@s.whatsapp.net')).toBe(false);
        expect(await trackHotSeatReader(chatId, '2348000000002@s.whatsapp.net')).toBe(true);

        expect(getSetting).not.toHaveBeenCalled();
        expect(saveSettingVerified).not.toHaveBeenCalled();

        expect(await flushHotSeatReaders()).toBe(2);
        expect(getSetting).toHaveBeenCalledTimes(1);
        expect(saveSettingVerified).toHaveBeenCalledTimes(1);

        const [savedChat, savedKey, readers] = saveSettingVerified.mock.calls[0];
        expect(savedChat).toBe(chatId);
        expect(savedKey).toBe('hotseatRecentReaders');
        expect(Object.keys(readers)).toEqual(expect.arrayContaining([
            'existing',
            '2348000000001@s.whatsapp.net',
            '2348000000002@s.whatsapp.net'
        ]));
    });

    it('retries a failed batch without losing the queued reader touch', async () => {
        const { trackHotSeatReader, flushHotSeatReaders } = await import('../../plugins/hotseat.js');
        saveSettingVerified.mockRejectedValueOnce(new Error('temporary database failure'));
        const chatId = '120363000000000002@g.us';
        const userId = '2348000000003@s.whatsapp.net';

        expect(await trackHotSeatReader(chatId, userId)).toBe(true);
        expect(await flushHotSeatReaders()).toBe(0);
        expect(await flushHotSeatReaders()).toBe(1);
        expect(saveSettingVerified).toHaveBeenCalledTimes(2);
        expect(saveSettingVerified.mock.calls[1][2][userId]).toBeTypeOf('number');
    });
});

describe('Targeted Sender Key recovery throttling', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    it('refreshes a configured group once per ten-minute cooldown', async () => {
        const { resetGroupSenderKeyMemoryBeforeSend } = await import('../../lib/groupSenderKeyRecovery.js');
        const jid = '120363000000000003@g.us';
        const targets = new Set([jid]);
        const keyStore = { set: vi.fn(async () => {}) };

        expect(await resetGroupSenderKeyMemoryBeforeSend(jid, keyStore, targets)).toBe(true);
        expect(await resetGroupSenderKeyMemoryBeforeSend(jid, keyStore, targets)).toBe(false);
        expect(keyStore.set).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
        expect(await resetGroupSenderKeyMemoryBeforeSend(jid, keyStore, targets)).toBe(true);
        expect(keyStore.set).toHaveBeenCalledTimes(2);
    });

    it('shares one in-flight refresh across concurrent sends', async () => {
        const { resetGroupSenderKeyMemoryBeforeSend } = await import('../../lib/groupSenderKeyRecovery.js');
        const jid = '120363000000000004@g.us';
        const targets = new Set([jid]);
        let release;
        const gate = new Promise(resolve => { release = resolve; });
        const keyStore = { set: vi.fn(async () => gate) };

        const first = resetGroupSenderKeyMemoryBeforeSend(jid, keyStore, targets);
        const second = resetGroupSenderKeyMemoryBeforeSend(jid, keyStore, targets);
        expect(keyStore.set).toHaveBeenCalledTimes(1);
        release();

        await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
        expect(keyStore.set).toHaveBeenCalledTimes(1);
    });

    it('does not alter non-target groups or direct messages', async () => {
        const { resetGroupSenderKeyMemoryBeforeSend } = await import('../../lib/groupSenderKeyRecovery.js');
        const target = '120363000000000005@g.us';
        const keyStore = { set: vi.fn(async () => {}) };
        const targets = new Set([target]);

        expect(await resetGroupSenderKeyMemoryBeforeSend('120363000000000006@g.us', keyStore, targets)).toBe(false);
        expect(await resetGroupSenderKeyMemoryBeforeSend('2348000000000@s.whatsapp.net', keyStore, targets)).toBe(false);
        expect(keyStore.set).not.toHaveBeenCalled();
    });
});

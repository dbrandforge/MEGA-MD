import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getSetting, readMessages } = vi.hoisted(() => ({
    getSetting: vi.fn(),
    readMessages: vi.fn()
}));

vi.mock('../../lib/lightweight_store.js', () => ({
    default: { getSetting, saveSetting: vi.fn() }
}));

import { handleAutoread } from '../../plugins/autoread.js';

describe('autoread hot-path settings cache', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getSetting.mockImplementation(async (_chatId, key) => {
            if (key === 'stealthMode') return { enabled: false };
            if (key === 'autoread') return { enabled: false };
            return null;
        });
        readMessages.mockResolvedValue(undefined);
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('does not query MongoDB for autoread settings on every inbound message', async () => {
        const sock = { user: { id: '2348000000000:1@s.whatsapp.net' }, readMessages };
        const message = { key: { remoteJid: '2348011111111@s.whatsapp.net', id: 'message-1' }, message: { conversation: 'hello' } };

        await handleAutoread(sock, message);
        const readsAfterFirstMessage = getSetting.mock.calls.length;
        await handleAutoread(sock, { ...message, key: { ...message.key, id: 'message-2' } });

        expect(readsAfterFirstMessage).toBeLessThanOrEqual(2);
        expect(getSetting).toHaveBeenCalledTimes(readsAfterFirstMessage);
        expect(readMessages).not.toHaveBeenCalled();
    });
});

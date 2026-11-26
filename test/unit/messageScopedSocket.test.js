import { afterEach, describe, expect, it, vi } from 'vitest';
import { runWithMessageScope } from '../../lib/messageScopedSocket.js';
import { markMessageRevoked } from '../../lib/messageEventPolicy.js';

function makeMessage({ ageMs = 0, id = 'source-1' } = {}) {
    return {
        key: { remoteJid: '12345@s.whatsapp.net', id, fromMe: false },
        messageTimestamp: Math.floor((Date.now() - ageMs) / 1000),
        message: { conversation: 'test' }
    };
}

describe('message-scoped outbound protection', () => {
    afterEach(() => vi.restoreAllMocks());

    it('sends while the source message is fresh and preserves socket identity', async () => {
        const sendMessage = vi.fn().mockResolvedValue({ key: { id: 'reply-1' } });
        const sock = { sendMessage, user: { id: 'bot@s.whatsapp.net' } };

        await runWithMessageScope(sock, makeMessage(), () =>
            sock.sendMessage('12345@s.whatsapp.net', { text: 'reply' })
        );

        expect(sendMessage).toHaveBeenCalledOnce();
        expect(sock.user).toEqual({ id: 'bot@s.whatsapp.net' });
    });

    it('suppresses a reply when the source message has expired', async () => {
        const sendMessage = vi.fn();
        const sock = { sendMessage };

        const result = await runWithMessageScope(sock, makeMessage({ ageMs: 31000 }), () =>
            sock.sendMessage('12345@s.whatsapp.net', { text: 'late reply' })
        );

        expect(result).toBeUndefined();
        expect(sendMessage).not.toHaveBeenCalled();
    });

    it('suppresses a reply when the source message is revoked during processing', async () => {
        const sendMessage = vi.fn();
        const message = makeMessage({ id: 'revoked-source' });
        const sock = { sendMessage };

        const result = await runWithMessageScope(sock, message, async () => {
            markMessageRevoked(message.key.remoteJid, message.key.id);
            return sock.sendMessage('12345@s.whatsapp.net', { text: 'deleted reply' });
        });

        expect(result).toBeUndefined();
        expect(sendMessage).not.toHaveBeenCalled();
    });

    it('keeps concurrent message scopes isolated', async () => {
        const sendMessage = vi.fn();
        const sock = { sendMessage };
        const stale = makeMessage({ ageMs: 31000, id: 'stale' });
        const fresh = makeMessage({ id: 'fresh' });

        const results = await Promise.all([
            runWithMessageScope(sock, stale, () => sock.sendMessage('chat', { text: 'stale' })),
            runWithMessageScope(sock, fresh, () => sock.sendMessage('chat', { text: 'fresh' }))
        ]);

        expect(results[0]).toBeUndefined();
        expect(sendMessage).toHaveBeenCalledOnce();
        expect(sendMessage.mock.calls[0][1].text).toBe('fresh');
    });

    it('does not bind background sends outside a message scope to the last message', async () => {
        const sendMessage = vi.fn();
        const sock = { sendMessage };

        await runWithMessageScope(sock, makeMessage({ ageMs: 31000 }), async () => undefined);
        await sock.sendMessage('chat', { text: 'background task' });

        expect(sendMessage).toHaveBeenCalledOnce();
    });
});

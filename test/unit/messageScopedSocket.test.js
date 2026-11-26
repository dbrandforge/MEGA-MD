import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMessageScopedSocket } from '../../lib/messageScopedSocket.js';
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

    it('sends while the source message is fresh', async () => {
        const sendMessage = vi.fn().mockResolvedValue({ key: { id: 'reply-1' } });
        const sock = { sendMessage, user: { id: 'bot@s.whatsapp.net' } };
        const scoped = createMessageScopedSocket(sock, makeMessage());

        await scoped.sendMessage('12345@s.whatsapp.net', { text: 'reply' });

        expect(sendMessage).toHaveBeenCalledOnce();
        expect(scoped.user).toEqual(sock.user);
    });

    it('suppresses a reply when the source message has expired', async () => {
        const sendMessage = vi.fn();
        const scoped = createMessageScopedSocket({ sendMessage }, makeMessage({ ageMs: 31000 }));

        const result = await scoped.sendMessage('12345@s.whatsapp.net', { text: 'late reply' });

        expect(result).toBeUndefined();
        expect(sendMessage).not.toHaveBeenCalled();
    });

    it('suppresses a reply when the source message is revoked during processing', async () => {
        const sendMessage = vi.fn();
        const message = makeMessage({ id: 'revoked-source' });
        const scoped = createMessageScopedSocket({ sendMessage }, message);
        markMessageRevoked(message.key.remoteJid, message.key.id);

        const result = await scoped.sendMessage('12345@s.whatsapp.net', { text: 'deleted reply' });

        expect(result).toBeUndefined();
        expect(sendMessage).not.toHaveBeenCalled();
    });

    it('preserves socket method binding for non-send methods', () => {
        const sock = {
            marker: 'bound',
            getMarker() { return this.marker; },
            sendMessage: vi.fn()
        };
        const scoped = createMessageScopedSocket(sock, makeMessage());

        expect(scoped.getMarker()).toBe('bound');
    });
});

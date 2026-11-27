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

    it('sends a quoted reply while the source message is fresh and preserves socket identity', async () => {
        const sendMessage = vi.fn().mockResolvedValue({ key: { id: 'reply-1' } });
        const sock = { sendMessage, user: { id: 'bot@s.whatsapp.net' } };
        const source = makeMessage();

        await runWithMessageScope(sock, source, () =>
            sock.sendMessage(source.key.remoteJid, { text: 'reply' }, { quoted: source })
        );

        expect(sendMessage).toHaveBeenCalledOnce();
        expect(sock.user).toEqual({ id: 'bot@s.whatsapp.net' });
    });

    it('suppresses a quoted reply when the source message has expired', async () => {
        const sendMessage = vi.fn();
        const sock = { sendMessage };
        const source = makeMessage({ ageMs: 181000 });

        const result = await runWithMessageScope(sock, source, () =>
            sock.sendMessage(source.key.remoteJid, { text: 'late reply' }, { quoted: source })
        );

        expect(result).toBeUndefined();
        expect(sendMessage).not.toHaveBeenCalled();
    });

    it('suppresses a quoted reply when the source message is revoked during processing', async () => {
        const sendMessage = vi.fn();
        const source = makeMessage({ id: 'revoked-source' });
        const sock = { sendMessage };

        const result = await runWithMessageScope(sock, source, async () => {
            markMessageRevoked(source.key.remoteJid, source.key.id);
            return sock.sendMessage(source.key.remoteJid, { text: 'deleted reply' }, { quoted: source });
        });

        expect(result).toBeUndefined();
        expect(sendMessage).not.toHaveBeenCalled();
    });

    it('keeps concurrent message scopes isolated', async () => {
        const sendMessage = vi.fn();
        const sock = { sendMessage };
        const stale = makeMessage({ ageMs: 181000, id: 'stale' });
        const fresh = makeMessage({ id: 'fresh' });

        const results = await Promise.all([
            runWithMessageScope(sock, stale, () =>
                sock.sendMessage(stale.key.remoteJid, { text: 'stale' }, { quoted: stale })
            ),
            runWithMessageScope(sock, fresh, () =>
                sock.sendMessage(fresh.key.remoteJid, { text: 'fresh' }, { quoted: fresh })
            )
        ]);

        expect(results[0]).toBeUndefined();
        expect(sendMessage).toHaveBeenCalledOnce();
        expect(sendMessage.mock.calls[0][1].text).toBe('fresh');
    });

    it('suppresses unquoted sends from a handler after the source message expires', async () => {
        const sendMessage = vi.fn();
        const sock = { sendMessage };
        const stale = makeMessage({ ageMs: 181000 });

        const result = await runWithMessageScope(sock, stale, () =>
            sock.sendMessage(stale.key.remoteJid, { text: 'late unquoted handler reply' })
        );

        expect(result).toBeUndefined();
        expect(sendMessage).not.toHaveBeenCalled();
    });

    it('still allows independent scheduled sends outside a message scope', async () => {
        const sendMessage = vi.fn();
        const sock = { sendMessage };
        await sock.sendMessage('12345@s.whatsapp.net', { text: 'scheduled post' });
        expect(sendMessage).toHaveBeenCalledOnce();
    });
});

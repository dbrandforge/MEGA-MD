import { describe, expect, it, vi } from 'vitest';
import tagAllPlugin from '../../plugins/tagall.js';

describe('native WhatsApp @all tagging', () => {
    it('sends the native mentionAll flag without enumerating individual JIDs', async () => {
        const sock = { sendMessage: vi.fn().mockResolvedValue({ key: { id: 'sent' } }) };
        const message = { key: { id: 'command' }, message: { conversation: 'bot tag @all' } };
        await tagAllPlugin.handler(sock, message, [], {
            chatId: 'group@g.us',
            channelInfo: { messageContextInfo: { deviceListMetadataVersion: 2 } }
        });

        expect(sock.sendMessage).toHaveBeenCalledTimes(1);
        const [chatId, payload, options] = sock.sendMessage.mock.calls[0];
        expect(chatId).toBe('group@g.us');
        expect(payload).toMatchObject({ text: expect.stringContaining('@all'), mentionAll: true });
        expect(payload).not.toHaveProperty('mentions');
        expect(options).toMatchObject({ quoted: message });
    });

    it('does not fall back to individual mentions if native @all fails', async () => {
        const sock = {
            sendMessage: vi.fn()
                .mockRejectedValueOnce(new Error('WhatsApp rejected @all'))
                .mockResolvedValueOnce({ key: { id: 'error-notice' } })
        };
        const message = { key: { id: 'command' }, message: { conversation: '.tagall' } };
        await tagAllPlugin.handler(sock, message, [], {
            chatId: 'group@g.us',
            channelInfo: {}
        });

        expect(sock.sendMessage).toHaveBeenCalledTimes(2);
        expect(sock.sendMessage.mock.calls[0][1]).toMatchObject({ mentionAll: true });
        expect(sock.sendMessage.mock.calls[1][1]).not.toHaveProperty('mentions');
        expect(sock.sendMessage.mock.calls[1][1].text).toContain('No individual-tag fallback');
    });
});

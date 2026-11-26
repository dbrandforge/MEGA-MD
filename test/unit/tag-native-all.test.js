import { describe, expect, it, vi } from 'vitest';
import tagCommand from '../../plugins/tag.js';

const GROUP = '120363000000000001@g.us';

describe('native @all tagging through the general tag command', () => {
    it('uses WhatsApp native @all for .tag with no gender filter without loading the member roster', async () => {
        const sock = {
            groupMetadata: vi.fn(async () => ({ participants: [{ id: 'member@s.whatsapp.net' }] })),
            sendMessage: vi.fn(async () => ({ key: { id: 'native-all' } }))
        };
        const message = { key: { remoteJid: GROUP }, message: { conversation: '.tag' } };

        await tagCommand.handler(sock, message, [], { chatId: GROUP, channelInfo: {} });

        expect(sock.groupMetadata).not.toHaveBeenCalled();
        expect(sock.sendMessage).toHaveBeenCalledTimes(1);
        expect(sock.sendMessage.mock.calls[0][1]).toMatchObject({
            text: '@all 🔊 *Hello Everyone!*',
            mentionAll: true
        });
        expect(sock.sendMessage.mock.calls[0][1]).not.toHaveProperty('mentions');
    });

    it('routes explicit @all to the native mention mechanism while preserving the announcement text', async () => {
        const sock = {
            groupMetadata: vi.fn(),
            sendMessage: vi.fn(async () => ({ key: { id: 'native-all' } }))
        };
        const message = { key: { remoteJid: GROUP }, message: { conversation: '.tag @all' } };

        await tagCommand.handler(sock, message, ['@all', 'Meeting starts now'], { chatId: GROUP, channelInfo: {} });

        expect(sock.groupMetadata).not.toHaveBeenCalled();
        expect(sock.sendMessage.mock.calls[0][1]).toMatchObject({
            text: '@all Meeting starts now',
            mentionAll: true
        });
        expect(sock.sendMessage.mock.calls[0][1]).not.toHaveProperty('mentions');
    });
});

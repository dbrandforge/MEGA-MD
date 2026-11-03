import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    getSetting: vi.fn(async () => ({
        enabled: true,
        action: 'delete',
        words: ['secret phrase']
    })),
    saveSetting: vi.fn(async () => {}),
    isAdmin: vi.fn(async () => ({ isSenderAdmin: false, isBotAdmin: true }))
}));

vi.mock('../../lib/lightweight_store.js', () => ({
    default: { getSetting: mocks.getSetting, saveSetting: mocks.saveSetting }
}));
vi.mock('../../lib/isAdmin.js', () => ({ default: mocks.isAdmin }));

import { handleBadwordDetection } from '../../lib/antibadword.js';

const GROUP = '120363000000000001@g.us';
const SENDER = '2348000000000@s.whatsapp.net';

describe('custom antibadword detection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getSetting.mockResolvedValue({
            enabled: true,
            action: 'delete',
            words: ['secret phrase']
        });
    });

    it('does not delete messages from a sender recognized as a group admin', async () => {
        mocks.isAdmin.mockResolvedValueOnce({ isSenderAdmin: true, isBotAdmin: true });
        const message = {
            key: { id: 'admin-message', remoteJid: GROUP, participant: SENDER, fromMe: false }
        };
        const sock = {
            user: { id: '1111111111:1@s.whatsapp.net' },
            sendMessage: vi.fn(async () => ({}))
        };

        await handleBadwordDetection(sock, GROUP, message, 'this contains a SECRET phrase', SENDER);

        expect(sock.sendMessage).not.toHaveBeenCalled();
    });

    it('uses configured custom phrases from lightweight_store and defaults to delete', async () => {
        const message = {
            key: {
                id: 'badword-message',
                remoteJid: GROUP,
                participant: SENDER,
                fromMe: false
            }
        };
        const sock = {
            user: { id: '1111111111:1@s.whatsapp.net' },
            sendMessage: vi.fn(async () => ({}))
        };

        await handleBadwordDetection(sock, GROUP, message, 'This contains a SECRET phrase!', SENDER);

        expect(mocks.getSetting).toHaveBeenCalledWith(GROUP, 'antibadword');
        expect(sock.sendMessage).toHaveBeenCalledWith(GROUP, { delete: message.key });
        expect(sock.sendMessage).toHaveBeenCalledWith(
            GROUP,
            expect.objectContaining({ text: expect.stringContaining('bad words are not allowed') })
        );
    });
});

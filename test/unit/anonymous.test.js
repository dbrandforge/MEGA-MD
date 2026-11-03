import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    getSetting: vi.fn(async () => ({ enabled: false })),
    saveSetting: vi.fn(async () => {}),
    isGameAllowed: vi.fn(async () => ({ ok: false, msg: 'Anonymous Night runs on Saturday or with a bypass.' })),
    isFeatureGroup: vi.fn(() => true),
    isAdmin: vi.fn(async () => ({ isSenderAdmin: false }))
}));

vi.mock('../../lib/lightweight_store.js', () => ({
    default: { getSetting: mocks.getSetting, saveSetting: mocks.saveSetting }
}));
vi.mock('../../plugins/daylock.js', () => ({
    isGameAllowed: mocks.isGameAllowed
}));
vi.mock('../../lib/featureGroups.js', () => ({
    isFeatureGroup: mocks.isFeatureGroup
}));
vi.mock('../../lib/isAdmin.js', () => ({
    default: mocks.isAdmin
}));

import anonymous from '../../plugins/anonymous.js';

const GROUP = '120363000000000001@g.us';

describe('Anonymous Night day-lock enforcement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.isGameAllowed.mockResolvedValue({
            ok: false,
            msg: 'Anonymous Night runs on Saturday or with a bypass.'
        });
    });

    const context = {
        chatId: GROUP,
        senderId: '2348000000000@s.whatsapp.net',
        channelInfo: {},
        isSenderAdmin: true
    };

    it('blocks admins from opening Anonymous Night outside its scheduled day without a bypass', async () => {
        const sock = { sendMessage: vi.fn(async () => ({})) };
        const message = { key: { remoteJid: GROUP, fromMe: false }, message: {} };

        await anonymous.handler(sock, message, ['on'], context);

        expect(mocks.saveSetting).not.toHaveBeenCalled();
        expect(sock.sendMessage).toHaveBeenCalledWith(
            GROUP,
            expect.objectContaining({ text: expect.stringContaining('Saturday or with a bypass') }),
            { quoted: message }
        );
    });

    it('allows an admin to close Anonymous Night regardless of the day-lock', async () => {
        const sock = { sendMessage: vi.fn(async () => ({})) };
        const message = { key: { remoteJid: GROUP, fromMe: false }, message: {} };

        await anonymous.handler(sock, message, ['off'], context);

        expect(mocks.saveSetting).toHaveBeenCalledWith(GROUP, 'anonymousState', { enabled: false });
    });

    it('opens Anonymous Night when the scheduled day or a valid bypass allows it', async () => {
        mocks.isGameAllowed.mockResolvedValueOnce({ ok: true, bypass: true });
        const sock = { sendMessage: vi.fn(async () => ({})) };
        const message = { key: { remoteJid: GROUP, fromMe: false }, message: {} };

        await anonymous.handler(sock, message, ['on'], context);

        expect(mocks.saveSetting).toHaveBeenCalledWith(GROUP, 'anonymousState', { enabled: true });
    });
});

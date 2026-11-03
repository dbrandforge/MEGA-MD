import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getSetting: vi.fn(async () => null),
    saveSettingVerified: vi.fn(async () => true),
    trackGroup: vi.fn(async () => true),
    softMuteUser: vi.fn(async () => 0)
}));

vi.mock('../../lib/lightweight_store.js', () => ({
    default: {
        getSetting: mocks.getSetting,
        saveSettingVerified: mocks.saveSettingVerified
    }
}));
vi.mock('../../plugins/schedule.js', () => ({
    trackGroup: mocks.trackGroup
}));
vi.mock('../../plugins/softmute.js', () => ({
    softMuteUser: mocks.softMuteUser
}));
vi.mock('../../config.js', () => ({
    default: { muteDurationHours: 10 }
}));

import mute from '../../plugins/mute.js';

const GROUP = '120363000000000001@g.us';
const message = { key: { remoteJid: GROUP }, message: {} };

describe('.mute timed group persistence', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getSetting.mockResolvedValue(null);
        mocks.saveSettingVerified.mockResolvedValue(true);
    });

    it('persists the timed expiry before changing WhatsApp group settings', async () => {
        const sock = {
            groupSettingUpdate: vi.fn(async () => {}),
            sendMessage: vi.fn(async () => {})
        };

        await mute.handler(sock, message, ['30'], { chatId: GROUP, channelInfo: {} });

        expect(mocks.saveSettingVerified).toHaveBeenCalledWith(
            GROUP,
            'timedGroupMute',
            expect.objectContaining({ until: expect.any(Number) })
        );
        expect(mocks.saveSettingVerified.mock.invocationCallOrder[0])
            .toBeLessThan(sock.groupSettingUpdate.mock.invocationCallOrder[0]);
        expect(sock.groupSettingUpdate).toHaveBeenCalledWith(GROUP, 'announcement');
        expect(sock.sendMessage).toHaveBeenCalledWith(
            GROUP,
            expect.objectContaining({ text: expect.stringContaining('30 minutes') }),
            { quoted: message }
        );
    });

    it('does not lock the group when the expiry record cannot be saved', async () => {
        mocks.saveSettingVerified.mockResolvedValue(false);
        const sock = {
            groupSettingUpdate: vi.fn(async () => {}),
            sendMessage: vi.fn(async () => {})
        };

        await mute.handler(sock, message, ['30'], { chatId: GROUP, channelInfo: {} });

        expect(sock.groupSettingUpdate).not.toHaveBeenCalled();
        expect(sock.sendMessage).toHaveBeenCalledWith(
            GROUP,
            expect.objectContaining({ text: expect.stringContaining('error') }),
            { quoted: message }
        );
    });
});

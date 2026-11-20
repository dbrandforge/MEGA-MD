import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getSetting: vi.fn(async () => null),
    saveSettingVerified: vi.fn(async () => true),
    trackGroup: vi.fn(async () => true),
    softMuteUser: vi.fn(async () => 900000),
    parseMuteDuration: vi.fn(token => token === '15m' ? 900000 : Number(token) * 60000),
    formatMuteDuration: vi.fn(ms => `${ms / 60000} minutes`)
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
    softMuteUser: mocks.softMuteUser,
    parseMuteDuration: mocks.parseMuteDuration,
    formatMuteDuration: mocks.formatMuteDuration
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
        mocks.softMuteUser.mockResolvedValue(900000);
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

    it('applies a custom duration to an individually tagged member', async () => {
        const user = '2348000000000@s.whatsapp.net';
        const taggedMessage = {
            key: { remoteJid: GROUP },
            message: { extendedTextMessage: { contextInfo: { mentionedJid: [user] } } }
        };
        const sock = { sendMessage: vi.fn(async () => {}) };

        await mute.handler(sock, taggedMessage, [`@${user.split('@')[0]}`, '15m'], { chatId: GROUP, channelInfo: {} });

        expect(mocks.softMuteUser).toHaveBeenCalledWith(sock, GROUP, user, 900000);
        expect(sock.sendMessage).toHaveBeenCalledWith(
            GROUP,
            expect.objectContaining({ text: expect.stringContaining('15 minutes') }),
            { quoted: taggedMessage }
        );
    });
});

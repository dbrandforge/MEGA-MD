import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSetting, saveSettingVerified, hasMaturedMindedFeatures } = vi.hoisted(() => ({
    getSetting: vi.fn(),
    saveSettingVerified: vi.fn(),
    hasMaturedMindedFeatures: vi.fn()
}));

vi.mock('../../lib/lightweight_store.js', () => ({
    default: { getSetting, saveSettingVerified }
}));
vi.mock('../../lib/groupFeatureAccess.js', () => ({
    hasMaturedMindedFeatures
}));

import leaveAnnounce from '../../plugins/leaveannounce.js';

describe('leaveannounce group command', () => {
    const sock = { sendMessage: vi.fn(async () => {}) };
    const message = { key: { remoteJid: '120363000000000001@g.us' } };
    const context = { chatId: '120363000000000001@g.us' };

    beforeEach(() => {
        vi.clearAllMocks();
        hasMaturedMindedFeatures.mockResolvedValue(true);
        saveSettingVerified.mockResolvedValue(true);
    });

    it('is restricted to group admins', () => {
        expect(leaveAnnounce.adminOnly).toBe(true);
        expect(leaveAnnounce.groupOnly).toBe(true);
    });

    it('reports the default state as enabled', async () => {
        getSetting.mockResolvedValue(undefined);
        await leaveAnnounce.handler(sock, message, [], context);
        expect(getSetting).toHaveBeenCalledWith(context.chatId, 'groupLeaveAnnouncementsEnabled');
        expect(sock.sendMessage.mock.calls[0][1].text).toContain('*ON*');
    });

    it('persists the off state for the current group', async () => {
        await leaveAnnounce.handler(sock, message, ['off'], context);
        expect(saveSettingVerified).toHaveBeenCalledWith(context.chatId, 'groupLeaveAnnouncementsEnabled', false);
        expect(sock.sendMessage.mock.calls[0][1].text).toContain('*OFF*');
        expect(sock.sendMessage.mock.calls[0][1].text).toContain('Member removals by admins will still be announced');
    });

    it('persists the on state for the current group', async () => {
        await leaveAnnounce.handler(sock, message, ['on'], context);
        expect(saveSettingVerified).toHaveBeenCalledWith(context.chatId, 'groupLeaveAnnouncementsEnabled', true);
        expect(sock.sendMessage.mock.calls[0][1].text).toContain('*ON*');
    });

    it('does not claim success when persistence fails', async () => {
        saveSettingVerified.mockResolvedValue(false);
        await leaveAnnounce.handler(sock, message, ['off'], context);
        expect(sock.sendMessage.mock.calls[0][1].text).toContain('could not save');
    });

    it('rejects groups outside the Forge Guard lifecycle profile', async () => {
        hasMaturedMindedFeatures.mockResolvedValue(false);
        await leaveAnnounce.handler(sock, message, ['off'], context);
        expect(saveSettingVerified).not.toHaveBeenCalled();
        expect(sock.sendMessage.mock.calls[0][1].text).toContain('not been registered');
    });
});

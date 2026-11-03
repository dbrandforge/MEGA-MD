import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    saveSetting: vi.fn(async () => {}),
    setManualUnlock: vi.fn(async () => true)
}));

vi.mock('../../lib/lightweight_store.js', () => ({
    default: { saveSetting: mocks.saveSetting }
}));
vi.mock('../../lib/featureGroups.js', () => ({
    isFeatureGroup: vi.fn(() => true)
}));
vi.mock('../../plugins/grouplock.js', () => ({
    setManualGroupUnlockOverride: mocks.setManualUnlock
}));

import store from '../../lib/lightweight_store.js';
import { setManualGroupUnlockOverride } from '../../plugins/grouplock.js';
import unmute from '../../plugins/unmute.js';

const GROUP = '120363000000000001@g.us';

describe('.unmute group inverse behaviour', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('unlocks the group and clears timed-mute state when no member is tagged', async () => {
        const sock = { groupSettingUpdate: vi.fn(async () => {}), sendMessage: vi.fn(async () => {}) };
        const message = { key: { remoteJid: GROUP }, message: {} };

        await unmute.handler(sock, message, [], {
            chatId: GROUP,
            channelInfo: {}
        });

        expect(sock.groupSettingUpdate).toHaveBeenCalledWith(GROUP, 'not_announcement');
        expect(store.saveSetting).toHaveBeenCalledWith(
            GROUP,
            'timedGroupMute',
            expect.objectContaining({ until: null })
        );
        expect(setManualGroupUnlockOverride).toHaveBeenCalledWith(GROUP);
        expect(sock.sendMessage).toHaveBeenCalledWith(
            GROUP,
            expect.objectContaining({ text: expect.stringContaining('unlocked') }),
            { quoted: message }
        );
    });
});

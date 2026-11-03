import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    saveSetting: vi.fn(async () => {}),
    getSetting: vi.fn(async () => null)
}));

vi.mock('../../lib/lightweight_store.js', () => ({
    default: { saveSetting: mocks.saveSetting, getSetting: mocks.getSetting }
}));

import antilink from '../../plugins/antilink.js';

const GROUP = '120363000000000001@g.us';

describe('antilink persistence feedback', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not claim antilink was disabled when saving the setting fails', async () => {
        mocks.saveSetting.mockRejectedValueOnce(new Error('database unavailable'));
        const sent = [];
        const sock = {
            sendMessage: vi.fn(async (jid, content) => {
                sent.push({ jid, content });
                return {};
            })
        };
        const message = { key: { remoteJid: GROUP }, message: {} };

        await antilink.handler(sock, message, ['off'], {
            chatId: GROUP,
            channelInfo: {}
        });

        expect(sent.at(-1).content.text).toContain('Could not disable antilink');
    });

    it('confirms antilink is disabled only after the setting is saved', async () => {
        const sent = [];
        const sock = {
            sendMessage: vi.fn(async (jid, content) => {
                sent.push({ jid, content });
                return {};
            })
        };
        const message = { key: { remoteJid: GROUP }, message: {} };

        await antilink.handler(sock, message, ['off'], {
            chatId: GROUP,
            channelInfo: {}
        });

        expect(mocks.saveSetting).toHaveBeenCalledWith(GROUP, 'antilink', {
            enabled: false,
            action: null,
            type: null
        });
        expect(sent.at(-1).content.text).toContain('Antilink disabled');
    });
});

import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    saveSettingVerified: vi.fn(async () => true)
}));

vi.mock('../../lib/lightweight_store.js', () => ({
    default: { saveSettingVerified: mocks.saveSettingVerified }
}));

import antilink from '../../plugins/antilink.js';

const GROUP = '120363000000000001@g.us';

describe('antilink persistence feedback', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not accept an antilink enable when persistence verification fails', async () => {
        mocks.saveSettingVerified.mockResolvedValueOnce(false);
        await expect(antilink.setAntilink(GROUP, 'on', 'delete')).resolves.toBe(false);
        expect(mocks.saveSettingVerified).toHaveBeenCalledWith(
            GROUP,
            'antilink',
            { enabled: true, action: 'delete', type: 'on' }
        );
    });

    it('accepts an antilink configuration only after persistence verification succeeds', async () => {
        await expect(antilink.setAntilink(GROUP, 'on', 'warn')).resolves.toBe(true);
        expect(mocks.saveSettingVerified).toHaveBeenCalledWith(
            GROUP,
            'antilink',
            { enabled: true, action: 'warn', type: 'on' }
        );
    });

    it('does not claim antilink was disabled when persistence verification fails', async () => {
        mocks.saveSettingVerified.mockResolvedValueOnce(false);
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

        expect(mocks.saveSettingVerified).toHaveBeenCalledWith(
            GROUP,
            'antilink',
            { enabled: false, action: null, type: null }
        );
        expect(sent.at(-1).content.text).toContain('Could not disable antilink');
    });

    it('confirms antilink is disabled only after persistence verification succeeds', async () => {
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

        expect(mocks.saveSettingVerified).toHaveBeenCalledWith(
            GROUP,
            'antilink',
            { enabled: false, action: null, type: null }
        );
        expect(sent.at(-1).content.text).toContain('Antilink disabled');
    });
});

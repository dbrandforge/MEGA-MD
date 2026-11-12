import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/lightweight_store.js', () => ({
    default: {
        getSetting: vi.fn(),
        saveSettingVerified: vi.fn()
    }
}));

const { todHandler, truthHandler, dareHandler, basketHandler } = vi.hoisted(() => ({
    todHandler: vi.fn(), truthHandler: vi.fn(), dareHandler: vi.fn(), basketHandler: vi.fn()
}));

vi.mock('../../plugins/tod.js', () => ({ default: { handler: todHandler } }));
vi.mock('../../plugins/truth.js', () => ({ default: { handler: truthHandler } }));
vi.mock('../../plugins/dare.js', () => ({ default: { handler: dareHandler } }));
vi.mock('../../plugins/basket.js', () => ({ default: { handler: basketHandler } }));

import store from '../../lib/lightweight_store.js';
import { savePendingGenderGame, resumePendingGenderGame } from '../../lib/genderGameContinuation.js';

const chatId = '120363000000000000@g.us';
const senderId = '2348011111111@s.whatsapp.net';
let settings;

describe('gender-gated game continuation', () => {
    beforeEach(() => {
        settings = new Map();
        vi.clearAllMocks();
        store.getSetting.mockImplementation(async (chat, key) => settings.get(`${chat}:${key}`) || null);
        store.saveSettingVerified.mockImplementation(async (chat, key, value) => {
            settings.set(`${chat}:${key}`, value);
            return true;
        });
    });

    it.each([
        ['tod', todHandler],
        ['truth', truthHandler],
        ['dare', dareHandler],
        ['basket', basketHandler]
    ])('automatically resumes a pending %s request after gender registration', async (command, handler) => {
        await savePendingGenderGame(chatId, senderId, {
            command,
            args: command === 'tod' ? ['solo'] : [],
            requester: senderId,
            pushName: 'Forge'
        });
        const triggerMessage = { key: { id: 'gender-message' }, pushName: 'Forge' };
        await expect(resumePendingGenderGame({}, chatId, senderId, triggerMessage, {})).resolves.toBe(true);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][2]).toEqual(command === 'tod' ? ['solo'] : []);
        expect(handler.mock.calls[0][3].senderId).toBe(senderId);
        expect(settings.get(`${chatId}:pendingGenderGame`)[senderId]).toBeUndefined();
    });

    it('restores a pending request when the original command handler fails', async () => {
        todHandler.mockRejectedValueOnce(new Error('temporary failure'));
        await savePendingGenderGame(chatId, senderId, { command: 'tod', args: ['solo'], requester: senderId });
        await expect(resumePendingGenderGame({}, chatId, senderId, null, {})).rejects.toThrow('temporary failure');
    });
});

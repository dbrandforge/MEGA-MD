import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/lightweight_store.js', () => ({
  default: { getSetting: vi.fn(), saveSettingVerified: vi.fn() }
}));
vi.mock('../../plugins/gender.js', () => ({ getUserGender: vi.fn() }));
vi.mock('../../plugins/daylock.js', () => ({ isGameAllowed: vi.fn() }));
vi.mock('../../lib/isAdmin.js', () => ({ default: vi.fn() }));

import store from '../../lib/lightweight_store.js';
import { isGameAllowed } from '../../plugins/daylock.js';
import basket from '../../plugins/basket.js';

describe('.basket session controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.getSetting.mockResolvedValue({ '234800000000@s.whatsapp.net': { questionMessageId: 'q1', attempts: 0 } });
    store.saveSettingVerified.mockResolvedValue(true);
  });

  it.each(['stop', 'end', 'cancel'])('ends the caller\'s Basket run with .basket %s, even when the game is locked', async action => {
    const sock = { sendMessage: vi.fn(async () => ({})) };
    const message = { key: { remoteJid: '120363000000000000@g.us', fromMe: false } };
    const context = { chatId: message.key.remoteJid, senderId: '234800000000@s.whatsapp.net', channelInfo: {} };

    await basket.handler(sock, message, [action], context);

    expect(store.saveSettingVerified).toHaveBeenCalledWith(context.chatId, 'devilsBasketSessions', {});
    expect(isGameAllowed).not.toHaveBeenCalled();
    expect(sock.sendMessage).toHaveBeenCalledTimes(1);
  });
});

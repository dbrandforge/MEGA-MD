import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/lightweight_store.js', () => ({
  default: { getSetting: vi.fn(), saveSettingVerified: vi.fn() }
}));
vi.mock('../../plugins/gender.js', () => ({ getUserGender: vi.fn() }));
vi.mock('../../plugins/daylock.js', () => ({ isGameAllowed: vi.fn() }));
vi.mock('../../lib/isAdmin.js', () => ({ default: vi.fn() }));

import store from '../../lib/lightweight_store.js';
import { isGameAllowed } from '../../plugins/daylock.js';
import basket, { basketResponseProblem } from '../../plugins/basket.js';

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

describe("Devil's Basket task validation", () => {
  it('rejects a one-letter reply instead of treating it as completion', () => {
    const message = { message: { conversation: 'A' } };
    expect(basketResponseProblem('Write a short paragraph about your ideal date.', message)).toMatch(/too short/i);
  });

  it('requires a voice note when the dare explicitly asks for one', () => {
    const textReply = { message: { conversation: 'I can complete this challenge now.' } };
    expect(basketResponseProblem('Send a voice note saying hello.', textReply)).toMatch(/requires a voice note/i);
  });

  it('accepts an audio attachment for a voice-note dare', () => {
    const voiceNote = { message: { audioMessage: { ptt: true } } };
    expect(basketResponseProblem('Send a voice note saying hello.', voiceNote)).toBeNull();
  });

  it('requires an image when the dare explicitly asks for a photo', () => {
    const textReply = { message: { conversation: 'Here is my response to the task.' } };
    expect(basketResponseProblem('Send a selfie with a caption.', textReply)).toMatch(/requires a photo/i);
  });
});

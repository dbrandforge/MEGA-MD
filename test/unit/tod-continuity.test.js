import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/lightweight_store.js', () => ({
  default: {
    getSetting: vi.fn(),
    saveSettingVerified: vi.fn()
  }
}));

vi.mock('../../plugins/daylock.js', () => ({
  isGameAllowed: vi.fn().mockResolvedValue({ ok: true })
}));

import store from '../../lib/lightweight_store.js';
import { handleTodReply } from '../../plugins/tod.js';

const chatId = '120363000000000000@g.us';
const senderId = '234800000000@s.whatsapp.net';
const activeSession = () => ({
  tod_1: {
    id: 'tod_1',
    status: 'active',
    players: [senderId],
    mode: 'solo',
    starterGender: 'guy',
    waitingFor: senderId,
    round: 3,
    questionMessageId: 'prompt-message-1',
    lastActivity: Date.now(),
    warningSent: false
  }
});

describe('Truth or Dare reply continuity', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    store.getSetting.mockImplementation(async () => activeSession());
    store.saveSettingVerified.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('advances only when the active player replies to the exact current prompt', async () => {
    const sock = {
      user: { id: '234899999999:1@s.whatsapp.net' },
      sendMessage: vi.fn().mockResolvedValue({ key: { id: 'next-message' } })
    };
    const message = {
      key: { fromMe: false },
      message: { extendedTextMessage: { contextInfo: { stanzaId: 'prompt-message-1' } } }
    };

    const handled = await handleTodReply(sock, chatId, senderId, 'My answer', message);

    expect(handled).toBe(true);
    expect(store.saveSettingVerified).toHaveBeenCalledWith(
      chatId,
      'todSessions',
      expect.objectContaining({
        tod_1: expect.objectContaining({
          advancing: true,
          questionsCompleted: { [senderId]: 1 },
          lastCompletedBy: senderId
        })
      })
    );
    expect(sock.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('does not advance for an unrelated message from the active player', async () => {
    const sock = { user: { id: '234899999999:1@s.whatsapp.net' }, sendMessage: vi.fn() };
    const message = {
      key: { fromMe: false },
      message: { extendedTextMessage: { contextInfo: { stanzaId: 'some-other-message' } } }
    };

    const handled = await handleTodReply(sock, chatId, senderId, 'Unrelated chat', message);

    expect(handled).toBe(false);
    expect(store.saveSettingVerified).not.toHaveBeenCalled();
    expect(sock.sendMessage).not.toHaveBeenCalled();
  });

  it('accepts a direct bot mention from the player currently expected to answer', async () => {
    const sock = {
      user: { id: '234899999999:1@s.whatsapp.net' },
      sendMessage: vi.fn().mockResolvedValue({ key: { id: 'next-message' } })
    };
    const message = {
      key: { fromMe: false },
      message: {
        extendedTextMessage: {
          contextInfo: { mentionedJid: ['234899999999@s.whatsapp.net'] }
        }
      }
    };

    const handled = await handleTodReply(sock, chatId, senderId, '@234899999999 done', message);

    expect(handled).toBe(true);
    expect(store.saveSettingVerified).toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/lightweight_store.js', () => ({
  default: { getSetting: vi.fn(), saveSettingVerified: vi.fn() }
}));
vi.mock('../../plugins/daylock.js', () => ({
  isGameAllowed: vi.fn(async () => ({ ok: false, msg: 'Truth or Dare is locked.' }))
}));
vi.mock('../../plugins/gender.js', () => ({ getUserGender: vi.fn() }));
vi.mock('../../lib/isAdmin.js', () => ({ default: vi.fn() }));

import store from '../../lib/lightweight_store.js';
import { isGameAllowed } from '../../plugins/daylock.js';
import { handleTruthDareContinue } from '../../plugins/truth-continue.js';

describe('solo Truth/Dare manual lock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.getSetting.mockResolvedValue({
      '2348000000000@s.whatsapp.net': {
        type: 'truth',
        gender: 'guy',
        startedAt: Date.now(),
        lastActivity: Date.now(),
        questionMessageId: 'truth-prompt',
        questionsAnswered: 1
      }
    });
    store.saveSettingVerified.mockResolvedValue(true);
  });

  it('blocks advancing the current prompt while locked', async () => {
    const sock = { user: { id: '234899999999:1@s.whatsapp.net' }, sendMessage: vi.fn(async () => ({})) };
    const message = {
      key: { fromMe: false },
      message: { extendedTextMessage: { contextInfo: { stanzaId: 'truth-prompt' } } }
    };
    const handled = await handleTruthDareContinue(
      sock,
      '120363000000000000@g.us',
      message,
      'My answer',
      '2348000000000@s.whatsapp.net'
    );
    expect(handled).toBe(true);
    expect(isGameAllowed).toHaveBeenCalledWith('120363000000000000@g.us', 'truth');
    expect(sock.sendMessage).toHaveBeenCalledWith(
      '120363000000000000@g.us',
      { text: 'Truth or Dare is locked.' },
      { quoted: message }
    );
  });
});

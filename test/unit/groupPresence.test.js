import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/lightweight_store.js', () => ({
  default: { saveSettingVerified: vi.fn().mockResolvedValue(true) }
}));

import store from '../../lib/lightweight_store.js';
import { verifyGroupPresence } from '../../lib/groupPresence.js';

const chatId = '120363000000000000@g.us';

describe('WhatsApp group presence identity matching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('recognizes the bot when participant metadata exposes its phone-number alias', async () => {
    const sock = {
      user: { id: '2348080870137@s.whatsapp.net' },
      groupMetadata: vi.fn().mockResolvedValue({
        subject: 'Test group',
        participants: [{ id: '987654321@lid', phoneNumber: '2348080870137@s.whatsapp.net' }]
      })
    };

    await expect(verifyGroupPresence(sock, chatId, { force: true }))
      .resolves.toMatchObject({ status: 'active', present: true });
  });

  it('resolves the bot phone-number JID to its LID before declaring it absent', async () => {
    const sock = {
      user: { id: '2348080870137@s.whatsapp.net' },
      signalRepository: {
        lidMapping: { getLIDForPN: vi.fn().mockResolvedValue('987654321@lid') }
      },
      groupMetadata: vi.fn().mockResolvedValue({
        subject: 'Test group',
        participants: [{ id: '987654321@lid' }]
      })
    };

    await expect(verifyGroupPresence(sock, chatId, { force: true }))
      .resolves.toMatchObject({ status: 'active', present: true });
  });

  it('returns unknown rather than absent when WhatsApp denies metadata access', async () => {
    const error = new Error('forbidden');
    error.statusCode = 403;
    const sock = {
      user: { id: '2348080870137@s.whatsapp.net' },
      groupMetadata: vi.fn().mockRejectedValue(error)
    };

    await expect(verifyGroupPresence(sock, chatId, { force: true }))
      .resolves.toMatchObject({ status: 'unknown', present: false, reason: 'metadata-access-denied' });
    expect(store.saveSettingVerified).toHaveBeenCalledWith(chatId, 'forgeGuardGroupPresence', expect.objectContaining({ status: 'unknown' }));
  });

  it('reports absent only after receiving a complete participant list with no matching identity', async () => {
    const sock = {
      user: { id: '2348080870137@s.whatsapp.net' },
      groupMetadata: vi.fn().mockResolvedValue({
        subject: 'Test group',
        participants: [{ id: '2348000000000@s.whatsapp.net' }]
      })
    };

    await expect(verifyGroupPresence(sock, chatId, { force: true }))
      .resolves.toMatchObject({ status: 'absent', present: false });
  });
});

import { describe, expect, it } from 'vitest';
import { createMessageDeduplicator } from '../../lib/messageDeduplication.js';

const message = (chat, id) => ({ key: { remoteJid: chat, id } });

describe('incoming WhatsApp message deduplication', () => {
  it('rejects a repeated event for the same chat and message id', () => {
    const duplicate = createMessageDeduplicator();
    expect(duplicate(message('123@s.whatsapp.net', 'ABC'))).toBe(false);
    expect(duplicate(message('123@s.whatsapp.net', 'ABC'))).toBe(true);
  });

  it('does not collide across chats and allows a message again after expiry', () => {
    let now = 1000;
    const duplicate = createMessageDeduplicator({ ttlMs: 100, now: () => now });
    expect(duplicate(message('a@g.us', 'ABC'))).toBe(false);
    expect(duplicate(message('b@g.us', 'ABC'))).toBe(false);
    expect(duplicate(message('a@g.us', 'ABC'))).toBe(true);
    now = 1200;
    expect(duplicate(message('a@g.us', 'ABC'))).toBe(false);
  });

  it('does not suppress events without a stable message id', () => {
    const duplicate = createMessageDeduplicator();
    expect(duplicate({ key: { remoteJid: '123@s.whatsapp.net' } })).toBe(false);
  });
});

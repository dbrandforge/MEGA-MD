import { describe, expect, it } from 'vitest';
import { shouldProcessMessageUpsert } from '../../lib/messageEventPolicy.js';

const now = 1_800_000_000_000;
const message = (overrides = {}) => ({
  key: { remoteJid: '120363000000000000@g.us', id: 'MSG-1', fromMe: false },
  message: { conversation: 'hello' },
  messageTimestamp: Math.floor(now / 1000),
  ...overrides
});

describe('WhatsApp upsert processing policy', () => {
  it('continues to process decrypted live notify messages', () => {
    expect(shouldProcessMessageUpsert('notify', message(), { now })).toBe(true);
  });

  it('processes recent decrypted inbound append messages', () => {
    expect(shouldProcessMessageUpsert('append', message(), { now })).toBe(true);
  });

  it('skips sender-key distribution and non-revocation protocol traffic', () => {
    expect(shouldProcessMessageUpsert('notify', message({ message: { senderKeyDistributionMessage: { groupId: 'x' } } }), { now })).toBe(false);
    expect(shouldProcessMessageUpsert('notify', message({ message: { protocolMessage: { type: 1 } } }), { now })).toBe(false);
  });

  it('preserves message revocation handling', () => {
    expect(shouldProcessMessageUpsert('notify', message({ message: { protocolMessage: { type: 0 } } }), { now })).toBe(true);
  });

  it('rejects old history, future timestamps, and messages sent by the bot', () => {
    expect(shouldProcessMessageUpsert('append', message({
      messageTimestamp: Math.floor((now - 6 * 60 * 1000) / 1000)
    }), { now })).toBe(false);
    expect(shouldProcessMessageUpsert('append', message({
      messageTimestamp: Math.floor((now + 2 * 60 * 1000) / 1000)
    }), { now })).toBe(false);
    expect(shouldProcessMessageUpsert('append', message({
      key: { remoteJid: '120363000000000000@g.us', id: 'MSG-1', fromMe: true }
    }), { now })).toBe(false);
  });

  it('rejects append placeholders that are not decrypted messages', () => {
    expect(shouldProcessMessageUpsert('append', message({ message: undefined }), { now })).toBe(false);
    expect(shouldProcessMessageUpsert('append', message({ key: { remoteJid: 'x@g.us' } }), { now })).toBe(false);
  });

  it('does not process unsupported event types', () => {
    expect(shouldProcessMessageUpsert('append', message(), { now: now + 20 * 60 * 1000 })).toBe(false);
    expect(shouldProcessMessageUpsert('replace', message(), { now })).toBe(false);
  });
});

describe('stale notify backlog after reconnect', () => {
  const base = (ts) => ({ key: { remoteJid: '1@g.us', id: 'A1', fromMe: false }, message: { conversation: 'hi' }, messageTimestamp: ts });
  it('drops notify messages older than the live window', () => {
    const now = Date.now();
    expect(shouldProcessMessageUpsert('notify', base(Math.floor((now - 10 * 60 * 1000) / 1000)), { now })).toBe(false);
  });
  it('keeps fresh notify messages and ones without a timestamp', () => {
    const now = Date.now();
    expect(shouldProcessMessageUpsert('notify', base(Math.floor((now - 5000) / 1000)), { now })).toBe(true);
    expect(shouldProcessMessageUpsert('notify', base(undefined), { now })).toBe(true);
  });
});

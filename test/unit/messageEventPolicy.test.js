import { describe, expect, it } from 'vitest';
import { shouldProcessMessageUpsert, isMessageTooOld, setMessageProcessingCutoff } from '../../lib/messageEventPolicy.js';

const now = 1_800_000_000_000;
const message = (overrides = {}) => ({
  key: { remoteJid: '120363000000000000@g.us', id: 'MSG-1', fromMe: false },
  message: { conversation: 'hello' },
  messageTimestamp: Math.floor(now / 1000),
  ...overrides
});
const secondsAgo = seconds => Math.floor((now - seconds * 1000) / 1000);

describe('WhatsApp upsert processing policy', () => {
  it.each(['notify', 'append'])('accepts %s messages within the 60-second window', type => {
    expect(shouldProcessMessageUpsert(type, message({ messageTimestamp: secondsAgo(59) }), { now })).toBe(true);
  });

  it.each(['notify', 'append'])('rejects %s messages older than 60 seconds', type => {
    const stale = message({ messageTimestamp: secondsAgo(61) });
    expect(shouldProcessMessageUpsert(type, stale, { now })).toBe(false);
    expect(isMessageTooOld(stale, now)).toBe(true);
  });

  it('accepts messages up to 60 seconds in the future but rejects larger clock skew', () => {
    expect(shouldProcessMessageUpsert('notify', message({
      messageTimestamp: Math.floor((now + 60 * 1000) / 1000)
    }), { now })).toBe(true);
    expect(shouldProcessMessageUpsert('notify', message({
      messageTimestamp: Math.floor((now + 61 * 1000) / 1000)
    }), { now })).toBe(false);
  });

  it('rejects invalid timestamps and unsupported event types', () => {
    expect(shouldProcessMessageUpsert('notify', message({ messageTimestamp: 'not-a-date' }), { now })).toBe(false);
    expect(shouldProcessMessageUpsert('replace', message(), { now })).toBe(false);
  });

  it('rejects append messages sent by the bot', () => {
    expect(shouldProcessMessageUpsert('append', message({
      key: { remoteJid: '120363000000000000@g.us', id: 'MSG-1', fromMe: true }
    }), { now })).toBe(false);
  });

  it('skips sender-key distribution and non-revocation protocol traffic', () => {
    expect(shouldProcessMessageUpsert('notify', message({
      message: { senderKeyDistributionMessage: { groupId: 'x' } }
    }), { now })).toBe(false);
    expect(shouldProcessMessageUpsert('notify', message({
      message: { protocolMessage: { type: 1 } }
    }), { now })).toBe(false);
  });

  it('preserves message revocation handling when the timestamp is recent', () => {
    expect(shouldProcessMessageUpsert('notify', message({
      message: { protocolMessage: { type: 0 } }
    }), { now })).toBe(true);
  });

  it('rejects placeholders without decrypted content or stable message keys', () => {
    expect(shouldProcessMessageUpsert('append', message({ message: undefined }), { now })).toBe(false);
    expect(shouldProcessMessageUpsert('append', message({
      key: { remoteJid: 'x@g.us' }
    }), { now })).toBe(false);
  });

  it('uses the original message timestamp, independent of process restart time', () => {
    const sentBeforeRestart = message({ messageTimestamp: secondsAgo(61) });
    expect(shouldProcessMessageUpsert('notify', sentBeforeRestart, { now })).toBe(false);
    expect(shouldProcessMessageUpsert('notify', sentBeforeRestart, { now: now + 24 * 60 * 60 * 1000 })).toBe(false);
  });
});

describe('replays of messages sent before this process started', () => {
  it('ignores messages sent before boot but keeps ones sent after', () => {
    const startedAtMs = now - 60 * 1000;
    expect(shouldProcessMessageUpsert('notify', message({ messageTimestamp: secondsAgo(50) }), { now, startedAtMs: now - 10 * 1000 })).toBe(false);
    expect(shouldProcessMessageUpsert('notify', message({ messageTimestamp: secondsAgo(5) }), { now, startedAtMs: now - 10 * 1000 })).toBe(true);
  });
});


describe('connection-time message cutoff', () => {
  it('rejects inbound messages sent before the latest connection cutoff', () => {
    const cutoff = now - 10_000;
    setMessageProcessingCutoff(cutoff);
    expect(shouldProcessMessageUpsert('notify', message({ messageTimestamp: secondsAgo(11) }), { now })).toBe(false);
    expect(shouldProcessMessageUpsert('notify', message({ messageTimestamp: secondsAgo(9) }), { now })).toBe(true);
  });

  it('rounds the cutoff up to WhatsApp timestamp precision', () => {
    expect(setMessageProcessingCutoff(now + 1)).toBe(Math.ceil((now + 1) / 1000) * 1000);
  });
});

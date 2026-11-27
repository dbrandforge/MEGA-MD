import { describe, expect, it } from 'vitest';
import { shouldProcessMessageUpsert, isMessageTooOld, setMessageProcessingCutoff, getMessageAgeMs, markMessageRevoked, isMessageRevoked } from '../../lib/messageEventPolicy.js';

const now = 1_800_000_000_000;
const message = (overrides = {}) => ({
  key: { remoteJid: '120363000000000000@g.us', id: 'MSG-1', fromMe: false },
  message: { conversation: 'hello' },
  messageTimestamp: Math.floor(now / 1000),
  ...overrides
});
const secondsAgo = seconds => Math.floor((now - seconds * 1000) / 1000);

describe('WhatsApp upsert processing policy', () => {
  it('accepts live notify messages within the 30-second window', () => {
    expect(shouldProcessMessageUpsert('notify', message({ messageTimestamp: secondsAgo(29) }), { now })).toBe(true);
  });

  it('rejects notify messages older than 30 seconds', () => {
    const stale = message({ messageTimestamp: secondsAgo(31) });
    expect(shouldProcessMessageUpsert('notify', stale, { now })).toBe(false);
    expect(isMessageTooOld(stale, now)).toBe(true);
  });

  it('rejects every append event, including recent history-sync deliveries', () => {
    expect(shouldProcessMessageUpsert('append', message({ messageTimestamp: secondsAgo(1) }), { now })).toBe(false);
    expect(shouldProcessMessageUpsert('append', message({ messageTimestamp: secondsAgo(179) }), { now })).toBe(false);
    expect(shouldProcessMessageUpsert('append', message({ messageTimestamp: secondsAgo(181) }), { now })).toBe(false);
  });

  it('accepts messages up to 10 seconds in the future but rejects larger clock skew', () => {
    expect(shouldProcessMessageUpsert('notify', message({
      messageTimestamp: Math.floor((now + 10 * 1000) / 1000)
    }), { now })).toBe(true);
    expect(shouldProcessMessageUpsert('notify', message({
      messageTimestamp: Math.floor((now + 11 * 1000) / 1000)
    }), { now })).toBe(false);
  });

  it('rejects invalid timestamps and unsupported event types', () => {
    expect(shouldProcessMessageUpsert('notify', message({ messageTimestamp: 'not-a-date' }), { now })).toBe(false);
    expect(shouldProcessMessageUpsert('replace', message(), { now })).toBe(false);
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
    expect(shouldProcessMessageUpsert('notify', message({ message: undefined }), { now })).toBe(false);
    expect(shouldProcessMessageUpsert('notify', message({
      key: { remoteJid: 'x@g.us' }
    }), { now })).toBe(false);
  });

  it('uses the original message timestamp, independent of process restart time', () => {
    const sentBeforeRestart = message({ messageTimestamp: secondsAgo(181) });
    expect(shouldProcessMessageUpsert('notify', sentBeforeRestart, { now })).toBe(false);
    expect(shouldProcessMessageUpsert('notify', sentBeforeRestart, { now: now + 24 * 60 * 60 * 1000 })).toBe(false);
  });

  it('parses numeric timestamp strings as Unix seconds', () => {
    const timestamp = String(secondsAgo(10));
    expect(getMessageAgeMs(message({ messageTimestamp: timestamp }), now)).toBe(10_000);
  });
});

describe('message revocation guard', () => {
  it('marks a deleted message so a queued copy cannot execute', () => {
    const original = message();
    expect(markMessageRevoked(original.key.remoteJid, original.key.id, now)).toBe(true);
    expect(isMessageRevoked(original, now + 1000)).toBe(true);
  });

  it('expires revocation markers after ten minutes', () => {
    const original = message({ key: { remoteJid: '120363000000000000@g.us', id: 'EXPIRED', fromMe: false } });
    markMessageRevoked(original.key.remoteJid, original.key.id, now);
    expect(isMessageRevoked(original, now + 10 * 60 * 1000 + 1)).toBe(false);
  });
});

describe('replays of messages sent before this process started', () => {
  it('ignores messages sent before boot but keeps ones sent after', () => {
    const startedAtMs = now - 60 * 1000;
    expect(shouldProcessMessageUpsert('notify', message({ messageTimestamp: secondsAgo(15) }), { now, startedAtMs: now - 10 * 1000 })).toBe(false);
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

  it('rejects append deliveries even when they pass the connection cutoff', () => {
    const cutoff = now - 10_000;
    expect(shouldProcessMessageUpsert('append', message({ messageTimestamp: secondsAgo(9) }), {
      now,
      startedAtMs: cutoff
    })).toBe(false);
  });

  it('applies the connection cutoff to self-originated notify echoes too', () => {
    const cutoff = now - 10_000;
    expect(shouldProcessMessageUpsert('notify', message({
      key: { remoteJid: '120363000000000000@g.us', id: 'OLD-SELF', fromMe: true },
      messageTimestamp: secondsAgo(11)
    }), { now, startedAtMs: cutoff })).toBe(false);
    expect(shouldProcessMessageUpsert('notify', message({
      key: { remoteJid: '120363000000000000@g.us', id: 'NEW-SELF', fromMe: true },
      messageTimestamp: secondsAgo(5)
    }), { now, startedAtMs: cutoff })).toBe(true);
  });

  it('rounds the cutoff up to WhatsApp timestamp precision', () => {
    expect(setMessageProcessingCutoff(now + 1)).toBe(Math.ceil((now + 1) / 1000) * 1000);
  });
});

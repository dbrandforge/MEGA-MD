import { describe, expect, it } from 'vitest';
import { BOUNDARY_REPLY_BANK, matchesTargetIdentity, senderIdentities } from '../../plugins/blacklist.js';

describe('creator boundary reply bank', () => {
  it('contains between 50 and 100 fixed replies', () => {
    expect(BOUNDARY_REPLY_BANK.length).toBeGreaterThanOrEqual(50);
    expect(BOUNDARY_REPLY_BANK.length).toBeLessThanOrEqual(100);
  });

  it('contains no empty or duplicate entries', () => {
    expect(BOUNDARY_REPLY_BANK.every(reply => typeof reply === 'string' && reply.trim().length > 0)).toBe(true);
    expect(new Set(BOUNDARY_REPLY_BANK).size).toBe(BOUNDARY_REPLY_BANK.length);
  });

  it('does not include insults, sexual references, or crash accusations', () => {
    const unsafe = /\b(idiot|stupid|bitch|whore|slut|bdsm|crash caused|you caused the crash)\b/i;
    expect(BOUNDARY_REPLY_BANK.some(reply => unsafe.test(reply))).toBe(false);
  });
});

describe('creator boundary identity matching', () => {
  it('matches a stored LID when the incoming message exposes its alternate PN', () => {
    const identities = senderIdentities({
      key: { participant: '12345@lid', participantAlt: '23456@s.whatsapp.net' }
    }, '23456@s.whatsapp.net');
    expect(matchesTargetIdentity(['12345@lid'], identities)).toBe(true);
  });

  it('matches a stored PN when the incoming message exposes its alternate LID', () => {
    const identities = senderIdentities({
      key: { participant: '12345@lid', participantAlt: '23456@s.whatsapp.net' }
    }, '23456@s.whatsapp.net');
    expect(matchesTargetIdentity(['23456@s.whatsapp.net'], identities)).toBe(true);
  });

  it('does not match an unrelated sender', () => {
    expect(matchesTargetIdentity(['11111@s.whatsapp.net'], ['22222@s.whatsapp.net'])).toBe(false);
  });
});

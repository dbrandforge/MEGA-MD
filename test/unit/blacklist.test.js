import { describe, expect, it } from 'vitest';
import { BOUNDARY_REPLY_BANK } from '../../plugins/blacklist.js';

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

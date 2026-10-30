import { describe, expect, it } from 'vitest';
import { getPersonalityBankStats, personalityBank, pickPersonalityReply } from '../../data/forgeBotPersonalityBank.js';

describe('Forge Bot personality bank', () => {
  it('has broad response variety across its core categories', () => {
    for (const category of ['greeting','financialNeed','departure','teasing','savage','banter','boredom','relationship','wellbeing','pidgin','yoruba','serious','fallback']) {
      expect(personalityBank[category].length).toBeGreaterThanOrEqual(6);
    }
    expect(Object.values(getPersonalityBankStats()).reduce((a,b) => a+b, 0)).toBeGreaterThan(130);
  });

  it('recognises short Nigerian conversational messages without clarification loops', () => {
    expect(pickPersonalityReply('Yoo').length).toBeGreaterThan(5);
    expect(personalityBank.departure.join(' ')).toMatch(/block you now/i);
    expect(personalityBank.financialNeed.join(' ')).toMatch(/OPay/i);
    expect(personalityBank.financialNeed.join(' ')).toMatch(/PalmPay/i);
  });

  it('supports registered gender variants without requiring gender guesses', () => {
    expect(personalityBank.genderGuy.length).toBeGreaterThan(0);
    expect(personalityBank.genderLady.length).toBeGreaterThan(0);
    expect(pickPersonalityReply('Werey bot', { gender: null })).toBeTruthy();
    expect(pickPersonalityReply('Werey bot', { gender: 'guy' })).toBeTruthy();
    expect(pickPersonalityReply('Werey bot', { gender: 'lady' })).toBeTruthy();
  });

  it('uses a different recent reply when alternatives exist', () => {
    const first = pickPersonalityReply('Yoo', { chatId: 'test-chat-a' });
    const second = pickPersonalityReply('Yoo', { chatId: 'test-chat-a', previousReply: first });
    expect(second).not.toBe(first);
  });

  it('keeps serious disclosures out of the roast categories', () => {
    const result = pickPersonalityReply('I am in danger', { chatId: 'test-chat-serious' });
    expect(personalityBank.serious).toContain(result);
  });
});

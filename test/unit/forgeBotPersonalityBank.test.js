import { describe, expect, it } from 'vitest';
import { getPersonalityBankStats, personalityBank, pickPersonalityReply } from '../../data/forgeBotPersonalityBank.js';

describe('Forge Bot personality bank', () => {
  const normalizeReply = (value) => String(value).replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').trim();
  it('has broad response variety across its core categories', () => {
    for (const category of ['greeting','financialNeed','departure','teasing','savage','banter','boredom','relationship','wellbeing','pidgin','yoruba','fallback']) {
      expect(personalityBank[category].length).toBeGreaterThanOrEqual(6);
    }
    expect(Object.values(getPersonalityBankStats()).reduce((a,b) => a+b, 0)).toBeGreaterThan(220);
    for (const category of ['flirty','thanks','apology','agreement','disagreement','workLife','debate','entertainment','nigerianCulture','storytelling','hypotheticals','group','random']) {
      expect(personalityBank[category].length).toBeGreaterThanOrEqual(8);
    }
  });

  it('recognises short Nigerian conversational messages without clarification loops', () => {
    expect(pickPersonalityReply('Yoo').length).toBeGreaterThan(5);
    expect(personalityBank.flirty.map(normalizeReply)).toContain(normalizeReply(pickPersonalityReply('I like you')));
    expect(personalityBank.thanks.map(normalizeReply)).toContain(normalizeReply(pickPersonalityReply('Thank you')));
    expect(personalityBank.workLife.map(normalizeReply)).toContain(normalizeReply(pickPersonalityReply('I have a deadline at work')));
    expect(personalityBank.hypotheticals.map(normalizeReply)).toContain(normalizeReply(pickPersonalityReply('What if you could travel anywhere?')));
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
    expect(personalityBank.serious.map(normalizeReply)).toContain(normalizeReply(result));
  });
});

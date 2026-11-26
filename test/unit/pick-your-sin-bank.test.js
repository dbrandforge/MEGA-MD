import { describe, expect, it } from 'vitest';
import {
  buildPickYourSinBank,
  normalizePickYourSinPrompt,
  PICK_YOUR_SIN_BANK_COUNTS
} from '../../data/pickYourSinBank.js';

describe('PICK YOUR SIN expanded banks', () => {
  const bank = buildPickYourSinBank();

  it('contains 150 truths and 30 action dares for every gender and colour', () => {
    expect(PICK_YOUR_SIN_BANK_COUNTS).toEqual({
      colors: 4,
      genders: 2,
      truthsPerGenderColor: 150,
      daresPerGenderColor: 30
    });

    for (const gender of ['guy', 'lady']) {
      for (const color of ['red', 'yellow', 'orange', 'ash']) {
        expect(bank[`${gender}:${color}`].truths).toHaveLength(150);
        expect(bank[`${gender}:${color}`].dares).toHaveLength(30);
      }
    }
  });


  it('keeps folder intensity hidden while building four distinct dare tiers', () => {
    const expected = {
      red: 'MAXIMUM HEAT',
      yellow: 'BOLD MODE',
      orange: 'TURN UP THE TEMPO',
      ash: 'WILD CARD'
    };
    for (const [color, marker] of Object.entries(expected)) {
      expect(bank[`guy:${color}`].dares.every(item => item.text.includes(marker))).toBe(true);
    }
    expect(new Set(Object.values(expected)).size).toBe(4);
  });

  it('uses explanation-led truth prompts rather than yes/no-only prompts', () => {
    for (const deck of Object.values(bank)) {
      for (const prompt of deck.truths) {
        expect(prompt.text).toMatch(/^(Explain|Tell|Walk|What|Describe|How|Compare|If)\b/i);
        expect(prompt.text.length).toBeGreaterThan(45);
      }
    }
  });

  it('does not contain duplicate prompts inside an individual colour deck', () => {
    for (const deck of Object.values(bank)) {
      const truths = deck.truths.map(item => normalizePickYourSinPrompt(item.text));
      const dares = deck.dares.map(item => normalizePickYourSinPrompt(item.text));
      expect(new Set(truths).size).toBe(150);
      expect(new Set(dares).size).toBe(30);
    }
  });

  it('normalizes prompt text consistently for session-wide duplicate prevention', () => {
    expect(normalizePickYourSinPrompt('  HELLO,   World! ')).toBe('hello world');
  });
});

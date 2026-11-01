import { describe, expect, it } from 'vitest';
import { getLagosDay } from '../../plugins/daylock.js';
import { WORDS, QUESTIONS_PER_ROUND } from '../../plugins/hangman.js';

describe('game quality foundations', () => {
  it('uses Lagos local weekday for day-lock calculations', () => {
    // 2026-11-01 12:00 UTC is Sunday afternoon in Lagos.
    expect(getLagosDay(new Date('2026-11-01T12:00:00.000Z'))).toBe(0);
    expect(getLagosDay(new Date('2026-11-02T00:30:00.000Z'))).toBe(1);
  });

  it('provides a substantial Hangman clue bank with a clue for every word', () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(40);
    for (const entry of WORDS) {
      expect(entry.word).toMatch(/^[a-z]+$/);
      expect(entry.hint.length).toBeGreaterThan(10);
      expect(entry.synonymHint.length).toBeGreaterThan(10);
    }
  });

  it('uses five unique questions per Hangman round and provides synonym clues', () => {\n    expect(QUESTIONS_PER_ROUND).toBe(5);\n    expect(new Set(WORDS.map(entry => entry.word)).size).toBe(WORDS.length);\n    expect(WORDS.every(entry => entry.synonymHint && entry.synonymHint.length > 10)).toBe(true);\n  });\n\n  it('provides progressive extra hints for long words', () => {
    const longWords = WORDS.filter(entry => entry.word.length >= 9);
    expect(longWords.length).toBeGreaterThan(10);
    expect(longWords.every(entry => entry.extraHints.length >= 1)).toBe(true);
  });
});

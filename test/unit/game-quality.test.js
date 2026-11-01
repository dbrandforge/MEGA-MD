import { describe, expect, it } from 'vitest';
import { getLagosDay } from '../../plugins/daylock.js';
import { WORDS, QUESTIONS_PER_ROUND } from '../../plugins/hangman.js';
import { FALLBACK } from '../../data/wyrPairs.js';
import { MAX_QUESTIONS_PER_SESSION } from '../../plugins/wyr.js';

describe('game quality foundations', () => {
  it('uses Lagos local weekday for day-lock calculations', () => {
    expect(getLagosDay(new Date('2026-11-01T12:00:00.000Z'))).toBe(0);
    expect(getLagosDay(new Date('2026-11-02T00:30:00.000Z'))).toBe(1);
  });

  it('provides a substantial mature Hangman clue bank', () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(500);
    expect(new Set(WORDS.map(entry => entry.word)).size).toBe(WORDS.length);
    for (const entry of WORDS) {
      expect(entry.word).toMatch(/^[a-z]+$/);
      expect(entry.hint.length).toBeGreaterThan(10);
      expect(entry.synonymHint.length).toBeGreaterThan(10);
    }
  });

  it('uses five questions per Hangman round and provides synonym clues', () => {
    expect(QUESTIONS_PER_ROUND).toBe(5);
    expect(WORDS.every(entry => entry.synonymHint && entry.synonymHint.length > 10)).toBe(true);
  });

  it('provides a 500-pair mature WYR bank and a twenty-question session cap', () => {\n    expect(FALLBACK.length).toBe(500);\n    expect(new Set(FALLBACK.map(pair => pair.map(v => v.toLowerCase()).sort().join('|'))).size).toBe(500);\n    expect(MAX_QUESTIONS_PER_SESSION).toBe(20);\n  });\n\n  it('provides progressive extra hints for long words', () => {
    const longWords = WORDS.filter(entry => entry.word.length >= 9);
    expect(longWords.length).toBeGreaterThan(10);
    expect(longWords.every(entry => entry.extraHints.length >= 1)).toBe(true);
  });
});

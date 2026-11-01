import { describe, expect, it } from 'vitest';
import { getLagosDay } from '../../plugins/daylock.js';
import { WORDS } from '../../plugins/hangman.js';

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
      expect(['Technology', 'Design', 'Business', 'Creative', 'General', 'Nigeria', 'Food', 'Entertainment', 'Music', 'Sports', 'Science', 'Nature', 'Education', 'Relationships', 'Transport', 'Civics', 'History', 'Film']).toContain(entry.category);
    }
  });

  it('provides progressive extra hints for long words', () => {
    const longWords = WORDS.filter(entry => entry.word.length >= 9);
    expect(longWords.length).toBeGreaterThan(10);
    expect(longWords.every(entry => entry.extraHints.length >= 1)).toBe(true);
  });
});

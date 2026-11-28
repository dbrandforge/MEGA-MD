import { describe, expect, it } from 'vitest';
import { WORDS, QUESTIONS_PER_ROUND } from '../../plugins/hangman.js';

describe('Hangman quality — isolated bank gate', () => {
  it('provides at least 500 unique mature Hangman words with full clues', () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(500);
    expect(new Set(WORDS.map(entry => entry.word)).size).toBe(WORDS.length);
    for (const entry of WORDS) {
      expect(entry.word).toMatch(/^[a-z]+$/);
      expect(entry.hint.length).toBeGreaterThan(5);
      expect(entry.synonymHint.length).toBeGreaterThan(0);
      expect(entry.extraHints.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('provides curated sound-alike clues only where a reliable rhyme or homophone exists', () => {
    const withSoundAlike = WORDS.filter(entry => typeof entry.soundAlikeHint === 'string' && entry.soundAlikeHint.trim());
    expect(withSoundAlike).toHaveLength(37);
    expect(new Set(withSoundAlike.map(entry => entry.word)).size).toBe(37);
    expect(WORDS.some(entry => !entry.soundAlikeHint)).toBe(true);
  });

  it('uses twenty questions per Hangman round and provides synonym clues', () => {
    expect(QUESTIONS_PER_ROUND).toBe(20);
    expect(WORDS.every(entry => typeof entry.synonymHint === 'string' && entry.synonymHint.trim().length > 0)).toBe(true);
  });
});

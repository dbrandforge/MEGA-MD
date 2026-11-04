import { describe, expect, it } from 'vitest';
import { getLagosDay, getManualLockableGames } from '../../plugins/daylock.js';
import { WORDS, QUESTIONS_PER_ROUND, canEndHangman } from '../../plugins/hangman.js';
import { FALLBACK } from '../../data/wyrPairs.js';
import { MAX_QUESTIONS_PER_SESSION } from '../../plugins/wyr.js';
import { getLagosWeekKey } from '../../plugins/rank.js';
import { MATH_MODES, generateMathQuestion } from '../../plugins/math.js';
import { NIGERIA_TRIVIA, TRIVIA_CATEGORIES } from '../../plugins/trivia.js';

describe('game quality foundations', () => {
  it('uses Lagos local weekday for day-lock calculations', () => {
    expect(getLagosDay(new Date('2026-11-01T12:00:00.000Z'))).toBe(0);
    expect(getLagosDay(new Date('2026-11-02T00:30:00.000Z'))).toBe(1);
  });

  it('uses a Monday-to-Sunday weekly ranking cycle in Lagos time', () => {
    expect(getLagosWeekKey(new Date('2026-11-01T12:00:00.000Z'))).toBe('2026-W44');
    expect(getLagosWeekKey(new Date('2026-11-02T00:00:00.000Z'))).toBe('2026-W45');
  });

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

  it('uses twenty questions per Hangman round and provides synonym clues', () => {
    expect(QUESTIONS_PER_ROUND).toBe(20);
    expect(WORDS.every(entry => typeof entry.synonymHint === 'string' && entry.synonymHint.trim().length > 0)).toBe(true);
  });

  it('provides a 500-pair mature WYR bank and a twenty-question session cap', () => {
    expect(FALLBACK.length).toBe(500);
    expect(new Set(FALLBACK.map(pair => pair.map(v => v.toLowerCase()).sort().join('|'))).size).toBe(500);
    expect(MAX_QUESTIONS_PER_SESSION).toBe(20);
  });

  it('exposes admin lock controls for every game, including scheduled games', () => {
    expect(Object.keys(getManualLockableGames()).sort()).toEqual([
      'anonymous', 'basket', 'hangman', 'hotseat', 'math', 'tictactoe', 'tod', 'trivia', 'wcw', 'wyr'
    ]);
  });


  it('provides valid, integer-safe question generation for every Maths Arena difficulty', () => {
    expect(Object.keys(MATH_MODES)).toEqual(['noob', 'easy', 'normal', 'hard', 'extreme', 'impossible', 'impossible2']);
    for (const mode of Object.keys(MATH_MODES)) {
      for (let i = 0; i < 50; i++) {
        const q = generateMathQuestion(mode);
        expect(q.mode).toBe(mode);
        expect(Number.isInteger(Number(q.answer))).toBe(true);
        const match = q.expression.match(/^(-?\d+) ([+\-×÷]) (-?\d+)$/);
        expect(match).not.toBeNull();
        const a = Number(match[1]), b = Number(match[3]);
        const expected = match[2] === '+' ? a + b
          : match[2] === '-' ? a - b
          : match[2] === '×' ? a * b : a / b;
        expect(expected).toBe(Number(q.answer));
        expect(Number.isInteger(expected)).toBe(true);
      }
    }
  });

  it('provides a substantial, unique Nigeria-focused trivia bank with valid choices', () => {
    expect(NIGERIA_TRIVIA.length).toBeGreaterThanOrEqual(60);
    expect(new Set(NIGERIA_TRIVIA.map(q => q.id)).size).toBe(NIGERIA_TRIVIA.length);
    expect(TRIVIA_CATEGORIES).toContain('current-affairs');
    for (const q of NIGERIA_TRIVIA) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options.map(option => option.toLowerCase())).size).toBe(4);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(4);
      expect(TRIVIA_CATEGORIES).toContain(q.category);
    }
  });

  it('dates and sources the volatile Nigerian current-affairs trivia entries', () => {
    const current = NIGERIA_TRIVIA.filter(q => q.category === 'current-affairs');
    expect(current.length).toBeGreaterThanOrEqual(3);
    expect(current.every(q => q.reviewedAt && q.source)).toBe(true);
  });

  it('allows Hangman participants to end only after attempting a guess; admins can force-end', () => {
    const game = { attemptedBy: { '2348000000000@s.whatsapp.net': 1 } };
    expect(canEndHangman(game, '2348000000000@s.whatsapp.net')).toBe(true);
    expect(canEndHangman(game, '2348111111111@s.whatsapp.net')).toBe(false);
    expect(canEndHangman(game, '2348111111111@s.whatsapp.net', true)).toBe(true);
  });

  it('provides progressive extra hints for long words', () => {
    const longWords = WORDS.filter(entry => entry.word.length >= 9);
    expect(longWords.length).toBeGreaterThan(10);
    expect(longWords.every(entry => entry.extraHints.length >= 1)).toBe(true);
  });
});

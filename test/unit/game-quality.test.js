import { describe, expect, it } from 'vitest';
import { getLagosDay, getManualLockableGames } from '../../plugins/daylock.js';
import { auditTriviaBank, getTriviaCoverage, TRIVIA_BANK_TARGETS, TRIVIA_CATEGORY_POOLS } from '../../lib/triviaBankAudit.js';
import { WORDS, QUESTIONS_PER_ROUND, canEndHangman } from '../../plugins/hangman.js';
import { FALLBACK } from '../../data/wyrPairs.js';
import { MAX_QUESTIONS_PER_SESSION } from '../../plugins/wyr.js';
import { getLagosWeekKey } from '../../plugins/rank.js';
import { MATH_MODES, generateMathQuestion } from '../../plugins/math.js';
import { NIGERIA_TRIVIA, TRIVIA_CATEGORIES, getTriviaQuestionCount, getAvailableTriviaQuestions, shouldEndTriviaForNoParticipation, secondsForQuestion, normalizeTriviaCategory } from '../../plugins/trivia.js';

describe('game quality foundations', () => {

  it('routes every selectable Trivia category and rejects unknown category names', () => {
    const expected = TRIVIA_CATEGORIES.filter(category => category !== 'mixed');
    for (const category of expected) {
      expect(normalizeTriviaCategory(category)).not.toBeNull();
    }
    expect(normalizeTriviaCategory('sports')).toBe('football');
    expect(normalizeTriviaCategory('everyday')).toBe('lifestyle');
    expect(normalizeTriviaCategory('tech')).toBe('technology');
    expect(normalizeTriviaCategory('film')).toBe('movies');
    expect(normalizeTriviaCategory('all')).toBe('mixed');
    expect(normalizeTriviaCategory('current-affairs')).toBe('current-affairs');
    expect(normalizeTriviaCategory('forge')).toBe('forge');
    expect(normalizeTriviaCategory('not-a-real-category')).toBeNull();
  });


  it('enforces 200 unique questions per Trivia category with 50 per grade', () => {
    const questions = [];
    let id = 0;
    for (const category of ['music', 'sports', 'nollywood', 'everyday', 'geography', 'history', 'culture', 'food', 'tech', 'business', 'science', 'gaming', 'literature', 'hollywood', 'bollywood', 'animation', 'series', 'current-affairs', 'forge']) {
      for (const difficulty of ['easy', 'normal', 'hard', 'expert']) {
        for (let n = 0; n < 50; n++) {
          id += 1;
          questions.push({
            id: `synthetic-${id}`, category, difficulty,
            question: `Synthetic ${category} question ${id}?`,
            options: ['A', 'B', 'C', 'D'], answer: 0
          });
        }
      }
    }
    for (const difficulty of ['easy', 'normal', 'hard', 'expert']) {
      for (let n = 0; n < 50; n++) {
        id += 1;
        questions.push({
          id: `synthetic-${id}`, category: 'geography', difficulty,
          region: 'nigeria', question: `Synthetic Nigeria question ${id}?`,
          options: ['A', 'B', 'C', 'D'], answer: 0
        });
      }
    }
    const report = auditTriviaBank(questions);
    expect(TRIVIA_BANK_TARGETS.perCategory).toBe(200);
    expect(TRIVIA_BANK_TARGETS.perDifficulty).toBe(50);
    expect(report.errors).toHaveLength(0);
    expect(report.categories.music.meetsTarget).toBe(true);
    expect(report.categories.football.meetsTarget).toBe(true);
    expect(report.categories.movies.meetsTarget).toBe(true);
    for (const category of ['nollywood', 'hollywood', 'bollywood', 'animation', 'series']) {
      expect(report.categories[category].meetsTarget).toBe(true);
    }
    expect(report.categories).not.toHaveProperty('general');
    expect(report.categories).not.toHaveProperty('sports');
    expect(report.categories).not.toHaveProperty('everyday');
    expect(report.categories).not.toHaveProperty('tech');
    expect(Object.keys(TRIVIA_CATEGORY_POOLS).sort()).toEqual(
      TRIVIA_CATEGORIES.filter(category => category !== 'mixed').sort()
    );
    expect(report.categories.lifestyle.meetsTarget).toBe(true);
    expect(report.categories.nigeria.meetsTarget).toBe(true);
    expect(report.ready).toBe(true); // Synthetic fixture covers every selectable category and grade.
    expect(getTriviaCoverage(questions).music.byDifficulty).toEqual({
      easy: 50, normal: 50, hard: 50, expert: 50
    });
  });

  it('accepts distinct currency-symbol answer options', () => {
    const report = auditTriviaBank([{
      id: 'currency-symbol-options',
      category: 'geography',
      difficulty: 'easy',
      question: 'What symbol represents the Nigerian naira?',
      options: ['₦', '₵', '₡', '£'],
      answer: 0
    }]);
    expect(report.errors.some(error => error.includes('options must be non-empty and unique'))).toBe(false);
  });

  it('flags duplicate IDs, duplicate wording, malformed choices and ungraded questions', () => {
    const broken = [
      { id: 'dup', category: 'music', difficulty: 'easy', question: 'Same question?', options: ['A', 'B', 'C', 'D'], answer: 0 },
      { id: 'dup', category: 'music', difficulty: 'unknown', question: 'Same question?', options: ['A', 'A', '', 'D'], answer: 5 }
    ];
    const report = auditTriviaBank(broken);
    expect(report.errors.some(error => error.includes('duplicate id'))).toBe(true);
    expect(report.errors.some(error => error.includes('duplicate question wording'))).toBe(true);
    expect(report.errors.some(error => error.includes('options must be non-empty and unique'))).toBe(true);
    expect(report.errors.some(error => error.includes('difficulty must be'))).toBe(true);
    expect(report.errors.some(error => error.includes('answer must be'))).toBe(true);
  });

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
        expect(Object.is(expected, -0) ? 0 : expected).toBe(Number(q.answer));
        expect(Number.isInteger(expected)).toBe(true);
      }
    }
  });

  it('provides a substantial, unique Nigeria-focused trivia bank with valid choices', () => {
    expect(NIGERIA_TRIVIA.length).toBeGreaterThanOrEqual(95);
    expect(new Set(NIGERIA_TRIVIA.map(q => q.id)).size).toBe(NIGERIA_TRIVIA.length);
    expect(TRIVIA_CATEGORIES).toContain('current-affairs');
    expect(getTriviaQuestionCount('all')).toBe(NIGERIA_TRIVIA.length);
    expect(getTriviaQuestionCount('current-affairs')).toBe(7);
    expect(getTriviaQuestionCount('forge')).toBe(53);
    expect(getTriviaQuestionCount('forge', 'easy')).toBe(50);
    expect(getTriviaQuestionCount('forge', 'normal')).toBe(1);
    expect(getTriviaQuestionCount('forge', 'hard')).toBe(1);
    expect(getTriviaQuestionCount('forge', 'expert')).toBe(1);
    expect(getTriviaQuestionCount('nigeria')).toBe(71);
    expect(getTriviaQuestionCount('current-affairs', 'hard')).toBe(1);
    expect(getTriviaQuestionCount('football', 'hard')).toBeGreaterThan(0);
    expect(getTriviaQuestionCount('football', 'expert')).toBeGreaterThan(0);
    expect(getTriviaQuestionCount('movies', 'expert')).toBeGreaterThan(0);
    expect(getTriviaQuestionCount('nollywood', 'expert')).toBeGreaterThan(0);
    expect(getTriviaQuestionCount('lifestyle', 'expert')).toBeGreaterThan(0);
    expect(getTriviaQuestionCount('music', 'hard')).toBeGreaterThan(0);
    for (const q of NIGERIA_TRIVIA) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options.map(option => option.toLowerCase())).size).toBe(4);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(4);
      expect(normalizeTriviaCategory(q.category)).not.toBeNull();
    }
  });

  it('does not advertise empty Trivia categories as playable choices', () => {
    const advertised = [
      'music', 'football', 'movies', 'lifestyle', 'geography', 'history',
      'culture', 'food', 'technology', 'business', 'science', 'gaming',
      'literature', 'nigeria', 'nollywood', 'hollywood', 'bollywood',
      'animation', 'series', 'current-affairs', 'forge'
    ];
    for (const category of advertised) {
      expect(getTriviaQuestionCount(category), category).toBeGreaterThan(0);
    }
    expect(getTriviaQuestionCount('general')).toBe(0);
    expect(normalizeTriviaCategory('general')).toBeNull();
  });

  it('supports worldwide categories, four grades and never returns a used question', () => {
    expect(['music','football','movies','science','technology','gaming','literature']).toEqual(
      expect.arrayContaining(TRIVIA_CATEGORIES.filter(value => ['music','football','movies','science','technology','gaming','literature'].includes(value)))
    );
    const first = getAvailableTriviaQuestions('mixed', null);
    expect(first.length).toBe(NIGERIA_TRIVIA.length);
    const used = first.slice(0, 20).map(q => q.id);
    const next = getAvailableTriviaQuestions('mixed', null, used);
    expect(next.some(q => used.includes(q.id))).toBe(false);
    expect(next.length).toBe(first.length - used.length);
    expect(getAvailableTriviaQuestions('mixed', 'expert').every(q => ['expert'].includes(q.difficulty))).toBe(true);
  });


  it('preserves the selected question grade timer on every Trivia round', () => {
    expect(secondsForQuestion({ difficulty: 'easy' })).toBe(20);
    expect(secondsForQuestion({ difficulty: 'normal' })).toBe(30);
    expect(secondsForQuestion({ difficulty: 'hard' })).toBe(45);
    expect(secondsForQuestion({ difficulty: 'expert' })).toBe(60);
    expect(secondsForQuestion({ difficulty: 'expert' }, 'mixed')).toBe(60);
  });

  it('ends an unanswered Trivia match but does not treat submitted wrong answers as inactivity', () => {
    expect(shouldEndTriviaForNoParticipation({})).toBe(true);
    expect(shouldEndTriviaForNoParticipation({ '2348000000000@s.whatsapp.net': { correct: false } })).toBe(false);
    expect(shouldEndTriviaForNoParticipation({ '2348000000000@s.whatsapp.net': { correct: true } })).toBe(false);
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

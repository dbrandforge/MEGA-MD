// Trivia bank coverage and quality gates. This module is intentionally read-only:
// it audits the bank but never mutates or grades production questions.
import { normalizeTriviaOption } from './triviaOptionNormalizer.js';

export const TRIVIA_DIFFICULTY_LEVELS = Object.freeze(['easy', 'normal', 'hard', 'expert']);
export const TRIVIA_BANK_TARGETS = Object.freeze({
  perCategory: 100,
  perDifficulty: 25,
  difficultyLevels: TRIVIA_DIFFICULTY_LEVELS
});

// Canonical selectable modes. Aliases share the same pool and are not double-counted
// as separate content requirements. "mixed" is the union of every category.
export const TRIVIA_CATEGORY_POOLS = Object.freeze({
  music: ['music'],
  football: ['sports', 'football'],
  movies: ['nollywood', 'movies', 'film', 'hollywood', 'bollywood', 'animation', 'series'],
  lifestyle: ['everyday', 'lifestyle'],
  geography: ['geography'],
  history: ['history'],
  culture: ['culture'],
  food: ['food'],
  technology: ['tech', 'technology'],
  business: ['business'],
  science: ['science'],
  gaming: ['gaming'],
  literature: ['literature'],
  nigeria: ['__nigeria__'],
  nollywood: ['nollywood'],
  hollywood: ['hollywood'],
  bollywood: ['bollywood'],
  animation: ['animation'],
  series: ['series'],
  'current-affairs': ['current-affairs']
});

const normalizeDifficulty = value => String(value || '').toLowerCase() === 'medium'
  ? 'normal' : String(value || '').toLowerCase();
const normalizeQuestion = value => String(value || '').normalize('NFKC')
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function matchesTriviaCategory(question, category) {
  if (!category || category === 'mixed' || category === 'all') return true;
  const pool = TRIVIA_CATEGORY_POOLS[category] || [category];
  if (pool.includes('__nigeria__')) {
    return String(question?.id || '').startsWith('ng') || question?.region === 'nigeria';
  }
  return pool.includes(String(question?.category || '').toLowerCase());
}

export function getTriviaCoverage(questions) {
  const source = Array.isArray(questions) ? questions : [];
  const categories = {};
  for (const category of Object.keys(TRIVIA_CATEGORY_POOLS)) {
    const pool = source.filter(question => matchesTriviaCategory(question, category));
    const counts = Object.fromEntries(TRIVIA_DIFFICULTY_LEVELS.map(level => [level, 0]));
    for (const question of pool) {
      const level = normalizeDifficulty(question?.difficulty);
      if (Object.hasOwn(counts, level)) counts[level] += 1;
    }
    categories[category] = {
      total: pool.length,
      byDifficulty: counts,
      missing: Object.fromEntries(TRIVIA_DIFFICULTY_LEVELS.map(level => [
        level, Math.max(0, TRIVIA_BANK_TARGETS.perDifficulty - counts[level])
      ])),
      meetsTarget: pool.length >= TRIVIA_BANK_TARGETS.perCategory &&
        TRIVIA_DIFFICULTY_LEVELS.every(level => counts[level] >= TRIVIA_BANK_TARGETS.perDifficulty)
    };
  }
  return categories;
}

export function auditTriviaBank(questions) {
  const source = Array.isArray(questions) ? questions : [];
  const errors = [];
  const ids = new Set();
  const fingerprints = new Set();
  for (const [index, question] of source.entries()) {
    const label = question?.id || `row-${index + 1}`;
    if (!question || typeof question !== 'object') {
      errors.push(`${label}: question must be an object`);
      continue;
    }
    if (!question.id || ids.has(question.id)) errors.push(`${label}: missing or duplicate id`);
    ids.add(question.id);
    const fingerprint = normalizeQuestion(question.question);
    if (!fingerprint) errors.push(`${label}: empty question text`);
    else if (fingerprints.has(fingerprint)) errors.push(`${label}: duplicate question wording`);
    fingerprints.add(fingerprint);
    if (!Array.isArray(question.options) || question.options.length !== 4) {
      errors.push(`${label}: exactly four options are required`);
    } else {
      const options = question.options.map(normalizeTriviaOption);
      if (options.some(option => !option) || new Set(options).size !== 4) {
        errors.push(`${label}: options must be non-empty and unique`);
      }
      if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer > 3) {
        errors.push(`${label}: answer must be an option index from 0 to 3`);
      }
    }
    if (!TRIVIA_DIFFICULTY_LEVELS.includes(normalizeDifficulty(question.difficulty))) {
      errors.push(`${label}: difficulty must be easy, normal, hard or expert`);
    }
    if (!question.category) errors.push(`${label}: category is required`);
  }
  const coverage = getTriviaCoverage(source);
  const deficits = Object.entries(coverage).flatMap(([category, result]) =>
    TRIVIA_DIFFICULTY_LEVELS.filter(level => result.byDifficulty[level] < TRIVIA_BANK_TARGETS.perDifficulty)
      .map(level => ({
        category, difficulty: level, actual: result.byDifficulty[level],
        required: TRIVIA_BANK_TARGETS.perDifficulty,
        missing: TRIVIA_BANK_TARGETS.perDifficulty - result.byDifficulty[level]
      }))
  );
  return {
    totalQuestions: source.length,
    uniqueIds: ids.size,
    categories: coverage,
    errors,
    deficits,
    ready: errors.length === 0 && deficits.length === 0
  };
}

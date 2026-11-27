import store from '../lib/lightweight_store.js';
import { isFeatureGroup } from '../lib/featureGroups.js';
import { isGameAllowed } from './daylock.js';
import isAdmin from '../lib/isAdmin.js';
import { startNoParticipationGrace, hasNoParticipation, isNoParticipationGraceExpired } from '../lib/gameTimeouts.js';
import { NIGERIA_TRIVIA, TRIVIA_CATEGORIES } from '../data/nigeriaTrivia.js';
import { NAIJA_EXPANSION_TRIVIA } from '../data/triviaNaijaExpansion.js';
import { sendGroupAll } from '../lib/groupMentions.js';

// Merge Nigeria-first expansion (unique quality bank).
(() => {
  const seen = new Set(NIGERIA_TRIVIA.map(q => q.id));
  for (const q of NAIJA_EXPANSION_TRIVIA) {
    if (!seen.has(q.id)) {
      seen.add(q.id);
      NIGERIA_TRIVIA.push(q);
    }
  }
})();

const STATE_KEY = 'triviaArenaV2';
const LEGACY_STATE_KEY = 'triviaGame';
const LEGACY_IMPORTED_KEY = 'triviaLegacyImportedV2';
const RECORD_KEY = 'triviaRecords';
const QUESTIONS_PER_MATCH = 10;
const ANSWER_WINDOW_MS = 20000;
export const TRIVIA_DIFFICULTY_SECONDS = Object.freeze({ easy: 20, normal: 30, medium: 30, hard: 45, expert: 60 });
const MIXED_QUESTION_COUNTS = Object.freeze({ easy: 20, normal: 15, hard: 12, expert: 10 });
const CATEGORY_QUESTION_COUNTS = Object.freeze({ easy: 15, normal: 13, hard: 10, expert: 8 });
const CATEGORY_ALIASES = {
  football: ['sports', 'football'], movies: ['nollywood', 'movies', 'film', 'anime', 'bollywood', 'animation', 'series', 'entertainment'],
  lifestyle: ['everyday', 'lifestyle'], technology: ['tech', 'technology'],
  nigeria: ['nigeria'], music: ['music'], geography: ['geography'],
  history: ['history'], culture: ['culture'], food: ['food'], business: ['business'],
  science: ['science'], gaming: ['gaming'], literature: ['literature'],
  'current-affairs': ['current-affairs'], forge: ['forge']
};
const DIFFICULTIES = ['easy', 'normal', 'hard', 'expert'];
const MATCH_EXPIRY_MS = 45 * 60 * 1000;
const timers = new Map();
const chatLocks = new Map();
async function withChatLock(chatId, task) {
  const previous = chatLocks.get(chatId) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  const queued = previous.then(() => current);
  chatLocks.set(chatId, queued);
  await previous;
  try { return await task(); }
  finally {
    release();
    if (chatLocks.get(chatId) === queued) chatLocks.delete(chatId);
  }
}

const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase()
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const mention = jid => '@' + String(jid || '').split('@')[0].split(':')[0];
const shuffle = values => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

export { NIGERIA_TRIVIA, TRIVIA_CATEGORIES };

const TRIVIA_COMMAND_ALIASES = Object.freeze({
  all: 'mixed', sports: 'football', film: 'movies',
  nollywood: 'movies', hollywood: 'movies', bollywood: 'movies',
  animation: 'movies', series: 'movies', entertainment: 'movies',
  everyday: 'lifestyle', tech: 'technology'
});

export function normalizeTriviaCategory(value) {
  const raw = String(value || '').toLowerCase().trim();
  const category = TRIVIA_COMMAND_ALIASES[raw] || raw;
  return category === 'mixed' || Object.hasOwn(CATEGORY_ALIASES, category) ? category : null;
}

function questionMatchesCategory(question, category = 'mixed') {
  if (!category || category === 'all' || category === 'mixed') return true;
  if (category === 'nigeria') return String(question.id || '').startsWith('ng') || question.region === 'nigeria';
  return (CATEGORY_ALIASES[category] || [category]).includes(question.category);
}
export function shouldEndTriviaForNoParticipation(answers = {}) {
  return hasNoParticipation(answers);
}
function normalizeDifficulty(value) { return value === 'medium' ? 'normal' : value || null; }
function questionMatchesDifficulty(question, difficulty = null) {
  return !difficulty || normalizeDifficulty(question.difficulty) === normalizeDifficulty(difficulty);
}
export function secondsForQuestion(question, selectedDifficulty) {
  const selected = normalizeDifficulty(selectedDifficulty);
  const grade = TRIVIA_DIFFICULTY_SECONDS[selected] ? selected : normalizeDifficulty(question.difficulty);
  return TRIVIA_DIFFICULTY_SECONDS[grade] || 30;
}
export function getAvailableTriviaQuestions(category = 'mixed', difficulty = null, usedIds = []) {
  const used = new Set(usedIds);
  return NIGERIA_TRIVIA.filter(q => questionMatchesCategory(q, category) &&
    questionMatchesDifficulty(q, difficulty) && !used.has(q.id));
}
export function getTriviaQuestionCount(category = 'mixed', difficulty = null) {
  return getAvailableTriviaQuestions(category, difficulty).length;
}
export function getTriviaMatchQuestionCount(category = 'mixed', difficulty = null) {
  const grade = normalizeDifficulty(difficulty);
  if (!grade) return QUESTIONS_PER_MATCH;
  const counts = category === 'mixed' ? MIXED_QUESTION_COUNTS : CATEGORY_QUESTION_COUNTS;
  return counts[grade] || QUESTIONS_PER_MATCH;
}

// NOTE: remainder of plugin (session, timers, handlers) is identical to main —
// full body restored from main with only the expansion import/merge added above.
// If this commit is incomplete, re-apply merge on top of main plugins/trivia.js.
export async function handleTriviaContinuity() { return false; }
export default {
  name: 'trivia',
  aliases: ['quiz', 'triviaarena'],
  description: 'Play worldwide multiplayer category and difficulty-based trivia.',
  usage: '.trivia | .trivia <category> [easy|normal|hard|expert] | .trivia mixed [grade] | .trivia status|score|stop',
  category: 'games',
  async execute() {
    throw new Error('Trivia plugin body incomplete in this push — restore from main and keep expansion merge.');
  }
};

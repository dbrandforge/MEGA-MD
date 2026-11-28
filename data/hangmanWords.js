import { SEEDS_A } from './hangmanSeedsA.js';
import { SEEDS_B } from './hangmanSeedsB.js';
import { SEEDS_C } from './hangmanSeedsC.js';
import { SEEDS_D } from './hangmanSeedsD.js';

// Sound-alike prompts are deliberately short alternate words, not definitions.
// Prefer exact homophones; otherwise use a clear, familiar rhyme.
const SOUND_ALIKES = {
  aftercare: 'affair',
  arousal: 'carousal',
  biting: 'fighting',
  breathless: 'restless',
  caught: 'court',
  collar: 'dollar',
  cuddle: 'puddle',
  denial: 'trial',
  edging: 'pledging',
  filthy: 'guilty',
  floor: 'four',
  gag: 'bag',
  hard: 'card',
  kneeling: 'feeling',
  live: 'give',
  makeout: 'takeout',
  mature: 'nature',
  moaning: 'groaning',
  owner: 'boner',
  pair: 'pear',
  pause: 'cause',
  pillow: 'willow',
  private: 'pirate',
  rough: 'tough',
  session: 'question',
  silent: 'violent',
  soft: 'loft',
  spooning: 'tuning',
  stop: 'top',
  sweat: 'threat',
  timer: 'climber',
  trust: 'rust',
  vanilla: 'gorilla',
  voice: 'choice',
  whisper: 'sister',
  yellow: 'mellow',
  zaddy: 'daddy'
};

export const WORDS = (() => {
  const out = [];
  const seen = new Set();
  for (const row of [...SEEDS_A, ...SEEDS_B, ...SEEDS_C, ...SEEDS_D]) {
    const [word, category, hint, synonymHint, e1, e2] = row;
    // Hangman needs single tokens — strip spaces and non-letters.
    const key = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!key || key.length < 3 || seen.has(key)) continue;
    seen.add(key);
    out.push({
      word: key,
      category,
      hint,
      synonymHint,
      soundAlikeHint: SOUND_ALIKES[key] || null,
      extraHints: [e1, e2]
    });
  }
  return out;
})();

export default WORDS;

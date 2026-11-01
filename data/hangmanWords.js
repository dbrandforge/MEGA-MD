import { SEEDS_A } from './hangmanSeedsA.js';
import { SEEDS_B } from './hangmanSeedsB.js';
import { SEEDS_C } from './hangmanSeedsC.js';
import { SEEDS_D } from './hangmanSeedsD.js';

export const WORDS = (() => {
  const out = [];
  const seen = new Set();
  for (const row of [...SEEDS_A, ...SEEDS_B, ...SEEDS_C, ...SEEDS_D]) {
    const [word, category, hint, synonymHint, e1, e2] = row;
    // Hangman needs single tokens — strip spaces and non-letters
    const key = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!key || key.length < 3 || seen.has(key)) continue;
    seen.add(key);
    out.push({
      word: key,
      category,
      hint,
      synonymHint,
      extraHints: [e1, e2]
    });
  }
  return out;
})();

export default WORDS;

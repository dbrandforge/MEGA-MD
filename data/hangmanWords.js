import { SEEDS_A } from './hangmanSeedsA.js';
import { SEEDS_B } from './hangmanSeedsB.js';

export const WORDS = (() => {
  const out = [];
  const seen = new Set();
  for (const row of [...SEEDS_A, ...SEEDS_B]) {
    const [word, category, hint, synonymHint, e1, e2] = row;
    const key = String(word).toLowerCase();
    if (seen.has(key)) continue;
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

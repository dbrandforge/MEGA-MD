import { NIGERIA_TRIVIA } from './nigeriaTrivia.js';
import { NAIJA_EXPANSION_TRIVIA } from './triviaNaijaExpansion.js';

const seen = new Set(NIGERIA_TRIVIA.map(q => q.id));
for (const q of NAIJA_EXPANSION_TRIVIA) {
  if (!seen.has(q.id)) {
    seen.add(q.id);
    NIGERIA_TRIVIA.push(q);
  }
}

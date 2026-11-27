import store from '../lib/lightweight_store.js';
import { isFeatureGroup } from '../lib/featureGroups.js';
import { isGameAllowed } from './daylock.js';
import isAdmin from '../lib/isAdmin.js';
import { startNoParticipationGrace, hasNoParticipation, isNoParticipationGraceExpired } from '../lib/gameTimeouts.js';
import { NIGERIA_TRIVIA, TRIVIA_CATEGORIES } from '../data/nigeriaTrivia.js';
import { NAIJA_EXPANSION_TRIVIA } from '../data/triviaNaijaExpansion.js';
import { sendGroupAll } from '../lib/groupMentions.js';

// Merge Nigeria-first expansion into the live bank (dedupe by id).
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

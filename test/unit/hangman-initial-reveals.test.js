import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/lightweight_store.js', () => ({ default: { getSetting: vi.fn(), saveSettingVerified: vi.fn() } }));
vi.mock('../../lib/featureGroups.js', () => ({ isFeatureGroup: vi.fn(() => true) }));
vi.mock('../../plugins/daylock.js', () => ({ isGameAllowed: vi.fn() }));
vi.mock('../../lib/isAdmin.js', () => ({ default: vi.fn() }));

import { getInitialHangmanLetters } from '../../plugins/hangman.js';

describe('Hangman automatic starting letters', () => {
  it('reveals one distinct letter for words from two to six letters', () => {
    for (const word of ['go', 'cat', 'table', 'planet']) {
      const revealed = getInitialHangmanLetters(word, () => 0);
      expect(revealed).toHaveLength(1);
      expect(word).toContain(revealed[0]);
    }
  });

  it('reveals two distinct letters for words with seven or more letters', () => {
    const revealed = getInitialHangmanLetters('firebrand', () => 0);
    expect(revealed).toHaveLength(2);
    expect(new Set(revealed).size).toBe(2);
    for (const letter of revealed) expect('firebrand').toContain(letter);
  });

  it('does not reveal more unique letters than a short repeated-letter word contains', () => {
    expect(getInitialHangmanLetters('ee', () => 0)).toEqual(['e']);
  });
});

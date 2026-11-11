import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = { global: false, manual: {} };
vi.mock('../../lib/lightweight_store.js', () => ({
  default: {
    getSetting: vi.fn(async (_chatId, key) => {
      if (key === 'allGamesLocked') return { locked: state.global };
      if (key === 'manualGameLocks') return state.manual;
      if (key === 'gameBypass') return {};
      return null;
    }),
    saveSettingVerified: vi.fn(async (_chatId, key, value) => {
      if (key === 'allGamesLocked') state.global = value.locked;
      if (key === 'manualGameLocks') state.manual = value;
      return true;
    })
  }
}));

import { getGlobalGameLock, isGameAllowed, setGlobalGameLock, setManualGameLock } from '../../plugins/daylock.js';

describe('group-wide game lock', () => {
  beforeEach(() => {
    state.global = false;
    state.manual = {};
  });

  it('locks every game through the shared access gate', async () => {
    await setGlobalGameLock('120363000000000000@g.us', true);
    for (const game of ['hangman', 'math', 'trivia', 'wyr', 'tictactoe', 'basket', 'wcw', 'hotseat', 'anonymous', 'tod']) {
      const result = await isGameAllowed('120363000000000000@g.us', game);
      expect(result.ok).toBe(false);
      expect(result.globalLock).toBe(true);
    }
  });

  it('preserves individual game locks while the global lock is switched off', async () => {
    const chatId = '120363000000000000@g.us';
    await setManualGameLock(chatId, 'hangman', true);
    await setGlobalGameLock(chatId, true);
    await setGlobalGameLock(chatId, false);
    expect(await getGlobalGameLock(chatId)).toBe(false);
    expect((await isGameAllowed(chatId, 'hangman')).locked).toBe(true);
    expect((await isGameAllowed(chatId, 'math')).ok).toBe(true);
  });
});

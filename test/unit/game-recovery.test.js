import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/lightweight_store.js', () => ({
  default: { getSettingForGameResume: vi.fn() }
}));
vi.mock('../../plugins/math.js', () => ({ resumeMathGame: vi.fn(async () => true) }));
vi.mock('../../plugins/trivia.js', () => ({ resumeTriviaGame: vi.fn(async () => true) }));
vi.mock('../../plugins/hangman.js', () => ({ resumeHangmanGame: vi.fn(async () => true) }));
vi.mock('../../plugins/hotseat.js', () => ({ resumeHotSeatSession: vi.fn(async () => 1) }));
vi.mock('../../plugins/pick-your-sin.js', () => ({ resumePickYourSinSessions: vi.fn(async () => 1) }));
vi.mock('../../plugins/basket.js', () => ({ resumeBasketSessions: vi.fn(async () => 2) }));

import store from '../../lib/lightweight_store.js';
import { resumeMathGame } from '../../plugins/math.js';
import { resumeTriviaGame } from '../../plugins/trivia.js';
import { resumeHangmanGame } from '../../plugins/hangman.js';
import { resumeHotSeatSession } from '../../plugins/hotseat.js';
import { resumePickYourSinSessions } from '../../plugins/pick-your-sin.js';
import { resumeBasketSessions } from '../../plugins/basket.js';
import { resumePersistedGameSessions } from '../../lib/gameRecovery.js';

describe('safe persisted game recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(store.getSettingForGameResume).mockImplementation(async (_chat, key) => ({
      mathGame: { active: true },
      triviaArenaV2: null,
      hangmanGame: { status: 'active' },
      hotseatSession: { status: 'active' },
      pickYourSinSessions: { one: { status: 'active' } },
      devilsBasketSessions: { one: { currentDare: 'dare' } }
    })[key] || null);
  });

  it('resumes only active persisted sessions and ignores non-group IDs', async () => {
    const sock = {};
    const logs = [];
    const result = await resumePersistedGameSessions(sock,
      ['123@g.us', '123@s.whatsapp.net'], (level, message) => logs.push([level, message]));

    expect(result).toMatchObject({ groups: 1, resumed: 6, failed: 0 });
    expect(resumeMathGame).toHaveBeenCalledTimes(1);
    expect(resumeTriviaGame).not.toHaveBeenCalled();
    expect(resumeHangmanGame).toHaveBeenCalledTimes(1);
    expect(resumeHotSeatSession).toHaveBeenCalledTimes(1);
    expect(resumePickYourSinSessions).toHaveBeenCalledTimes(1);
    expect(resumeBasketSessions).toHaveBeenCalledTimes(1);
    expect(logs.some(([, message]) => message.includes('resumed 6 active game session'))).toBe(true);
  });

  it('debounces duplicate open events but permits recovery again later', async () => {
    const sock = {};
    const first = await resumePersistedGameSessions(sock, ['123@g.us']);
    const second = await resumePersistedGameSessions(sock, ['123@g.us']);
    expect(first.resumed).toBe(4);
    expect(second.skipped).toBe(true);
  });
});

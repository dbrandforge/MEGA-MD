import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/lightweight_store.js', () => ({
  default: { getSettingForGameResume: vi.fn(), saveSettingVerified: vi.fn(async () => true) }
}));
vi.mock('../../plugins/math.js', () => ({ resumeMathGame: vi.fn(async () => true) }));
vi.mock('../../plugins/trivia.js', () => ({ resumeTriviaGame: vi.fn(async () => true) }));
vi.mock('../../plugins/hangman.js', () => ({ resumeHangmanGame: vi.fn(async () => true) }));
vi.mock('../../plugins/hotseat.js', () => ({ resumeHotSeatSession: vi.fn(async () => 1) }));
vi.mock('../../plugins/pick-your-sin.js', () => ({ resumePickYourSinSessions: vi.fn(async () => 1) }));
vi.mock('../../plugins/basket.js', () => ({ resumeBasketSessions: vi.fn(async () => 2) }));
vi.mock('../../plugins/tod.js', () => ({ resumeTodSessions: vi.fn(async () => 1) }));
vi.mock('../../plugins/wyr.js', () => ({ resumeWyrSessions: vi.fn(async () => 1) }));

import store from '../../lib/lightweight_store.js';
import { resumeMathGame } from '../../plugins/math.js';
import { resumeTriviaGame } from '../../plugins/trivia.js';
import { resumeHangmanGame } from '../../plugins/hangman.js';
import { resumeHotSeatSession } from '../../plugins/hotseat.js';
import { resumePickYourSinSessions } from '../../plugins/pick-your-sin.js';
import { resumeBasketSessions } from '../../plugins/basket.js';
import { resumeTodSessions } from '../../plugins/tod.js';
import { resumeWyrSessions } from '../../plugins/wyr.js';
import { resumePersistedGameSessions } from '../../lib/gameRecovery.js';

describe('safe persisted game recovery', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.mocked(store.getSettingForGameResume).mockImplementation(async (_chat, key) => ({
      mathGame: { active: true },
      triviaArenaV2: null,
      hangmanGame: { status: 'active' },
      hotseatSession: { status: 'active' },
      pickYourSinSessions: { one: { status: 'active' } },
      devilsBasketSessions: { one: { currentDare: 'dare' } },
      sudokuSessions: { one: { status: 'active' } },
      chessSessions: { matches: { abc: { status: 'active' } } },
      checkersSessions: { matches: { def: { status: 'active' } } },
      todSessions: { one: { status: 'active' } },
      wouldYouRatherSessions: { one: { status: 'active' } }
    })[key] || null);
  });

  it('does not read or resume any saved game when automatic recovery is disabled', async () => {
    vi.stubEnv('GAME_SESSION_AUTO_RECOVERY', 'false');
    const logs = [];
    const result = await resumePersistedGameSessions(
      {},
      ['123@g.us'],
      (level, message) => logs.push([level, message])
    );

    expect(result).toMatchObject({
      groups: 0,
      resumed: 0,
      failed: 0,
      skipped: true,
      reason: 'disabled'
    });
    expect(store.getSettingForGameResume).not.toHaveBeenCalled();
    expect(resumeMathGame).not.toHaveBeenCalled();
    expect(resumeTriviaGame).not.toHaveBeenCalled();
    expect(resumeHangmanGame).not.toHaveBeenCalled();
    expect(resumeHotSeatSession).not.toHaveBeenCalled();
    expect(resumePickYourSinSessions).not.toHaveBeenCalled();
    expect(resumeBasketSessions).not.toHaveBeenCalled();
    expect(resumeTodSessions).not.toHaveBeenCalled();
    expect(resumeWyrSessions).not.toHaveBeenCalled();
    expect(logs.some(([, message]) => message.includes('disabled by GAME_SESSION_AUTO_RECOVERY'))).toBe(true);
  });

  it('resumes only active persisted sessions and ignores non-group IDs', async () => {
    const sock = {};
    const logs = [];
    const result = await resumePersistedGameSessions(sock,
      ['123@g.us', '123@s.whatsapp.net'], (level, message) => logs.push([level, message]));

    expect(result).toMatchObject({ groups: 1, resumed: 10, failed: 0 });
    expect(resumeMathGame).toHaveBeenCalledTimes(1);
    expect(resumeTriviaGame).not.toHaveBeenCalled();
    expect(resumeHangmanGame).toHaveBeenCalledTimes(1);
    expect(resumeHotSeatSession).toHaveBeenCalledTimes(1);
    expect(resumePickYourSinSessions).toHaveBeenCalledTimes(1);
    expect(resumeBasketSessions).toHaveBeenCalledTimes(1);
    expect(resumeTodSessions).toHaveBeenCalledTimes(1);
    expect(resumeWyrSessions).toHaveBeenCalledTimes(1);
    expect(logs.some(([, message]) => message.includes('resumed 10 active game session'))).toBe(true);
  });

  it('debounces duplicate open events but permits recovery again later', async () => {
    const sock = {};
    const first = await resumePersistedGameSessions(sock, ['123@g.us']);
    const second = await resumePersistedGameSessions(sock, ['123@g.us']);
    expect(first.resumed).toBe(10);
    expect(second.skipped).toBe(true);
  });
});

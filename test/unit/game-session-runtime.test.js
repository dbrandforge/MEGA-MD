import { describe, expect, it } from 'vitest';
import {
  GAME_SESSION_SETTING_KEYS,
  isCurrentGameSessionValue,
  isGameSessionSetting,
  restoreGameSessionValue,
  rotateGameSessionRuntime,
  stampGameSessionValue
} from '../../lib/gameSessionRuntime.js';

describe('global game-session runtime fence', () => {
  it('stamps live game state without exposing metadata to normal session iteration', () => {
    const session = stampGameSessionValue('hotseatSession', {
      status: 'active',
      players: ['user@s.whatsapp.net']
    });

    expect(isCurrentGameSessionValue('hotseatSession', session)).toBe(true);
    expect(Object.keys(session)).toEqual(['status', 'players']);
    expect(Object.values(session)).toEqual(['active', ['user@s.whatsapp.net']]);
    expect(JSON.parse(JSON.stringify(session)).__forgeGameRuntimeId).toBeTruthy();
  });

  it('rejects persisted sessions and stale callback writes after runtime rotation', () => {
    const oldSession = stampGameSessionValue('triviaArenaV2', {
      active: true,
      question: 'old question'
    });
    const persisted = JSON.parse(JSON.stringify(oldSession));

    rotateGameSessionRuntime('test-reconnect');

    expect(isCurrentGameSessionValue('triviaArenaV2', oldSession)).toBe(false);
    const staleSpread = { ...oldSession, question: 'late timer result' };
    expect(isCurrentGameSessionValue('triviaArenaV2', stampGameSessionValue('triviaArenaV2', staleSpread))).toBe(false);
    expect(isCurrentGameSessionValue('triviaArenaV2', persisted)).toBe(false);
    expect(isCurrentGameSessionValue('triviaArenaV2', restoreGameSessionValue('triviaArenaV2', persisted))).toBe(false);
    expect(stampGameSessionValue('triviaArenaV2', oldSession).__forgeGameRuntimeId)
      .toBe(oldSession.__forgeGameRuntimeId);
  });

  it('fences only live game state, not durable scores or history', () => {
    expect(isGameSessionSetting('pendingGenderGame')).toBe(true);
    expect(isGameSessionSetting('pickYourSinSelection')).toBe(true);
    expect(isGameSessionSetting('triviaRecords')).toBe(false);
    expect(isGameSessionSetting('hangmanHighScores')).toBe(false);
    expect(GAME_SESSION_SETTING_KEYS.size).toBeGreaterThanOrEqual(12);
  });
});

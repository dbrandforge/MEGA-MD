import { describe, expect, it } from 'vitest';
import {
  GAME_SESSION_SETTING_KEYS,
  isCurrentGameSessionValue,
  isGameSessionSetting,
  claimGameSessionValue,
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

  it('clones frozen persisted values before restoring or restamping runtime metadata', () => {
    const original = stampGameSessionValue('mathGame', {
      active: true,
      round: 7
    });
    const frozen = Object.freeze(original);

    const restored = restoreGameSessionValue('mathGame', frozen);
    expect(restored).not.toBe(frozen);
    expect(restored.active).toBe(true);
    expect(isCurrentGameSessionValue('mathGame', restored)).toBe(true);

    const restamped = stampGameSessionValue('mathGame', frozen);
    expect(restamped).not.toBe(frozen);
    expect(restamped.__forgeGameRuntimeId).toBe(original.__forgeGameRuntimeId);
    expect(isCurrentGameSessionValue('mathGame', restamped)).toBe(true);
  });

  it('restores legacy frozen Symbol-stamped values without mutating the Symbol property', () => {
    const legacySymbol = Symbol.for('forge.gameSessionRuntimeId');
    const id = 'legacy-runtime-id';
    const legacy = { active: true, round: 4 };
    Object.defineProperty(legacy, legacySymbol, {
      value: id, enumerable: true, configurable: false, writable: false
    });
    Object.freeze(legacy);

    const restored = restoreGameSessionValue('mathGame', legacy);
    expect(restored).not.toBe(legacy);
    expect(restored.active).toBe(true);
    expect(restored[legacySymbol]).toBeUndefined();
    expect(restored.__forgeGameRuntimeId).toBe(id);
    expect(JSON.parse(JSON.stringify(restored)).__forgeGameRuntimeId).toBe(id);
  });

  it('explicitly claims a persisted prior-runtime session only when resume is requested', () => {
    const prior = stampGameSessionValue('mathGame', { active: true, round: 3 });
    const persisted = JSON.parse(JSON.stringify(prior));
    rotateGameSessionRuntime('explicit-resume-test');
    expect(isCurrentGameSessionValue('mathGame', persisted)).toBe(false);
    const claimed = claimGameSessionValue('mathGame', persisted);
    expect(isCurrentGameSessionValue('mathGame', claimed)).toBe(true);
    expect(claimed.round).toBe(3);
  });

  it('fences only live game state, not durable scores or history', () => {
    expect(isGameSessionSetting('pendingGenderGame')).toBe(true);
    expect(isGameSessionSetting('pickYourSinSelection')).toBe(true);
    expect(isGameSessionSetting('triviaRecords')).toBe(false);
    expect(isGameSessionSetting('hangmanHighScores')).toBe(false);
    expect(GAME_SESSION_SETTING_KEYS.size).toBeGreaterThanOrEqual(12);
  });
});

/**
 * Process-scoped game-session fence.
 *
 * Every persisted live-game state is stamped when written. A new process gets
 * a different runtime id, so sessions and pending game continuations from a
 * previous process are invisible after restart. Durable records/leaderboards
 * and game history are deliberately not fenced.
 */
import { randomBytes } from 'node:crypto';

let runtimeId = `${process.pid}-${Date.now()}-${randomBytes(8).toString('hex')}`;

export function getGameSessionRuntimeId() {
  return runtimeId;
}

export function rotateGameSessionRuntime(reason = 'connection-reset') {
  const previous = runtimeId;
  runtimeId = `${process.pid}-${Date.now()}-${randomBytes(8).toString('hex')}`;
  return { previous, current: runtimeId, reason };
}

export const GAME_SESSION_SETTING_KEYS = new Set([
  'triviaArenaV2',
  'triviaGame',
  'mathGame',
  'wouldYouRatherSessions',
  'devilsBasketSessions',
  'todSessions',
  'soloTruthDareSessions',
  'pickYourSinSessions',
  'pickYourSinSelection',
  'hotseatSession',
  'hangmanGame',
  'pendingGenderGame',
]);

export function isGameSessionSetting(key) {
  return GAME_SESSION_SETTING_KEYS.has(String(key || ''));
}

export function stampGameSessionValue(key, value) {
  if (!isGameSessionSetting(key) || !value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  if (typeof value.__forgeGameRuntimeId === 'string') return value;
  return { ...value, __forgeGameRuntimeId: runtimeId };
}

export function isCurrentGameSessionValue(key, value) {
  if (!isGameSessionSetting(key) || value == null) return true;
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    value.__forgeGameRuntimeId === runtimeId
  );
}

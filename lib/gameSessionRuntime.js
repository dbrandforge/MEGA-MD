/**
 * Process-scoped game-session fence.
 *
 * Every persisted live-game state is stamped when written. A new process gets
 * a different runtime id, so sessions and pending game continuations from a
 * previous process are invisible after restart. Durable records/leaderboards
 * and game history are deliberately not fenced.
 */
import { randomBytes } from 'node:crypto';

const GAME_RUNTIME_SYMBOL = Symbol.for('forge.gameSessionRuntimeId');
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

function attachRuntimeMetadata(value, id) {
  // Storage adapters may return frozen/sealed values or objects carrying a
  // non-writable runtime symbol. Never mutate a value owned by the adapter.
  // A shallow copy preserves the session payload and makes metadata writable
  // on the copy before it is redefined.
  const target = { ...value };
  Object.defineProperty(target, GAME_RUNTIME_SYMBOL, {
    value: id, enumerable: true, configurable: true, writable: false
  });
  Object.defineProperty(target, '__forgeGameRuntimeId', {
    value: id, enumerable: false, configurable: true, writable: false
  });
  Object.defineProperty(target, 'toJSON', {
    enumerable: false,
    configurable: true,
    value() {
      return { ...this, __forgeGameRuntimeId: this.__forgeGameRuntimeId };
    }
  });
  return target;
}

export function stampGameSessionValue(key, value) {
  if (!isGameSessionSetting(key) || !value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  const existingId = value[GAME_RUNTIME_SYMBOL] || value.__forgeGameRuntimeId;
  if (typeof existingId === 'string') return attachRuntimeMetadata(value, existingId);
  return attachRuntimeMetadata({ ...value }, runtimeId);
}

export function restoreGameSessionValue(key, value) {
  if (!isGameSessionSetting(key) || !value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  const id = value[GAME_RUNTIME_SYMBOL] || value.__forgeGameRuntimeId;
  if (typeof id !== 'string') return value;
  return attachRuntimeMetadata(value, id);
}

export function isCurrentGameSessionValue(key, value) {
  if (!isGameSessionSetting(key) || value == null) return true;
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (value[GAME_RUNTIME_SYMBOL] || value.__forgeGameRuntimeId) === runtimeId
  );
}

export function serializeGameSessionValue(key, value) {
  if (!isGameSessionSetting(key) || !value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  const id = value[GAME_RUNTIME_SYMBOL] || value.__forgeGameRuntimeId || runtimeId;
  return { ...value, __forgeGameRuntimeId: id };
}

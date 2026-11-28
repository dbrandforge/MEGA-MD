/**
 * Process-scoped game-session fence.
 *
 * Runtime metadata is carried only in a serializable string property. Earlier
 * builds also used a Symbol property; some storage adapters return frozen
 * objects, so writing that symbol back could throw during resume/save.
 */
import { randomBytes } from 'node:crypto';

const LEGACY_GAME_RUNTIME_SYMBOL = Symbol.for('forge.gameSessionRuntimeId');
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
  'triviaArenaV2', 'triviaGame', 'mathGame', 'wouldYouRatherSessions',
  'devilsBasketSessions', 'todSessions', 'soloTruthDareSessions',
  'pickYourSinSessions', 'pickYourSinSelection', 'hotseatSession',
  'hangmanGame', 'pendingGenderGame', 'sudokuSessions', 'chessSessions',
  'checkersSessions'
]);

export function isGameSessionSetting(key) {
  return GAME_SESSION_SETTING_KEYS.has(String(key || ''));
}

function readRuntimeId(value) {
  if (!value || typeof value !== 'object') return null;
  return value.__forgeGameRuntimeId || value[LEGACY_GAME_RUNTIME_SYMBOL] || null;
}

function copyWithoutLegacySymbol(value) {
  const copy = { ...value };
  // Object spread copies enumerable symbol keys. Remove our legacy key from
  // the copy so no later consumer can accidentally assign to its descriptor.
  try { delete copy[LEGACY_GAME_RUNTIME_SYMBOL]; } catch {}
  return copy;
}

function attachRuntimeMetadata(value, id) {
  const target = copyWithoutLegacySymbol(value);
  // Keep the legacy Symbol enumerable so object spreads made by delayed game
  // callbacks retain their originating runtime ID. Define it only on our copy;
  // never assign to a storage-owned/frozen object.
  Object.defineProperty(target, LEGACY_GAME_RUNTIME_SYMBOL, {
    value: id, enumerable: true, configurable: true, writable: false
  });
  Object.defineProperty(target, '__forgeGameRuntimeId', {
    value: id,
    enumerable: false,
    configurable: true,
    writable: false
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
  if (!isGameSessionSetting(key) || !value || typeof value !== 'object' || Array.isArray(value)) return value;
  const existingId = readRuntimeId(value);
  return attachRuntimeMetadata(value, typeof existingId === 'string' ? existingId : runtimeId);
}

export function claimGameSessionValue(key, value) {
  if (!isGameSessionSetting(key) || !value || typeof value !== 'object' || Array.isArray(value)) return value;
  return attachRuntimeMetadata(value, runtimeId);
}

export function restoreGameSessionValue(key, value) {
  if (!isGameSessionSetting(key) || !value || typeof value !== 'object' || Array.isArray(value)) return value;
  const id = readRuntimeId(value);
  if (typeof id !== 'string') return value;
  return attachRuntimeMetadata(value, id);
}

export function isCurrentGameSessionValue(key, value) {
  if (!isGameSessionSetting(key) || value == null) return true;
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && readRuntimeId(value) === runtimeId);
}

export function serializeGameSessionValue(key, value) {
  if (!isGameSessionSetting(key) || !value || typeof value !== 'object' || Array.isArray(value)) return value;
  const id = readRuntimeId(value) || runtimeId;
  return { ...copyWithoutLegacySymbol(value), __forgeGameRuntimeId: id };
}

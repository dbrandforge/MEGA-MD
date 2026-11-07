import store from './lightweight_store.js';
import { PRIMARY_FEATURE_GROUP } from './featureGroups.js';

const cache = new Map();
const CACHE_TTL_MS = 30_000;

export function isMaturedMindedPackageEnabled(chatId, profile) {
  return chatId === PRIMARY_FEATURE_GROUP || profile?.featureSets?.maturedMinded === true;
}

export function invalidateGroupFeatureAccessCache(chatId) {
  if (chatId) cache.delete(chatId);
}

/**
 * The original Matured Minded group always owns its bespoke lifecycle.
 * Additional groups receive those features only when the exclusive package
 * is explicitly enabled in their persisted Forge Guard profile.
 */
export async function hasMaturedMindedFeatures(chatId) {
  if (chatId === PRIMARY_FEATURE_GROUP) return true;
  if (!chatId?.endsWith('@g.us')) return false;
  const cached = cache.get(chatId);
  if (cached && cached.expiresAt > Date.now()) return cached.enabled;
  try {
    const profile = await store.getSetting(chatId, 'forgeGuardGroupProfile');
    const enabled = isMaturedMindedPackageEnabled(chatId, profile);
    cache.set(chatId, { enabled, expiresAt: Date.now() + CACHE_TTL_MS });
    return enabled;
  } catch (error) {
    console.error('[GROUP FEATURES] Could not read Matured Minded package state:', error.message);
    cache.set(chatId, { enabled: false, expiresAt: Date.now() + CACHE_TTL_MS });
    return false;
  }
}

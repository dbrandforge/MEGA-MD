import store from './lightweight_store.js';
import { PRIMARY_FEATURE_GROUP } from './featureGroups.js';

/**
 * The original Matured Minded group always owns its bespoke lifecycle.
 * Additional groups receive those features only when the exclusive package
 * is explicitly enabled in their persisted Forge Guard profile.
 */
export async function hasMaturedMindedFeatures(chatId) {
  if (chatId === PRIMARY_FEATURE_GROUP) return true;
  if (!chatId?.endsWith('@g.us')) return false;
  try {
    const profile = await store.getSetting(chatId, 'forgeGuardGroupProfile');
    return profile?.featureSets?.maturedMinded === true;
  } catch (error) {
    console.error('[GROUP FEATURES] Could not read Matured Minded package state:', error.message);
    return false;
  }
}

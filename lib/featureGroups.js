import store from './lightweight_store.js';

// Groups already authorized for the shared Mature Minded feature set.
export const PRIMARY_FEATURE_GROUP = '120363405434471171@g.us';
export const ADDITIONAL_FEATURE_GROUPS = [
  '120363420924358296@g.us' // ONLINE INCOME SQUAD
];
export const FEATURE_GROUPS = [PRIMARY_FEATURE_GROUP, ...ADDITIONAL_FEATURE_GROUPS];

const FEATURE_GROUPS_KEY = 'forgeGuardFeatureGroups';
let loaded = false;
let loadPromise = null;

export async function loadFeatureGroups() {
  if (loaded) return FEATURE_GROUPS;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const saved = await store.getSetting('global', FEATURE_GROUPS_KEY);
      if (Array.isArray(saved)) {
        for (const id of saved) {
          if (typeof id === 'string' && id.endsWith('@g.us') && !FEATURE_GROUPS.includes(id)) {
            FEATURE_GROUPS.push(id);
          }
        }
      }
    } catch (error) {
      console.error('[FEATURE GROUPS] Could not load dynamic group registry:', error.message);
    }
    loaded = true;
    return FEATURE_GROUPS;
  })();
  return loadPromise;
}

export async function registerFeatureGroup(chatId) {
  if (typeof chatId !== 'string' || !chatId.endsWith('@g.us')) {
    throw new Error('A valid WhatsApp group ID is required.');
  }
  await loadFeatureGroups();
  const next = [...new Set([...FEATURE_GROUPS, chatId])];
  if (!await store.saveSettingVerified('global', FEATURE_GROUPS_KEY, next)) {
    throw new Error('Feature-group registration could not be saved.');
  }
  FEATURE_GROUPS.splice(0, FEATURE_GROUPS.length, ...next);
  return FEATURE_GROUPS;
}

export const isFeatureGroup = (chatId) => FEATURE_GROUPS.includes(chatId);

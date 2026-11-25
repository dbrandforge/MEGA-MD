import store from './lightweight_store.js';

// Groups authorized for general Forge Guard group features.
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
        // The persisted registry is authoritative after the first setup. This
        // allows an owner to disable even a built-in additional group without
        // the default list silently re-enabling it after a restart.
        const next = [...new Set([PRIMARY_FEATURE_GROUP, ...saved.filter(id =>
          typeof id === 'string' && id.endsWith('@g.us') && id !== PRIMARY_FEATURE_GROUP
        )])];
        FEATURE_GROUPS.splice(0, FEATURE_GROUPS.length, ...next);
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

export async function unregisterFeatureGroup(chatId) {
  if (typeof chatId !== 'string' || !chatId.endsWith('@g.us')) return FEATURE_GROUPS;
  await loadFeatureGroups();
  // Matured Minded is the protected source group. Additional groups can be disabled.
  if (chatId === PRIMARY_FEATURE_GROUP) return FEATURE_GROUPS;
  const next = FEATURE_GROUPS.filter(id => id !== chatId);
  if (!await store.saveSettingVerified('global', FEATURE_GROUPS_KEY, next)) {
    throw new Error('General group-feature access could not be removed from the registry.');
  }
  FEATURE_GROUPS.splice(0, FEATURE_GROUPS.length, ...next);
  return FEATURE_GROUPS;
}

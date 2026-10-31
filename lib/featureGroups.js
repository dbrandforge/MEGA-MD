// Groups authorized for the shared Mature Minded feature set.
// Keep the primary group first; additional groups receive the same eligible features.
export const PRIMARY_FEATURE_GROUP = '120363405434471171@g.us';
export const ADDITIONAL_FEATURE_GROUPS = [
    '120363420924358296@g.us', // ONLINE INCOME SQUAD
];
export const FEATURE_GROUPS = [PRIMARY_FEATURE_GROUP, ...ADDITIONAL_FEATURE_GROUPS];
export const isFeatureGroup = (chatId) => FEATURE_GROUPS.includes(chatId);

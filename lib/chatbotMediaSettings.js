import store from './lightweight_store.js';

const SETTINGS_KEY = 'chatbotMediaModes';

export async function getChatbotMediaModes(chatId) {
    const allModes = await store.getSetting('global', SETTINGS_KEY);
    const saved = allModes && typeof allModes === 'object' ? allModes[chatId] : null;
    return {
        stickers: saved?.stickers === true,
        voiceNotes: saved?.voiceNotes === true
    };
}

export async function setChatbotMediaMode(chatId, feature, enabled) {
    if (!['stickers', 'voiceNotes'].includes(feature)) return false;
    const allModes = await store.getSetting('global', SETTINGS_KEY);
    const modes = allModes && typeof allModes === 'object' && !Array.isArray(allModes) ? allModes : {};
    const current = modes[chatId] && typeof modes[chatId] === 'object' ? modes[chatId] : {};
    const updated = { ...current, [feature]: Boolean(enabled) };
    await store.saveSetting('global', SETTINGS_KEY, { ...modes, [chatId]: updated });
    const persisted = await getChatbotMediaModes(chatId);
    return persisted[feature] === Boolean(enabled);
}

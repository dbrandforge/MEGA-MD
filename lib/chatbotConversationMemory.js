export function normalizeConversationParticipant(senderId) {
    return String(senderId || '').trim().replace(/:\d+(?=@)/, '');
}

export function getConversationMemoryKey({ chatId, senderId, isGroup }) {
    const chat = String(chatId || '').trim();
    const participant = normalizeConversationParticipant(senderId);
    if (!chat) return null;
    if (isGroup) return participant ? `group:${chat}:user:${participant}` : null;
    return `dm:${participant || chat}`;
}

export function createKeyedSerialExecutor() {
    const pending = new Map();
    return async function run(key, task) {
        const scope = String(key || '');
        if (!scope) throw new Error('A conversation scope key is required');
        const previous = pending.get(scope) || Promise.resolve();
        let release;
        const current = new Promise(resolve => { release = resolve; });
        pending.set(scope, current);
        await previous.catch(() => {});
        try {
            return await task();
        } finally {
            release();
            if (pending.get(scope) === current) pending.delete(scope);
        }
    };
}


export function getCachedConversationHistory(messages, loaded, key) {
    if (!loaded.has(key) || !messages.has(key)) return undefined;
    const history = messages.get(key);
    messages.delete(key);
    messages.set(key, history);
    loaded.delete(key);
    loaded.add(key);
    return history;
}

export function setCachedConversationHistory(messages, loaded, key, history, maxEntries = 1000) {
    messages.delete(key);
    messages.set(key, history);
    loaded.delete(key);
    loaded.add(key);
    while (messages.size > maxEntries || loaded.size > maxEntries) {
        const oldestKey = loaded.values().next().value;
        if (oldestKey === undefined) break;
        loaded.delete(oldestKey);
        messages.delete(oldestKey);
    }
    return history;
}

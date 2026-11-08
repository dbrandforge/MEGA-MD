export function normalizeConversationParticipant(senderId) {
    return String(senderId || '').trim().replace(/:\\d+(?=@)/, '');
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

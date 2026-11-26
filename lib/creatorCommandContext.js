const PENDING_TTL_MS = 10 * 60 * 1000;
const MAX_PENDING_CONTEXTS = 500;
const pending = new Map();

function makeKey(senderId, chatId) {
    if (!senderId || !chatId) return null;
    return String(senderId) + ':' + String(chatId);
}

export function setPendingCreatorCommand(senderId, chatId, instruction, clarification, now = Date.now()) {
    const key = makeKey(senderId, chatId);
    const text = String(instruction || '').trim().slice(0, 1200);
    if (!key || !text) return false;
    pending.delete(key);
    pending.set(key, {
        instruction: text,
        clarification: String(clarification || '').trim().slice(0, 500),
        createdAt: now,
        expiresAt: now + PENDING_TTL_MS
    });
    while (pending.size > MAX_PENDING_CONTEXTS) pending.delete(pending.keys().next().value);
    return true;
}

export function getPendingCreatorCommand(senderId, chatId, now = Date.now()) {
    const key = makeKey(senderId, chatId);
    if (!key) return null;
    const value = pending.get(key);
    if (!value) return null;
    if (value.expiresAt <= now) {
        pending.delete(key);
        return null;
    }
    // Refresh insertion order, but do not extend the original expiry.
    pending.delete(key);
    pending.set(key, value);
    return { instruction: value.instruction, clarification: value.clarification };
}

export function clearPendingCreatorCommand(senderId, chatId) {
    const key = makeKey(senderId, chatId);
    return key ? pending.delete(key) : false;
}

export function clearAllPendingCreatorCommands() {
    pending.clear();
}

const DEFAULT_TTL_MS = 2 * 60 * 1000;
const MAX_ENTRIES = 5000;

export function createMessageDeduplicator({ ttlMs = DEFAULT_TTL_MS, maxEntries = MAX_ENTRIES, now = Date.now } = {}) {
  const seen = new Map();
  return function isDuplicate(message) {
    const id = String(message?.key?.id || '').trim();
    const chat = String(message?.key?.remoteJid || '').trim();
    if (!id || !chat) return false;
    const key = chat + ':' + id;
    const timestamp = now();
    while (seen.size) {
      const first = seen.entries().next().value;
      if (!first || first[1] > timestamp) break;
      seen.delete(first[0]);
    }
    const expiresAt = seen.get(key);
    if (expiresAt && expiresAt > timestamp) return true;
    seen.delete(key);
    seen.set(key, timestamp + ttlMs);
    while (seen.size > maxEntries) seen.delete(seen.keys().next().value);
    return false;
  };
}

export const isDuplicateIncomingMessage = createMessageDeduplicator();

// Opt-in recovery for stale Baileys group Sender Key distribution memory.
// The underlying key name is Baileys-internal; keep this narrowly scoped and disabled by default.
const RECOVERY_COOLDOWN_MS = 10 * 60 * 1000;
const lastRefreshAt = new Map();
const refreshInFlight = new Map();

export function parseGroupSenderKeyRecoveryTargets(value = '') {
    return new Set(String(value)
        .split(',')
        .map(item => item.trim())
        .filter(item => /^[0-9]+(?:-[0-9]+)?@g\\.us$/.test(item)));
}

export async function resetGroupSenderKeyMemoryBeforeSend(jid, keyStore, targets) {
    if (typeof jid !== 'string' || !jid.endsWith('@g.us') || !targets?.has(jid)) {
        return false;
    }
    if (!keyStore || typeof keyStore.set !== 'function') {
        throw new TypeError('A writable Baileys Signal key store is required for group Sender Key recovery');
    }

    const now = Date.now();
    const lastRefresh = lastRefreshAt.get(jid) || 0;
    if (now - lastRefresh < RECOVERY_COOLDOWN_MS) return false;

    // Concurrent sends to the same recovery target share one key-store reset.
    const pending = refreshInFlight.get(jid);
    if (pending) return pending;

    const refresh = (async () => {
        // Baileys 7 rc14 caches this map and only re-sends SKDMs to devices it
        // believes already received the key. Refresh at most once per cooldown
        // window instead of clearing the map before every outbound group message.
        await keyStore.set({ 'sender-key-memory': { [jid]: null } });
        lastRefreshAt.set(jid, Date.now());
        return true;
    })();

    refreshInFlight.set(jid, refresh);
    try {
        return await refresh;
    } finally {
        if (refreshInFlight.get(jid) === refresh) refreshInFlight.delete(jid);
    }
}

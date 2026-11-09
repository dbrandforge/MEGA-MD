// Opt-in recovery for stale Baileys group Sender Key distribution memory.
// The underlying key name is Baileys-internal; keep this narrowly scoped and disabled by default.
export function parseGroupSenderKeyRecoveryTargets(value = '') {
    return new Set(String(value)
        .split(',')
        .map(item => item.trim())
        .filter(item => /^\d+-\d+@g\.us$/.test(item)));
}

export async function resetGroupSenderKeyMemoryBeforeSend(jid, keyStore, targets) {
    if (typeof jid !== 'string' || !jid.endsWith('@g.us') || !targets?.has(jid)) {
        return false;
    }
    if (!keyStore || typeof keyStore.set !== 'function') {
        throw new TypeError('A writable Baileys Signal key store is required for group Sender Key recovery');
    }

    // Baileys 7 rc14 caches this map and only re-sends SKDMs to devices it
    // believes already received the key. Clearing one configured group's map
    // forces a fresh distribution to its current participant devices.
    await keyStore.set({ 'sender-key-memory': { [jid]: null } });
    return true;
}

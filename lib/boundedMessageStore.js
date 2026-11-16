export function createBoundedMessageStore({
    maxEntries = 10000,
    ttlMs = 48 * 60 * 60 * 1000,
    now = Date.now,
    onEvict = null,
} = {}) {
    const entries = new Map();

    function evict(key, reason) {
        const entry = entries.get(key);
        if (!entry) return false;
        entries.delete(key);
        try {
            const result = onEvict?.(entry.value, key, reason);
            if (result && typeof result.catch === 'function') result.catch(() => {});
        } catch {}
        return true;
    }

    function prune(timestamp = now()) {
        let removed = 0;
        for (const [key, entry] of entries) {
            if (timestamp - entry.storedAt > ttlMs) {
                if (evict(key, 'expired')) removed++;
            }
        }
        while (entries.size > maxEntries) {
            const oldestKey = entries.keys().next().value;
            if (oldestKey === undefined) break;
            if (evict(oldestKey, 'capacity')) removed++;
        }
        return removed;
    }

    return {
        set(key, value) {
            if (entries.has(key)) {
                const previous = entries.get(key)?.value;
                entries.delete(key);
                if (previous?.mediaPath && previous.mediaPath !== value?.mediaPath) {
                    try {
                        const result = onEvict?.(previous, key, 'replaced');
                        if (result && typeof result.catch === 'function') result.catch(() => {});
                    } catch {}
                }
            }
            entries.set(key, { value, storedAt: now() });
            while (entries.size > maxEntries) {
                const oldestKey = entries.keys().next().value;
                if (oldestKey === undefined) break;
                evict(oldestKey, 'capacity');
            }
            return this;
        },
        get(key) {
            const entry = entries.get(key);
            if (!entry) return undefined;
            if (now() - entry.storedAt > ttlMs) {
                evict(key, 'expired');
                return undefined;
            }
            entries.delete(key);
            entries.set(key, entry);
            return entry.value;
        },
        has(key) {
            return this.get(key) !== undefined;
        },
        delete(key) {
            return evict(key, 'deleted');
        },
        prune,
        *entries() {
            for (const [key, entry] of entries) yield [key, entry.value];
        },
        get size() {
            return entries.size;
        },
        clear() {
            for (const key of [...entries.keys()]) evict(key, 'cleared');
        },
    };
}

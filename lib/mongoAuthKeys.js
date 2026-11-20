// MongoDB-backed Signal key store for Baileys (opt-in via AUTH_STORE=mongo).
//
// The default multi-file auth state keeps thousands of tiny JSON files on disk
// and a separate loop re-reads, hashes and uploads them. On a 0.15 CPU instance
// that churn is a large share of the load. This store keeps the same documents
// (same filenames and JSON format as useMultiFileAuthState, in the same
// collection), so switching back to file mode needs no migration.
//
//  - reads: in-memory cache first, then one batched MongoDB query per miss set
//  - writes: applied to memory immediately, flushed to MongoDB as a small
//    write-behind batch containing ONLY keys that actually changed
//  - shutdown: flush() persists everything pending
//
// creds.json is still handled by the existing file + backup path.

const DEFAULT_FLUSH_MS = 5000;
const DEFAULT_CACHE_MAX = 2500;
const BATCH_SIZE = 100;
const MAX_FLUSH_DELAY_MS = 60000;
const DEFAULT_BATCH_COOLDOWN_MS = (() => {
    const configured = Number.parseInt(process.env.AUTH_KEY_BATCH_COOLDOWN_MS ?? '25', 10);
    return Number.isFinite(configured) ? Math.max(0, Math.min(1000, configured)) : 25;
})();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export function authKeyFilename(type, id) {
    // Identical to Baileys' multi-file fixFileName(`${type}-${id}.json`).
    return `${type}-${id}.json`.replace(/\//g, '__').replace(/:/g, '-');
}

export function createMongoKeyStore({
    getModel,                    // async () => mongoose Model | null
    canWrite = async () => true, // async () => boolean (single-writer lease)
    BufferJSON,
    proto,
    log = () => { },
    flushMs = DEFAULT_FLUSH_MS,
    cacheMax = DEFAULT_CACHE_MAX,
    batchCooldownMs = DEFAULT_BATCH_COOLDOWN_MS,
}) {
    const cooldownMs = Number.isFinite(Number(batchCooldownMs))
        ? Math.max(0, Math.min(1000, Number(batchCooldownMs)))
        : DEFAULT_BATCH_COOLDOWN_MS;
    const cache = new Map();   // filename -> parsed value (LRU by insertion order)
    let dirty = new Map();     // filename -> serialized string | null (delete)
    let timer = null;
    let flushing = null;
    let rerun = false;
    let warnedNotLeader = false;
    let lastFlushMs = 0;       // how long the last pass took (drives the next delay)
    let failureStreak = 0;
    const known = new Map();   // filename -> last content known to be in MongoDB
    const categories = new Map(); // dirty filename -> key type, for diagnostics only

    const rememberKnown = (filename, content) => {
        known.delete(filename);
        known.set(filename, content);
        while (known.size > cacheMax) known.delete(known.keys().next().value);
    };

    // Evict oldest entries that are not waiting to be written.
    const trim = () => {
        if (cache.size <= cacheMax) return;
        for (const key of cache.keys()) {
            if (cache.size <= cacheMax) break;
            if (!dirty.has(key)) cache.delete(key);
        }
    };
    const remember = (filename, value) => {
        cache.delete(filename);
        cache.set(filename, value);
        trim();
    };

    const parse = (type, content) => {
        let value = JSON.parse(content, BufferJSON.reviver);
        if (type === 'app-state-sync-key' && value && proto?.Message?.AppStateSyncKeyData) {
            value = proto.Message.AppStateSyncKeyData.fromObject(value);
        }
        return value;
    };

    const schedule = () => {
        if (timer) return;
        // Back off when the last pass was slow or failed, so a CPU-starved
        // process is never asked to start the next write before it recovers.
        const delay = Math.min(MAX_FLUSH_DELAY_MS, Math.max(flushMs, lastFlushMs, failureStreak ? flushMs * 2 ** failureStreak : 0));
        timer = setTimeout(() => { timer = null; flush().catch(() => { }); }, delay);
        timer.unref?.();
    };

    // Single-flight: only one database pass runs at a time. A caller that
    // arrives mid-pass gets that same promise, and one follow-up pass runs so
    // everything dirty at call time (e.g. at shutdown) is still persisted.
    function flush() {
        if (flushing) { rerun = true; return flushing; }
        flushing = (async () => {
            try {
                do {
                    rerun = false;
                    await flushOnce();
                } while (rerun && dirty.size);
            } finally {
                flushing = null;
            }
            if (dirty.size) schedule();
        })();
        return flushing;
    }

    async function flushOnce() {
        if (!dirty.size) return;
        const Model = await getModel();
        if (!Model) return;
        if (!(await canWrite())) {
            if (!warnedNotLeader) {
                warnedNotLeader = true;
                log('warning', '[auth-keys] Not the active session writer; key writes are being held back.');
            }
            return;
        }
        warnedNotLeader = false;
        const batch = dirty;
        dirty = new Map();
        const entries = [...batch.entries()];
        let written = 0;
        let batchCount = 0;
        const flushStartedAt = Date.now();
        try {
            for (let i = 0; i < entries.length; i += BATCH_SIZE) {
                const slice = entries.slice(i, i + BATCH_SIZE);
                const ops = slice.map(([filename, content]) => content === null
                    ? { deleteOne: { filter: { filename } } }
                    : {
                        updateOne: {
                            filter: { filename },
                            update: { $set: { filename, content, updatedAt: new Date() } },
                            upsert: true,
                        },
                    });
                await Model.bulkWrite(ops, { ordered: false });
                for (const [filename, content] of slice) {
                    if (content === null) known.delete(filename); else rememberKnown(filename, content);
                }
                written += slice.length;
                batchCount++;
                // Yield immediately, then apply a small real cooldown between
                // database batches so a large dirty-key burst cannot monopolize
                // MongoDB or a CPU-constrained Node.js process.
                await new Promise(resolve => setImmediate(resolve));
                if (i + BATCH_SIZE < entries.length && cooldownMs > 0) {
                    await wait(cooldownMs);
                }
            }
        } catch (err) {
            // Re-queue anything that was not durably written, unless a newer
            // value for the same key arrived while we were flushing.
            for (const [filename, content] of entries.slice(written)) {
                if (!dirty.has(filename)) dirty.set(filename, content);
            }
            failureStreak = Math.min(5, failureStreak + 1);
            log('warning', `[auth-keys] Key flush failed (will retry): ${err.message}`);
            schedule();
            return;
        }
        failureStreak = 0;
        lastFlushMs = Date.now() - flushStartedAt;
        const counts = {};
        for (const [filename] of entries) {
            const type = categories.get(filename) || 'other';
            counts[type] = (counts[type] || 0) + 1;
            categories.delete(filename);
        }
        trim();
        if (written) {
            const kinds = Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(',');
            log('info', `[auth-keys] Persisted ${written} changed key(s) in ${batchCount} batch(es) to MongoDB; cooldown=${cooldownMs}ms duration=${lastFlushMs}ms pending=${dirty.size} kinds=${kinds}`);
        }
    }

    const store = {
        async get(type, ids) {
            const data = {};
            const misses = [];
            for (const id of ids) {
                const filename = authKeyFilename(type, id);
                if (dirty.has(filename)) {
                    const pending = dirty.get(filename);
                    if (pending !== null) data[id] = cache.get(filename) ?? parse(type, pending);
                    continue;
                }
                if (cache.has(filename)) {
                    const value = cache.get(filename);
                    cache.delete(filename); cache.set(filename, value); // refresh recency
                    data[id] = value;
                    continue;
                }
                misses.push([id, filename]);
            }
            if (misses.length) {
                const Model = await getModel();
                if (Model) {
                    const docs = await Model.find({ filename: { $in: misses.map(([, f]) => f) } })
                        .select('filename content').lean();
                    const byName = new Map(docs.map(doc => [doc.filename, doc.content]));
                    for (const [id, filename] of misses) {
                        const content = byName.get(filename);
                        if (typeof content !== 'string') continue;
                        try {
                            const value = parse(type, content);
                            rememberKnown(filename, content);
                            remember(filename, value);
                            data[id] = value;
                        } catch {
                            // Unreadable document: treat as missing, like an absent file.
                        }
                    }
                }
            }
            return data;
        },

        async set(data) {
            for (const category of Object.keys(data)) {
                for (const id of Object.keys(data[category])) {
                    const value = data[category][id];
                    const filename = authKeyFilename(category, id);
                    if (value) {
                        const content = JSON.stringify(value, BufferJSON.replacer);
                        remember(filename, value);
                        // Skip writes that would store exactly what MongoDB already has.
                        if (!dirty.has(filename) && known.get(filename) === content) continue;
                        dirty.set(filename, content);
                        categories.set(filename, category);
                    } else {
                        dirty.set(filename, null);
                        categories.set(filename, category);
                        cache.delete(filename);
                    }
                }
            }
            if (dirty.size) schedule();
        },

        flush,
        pendingCount: () => dirty.size,
        cacheSize: () => cache.size,
        close() { if (timer) { clearTimeout(timer); timer = null; } },
    };
    return store;
}

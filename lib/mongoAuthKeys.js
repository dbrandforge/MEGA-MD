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
}) {
    const cache = new Map();   // filename -> parsed value (LRU by insertion order)
    let dirty = new Map();     // filename -> serialized string | null (delete)
    let timer = null;
    let flushing = null;
    let warnedNotLeader = false;

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
        timer = setTimeout(() => { timer = null; flush().catch(() => { }); }, flushMs);
        timer.unref?.();
    };

    async function flush() {
        if (flushing) { await flushing; if (!dirty.size) return; }
        if (!dirty.size) return;
        flushing = (async () => {
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
                    written += slice.length;
                    // Yield so message handling is not starved on a tiny CPU quota.
                    await new Promise(resolve => setImmediate(resolve));
                }
            } catch (err) {
                // Re-queue anything that was not durably written, unless a newer
                // value for the same key arrived while we were flushing.
                for (const [filename, content] of entries.slice(written)) {
                    if (!dirty.has(filename)) dirty.set(filename, content);
                }
                log('warning', `[auth-keys] Key flush failed (will retry): ${err.message}`);
                schedule();
                return;
            }
            trim();
            if (written) log('info', `[auth-keys] Persisted ${written} changed key(s) to MongoDB`);
        })();
        try { await flushing; } finally { flushing = null; }
        if (dirty.size) schedule();
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
                        dirty.set(filename, JSON.stringify(value, BufferJSON.replacer));
                        remember(filename, value);
                    } else {
                        dirty.set(filename, null);
                        cache.delete(filename);
                    }
                }
            }
            schedule();
        },

        flush,
        pendingCount: () => dirty.size,
        cacheSize: () => cache.size,
        close() { if (timer) { clearTimeout(timer); timer = null; } },
    };
    return store;
}

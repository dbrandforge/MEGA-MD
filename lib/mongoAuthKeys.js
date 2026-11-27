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

import { createHash } from 'crypto';

const DEFAULT_FLUSH_MS = 12000;
const DEFAULT_CACHE_MAX = 2500;
const BATCH_SIZE = 200;
const MAX_FLUSH_DELAY_MS = 30000;
const DEFAULT_SESSION_FLUSH_MS = 60 * 1000;
const DEFAULT_BATCH_COOLDOWN_MS = (() => {
    const configured = Number.parseInt(process.env.AUTH_KEY_BATCH_COOLDOWN_MS ?? '100', 10);
    return Number.isFinite(configured) ? Math.max(0, Math.min(1000, configured)) : 100;
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
    sessionFlushMs = DEFAULT_SESSION_FLUSH_MS,
}) {
    const cooldownMs = Number.isFinite(Number(batchCooldownMs))
        ? Math.max(0, Math.min(1000, Number(batchCooldownMs)))
        : DEFAULT_BATCH_COOLDOWN_MS;
    const cache = new Map();   // filename -> parsed value (LRU by insertion order)
    let dirty = new Map();     // filename -> serialized string | null (delete)
    const inFlight = new Map(); // filename -> content currently being persisted
    let timer = null;
    let flushing = null;
    let rerun = false;
    let warnedNotLeader = false;
    let lastFlushMs = 0;       // how long the last pass took (drives the next delay)
    let failureStreak = 0;
    const known = new Map();   // filename -> SHA-256 of last content known to be in MongoDB; not LRU-capped
    const categories = new Map(); // dirty filename -> key type, for diagnostics only
    let lastLargeSetTraceAt = 0;
    // Existing Signal sessions are rewritten by Baileys on every large group send
    // (~775 at once). The in-memory cache is the source of truth, so changed
    // sessions that MongoDB already holds are batched and written at most once per
    // sessionFlushMs (and always on shutdown) instead of continuously.
    const deferred = new Map(); // filename -> serialized session waiting for the next batch
    let deferredTimer = null;
    const diffSamples = new Map(); // filename -> last serialized content, for change diagnostics (max 3)
    let lastDiffLogAt = 0;

    const fingerprint = content => createHash('sha256').update(content).digest('hex');
    // This is a persistence baseline, not an object cache: evicting entries here
    // makes Baileys' recurring full-session set look dirty and rewrites unchanged
    // ratchets. Keep one compact hash for every MongoDB key, independent of cacheMax.
    const rememberKnown = (filename, content) => {
        known.set(filename, fingerprint(content));
    };

    // Evict oldest entries that are not waiting to be written.
    const trim = () => {
        if (cache.size <= cacheMax) return;
        for (const key of cache.keys()) {
            if (cache.size <= cacheMax) break;
            if (!dirty.has(key) && !deferred.has(key)) cache.delete(key);
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

    const firstDifferingPath = (a, b, path = '') => {
        if (a === b) return null;
        if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return path || '(root)';
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const key of keys) {
            if (!(key in a) || !(key in b)) return `${path}/${key}(added-or-removed)`;
            const found = firstDifferingPath(a[key], b[key], `${path}/${Array.isArray(a) ? '#' : key}`);
            if (found) return found;
        }
        return null;
    };
    // Logs only a structural path and sizes, never key material or values.
    const traceSessionChange = (filename, before, after) => {
        try {
            if (Date.now() - lastDiffLogAt < 5 * 60 * 1000) return;
            lastDiffLogAt = Date.now();
            const path = firstDifferingPath(JSON.parse(before), JSON.parse(after)) || 'none';
            // Structural object keys can contain opaque Signal session identifiers.
            // Log only the nesting depth, never the path or identifier itself.
            const depth = path === 'none' ? 0 : path.split('/').length - 1;
            log('warning', `[auth-keys] Session rewrite differs structure_depth=${depth} lenBefore=${before.length} lenAfter=${after.length}`);
        } catch { /* diagnostic only */ }
    };
    const promoteDeferred = () => {
        for (const [filename, content] of deferred) {
            if (!dirty.has(filename)) dirty.set(filename, content);
        }
        deferred.clear();
        if (deferredTimer) { clearTimeout(deferredTimer); deferredTimer = null; }
    };
    const scheduleDeferred = () => {
        if (deferredTimer || !deferred.size) return;
        deferredTimer = setTimeout(() => {
            deferredTimer = null;
            promoteDeferred();
            if (dirty.size) { schedule(); }
        }, sessionFlushMs);
        deferredTimer.unref?.();
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
        // Mark the entire detached batch before the first await. Baileys can
        // re-submit the same transaction while MongoDB is still writing it;
        // without this snapshot, those identical values are queued a second time.
        const batchKinds = new Map();
        for (const [filename, content] of entries) {
            inFlight.set(filename, content);
            batchKinds.set(filename, categories.get(filename) || 'other');
            categories.delete(filename);
        }
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
                    if (inFlight.has(filename) && inFlight.get(filename) === content) inFlight.delete(filename);
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
                if (!dirty.has(filename)) {
                    // If a newer session value arrived while this write was in
                    // flight, retry that value rather than overwriting it with
                    // the older failed batch entry.
                    const retryContent = deferred.has(filename) ? deferred.get(filename) : content;
                    dirty.set(filename, retryContent);
                    deferred.delete(filename);
                    if (!categories.has(filename)) categories.set(filename, batchKinds.get(filename) || 'other');
                }
            }
            for (const [filename, content] of entries) {
                if (inFlight.has(filename) && inFlight.get(filename) === content) inFlight.delete(filename);
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
            const type = batchKinds.get(filename) || 'other';
            counts[type] = (counts[type] || 0) + 1;
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
                if (!dirty.has(filename) && deferred.has(filename)) {
                    data[id] = cache.get(filename) ?? parse(type, deferred.get(filename));
                    continue;
                }
                if (dirty.has(filename)) {
                    const pending = dirty.get(filename);
                    if (pending !== null) data[id] = cache.get(filename) ?? parse(type, pending);
                    continue;
                }
                if (inFlight.has(filename)) {
                    const pending = inFlight.get(filename);
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
            // The production log shows ~799 session keys being marked dirty every minute.
            // Capture the call site (never key IDs or contents) so the next deploy identifies
            // which Baileys operation is issuing these unusually broad writes.
            const sessionCount = Object.keys(data?.session || {}).length;
            if (sessionCount >= 100 && Date.now() - lastLargeSetTraceAt >= 5 * 60 * 1000) {
                lastLargeSetTraceAt = Date.now();
                const caller = new Error('large Signal session-key set').stack?.split('\n').slice(2, 9).join(' <- ') || 'unavailable';
                log('warning', `[auth-keys] Large session set diagnostic count=${sessionCount} caller=${caller}`);
            }
            for (const category of Object.keys(data)) {
                for (const id of Object.keys(data[category])) {
                    const value = data[category][id];
                    const filename = authKeyFilename(category, id);
                    if (value) {
                        const content = JSON.stringify(value, BufferJSON.replacer);
                        remember(filename, value);
                        // Skip writes that would store exactly what MongoDB already has.
                        const hash = fingerprint(content);
                        if (dirty.has(filename) && dirty.get(filename) === content) continue;
                        if (deferred.has(filename) && deferred.get(filename) === content) continue;
                        if (!dirty.has(filename) && !deferred.has(filename) && inFlight.has(filename) && inFlight.get(filename) === content) continue;
                        if (!dirty.has(filename) && !deferred.has(filename) && !inFlight.has(filename) && known.get(filename) === hash) continue;
                        if (category === 'session' && !dirty.has(filename) && known.has(filename)) {
                            const sample = diffSamples.get(filename);
                            if (sample && sample !== content) traceSessionChange(filename, sample, content);
                            if (diffSamples.size < 3 || sample !== undefined) diffSamples.set(filename, content);
                            deferred.set(filename, content);
                            categories.set(filename, category);
                            continue;
                        }
                        dirty.set(filename, content);
                        deferred.delete(filename);
                        categories.set(filename, category);
                    } else {
                        if (dirty.has(filename) && dirty.get(filename) === null) continue;
                        if (!dirty.has(filename) && !deferred.has(filename) && inFlight.has(filename) && inFlight.get(filename) === null) continue;
                        deferred.delete(filename);
                        diffSamples.delete(filename);
                        dirty.set(filename, null);
                        categories.set(filename, category);
                        cache.delete(filename);
                    }
                }
            }
            if (dirty.size) schedule();
            scheduleDeferred();
        },

        flush: () => { promoteDeferred(); return flush(); },
        pendingCount: () => dirty.size + deferred.size,
        cacheSize: () => cache.size,
        close() {
            if (timer) { clearTimeout(timer); timer = null; }
            if (deferredTimer) { clearTimeout(deferredTimer); deferredTimer = null; }
        },
    };
    return store;
}

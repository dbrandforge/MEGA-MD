// Durable, concurrency-safe persistence for the complete Baileys multi-file auth state.
import fs from 'fs';
import { createHash, randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { printLog } from './print.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSION_DIR = path.join(__dirname, '..', 'session');
const MONGO_URL = process.env.MONGO_URL || '';
const MANIFEST_FILENAME = '__snapshot_manifest__.json';
const LOCK_ID = 'baileys-session-snapshot';
const LOCK_TTL_MS = 5 * 60 * 1000;
// A replacement Render instance must outwait the full snapshot lease plus a
// safety margin; 90 seconds is shorter than LOCK_TTL_MS and can abort every
// deployment that terminates the previous process during a snapshot.
export const DEFAULT_LEADERSHIP_WAIT_MS = LOCK_TTL_MS + 60 * 1000;
const LEADER_ID = 'baileys-session-backup-leader';
const LEADER_TTL_MS = 90 * 1000;
const LEADER_RENEW_INTERVAL_MS = 20 * 1000;
const PROCESS_OWNER = randomUUID();
const PROCESS_STARTED_AT = new Date();
let isBackupLeader = false;
let leaderHeartbeat = null;

let connection = null;
let SessionFileModel = null;
let LockModel = null;
let LeaderModel = null;
let connecting = null;
let backupQueue = Promise.resolve();
let lastSyncedHashes = new Map();
let lastManifestContent = null;

function getModel() {
    if (!MONGO_URL) return null;
    if (SessionFileModel) return SessionFileModel;
    connection = mongoose.createConnection(MONGO_URL);
    connection.on('error', err => printLog('warning', `[session-backup] MongoDB connection error: ${err.message}`));
    const schema = new mongoose.Schema({
        filename: { type: String, required: true, unique: true },
        content: { type: String, required: true },
        updatedAt: { type: Date, default: Date.now },
    });
    SessionFileModel = connection.model('BaileysSessionFile', schema, 'baileys_session_files');
    const lockSchema = new mongoose.Schema({
        _id: String,
        owner: String,
        startedAt: Date,
        expiresAt: Date,
    }, { versionKey: false });
    LockModel = connection.model('BaileysSessionBackupLock', lockSchema, 'baileys_session_backup_locks');
    LeaderModel = connection.model('BaileysSessionBackupLeader', lockSchema, 'baileys_session_backup_leaders');
    return SessionFileModel;
}

async function waitForConnection() {
    if (!connection || connection.readyState === 1) return connection?.readyState === 1;
    if (!connecting) {
        connecting = new Promise(resolve => {
            const finish = value => {
                clearTimeout(timer);
                connection.off('open', onOpen);
                connection.off('error', onError);
                connecting = null;
                resolve(value);
            };
            const onOpen = () => finish(true);
            const onError = () => finish(false);
            const timer = setTimeout(() => finish(false), 10000);
            connection.once('open', onOpen);
            connection.once('error', onError);
        });
    }
    return connecting;
}

function isValidCredentials(content) {
    try {
        const creds = JSON.parse(content);
        return creds?.registered === true && !!creds.noiseKey && !!creds.signedIdentityKey && !!creds.signedPreKey;
    } catch {
        return false;
    }
}

function safeFilename(filename) {
    return typeof filename === 'string' && filename.length > 0 &&
        filename === path.basename(filename) && filename.endsWith('.json') &&
        filename !== MANIFEST_FILENAME;
}

// Report only aggregate file counts. Never expose filenames, JIDs, or auth contents.
export function summarizeAuthStateInventory(filenames = []) {
    const summary = { total: 0, credentials: 0, sessions: 0, senderKeys: 0, preKeys: 0, appStateKeys: 0, other: 0 };
    for (const filename of filenames) {
        if (!safeFilename(filename)) continue;
        summary.total++;
        if (filename === 'creds.json') summary.credentials++;
        else if (filename.startsWith('session-')) summary.sessions++;
        else if (filename.startsWith('sender-key-')) summary.senderKeys++;
        else if (filename.startsWith('pre-key-')) summary.preKeys++;
        else if (filename.startsWith('app-state-sync-')) summary.appStateKeys++;
        else summary.other++;
    }
    return summary;
}

export function getAuthStateInventory() {
    return summarizeAuthStateInventory(fs.readdirSync(SESSION_DIR));
}

// Baileys stores both forward and reverse LID mappings as JSON strings.
// All other auth-state files must retain the existing object-root validation.
export function isValidAuthJson(content, filename = '') {
    if (typeof content !== 'string' || !content.trim()) return false;
    try {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === 'object') return true;
        return typeof parsed === 'string' &&
            typeof filename === 'string' &&
            filename.startsWith('lid-mapping-') &&
            filename.endsWith('.json');
    } catch {
        return false;
    }
}

// Log only a file class, never a raw filename (which may contain a WhatsApp JID).
function getSafeAuthFileLabel(filename) {
    if (filename === 'creds.json') return 'creds.json';
    if (/^session-.*\.json$/.test(filename)) return 'session-<redacted>.json';
    if (/^sender-key-.*\.json$/.test(filename)) return 'sender-key-<redacted>.json';
    if (/^pre-key-.*\.json$/.test(filename)) return 'pre-key-<redacted>.json';
    if (/^app-state-sync-.*\.json$/.test(filename)) return 'app-state-sync-<redacted>.json';
    // Preserve only the filename pattern for unknown JSON files. Strip all
    // numeric identifiers and JID-like suffixes before anything reaches logs.
    const redacted = String(filename)
        .replace(/@[^.]+/g, '@<redacted>')
        .replace(/\\d+/g, '#')
        .replace(/[^a-zA-Z0-9@._<>#-]/g, '_')
        .slice(0, 80);
    return `other-json:${redacted || 'unknown'}`;
}

function getAuthJsonFailureDetail(content, filename = '') {
    if (typeof content !== 'string' || !content.trim()) return 'empty_file';
    try {
        const parsed = JSON.parse(content);
        return isValidAuthJson(content, filename) ? null :
            (parsed && typeof parsed === 'object' ? null : 'invalid_json_root');
    } catch {
        return 'malformed_json';
    }
}

function hashContent(content) {
    return createHash('sha256').update(content).digest('hex');
}

export function chunkOperations(operations, size = 250) {
    if (!Array.isArray(operations) || !Number.isInteger(size) || size < 1) return [];
    const chunks = [];
    for (let index = 0; index < operations.length; index += size) {
        chunks.push(operations.slice(index, index + size));
    }
    return chunks;
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Capture the auth directory as one coherent generation. Baileys writes several
// independent key files while messages are flowing; a single transient write
// must not cause every scheduled Mongo snapshot to be discarded.
async function captureStableAuthSnapshot(maxAttempts = 6) {
    let lastFailure = 'concurrent_auth_write';
    let lastFailureFile = 'unknown';
    let lastFailureDetail = 'none';
    let lastFailureBytes = 0;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const namesBefore = fs.readdirSync(SESSION_DIR).filter(safeFilename).sort();
            const snapshot = [];
            const observedStats = new Map();
            let stable = true;

            for (const filename of namesBefore) {
                const filePath = path.join(SESSION_DIR, filename);
                const before = fs.statSync(filePath);
                const content = fs.readFileSync(filePath, 'utf8');
                const after = fs.statSync(filePath);

                const jsonValid = isValidAuthJson(content, filename);
                if (
                    before.size !== after.size ||
                    before.mtimeMs !== after.mtimeMs ||
                    before.ctimeMs !== after.ctimeMs ||
                    before.ino !== after.ino ||
                    !jsonValid
                ) {
                    lastFailure = !jsonValid ? 'invalid_auth_json' : 'file_changed_during_read';
                    if (!jsonValid) {
                        lastFailureFile = getSafeAuthFileLabel(filename);
                        lastFailureDetail = getAuthJsonFailureDetail(content, filename) || 'unknown';
                        lastFailureBytes = Buffer.byteLength(content, 'utf8');
                    }
                    stable = false;
                    break;
                }

                observedStats.set(filename, after);
                snapshot.push({ filename, content, hash: hashContent(content) });
            }

            if (stable) {
                const namesAfter = fs.readdirSync(SESSION_DIR).filter(safeFilename).sort();
                stable = namesBefore.length === namesAfter.length &&
                    namesBefore.every((filename, index) => filename === namesAfter[index]);
                if (!stable) lastFailure = 'directory_membership_changed';
            }

            // Recheck every file after the full directory read. This catches a
            // key that changed after its own read but before the snapshot ended.
            if (stable) {
                for (const [filename, observed] of observedStats) {
                    const current = fs.statSync(path.join(SESSION_DIR, filename));
                    if (
                        observed.size !== current.size ||
                        observed.mtimeMs !== current.mtimeMs ||
                        observed.ctimeMs !== current.ctimeMs ||
                        observed.ino !== current.ino
                    ) {
                        lastFailure = 'file_changed_during_snapshot';
                        stable = false;
                        break;
                    }
                }
            }

            if (stable) return snapshot;
        } catch {
            lastFailure = 'file_read_race';
            // A file may be renamed or rewritten while Baileys persists keys.
            // Retry the complete snapshot rather than publishing mixed state.
        }

        // Baileys writes auth JSON directly to disk. A watcher can fire while
        // writeFile is between truncation and completion, so retry with a
        // bounded backoff long enough for the write to settle before deferring.
        if (attempt < maxAttempts) await wait(Math.min(1200, 100 * (2 ** (attempt - 1))));
    }

    let inventory = { total: 0, credentials: 0, sessions: 0, senderKeys: 0, preKeys: 0, appStateKeys: 0, other: 0 };
    try { inventory = getAuthStateInventory(); } catch {}
    printLog('warning', `[session-backup] Stable snapshot unavailable attempts=${maxAttempts} reason=${lastFailure} fileClass=${lastFailureFile} detail=${lastFailureDetail} bytes=${lastFailureBytes} total=${inventory.total} creds=${inventory.credentials} sessions=${inventory.sessions} senderKeys=${inventory.senderKeys} preKeys=${inventory.preKeys} appStateKeys=${inventory.appStateKeys} other=${inventory.other}`);
    return null;
}

// Read one changed auth file without rescanning the entire session directory.
// Stat checks on both sides of the read prevent a partially-written key from
// being committed; transient writes receive a short bounded retry.
async function captureStableAuthFile(filename, maxAttempts = 4) {
    if (!safeFilename(filename)) return null;
    const filePath = path.join(SESSION_DIR, filename);
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const before = fs.statSync(filePath);
            if (!before.isFile()) return null;
            const content = fs.readFileSync(filePath, 'utf8');
            const after = fs.statSync(filePath);
            const stable = before.size === after.size &&
                before.mtimeMs === after.mtimeMs &&
                before.ctimeMs === after.ctimeMs &&
                before.ino === after.ino;
            if (stable && isValidAuthJson(content, filename)) {
                if (filename === 'creds.json' && !isValidCredentials(content)) {
                    printLog('warning', '[session-backup] Changed credentials were not registered/valid; previous durable credentials remain untouched');
                    return null;
                }
                return { filename, content, hash: hashContent(content) };
            }
            if (stable) {
                printLog('warning', `[session-backup] Changed auth file rejected as invalid JSON class=${getSafeAuthFileLabel(filename)} detail=${getAuthJsonFailureDetail(content, filename) || 'unknown'}`);
                return null;
            }
        } catch (err) {
            if (err?.code === 'ENOENT') return { filename, deleted: true };
        }
        if (attempt < maxAttempts) await wait(100 * (2 ** (attempt - 1)));
    }
    printLog('warning', `[session-backup] Changed auth file remained unstable after ${maxAttempts} reads class=${getSafeAuthFileLabel(filename)}`);
    return null;
}

async function loadRemoteSnapshotBaseline(Model) {
    if (lastManifestContent || lastSyncedHashes.size) return;
    try {
        const remoteManifest = await Model.findOne({ filename: MANIFEST_FILENAME }).select('content').lean();
        if (typeof remoteManifest?.content !== 'string') return;
        const manifest = JSON.parse(remoteManifest.content);
        if (manifest?.version !== 1 || !Array.isArray(manifest.files)) return;
        const baseline = new Map();
        for (const entry of manifest.files) {
            if (safeFilename(entry?.filename) && typeof entry.hash === 'string' && /^[a-f0-9]{64}$/i.test(entry.hash)) {
                baseline.set(entry.filename, entry.hash);
            }
        }
        if (!baseline.has('creds.json')) return;
        lastSyncedHashes = baseline;
        lastManifestContent = remoteManifest.content;
    } catch (err) {
        printLog('warning', `[session-backup] Existing manifest baseline unavailable; a full verified snapshot will be created: ${err.message}`);
    }
}

async function acquireLock() {
    const owner = randomUUID();
    const now = new Date();
    try {
        const lock = await LockModel.findOneAndUpdate(
            { _id: LOCK_ID, $or: [{ expiresAt: { $lte: now } }, { owner }] },
            { $set: { owner, expiresAt: new Date(now.getTime() + LOCK_TTL_MS) } },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        ).lean();
        return lock?.owner === owner ? owner : null;
    } catch (err) {
        // An unexpired lock causes an expected duplicate-key error on upsert.
        if (err?.code !== 11000) printLog('warning', `[session-backup] Lock acquisition failed: ${err.message}`);
        return null;
    }
}

async function releaseLock(owner) {
    if (!owner) return;
    try { await LockModel.deleteOne({ _id: LOCK_ID, owner }); }
    catch (err) { printLog('warning', `[session-backup] Lock release failed: ${err.message}`); }
}

async function isCurrentBackupLeader() {
    if (!isBackupLeader || !LeaderModel) return false;
    try {
        const leader = await LeaderModel.findOne({ _id: LEADER_ID, owner: PROCESS_OWNER, expiresAt: { $gt: new Date() } }).lean();
        return !!leader;
    } catch (err) {
        printLog('warning', `[session-backup] Leadership check failed: ${err.message}`);
        return false;
    }
}

async function renewBackupLeadership() {
    if (!isBackupLeader || !LeaderModel) return false;
    try {
        const result = await LeaderModel.updateOne(
            { _id: LEADER_ID, owner: PROCESS_OWNER, startedAt: PROCESS_STARTED_AT },
            { $set: { expiresAt: new Date(Date.now() + LEADER_TTL_MS) } }
        );
        if (result.matchedCount !== 1) {
            isBackupLeader = false;
            if (leaderHeartbeat) clearInterval(leaderHeartbeat);
            leaderHeartbeat = null;
            printLog('warning', '[session-backup] This Render instance lost backup leadership; all further session writes are disabled.');
            return false;
        }
        return true;
    } catch (err) {
        printLog('warning', `[session-backup] Leadership renewal failed: ${err.message}`);
        return false;
    }
}

// The newest process owns the session backup lease. Claims use the same
// short MongoDB lock as snapshot writes, so an old writer must finish before
// a newer Render deploy can take over. Once superseded, an old process cannot
// renew its lease or write another snapshot.
export async function claimSessionBackupLeadership(waitMs = DEFAULT_LEADERSHIP_WAIT_MS) {
    if (!MONGO_URL) return true;
    const Model = getModel();
    if (!Model || !(await waitForConnection())) {
        printLog('error', '[session-backup] Cannot establish MongoDB leadership; refusing to start another WhatsApp session.');
        return false;
    }
    const deadline = Date.now() + waitMs;
    let waitingForSnapshotLeaseLogged = false;
    while (Date.now() < deadline) {
        const lockOwner = await acquireLock();
        if (!lockOwner && !waitingForSnapshotLeaseLogged) {
            printLog('warning', '[session-backup] Waiting for the previous snapshot lease to expire; existing WhatsApp credentials and backups remain untouched.');
            waitingForSnapshotLeaseLogged = true;
        }
        if (lockOwner) {
            try {
                const now = new Date();
                const leader = await LeaderModel.findOneAndUpdate(
                    {
                        _id: LEADER_ID,
                        $or: [
                            { expiresAt: { $lte: now } },
                            { startedAt: { $lt: PROCESS_STARTED_AT } },
                            { owner: PROCESS_OWNER },
                        ],
                    },
                    {
                        $set: {
                            owner: PROCESS_OWNER,
                            startedAt: PROCESS_STARTED_AT,
                            expiresAt: new Date(now.getTime() + LEADER_TTL_MS),
                        },
                    },
                    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
                ).lean();
                if (leader?.owner === PROCESS_OWNER) {
                    isBackupLeader = true;
                    if (leaderHeartbeat) clearInterval(leaderHeartbeat);
                    leaderHeartbeat = setInterval(() => { renewBackupLeadership(); }, LEADER_RENEW_INTERVAL_MS);
                    if (typeof leaderHeartbeat.unref === 'function') leaderHeartbeat.unref();
                    printLog('success', '[session-backup] This Render instance holds the active session-backup lease.');
                    return true;
                }
            } catch (err) {
                if (err?.code !== 11000) printLog('warning', `[session-backup] Leadership claim failed: ${err.message}`);
            } finally {
                await releaseLock(lockOwner);
            }
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    printLog('error', '[session-backup] Could not acquire the session-backup lease; startup aborted to protect WhatsApp credentials.');
    return false;
}

export function isMongoBackupEnabled() {
    return !!MONGO_URL;
}

/**
 * Choose which MongoDB documents to restore. One stale or malformed file must not
 * discard thousands of valid Signal keys, so every individually valid auth file is
 * restored (newest content wins over an out-of-date manifest hash). A valid,
 * registered creds.json is still mandatory; otherwise nothing is restored.
 */
export function selectRestorableFiles(byName, manifestContent) {
    let listed = null;
    if (manifestContent) {
        try {
            const manifest = JSON.parse(manifestContent);
            if (manifest?.version === 1 && Array.isArray(manifest.files)) listed = manifest.files;
        } catch { listed = null; }
    }
    const files = [];
    let skippedInvalid = 0;
    for (const [filename, content] of byName.entries()) {
        if (filename === MANIFEST_FILENAME || !safeFilename(filename)) continue;
        if (!isValidAuthJson(content, filename)) { skippedInvalid++; continue; }
        files.push({ filename, content });
    }
    if (!files.some(file => file.filename === 'creds.json' && isValidCredentials(file.content))) return null;
    let manifestMismatch = 0;
    let manifestMissing = 0;
    if (listed) {
        const kept = new Map(files.map(file => [file.filename, file.content]));
        for (const entry of listed) {
            if (!safeFilename(entry?.filename)) continue;
            const content = kept.get(entry.filename);
            if (typeof content !== 'string') manifestMissing++;
            else if (hashContent(content) !== entry.hash) manifestMismatch++;
        }
    }
    return { files, skippedInvalid, manifestMismatch, manifestMissing };
}

export async function restoreSessionFromMongo() {
    const Model = getModel();
    if (!Model || !(await waitForConnection()) || !(await isCurrentBackupLeader())) return false;
    const lockOwner = await acquireLock();
    if (!lockOwner) {
        printLog('warning', '[session-backup] Restore deferred: another process is updating the session snapshot');
        return false;
    }
    try {
        if (!(await isCurrentBackupLeader())) return false;
        const docs = await Model.find({}).lean();
        if (!docs?.length) return false;
        const byName = new Map(docs.filter(doc => safeFilename(doc.filename) && typeof doc.content === 'string')
            .map(doc => [doc.filename, doc.content]));
        const credsContent = byName.get('creds.json');
        if (!credsContent || !isValidCredentials(credsContent)) {
            printLog('warning', '[session-backup] Refusing restore: MongoDB snapshot has no valid registered creds.json');
            return false;
        }

        const manifestContent = docs.find(doc => doc.filename === MANIFEST_FILENAME)?.content;
        const selection = selectRestorableFiles(byName, manifestContent);
        if (!selection) {
            printLog('warning', '[session-backup] Refusing restore: no valid registered creds.json among restorable files');
            return false;
        }
        const files = selection.files;
        if (selection.skippedInvalid || selection.manifestMismatch || selection.manifestMissing) {
            printLog('warning', `[session-backup] Tolerant restore: ${files.length} valid file(s) kept, ${selection.skippedInvalid} malformed skipped, ${selection.manifestMismatch} newer than manifest, ${selection.manifestMissing} listed in manifest but absent`);
        }

        fs.mkdirSync(SESSION_DIR, { recursive: true });
        // The caller only invokes restore when local credentials are invalid.
        // Remove old JSON fragments only after the remote snapshot has passed validation.
        for (const filename of fs.readdirSync(SESSION_DIR)) {
            if (filename.endsWith('.json')) {
                try { fs.rmSync(path.join(SESSION_DIR, filename), { force: true }); } catch {}
            }
        }
        let restored = 0;
        // Write creds.json last so a failed partial restore cannot leave a
        // seemingly valid credential file beside missing Signal-key files.
        files.sort((a, b) => (a.filename === 'creds.json' ? 1 : 0) - (b.filename === 'creds.json' ? 1 : 0));
        for (const file of files) {
            const destination = path.join(SESSION_DIR, file.filename);
            const temporary = `${destination}.restore-tmp`;
            try {
                fs.writeFileSync(temporary, file.content, { mode: 0o600 });
                fs.renameSync(temporary, destination);
                restored++;
            } catch (err) {
                try { fs.rmSync(temporary, { force: true }); } catch {}
                printLog('warning', `[session-backup] Failed to restore ${file.filename}: ${err.message}`);
                return false;
            }
        }
        printLog('success', `[session-backup] Restored ${restored} verified auth-state file(s) from MongoDB`);
        return restored > 0;
    } catch (err) {
        printLog('warning', `[session-backup] Restore failed: ${err.message}`);
        return false;
    } finally {
        await releaseLock(lockOwner);
    }
}

// Deliberate relink escape hatch only.
export async function clearMongoSessionBackup() {
    const Model = getModel();
    if (!Model || !(await waitForConnection()) || !(await isCurrentBackupLeader())) return false;
    const lockOwner = await acquireLock();
    if (!lockOwner) {
        printLog('warning', '[session-backup] Clear refused: another process owns the session snapshot lock');
        return false;
    }
    try {
        if (!(await isCurrentBackupLeader())) return false;
        const result = await Model.deleteMany({});
        printLog('success', `[session-backup] Cleared ${result.deletedCount || 0} auth-state file(s) from MongoDB`);
        return true;
    } catch (err) {
        printLog('warning', `[session-backup] Clear failed: ${err.message}`);
        return false;
    } finally {
        await releaseLock(lockOwner);
    }
}

// Every snapshot writes all auth files and commits a manifest last. Restore only
// accepts files whose hashes match that manifest. A MongoDB lease serializes
// writers across overlapping Render instances; no process prunes another's files.
export async function backupSessionToMongo(changedFilenames = null) {
    const requestedFiles = Array.isArray(changedFilenames)
        ? [...new Set(changedFilenames.filter(safeFilename))]
        : null;
    backupQueue = backupQueue.then(async () => {
        const Model = getModel();
        if (!Model || !(await waitForConnection()) || !(await isCurrentBackupLeader())) return;
        const lockOwner = await acquireLock();
        if (!lockOwner) {
            printLog('warning', '[session-backup] Snapshot deferred: another process owns the session snapshot lock');
            return;
        }
        try {
            if (!(await isCurrentBackupLeader())) return;
            await loadRemoteSnapshotBaseline(Model);

            // Once a verified baseline exists, watcher events touch only the
            // named auth files. This avoids repeatedly scanning thousands of
            // unchanged Signal/session files for every small key update.
            if (requestedFiles?.length && lastSyncedHashes.size) {
                const operations = [];
                const hashUpdates = new Map();
                const deletedFiles = [];
                const changedFileNames = [];
                let changedCount = 0;
                let changedBytes = 0;

                // A large WhatsApp group can rotate hundreds of per-recipient
                // Signal sessions after a single outbound message. Read and hash
                // those files locally, then persist them in bounded bulk writes
                // instead of issuing one MongoDB round trip per auth file.
                for (const filename of requestedFiles) {
                    const file = await captureStableAuthFile(filename);
                    if (!file) continue;
                    if (file.deleted) {
                        if (filename === 'creds.json' || !lastSyncedHashes.has(filename)) continue;
                        operations.push({ deleteOne: { filter: { filename } } });
                        deletedFiles.push(filename);
                        changedFileNames.push(filename);
                        changedCount++;
                        continue;
                    }
                    if (lastSyncedHashes.get(filename) === file.hash) continue;
                    operations.push({
                        updateOne: {
                            filter: { filename },
                            update: { $set: { filename, content: file.content, updatedAt: new Date() } },
                            upsert: true,
                        },
                    });
                    hashUpdates.set(filename, file.hash);
                    changedFileNames.push(filename);
                    changedBytes += Buffer.byteLength(file.content, 'utf8');
                    changedCount++;
                }

                const writeStartedAt = Date.now();
                for (const batch of chunkOperations(operations, 250)) {
                    await Model.bulkWrite(batch, { ordered: false });
                }
                const bulkWriteMs = Date.now() - writeStartedAt;

                // Advance the local manifest baseline only after every durable
                // batch succeeds. A partial bulk-write failure is safely retried.
                for (const filename of deletedFiles) lastSyncedHashes.delete(filename);
                for (const [filename, hash] of hashUpdates) lastSyncedHashes.set(filename, hash);

                const manifest = {
                    version: 1,
                    files: [...lastSyncedHashes.entries()]
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([filename, hash]) => ({ filename, hash })),
                };
                const manifestContent = JSON.stringify(manifest);
                if (manifestContent !== lastManifestContent) {
                    await Model.updateOne(
                        { filename: MANIFEST_FILENAME },
                        { $set: { filename: MANIFEST_FILENAME, content: manifestContent, updatedAt: new Date() } },
                        { upsert: true }
                    );
                    lastManifestContent = manifestContent;
                }
                if (changedCount) {
                    const classes = summarizeAuthStateInventory(changedFileNames);
                    printLog('info', `[session-backup] Incremental snapshot committed: changed=${changedCount} bytesWritten=${changedBytes} creds=${classes.credentials} sessions=${classes.sessions} senderKeys=${classes.senderKeys} preKeys=${classes.preKeys} appStateKeys=${classes.appStateKeys} other=${classes.other} batches=${Math.ceil(operations.length / 250)} bulkWriteMs=${bulkWriteMs}; full inventory scan skipped`);
                }
                return;
            }

            // One full, integrity-checked inventory is performed on startup (or
            // when the watcher cannot identify a changed filename). Thereafter
            // normal writes are incremental and event-driven.
            const snapshot = await captureStableAuthSnapshot();
            if (!snapshot) {
                printLog('warning', '[session-backup] Snapshot deferred after bounded retries: auth-state files did not settle; MongoDB was left untouched');
                return;
            }
            const creds = snapshot.find(doc => doc.filename === 'creds.json');
            if (!creds || !isValidCredentials(creds.content)) {
                printLog('warning', '[session-backup] Skipping snapshot: local credentials are missing or invalid; MongoDB was left untouched');
                return;
            }
            const currentHashes = new Map(snapshot.map(doc => [doc.filename, doc.hash]));
            const changed = snapshot.filter(doc => lastSyncedHashes.get(doc.filename) !== doc.hash);
            const operations = changed.map(doc => ({
                updateOne: {
                    filter: { filename: doc.filename },
                    update: { $set: { filename: doc.filename, content: doc.content, updatedAt: new Date() } },
                    upsert: true,
                },
            }));
            if (operations.length) await Model.bulkWrite(operations, { ordered: true });
            const manifest = {
                version: 1,
                files: snapshot.map(({ filename, hash }) => ({ filename, hash })),
            };
            const manifestContent = JSON.stringify(manifest);
            const manifestChanged = manifestContent !== lastManifestContent;
            if (manifestChanged) {
                await Model.updateOne(
                    { filename: MANIFEST_FILENAME },
                    { $set: { filename: MANIFEST_FILENAME, content: manifestContent, updatedAt: new Date() } },
                    { upsert: true }
                );
            }
            // Update local delta state only after all durable writes have succeeded.
            lastSyncedHashes = currentHashes;
            lastManifestContent = manifestContent;
            if (changed.length || manifestChanged) {
                printLog('info', `[session-backup] Verified startup snapshot committed: ${changed.length} changed of ${snapshot.length} auth-state files`);
            } else {
                printLog('info', `[session-backup] Startup snapshot verified unchanged (${snapshot.length} auth-state files)`);
            }
        } catch (err) {
            printLog('warning', `[session-backup] Backup failed: ${err.message}`);
        } finally {
            await releaseLock(lockOwner);
        }
    }).catch(err => printLog('warning', `[session-backup] Backup queue failed: ${err.message}`));
    return backupQueue;
}

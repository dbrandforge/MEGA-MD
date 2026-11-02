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

function hashContent(content) {
    return createHash('sha256').update(content).digest('hex');
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
export async function claimSessionBackupLeadership(waitMs = 90000) {
    if (!MONGO_URL) return true;
    const Model = getModel();
    if (!Model || !(await waitForConnection())) {
        printLog('error', '[session-backup] Cannot establish MongoDB leadership; refusing to start another WhatsApp session.');
        return false;
    }
    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline) {
        const lockOwner = await acquireLock();
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
        let files;
        if (manifestContent) {
            let manifest;
            try { manifest = JSON.parse(manifestContent); }
            catch {
                printLog('warning', '[session-backup] Refusing restore: snapshot manifest is invalid JSON');
                return false;
            }
            if (manifest?.version !== 1 || !Array.isArray(manifest.files) || !manifest.files.length) {
                printLog('warning', '[session-backup] Refusing restore: snapshot manifest has an unsupported format');
                return false;
            }
            files = [];
            for (const entry of manifest.files) {
                if (!safeFilename(entry?.filename) || typeof entry.hash !== 'string') return false;
                const content = byName.get(entry.filename);
                if (typeof content !== 'string' || hashContent(content) !== entry.hash) {
                    printLog('warning', '[session-backup] Refusing restore: snapshot is incomplete or files do not match its manifest');
                    return false;
                }
                files.push({ filename: entry.filename, content });
            }
            if (!files.some(file => file.filename === 'creds.json' && isValidCredentials(file.content))) return false;
        } else {
            // One-time compatibility path for snapshots created before manifests existed.
            files = [...byName.entries()].map(([filename, content]) => ({ filename, content }));
            printLog('warning', '[session-backup] Restoring a legacy snapshot without a completeness manifest; it will be upgraded immediately');
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
export async function backupSessionToMongo() {
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
            const names = fs.readdirSync(SESSION_DIR).filter(safeFilename).sort();
            const snapshot = [];
            for (const filename of names) {
                const content = fs.readFileSync(path.join(SESSION_DIR, filename), 'utf8');
                if (content) snapshot.push({ filename, content, hash: hashContent(content) });
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
                printLog('info', `[session-backup] Verified snapshot committed: ${changed.length} changed of ${snapshot.length} auth-state files`);
            } else {
                printLog('info', `[session-backup] Snapshot unchanged (${snapshot.length} auth-state files)`);
            }
        } catch (err) {
            printLog('warning', `[session-backup] Backup failed: ${err.message}`);
        } finally {
            await releaseLock(lockOwner);
        }
    }).catch(err => printLog('warning', `[session-backup] Backup queue failed: ${err.message}`));
    return backupQueue;
}

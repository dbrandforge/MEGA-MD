// Reliable persistence for the complete Baileys multi-file authentication state.
// Never restore an old snapshot over a live local session. Never prune MongoDB
// records unless a complete, valid local snapshot has been read successfully.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { printLog } from './print.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSION_DIR = path.join(__dirname, '..', 'session');
const MONGO_URL = process.env.MONGO_URL || '';

let connection = null;
let SessionFileModel = null;
let connecting = null;
let backupQueue = Promise.resolve();

function getModel() {
    if (!MONGO_URL) return null;
    if (SessionFileModel) return SessionFileModel;

    connection = mongoose.createConnection(MONGO_URL);
    connection.on('error', err => {
        printLog('warning', `[session-backup] MongoDB connection error: ${err.message}`);
    });
    const schema = new mongoose.Schema({
        filename: { type: String, required: true, unique: true },
        content: { type: String, required: true },
        updatedAt: { type: Date, default: Date.now },
    });
    SessionFileModel = connection.model('BaileysSessionFile', schema, 'baileys_session_files');
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
        return creds?.registered === true &&
            !!creds.noiseKey && !!creds.signedIdentityKey && !!creds.signedPreKey;
    } catch {
        return false;
    }
}

function safeFilename(filename) {
    return typeof filename === 'string' &&
        filename.length > 0 &&
        filename === path.basename(filename) &&
        filename.endsWith('.json');
}

export function isMongoBackupEnabled() {
    return !!MONGO_URL;
}

// Restore only when the caller has established that the local auth state is
// absent/invalid. Write each file atomically and reject unsafe document names.
export async function restoreSessionFromMongo() {
    const Model = getModel();
    if (!Model || !(await waitForConnection())) return false;

    try {
        const docs = await Model.find({}).lean();
        if (!docs?.length) return false;

        const credsDoc = docs.find(doc => doc.filename === 'creds.json');
        if (!credsDoc || !isValidCredentials(credsDoc.content)) {
            printLog('warning', '[session-backup] Refusing restore: MongoDB snapshot has no valid registered creds.json');
            return false;
        }

        fs.mkdirSync(SESSION_DIR, { recursive: true });
        let restored = 0;
        for (const doc of docs) {
            if (!safeFilename(doc.filename) || typeof doc.content !== 'string') continue;
            const destination = path.join(SESSION_DIR, doc.filename);
            const temporary = `${destination}.restore-tmp`;
            try {
                fs.writeFileSync(temporary, doc.content, { mode: 0o600 });
                fs.renameSync(temporary, destination);
                restored++;
            } catch (err) {
                try { fs.rmSync(temporary, { force: true }); } catch {}
                printLog('warning', `[session-backup] Failed to restore ${doc.filename}: ${err.message}`);
            }
        }
        printLog('success', `[session-backup] Restored ${restored} auth-state file(s) from MongoDB`);
        return restored > 0;
    } catch (err) {
        printLog('warning', `[session-backup] Restore failed: ${err.message}`);
        return false;
    }
}

// Kept for the explicit, deliberate relink escape hatch only.
export async function clearMongoSessionBackup() {
    const Model = getModel();
    if (!Model || !(await waitForConnection())) return;
    try {
        const result = await Model.deleteMany({});
        printLog('success', `[session-backup] Cleared ${result.deletedCount || 0} auth-state file(s) from MongoDB`);
    } catch (err) {
        printLog('warning', `[session-backup] Clear failed: ${err.message}`);
    }
}

// Serialize snapshots so overlapping 8-second ticks can never complete out of
// order and roll MongoDB backwards. Reconcile deletions only after reading a
// complete snapshot with valid credentials; this prevents orphaned pre-keys
// accumulating forever while protecting the database from an empty/partial dir.
export async function backupSessionToMongo() {
    backupQueue = backupQueue.then(async () => {
        const Model = getModel();
        if (!Model || !(await waitForConnection())) return;
        try {
            const names = fs.readdirSync(SESSION_DIR).filter(safeFilename);
            const snapshot = [];
            for (const filename of names) {
                const content = fs.readFileSync(path.join(SESSION_DIR, filename), 'utf8');
                if (content) snapshot.push({ filename, content, updatedAt: new Date() });
            }

            const creds = snapshot.find(doc => doc.filename === 'creds.json');
            if (!creds || !isValidCredentials(creds.content)) {
                printLog('warning', '[session-backup] Skipping snapshot: local credentials are missing or invalid; MongoDB was left untouched');
                return;
            }

            const operations = snapshot.map(doc => ({
                updateOne: {
                    filter: { filename: doc.filename },
                    update: { $set: doc },
                    upsert: true,
                },
            }));
            if (operations.length) await Model.bulkWrite(operations, { ordered: false });

            const activeNames = snapshot.map(doc => doc.filename);
            const prune = await Model.deleteMany({ filename: { $nin: activeNames } });
            printLog('info', `[session-backup] Snapshot synced: ${snapshot.length} files; removed ${prune.deletedCount || 0} stale records`);
        } catch (err) {
            printLog('warning', `[session-backup] Backup failed: ${err.message}`);
        }
    }).catch(err => {
        printLog('warning', `[session-backup] Backup queue failed: ${err.message}`);
    });
    return backupQueue;
}

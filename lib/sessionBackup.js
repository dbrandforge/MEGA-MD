// --- Full Baileys session backup to MongoDB -----------------------------
// Why this exists: Render's free web service filesystem is wiped on every
// redeploy and can also be reset by Render at any time. The bot's old
// recovery path (SESSION_ID -> Gist) only restores creds.json, which is
// the long-term account identity - but NOT the Signal protocol session
// state (pre-keys, per-contact ratchets, sender-keys) that useMultiFileAuthState
// also keeps in the ./session folder. Losing that state on every redeploy
// forces the bot to silently re-negotiate encryption with every contact
// from scratch, and any message that arrives before a given contact's
// renegotiation completes fails to decrypt ("Bad MAC") and is dropped -
// which looks like "the bot only responds to some people."
//
// This module backs up EVERY file in ./session (not just creds.json) to
// MongoDB, and restores the full set at boot, so a redeploy no longer
// resets anyone's encryption session.
//
// It reuses the same MONGO_URL env var the bot's own store (lib/lightweight_store.js)
// already supports, but opens its own mongoose connection so it never
// interferes with that module's connection/state. If MONGO_URL isn't set,
// every function here is a safe no-op and the bot behaves exactly as
// before (falls back to the existing SESSION_ID/Gist creds-only restore).
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { printLog } from './print.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SESSION_DIR = path.join(__dirname, '..', 'session');
const MONGO_URL = process.env.MONGO_URL || '';

let connection = null;
let SessionFileModel = null;
let connecting = null;

function getModel() {
    if (!MONGO_URL)
        return null;
    if (SessionFileModel)
        return SessionFileModel;
    connection = mongoose.createConnection(MONGO_URL);
    connection.on('error', (err) => {
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

async function waitForConnection(Model) {
    if (!connection)
        return;
    if (connection.readyState === 1)
        return;
    if (!connecting) {
        connecting = new Promise((resolve) => {
            connection.once('open', resolve);
            connection.once('error', resolve);
            setTimeout(resolve, 8000); // don't block boot forever if Mongo is unreachable
        });
    }
    await connecting;
}

export function isMongoBackupEnabled() {
    return !!MONGO_URL;
}

// Restores every backed-up file into ./session. Returns true if anything
// was restored (meaning a previous full backup existed).
export async function restoreSessionFromMongo() {
    const Model = getModel();
    if (!Model)
        return false;
    try {
        await waitForConnection(Model);
        const docs = await Model.find({}).lean();
        if (!docs || docs.length === 0)
            return false;
        if (!fs.existsSync(SESSION_DIR))
            fs.mkdirSync(SESSION_DIR, { recursive: true });
        for (const doc of docs) {
            try {
                fs.writeFileSync(path.join(SESSION_DIR, doc.filename), doc.content);
            }
            catch (err) {
                printLog('warning', `[session-backup] Failed to write ${doc.filename}: ${err.message}`);
            }
        }
        printLog('success', `[session-backup] Restored ${docs.length} session file(s) from MongoDB`);
        return true;
    }
    catch (err) {
        printLog('warning', `[session-backup] Restore from MongoDB failed: ${err.message}`);
        return false;
    }
}

// Uploads every current file in ./session to MongoDB (upsert per file).
// Safe to call often - only touched files cost a write, and cost is low
// since Baileys session files are small.
export async function backupSessionToMongo() {
    const Model = getModel();
    if (!Model)
        return;
    try {
        await waitForConnection(Model);
        if (!fs.existsSync(SESSION_DIR))
            return;
        const files = fs.readdirSync(SESSION_DIR).filter((f) => f.endsWith('.json'));
        for (const filename of files) {
            let content;
            try {
                content = fs.readFileSync(path.join(SESSION_DIR, filename), 'utf8');
            }
            catch (_e) {
                continue;
            }
            if (!content)
                continue;
            await Model.updateOne({ filename }, { filename, content, updatedAt: new Date() }, { upsert: true }).catch((err) => {
                printLog('warning', `[session-backup] Failed to back up ${filename}: ${err.message}`);
            });
        }
    }
    catch (err) {
        printLog('warning', `[session-backup] Backup to MongoDB failed: ${err.message}`);
    }
}

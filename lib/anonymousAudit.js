import mongoose from 'mongoose';
import { createCipheriv, createDecipheriv, createHash, createHmac, createPrivateKey, randomBytes, randomUUID, sign as signDetached } from 'node:crypto';
import { gzip, gunzip } from 'node:zlib';
import { promisify } from 'node:util';

const MONGO_URL = process.env.MONGO_URL || '';
const COLLECTION = 'anonymous_submission_audit';
const RETENTION_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const AUDIT_BACKUP_BATCH_SIZE = Math.min(100, Math.max(10, Number(process.env.ANON_AUDIT_BACKUP_BATCH_SIZE) || 50));
const AUDIT_BACKUP_INTERVAL_MS = 10 * 60 * 1000;
let auditBackupTimer = null;
let auditBackupRunning = false;

let connection;
let modelPromise;
let AuditModel;

function getEncryptionKey() {
    const raw = String(process.env.ANON_AUDIT_ENCRYPTION_KEY || '').trim();
    if (!raw) throw new Error('Anonymous audit encryption key is not configured');
    const key = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (key.length !== 32) throw new Error('Anonymous audit encryption key must decode to exactly 32 bytes');
    return key;
}

export function encryptSensitiveValue(value, key = getEncryptionKey()) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(String(value || ''), 'utf8'), cipher.final()]);
    return {
        algorithm: 'aes-256-gcm',
        iv: iv.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
        data: ciphertext.toString('base64')
    };
}

export function decryptSensitiveValue(record, key = getEncryptionKey()) {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(record.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
    return Buffer.concat([
        decipher.update(Buffer.from(record.data, 'base64')),
        decipher.final()
    ]).toString('utf8');
}

function clean(value, max = 160) {
    return String(value || '').replace(/[\r\n\0]/g, ' ').trim().slice(0, max) || null;
}

function parseVersion(ua, expression) {
    const match = String(ua || '').match(expression);
    return match?.[1] ? match[1].slice(0, 40) : null;
}

export function parseAnonymousClient(headers = {}) {
    const ua = clean(headers['user-agent'], 1024) || '';
    const chPlatform = clean(headers['sec-ch-ua-platform'], 80)?.replace(/^"|"$/g, '') || '';
    const chModel = clean(headers['sec-ch-ua-model'], 100)?.replace(/^"|"$/g, '') || '';
    const chMobile = clean(headers['sec-ch-ua-mobile'], 8);

    let browser = 'Unknown';
    let browserVersion = null;
    const browserRules = [
        ['Microsoft Edge', /Edg(?:A|iOS)?\/([\d.]+)/],
        ['Opera', /(?:OPR|Opera)\/([\d.]+)/],
        ['Samsung Internet', /SamsungBrowser\/([\d.]+)/],
        ['Firefox', /Firefox\/([\d.]+)/],
        ['Chrome', /(?:Chrome|CriOS)\/([\d.]+)/],
        ['Safari', /Version\/([\d.]+).*Safari/]
    ];
    for (const [name, rule] of browserRules) {
        const match = ua.match(rule);
        if (match) { browser = name; browserVersion = match[1].slice(0, 40); break; }
    }

    let os = 'Unknown';
    let osVersion = null;
    if (/Android/i.test(ua) || /Android/i.test(chPlatform)) {
        os = 'Android';
        osVersion = parseVersion(ua, /Android\s([\d.]+)/);
    } else if (/iPhone|iPad|iPod/i.test(ua) || /iOS/i.test(chPlatform)) {
        os = 'iOS';
        osVersion = parseVersion(ua, /OS\s([\d_]+)/)?.replace(/_/g, '.');
    } else if (/Windows/i.test(ua) || /Windows/i.test(chPlatform)) {
        os = 'Windows';
        osVersion = parseVersion(ua, /Windows NT\s([\d.]+)/);
    } else if (/Mac OS X/i.test(ua) || /macOS/i.test(chPlatform)) {
        os = 'macOS';
        osVersion = parseVersion(ua, /Mac OS X\s([\d_]+)/)?.replace(/_/g, '.');
    } else if (/Linux/i.test(ua) || /Linux/i.test(chPlatform)) {
        os = 'Linux';
    }
    if (chPlatform) {
        const normalized = chPlatform.toLowerCase();
        if (normalized.includes('android')) os = 'Android';
        else if (normalized.includes('ios')) os = 'iOS';
        else if (normalized.includes('windows')) os = 'Windows';
        else if (normalized.includes('mac')) os = 'macOS';
        else if (normalized.includes('linux')) os = 'Linux';
    }

    const isTablet = /iPad|Tablet|PlayBook|Silk/i.test(ua);
    const isMobile = !isTablet && (chMobile === '?1' || /Mobile|iPhone|iPod|Android/i.test(ua));
    const deviceType = isTablet ? 'tablet' : (isMobile ? 'mobile' : 'desktop');
    let deviceModel = chModel || null;
    if (!deviceModel && /Android/i.test(ua)) {
        const match = ua.match(/Android[^;)]*;\s*([^;)]+?)(?:\s+Build\/[^;)]+)?\s*[;)]/i);
        if (match && !/^(?:wv|U|arm|linux)/i.test(match[1].trim())) deviceModel = clean(match[1], 100);
    }
    if (!deviceModel && /iPhone/i.test(ua)) deviceModel = 'iPhone (model not exposed)';
    if (!deviceModel && /iPad/i.test(ua)) deviceModel = 'iPad (model not exposed)';

    return {
        browser,
        browserVersion,
        os,
        osVersion,
        deviceType,
        deviceModel,
        mobile: isMobile,
        clientHints: {
            brands: clean(headers['sec-ch-ua'], 256),
            platform: chPlatform || null,
            model: chModel || null,
            mobile: chMobile || null
        },
        language: clean(headers['accept-language'], 120)
    };
}

async function getAuditModel() {
    if (!MONGO_URL) throw new Error('MONGO_URL is not configured for anonymous audit storage');
    if (AuditModel) return AuditModel;
    if (!modelPromise) {
        modelPromise = (async () => {
            connection = mongoose.createConnection(MONGO_URL, {
                maxPoolSize: 3,
                minPoolSize: 0,
                serverSelectionTimeoutMS: 8000,
                socketTimeoutMS: 10000,
                appName: 'ForgeGuard-AnonymousAudit'
            });
            connection.on('error', () => {});
            await connection.asPromise();
            const schema = new mongoose.Schema({
                submissionId: { type: String, required: true, unique: true, index: true },
                groupId: { type: String, required: true, index: true },
                submittedAt: { type: Date, required: true, index: true },
                deliveredAt: Date,
                status: { type: String, enum: ['received', 'sent', 'failed'], required: true },
                whatsappMessageId: String,
                contentHmac: { type: String, required: true },
                client: {
                    browser: String,
                    browserVersion: String,
                    os: String,
                    osVersion: String,
                    deviceType: String,
                    deviceModel: String,
                    mobile: Boolean,
                    clientHints: mongoose.Schema.Types.Mixed,
                    language: String
                },
                ipEncrypted: { type: mongoose.Schema.Types.Mixed, required: true },
                userAgentEncrypted: mongoose.Schema.Types.Mixed,
                ipHmac: { type: String, index: true },
                expiresAt: { type: Date, required: true }
            }, {
                collection: COLLECTION,
                versionKey: false,
                strict: true,
                minimize: false,
                writeConcern: { w: 'majority', wtimeout: 8000 }
            });
            schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
            schema.index({ groupId: 1, submittedAt: -1 });
            AuditModel = connection.model('AnonymousSubmissionAudit', schema, COLLECTION);
            await AuditModel.init();
            return AuditModel;
        })().catch(async error => {
            modelPromise = null;
            try { await connection?.close(); } catch {}
            connection = null;
            AuditModel = null;
            throw error;
        });
    }
    return modelPromise;
}

export async function createAnonymousSubmissionRecord({ req, groupId, text }) {
    const key = getEncryptionKey();
    const Model = await getAuditModel();
    const submittedAt = new Date();
    const ip = clean(req.ip || req.socket?.remoteAddress, 128) || 'unknown';
    const userAgent = clean(req.get?.('user-agent') || req.headers?.['user-agent'], 1024) || '';
    const client = parseAnonymousClient(req.headers || {});
    const submissionId = randomUUID();
    const ipHmac = createHmac('sha256', key).update('anonymous-ip:').update(ip).digest('hex');

    await Model.create({
        submissionId,
        groupId,
        submittedAt,
        status: 'received',
        contentHmac: createHmac('sha256', key).update('anonymous-content:').update(String(text)).digest('hex'),
        client,
        ipEncrypted: encryptSensitiveValue(ip, key),
        userAgentEncrypted: userAgent ? encryptSensitiveValue(userAgent, key) : null,
        ipHmac,
        expiresAt: new Date(submittedAt.getTime() + RETENTION_DAYS * DAY_MS)
    });
    return { submissionId };
}

export async function updateAnonymousSubmissionRecord(submissionId, update) {
    if (!submissionId) return false;
    const Model = await getAuditModel();
    const safeUpdate = {};
    if (['sent', 'failed'].includes(update?.status)) safeUpdate.status = update.status;
    if (typeof update?.whatsappMessageId === 'string' && update.whatsappMessageId.length <= 160) {
        safeUpdate.whatsappMessageId = update.whatsappMessageId;
    }
    if (update?.status === 'sent') safeUpdate.deliveredAt = new Date();
    const result = await Model.updateOne({ submissionId }, { $set: safeUpdate }, { writeConcern: { w: 'majority', wtimeout: 8000 } });
    return result.modifiedCount === 1 || result.matchedCount === 1;
}




export async function encryptAuditBackupBatch(records, key = getEncryptionKey()) {
    if (!Array.isArray(records) || records.length < 1 || records.length > 100) {
        throw new Error('Audit backup batch must contain between 1 and 100 records');
    }
    const ndjson = Buffer.from(records.map(record => JSON.stringify(record)).join('\n') + '\n', 'utf8');
    const compressed = await gzipAsync(ndjson, { level: 6 });
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
    return Buffer.concat([Buffer.from('FGA1'), iv, cipher.getAuthTag(), encrypted]);
}

export async function decryptAuditBackupBatch(archive, key = getEncryptionKey()) {
    const buffer = Buffer.from(archive || []);
    if (buffer.length < 33 || buffer.subarray(0, 4).toString('ascii') !== 'FGA1') {
        throw new Error('Invalid anonymous audit archive format');
    }
    const iv = buffer.subarray(4, 16);
    const tag = buffer.subarray(16, 32);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const compressed = Buffer.concat([decipher.update(buffer.subarray(32)), decipher.final()]);
    const ndjson = (await gunzipAsync(compressed)).toString('utf8');
    return ndjson.split('\n').filter(Boolean).map(line => JSON.parse(line));
}

async function runAnonymousAuditBackupBatch() {
    if (auditBackupRunning) return { skipped: 'already_running' };
    const endpoint = String(process.env.ANON_AUDIT_BACKUP_URL || '').trim();
    const signingKey = String(process.env.ANON_AUDIT_BACKUP_SIGNING_KEY || '').trim();
    if (!endpoint || !signingKey) return { skipped: 'backup_not_configured' };

    auditBackupRunning = true;
    try {
        const key = getEncryptionKey();
        const Model = await getAuditModel();
        const stateCollection = Model.db.collection('anonymous_submission_audit_backup_state');
        const state = await stateCollection.findOne({ _id: 'r2-batch-cursor' });
        const query = state?.lastId ? { _id: { $gt: state.lastId } } : {};
        const records = await Model.find(query)
            .sort({ _id: 1 })
            .limit(AUDIT_BACKUP_BATCH_SIZE)
            .lean();

        if (!records.length) return { skipped: 'no_new_records' };

        // Serialize, compress and encrypt only this bounded batch; never load the full collection.
        const archive = await encryptAuditBackupBatch(records, key);
        const timestamp = String(Math.floor(Date.now() / 1000));
        const datePath = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
        const firstId = String(records[0]._id);
        const lastId = String(records[records.length - 1]._id);
        const objectKey = 'anonymous-audit/' + datePath + '/batch-' + Date.now() + '-' + firstId + '-' + lastId + '.bin';
        const digest = createHash('sha256').update(archive).digest('hex');
        const privateKey = createPrivateKey({ key: Buffer.from(signingKey, 'base64'), format: 'der', type: 'pkcs8' });
        const signature = signDetached(null, Buffer.from(timestamp + '\n' + objectKey + '\n' + digest), privateKey).toString('hex');

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'content-type': 'application/octet-stream',
                'x-forge-audit-timestamp': timestamp,
                'x-forge-audit-object': objectKey,
                'x-forge-audit-sha256': digest,
                'x-forge-audit-signature': signature
            },
            body: archive,
            signal: AbortSignal.timeout(15000)
        });
        if (!response.ok) throw new Error('R2 archive upload failed with status ' + response.status);

        // Advance only after R2 confirms the object write. Failed uploads are retried.
        await stateCollection.updateOne(
            { _id: 'r2-batch-cursor' },
            {
                $set: {
                    lastId: records[records.length - 1]._id,
                    lastObjectKey: objectKey,
                    lastBatchAt: new Date(),
                    lastBatchCount: records.length
                },
                $inc: { batchesCompleted: 1 }
            },
            { upsert: true, writeConcern: { w: 'majority', wtimeout: 8000 } }
        );
        return { uploaded: records.length };
    } finally {
        auditBackupRunning = false;
    }
}

export function startAnonymousAuditBackupScheduler() {
    if (process.env.ANON_AUDIT_BACKUP_ENABLED !== 'true' || auditBackupTimer) return false;
    if (!process.env.ANON_AUDIT_BACKUP_URL || !process.env.ANON_AUDIT_BACKUP_SIGNING_KEY) {
        console.error('[anon-audit-backup] Enabled but backup endpoint/secret is missing');
        return false;
    }
    const run = () => runAnonymousAuditBackupBatch().catch(error => {
        console.error('[anon-audit-backup] Batch failed:', String(error?.message || 'unknown').slice(0, 180));
    });
    // Spread work across the process lifetime and cap each run to one small batch.
    const initial = setTimeout(run, 60_000);
    initial.unref?.();
    auditBackupTimer = setInterval(run, AUDIT_BACKUP_INTERVAL_MS);
    auditBackupTimer.unref?.();
    return true;
}

export async function getAnonymousSubmissionRecord(reference) {
    const lookup = clean(reference, 160);
    if (!lookup) return null;
    const key = getEncryptionKey();
    const Model = await getAuditModel();
    const record = await Model.findOne({
        $or: [
            { submissionId: lookup },
            { whatsappMessageId: lookup }
        ]
    }).lean();
    if (!record) return null;

    return {
        submissionId: record.submissionId,
        groupId: record.groupId,
        submittedAt: record.submittedAt,
        deliveredAt: record.deliveredAt || null,
        status: record.status,
        whatsappMessageId: record.whatsappMessageId || null,
        ipAddress: decryptSensitiveValue(record.ipEncrypted, key),
        userAgent: record.userAgentEncrypted
            ? decryptSensitiveValue(record.userAgentEncrypted, key)
            : null,
        client: record.client || {},
        ipCorrelationHash: record.ipHmac || null,
        contentIntegrityHash: record.contentHmac || null
    };
}

export const ANONYMOUS_AUDIT_RETENTION_DAYS = RETENTION_DAYS;

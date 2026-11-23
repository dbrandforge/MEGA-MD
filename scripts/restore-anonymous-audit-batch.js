import fs from 'node:fs';
import mongoose from 'mongoose';
import { decryptAuditBackupBatch } from '../lib/anonymousAudit.js';

const MONGO_URL = process.env.MONGO_URL || '';
const filePath = process.argv[2];

if (!MONGO_URL) {
    console.error('MONGO_URL is required.');
    process.exit(1);
}
if (!filePath) {
    console.error('Usage: node scripts/restore-anonymous-audit-batch.js <archive-file.bin>');
    process.exit(1);
}

function restoreDate(value) {
    if (!value) return value ?? null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error('Archive contains an invalid date');
    return date;
}

function chunk(items, size = 50) {
    const result = [];
    for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
    return result;
}

let connection;
try {
    const archive = fs.readFileSync(filePath);
    const records = await decryptAuditBackupBatch(archive);
    if (!Array.isArray(records) || records.length < 1 || records.length > 100) {
        throw new Error('Archive batch has an invalid record count');
    }

    const prepared = records.map(record => {
        if (!record?.submissionId || !record?.groupId || !record?.ipEncrypted) {
            throw new Error('Archive contains an incomplete audit record');
        }
        const restored = { ...record };
        if (typeof restored._id === 'string' && mongoose.Types.ObjectId.isValid(restored._id)) {
            restored._id = new mongoose.Types.ObjectId(restored._id);
        }
        restored.submittedAt = restoreDate(restored.submittedAt);
        restored.deliveredAt = restoreDate(restored.deliveredAt);
        restored.expiresAt = restoreDate(restored.expiresAt);
        return restored;
    });

    connection = await mongoose.createConnection(MONGO_URL, {
        maxPoolSize: 2,
        minPoolSize: 0,
        serverSelectionTimeoutMS: 10000,
        appName: 'ForgeGuard-AnonymousAuditRestore'
    }).asPromise();

    const collection = connection.collection('anonymous_submission_audit');
    let inserted = 0;
    for (const batch of chunk(prepared, 50)) {
        const result = await collection.bulkWrite(
            batch.map(record => ({
                updateOne: {
                    filter: { submissionId: record.submissionId },
                    update: { $setOnInsert: record },
                    upsert: true
                }
            })),
            { ordered: false, writeConcern: { w: 'majority', wtimeout: 10000 } }
        );
        inserted += result.upsertedCount || 0;
    }
    console.log('Anonymous audit restore complete. Inserted:', inserted, 'Existing records left unchanged:', prepared.length - inserted);
} catch (error) {
    console.error('Anonymous audit restore failed:', String(error?.message || 'unknown').slice(0, 200));
    process.exitCode = 1;
} finally {
    try { await connection?.close(); } catch {}
}

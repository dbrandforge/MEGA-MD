import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import config from '../config.js';

const TARGET_SETTINGS = Object.freeze([
    'chatbotUserProfile',
    'chatbotGroupRoster',
    'chatbotConversationMemory'
]);
const DATA_DIR = path.resolve(process.cwd(), 'data');
const APPLY = process.argv.includes('--apply');

function logPlan() {
    console.log('[User memory reset] Scope:');
    for (const key of TARGET_SETTINGS) console.log('  - settings key:', key);
    console.log('Protected: creator profile records, creator knowledge/configuration, gender and birthday feature registries, game and trivia records, XP, scores, achievements, moderation state, WhatsApp auth/session files, message counters, and backups.');
    console.log(APPLY ? '[User memory reset] APPLY mode enabled.' : '[User memory reset] Dry run only. Re-run with --apply to delete the listed memory records.');
}

async function resetMongo() {
    await mongoose.connect(process.env.MONGO_URL);
    try {
        const settings = mongoose.connection.collection('settings');
        const creatorDigits = String(config.creatorNumber || config.ownerNumber || '').replace(/\D/g, '');
        const creatorProfilePattern = creatorDigits
            ? new RegExp('(?:^|:)user:' + creatorDigits + '(?:@s\\.whatsapp\\.net|@c\\.us|@lid)?$')
            : null;
        const filter = {
            key: { $in: TARGET_SETTINGS },
            ...(creatorProfilePattern ? {
                $nor: [{ key: 'chatbotUserProfile', chatId: { $regex: creatorProfilePattern } }]
            } : {})
        };
        const count = await settings.countDocuments(filter);
        console.log(`[User memory reset] MongoDB matching setting documents: ${count}`);
        if (!APPLY) return;
        const result = await settings.deleteMany(filter);
        console.log(`[User memory reset] Deleted ${result.deletedCount} targeted setting documents; creator profile documents were excluded.`);
    } finally {
        await mongoose.disconnect();
    }
}

function resetLocalFiles() {
    const targets = TARGET_SETTINGS.map(key => path.join(DATA_DIR, `${key}.json`));
    for (const file of targets) {
        const exists = fs.existsSync(file);
        console.log(`[User memory reset] ${exists ? 'Found' : 'Not found'}: ${path.relative(process.cwd(), file)}`);
    }
    const profileFile = path.join(DATA_DIR, 'chatbotUserProfile.json');
    if (APPLY && fs.existsSync(profileFile)) {
        throw new Error('The local profile file is not sender-scoped, so creator data cannot be safely excluded. No local memory files were deleted. Use MongoDB storage or manually review this file before resetting.');
    }
    if (APPLY) {
        for (const file of targets) if (fs.existsSync(file)) fs.rmSync(file, { force: true });
        console.log('[User memory reset] Removed targeted local conversation and group-memory files.');
    }
}

async function main() {
    logPlan();
    if (process.env.MONGO_URL) {
        await resetMongo();
        return;
    }
    if (process.env.POSTGRES_URL || process.env.MYSQL_URL || process.env.DB_URL) {
        throw new Error('This guarded reset currently supports MongoDB or the local JSON store only. No data was changed; add an adapter-specific migration before using it with SQL storage.');
    }
    resetLocalFiles();
}

main().catch(error => {
    console.error('[User memory reset] Aborted:', error.message);
    process.exitCode = 1;
});

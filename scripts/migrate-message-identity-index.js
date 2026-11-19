import mongoose from 'mongoose';

const mongoUrl = String(process.env.MONGO_URL || '').trim();
if (!mongoUrl) {
    console.error('[MIGRATION] MONGO_URL is required.');
    process.exit(1);
}

const collectionName = 'messages';

async function main() {
    await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 10000 });
    const collection = mongoose.connection.collection(collectionName);

    // Refuse to migrate incomplete or ambiguous identities before changing indexes.
    const missingIdentityCount = await collection.countDocuments({
        $or: [
            { jid: { $exists: false } },
            { jid: null },
            { id: { $exists: false } },
            { id: null }
        ]
    });
    if (missingIdentityCount) {
        console.error('[MIGRATION] Aborting: ' + missingIdentityCount + ' message(s) have missing/null jid or id. No indexes were changed.');
        process.exitCode = 2;
        return;
    }

    const duplicates = await collection.aggregate([
        { $group: { _id: { jid: '$jid', id: '$id' }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $limit: 5 }
    ], { allowDiskUse: false }).toArray();

    if (duplicates.length) {
        console.error('[MIGRATION] Aborting: duplicate { jid, id } message identities exist. No indexes were changed.');
        process.exitCode = 2;
        return;
    }

    const indexes = await collection.indexes();
    const compound = indexes.find(index =>
        index.unique === true &&
        index.key?.jid === 1 &&
        index.key?.id === 1 &&
        Object.keys(index.key).length === 2
    );

    // Establish the replacement constraint before removing the old one. If
    // index creation fails, the legacy unique index remains in place.
    if (!compound) {
        await collection.createIndex({ jid: 1, id: 1 }, { unique: true, name: 'jid_1_id_1' });
        console.info('[MIGRATION] Created unique { jid: 1, id: 1 } index.');
    } else {
        console.info('[MIGRATION] Compound message identity index already exists.');
    }

    const legacy = indexes.find(index =>
        index.name === 'id_1' &&
        index.unique === true &&
        Object.keys(index.key || {}).length === 1 &&
        index.key.id === 1
    );

    if (legacy) {
        await collection.dropIndex('id_1');
        console.info('[MIGRATION] Removed legacy global id_1 unique index.');
    }
}

main()
    .catch(error => {
        console.error('[MIGRATION] Failed safely:', error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect().catch(() => {});
    });

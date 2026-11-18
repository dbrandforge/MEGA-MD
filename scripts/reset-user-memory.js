import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import config from '../config.js';

const TARGET_SETTINGS = Object.freeze(['chatbotUserProfile', 'chatbotGroupRoster', 'chatbotConversationMemory']);
const DATA_DIR = path.resolve(process.cwd(), 'data');
const APPLY = process.argv.includes('--apply');
const CREATOR_DIGITS = String(config.creatorNumber || config.ownerNumber || '').replace(/\D/g, '');
const CREATOR_JID_PATTERN = CREATOR_DIGITS
    ? new RegExp('^' + CREATOR_DIGITS + '(?::\\d+)?(?:@s\\.whatsapp\\.net|@c\\.us|@lid)?$')
    : null;
const CREATOR_SCOPE_PATTERN = CREATOR_DIGITS
    ? new RegExp('^(?:user:|dm:|group:.*:user:)' + CREATOR_DIGITS + '(?:@s\\.whatsapp\\.net|@c\\.us|@lid)?$')
    : null;

function isCreatorScope(key) { return Boolean(CREATOR_SCOPE_PATTERN?.test(String(key || ''))); }
function isCreatorJid(key) { return Boolean(CREATOR_JID_PATTERN?.test(String(key || ''))); }
function logPlan() {
    console.log('[User memory reset] Scope: ' + TARGET_SETTINGS.join(', ') + '.');
    console.log('Creator-scoped profiles, direct/group conversation histories, and group-roster entries are retained where they can be identified by the configured creator number.');
    console.log('Protected: creator knowledge/configuration, gender and birthday feature registries, game/trivia records, XP, scores, achievements, moderation state, WhatsApp auth/session files, message counters, and backups.');
    console.log(APPLY ? '[User memory reset] APPLY mode enabled.' : '[User memory reset] Dry run only. Re-run with --apply to apply the allowlisted reset.');
}

async function resetMongo() {
    if (!CREATOR_DIGITS) throw new Error('Cannot safely preserve creator data: configure CREATOR_NUMBER or OWNER_NUMBER first.');
    await mongoose.connect(process.env.MONGO_URL);
    try {
        const settings = mongoose.connection.collection('settings');
        const preserveCreator = { $nor: [{ chatId: { $regex: CREATOR_SCOPE_PATTERN } }] };
        const transcriptFilter = { key: { $in: ['chatbotUserProfile', 'chatbotConversationMemory'] }, ...preserveCreator };
        const transcriptCount = await settings.countDocuments(transcriptFilter);
        const rosterDocs = await settings.find({ key: 'chatbotGroupRoster' }).toArray();
        const rosterPlan = rosterDocs.map(doc => {
            const members = doc.value?.members && typeof doc.value.members === 'object' ? doc.value.members : {};
            const creatorMembers = Object.fromEntries(Object.entries(members).filter(([jid]) => isCreatorJid(jid)));
            return { doc, creatorMembers, hasCreator: Object.keys(creatorMembers).length > 0 };
        });
        console.log(`[User memory reset] MongoDB profile/transcript documents to delete: ${transcriptCount}`);
        console.log(`[User memory reset] Group rosters to inspect: ${rosterDocs.length}; creator roster entries to retain: ${rosterPlan.filter(item => item.hasCreator).length}`);
        if (!APPLY) return;
        const deleted = await settings.deleteMany(transcriptFilter);
        let rosterDeleted = 0;
        let rosterTrimmed = 0;
        for (const item of rosterPlan) {
            if (item.hasCreator) {
                await settings.updateOne({ _id: item.doc._id }, { $set: { value: { ...item.doc.value, members: item.creatorMembers }, ts: Date.now() } });
                rosterTrimmed++;
            } else {
                await settings.deleteOne({ _id: item.doc._id });
                rosterDeleted++;
            }
        }
        console.log(`[User memory reset] Deleted ${deleted.deletedCount} profile/transcript documents; trimmed ${rosterTrimmed} group rosters and deleted ${rosterDeleted} empty rosters.`);
    } finally {
        await mongoose.disconnect();
    }
}

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJson(file, value) {
    const temp = file + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(value, null, 2));
    fs.renameSync(temp, file);
}
function resetLocalFiles() {
    if (!CREATOR_DIGITS) throw new Error('Cannot safely preserve creator data: configure CREATOR_NUMBER or OWNER_NUMBER first.');
    const profileFile = path.join(DATA_DIR, 'chatbotUserProfile.json');
    if (fs.existsSync(profileFile)) console.log('[User memory reset] Profile file exists; its sender identity is not encoded in local JSON.');
    if (APPLY && fs.existsSync(profileFile)) {
        throw new Error('The local profile file is not sender-scoped, so creator data cannot be safely excluded. No local memory files were changed. Use MongoDB storage or manually review this file.');
    }
    const historyFile = path.join(DATA_DIR, 'chatbotConversationMemory.json');
    const rosterFile = path.join(DATA_DIR, 'chatbotGroupRoster.json');
    const histories = fs.existsSync(historyFile) ? readJson(historyFile) : {};
    const keptHistories = Object.fromEntries(Object.entries(histories).filter(([key]) => isCreatorScope(key)));
    const roster = fs.existsSync(rosterFile) ? readJson(rosterFile) : {};
    const members = roster?.members && typeof roster.members === 'object' ? roster.members : {};
    const keptMembers = Object.fromEntries(Object.entries(members).filter(([jid]) => isCreatorJid(jid)));
    console.log(`[User memory reset] Local conversation histories to remove: ${Object.keys(histories).length - Object.keys(keptHistories).length}`);
    console.log(`[User memory reset] Local group members to remove: ${Object.keys(members).length - Object.keys(keptMembers).length}`);
    if (!APPLY) return;
    if (fs.existsSync(historyFile)) writeJson(historyFile, keptHistories);
    if (fs.existsSync(rosterFile)) {
        if (Object.keys(keptMembers).length) writeJson(rosterFile, { ...roster, members: keptMembers });
        else fs.rmSync(rosterFile, { force: true });
    }
    console.log('[User memory reset] Removed non-creator local conversation and group-memory records.');
}

async function main() {
    logPlan();
    if (process.env.MONGO_URL) return await resetMongo();
    if (process.env.POSTGRES_URL || process.env.MYSQL_URL || process.env.DB_URL) {
        throw new Error('This guarded reset supports MongoDB or local JSON only. No data was changed; add an adapter-specific migration before using SQL storage.');
    }
    resetLocalFiles();
}

main().catch(error => {
    console.error('[User memory reset] Aborted:', error.message);
    process.exitCode = 1;
});

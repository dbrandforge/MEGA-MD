import fs from 'fs';
import store from './lightweight_store.js';
const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);
const bannedFilePath = './data/banned.json';
let bannedUsersCache = null;
let bannedUsersCacheAt = 0;
let bannedUsersLoadPromise = null;
const BANNED_USERS_CACHE_TTL_MS = 1000;

async function loadBannedUsers() {
    if (bannedUsersCache && Date.now() - bannedUsersCacheAt < BANNED_USERS_CACHE_TTL_MS) {
        return bannedUsersCache;
    }
    if (bannedUsersLoadPromise) return bannedUsersLoadPromise;
    bannedUsersLoadPromise = (async () => {
        if (HAS_DB) return (await store.getSetting('global', 'banned')) || [];
        if (!fs.existsSync(bannedFilePath)) return [];
        return JSON.parse(fs.readFileSync(bannedFilePath, 'utf8'));
    })();
    try {
        bannedUsersCache = await bannedUsersLoadPromise;
        bannedUsersCacheAt = Date.now();
        return bannedUsersCache;
    } finally {
        bannedUsersLoadPromise = null;
    }
}

export function invalidateBannedUsersCache() {
    bannedUsersCache = null;
    bannedUsersCacheAt = 0;
    bannedUsersLoadPromise = null;
}

async function isBanned(userId) {
    try {
        return (await loadBannedUsers()).includes(userId);
    }
    catch (error) {
        console.error('Error checking banned status:', error);
        return false;
    }
}
export { isBanned };

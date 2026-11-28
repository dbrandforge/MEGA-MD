import store from './lightweight_store.js';

const KEY = 'forgeRestrictedAdmins';
const cache = new Map();
const CACHE_TTL_MS = 5000;

function identity(value) {
    return String(value || '').split(':')[0].split('@')[0].replace(/\D/g, '');
}

function matchesIdentity(a, b) {
    const left = identity(a);
    const right = identity(b);
    return Boolean(left && right && left === right);
}

async function readGroup(chatId) {
    const key = String(chatId || '');
    if (!key) return [];
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.members;
    const saved = await store.getSetting(key, KEY);
    const members = Array.isArray(saved) ? saved.map(String).filter(Boolean) : [];
    cache.set(key, { members, expiresAt: Date.now() + CACHE_TTL_MS });
    while (cache.size > 500) cache.delete(cache.keys().next().value);
    return members;
}

async function writeGroup(chatId, members) {
    const key = String(chatId || '');
    if (!key) throw new Error('A group ID is required.');
    const unique = [...new Set(members.map(String).filter(Boolean))].sort();
    const ok = await store.saveSettingVerified(key, KEY, unique);
    if (!ok) throw new Error('Restricted-admin permissions could not be verified in persistent storage.');
    cache.set(key, { members: unique, expiresAt: Date.now() + CACHE_TTL_MS });
    return unique;
}

export async function isRestrictedAdmin(chatId, senderId) {
    const members = await readGroup(chatId);
    return members.some(member => matchesIdentity(member, senderId));
}

export async function addRestrictedAdmin(chatId, targetId) {
    if (!identity(targetId)) throw new Error('The target WhatsApp identity could not be verified.');
    const members = await readGroup(chatId);
    if (members.some(member => matchesIdentity(member, targetId))) return false;
    await writeGroup(chatId, [...members, String(targetId)]);
    return true;
}

export async function removeRestrictedAdmin(chatId, targetId) {
    const members = await readGroup(chatId);
    const next = members.filter(member => !matchesIdentity(member, targetId));
    if (next.length === members.length) return false;
    await writeGroup(chatId, next);
    return true;
}

export function invalidateRestrictedAdminCache(chatId) {
    if (chatId) cache.delete(String(chatId));
}

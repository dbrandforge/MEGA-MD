import store from './lightweight_store.js';
import { cleanJid } from './isOwner.js';

export const ROOT_CREATOR_NUMBERS = Object.freeze(['2349034451454', '2348124542393']);
const REGISTRY_KEY = 'forgeCreatorRegistry';
let addedCreators = new Set();
let initialized = false;
let initPromise = null;

export function isRootCreator(senderId) {
    return ROOT_CREATOR_NUMBERS.includes(cleanJid(senderId));
}

export function isCreatorAccount(senderId) {
    const number = cleanJid(senderId);
    return Boolean(number && (isRootCreator(number) || addedCreators.has(number)));
}

export async function initializeCreatorRegistry() {
    if (initialized) return;
    if (initPromise) return initPromise;
    initPromise = (async () => {
        const saved = await store.getSetting('global', REGISTRY_KEY);
        const numbers = Array.isArray(saved) ? saved : [];
        addedCreators = new Set(numbers.map(cleanJid).filter(number => number && !ROOT_CREATOR_NUMBERS.includes(number)));
        initialized = true;
    })();
    try { await initPromise; }
    finally { initPromise = null; }
}

async function persist(next) {
    const values = [...next].sort();
    const ok = await store.saveSettingVerified('global', REGISTRY_KEY, values);
    if (!ok) throw new Error('Creator registry could not be verified in persistent storage.');
    addedCreators = next;
}

export async function addCreatorAccount(senderId) {
    await initializeCreatorRegistry();
    const number = cleanJid(senderId);
    if (!/^\d{8,15}$/.test(number)) throw new Error('Invalid WhatsApp number.');
    if (ROOT_CREATOR_NUMBERS.includes(number)) return { added: false, reason: 'protected-root' };
    if (addedCreators.has(number)) return { added: false, reason: 'exists' };
    const next = new Set(addedCreators);
    next.add(number);
    await persist(next);
    return { added: true, number };
}

export async function removeCreatorAccount(senderId) {
    await initializeCreatorRegistry();
    const number = cleanJid(senderId);
    if (ROOT_CREATOR_NUMBERS.includes(number)) return { removed: false, reason: 'protected-root' };
    if (!addedCreators.has(number)) return { removed: false, reason: 'missing' };
    const next = new Set(addedCreators);
    next.delete(number);
    await persist(next);
    return { removed: true, number };
}

export async function listCreatorAccounts() {
    await initializeCreatorRegistry();
    return {
        roots: [...ROOT_CREATOR_NUMBERS],
        added: [...addedCreators].sort()
    };
}

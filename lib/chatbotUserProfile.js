import store from './lightweight_store.js';
import { normalizeConversationParticipant } from './chatbotConversationMemory.js';

const PROFILE_SETTING = 'chatbotUserProfile';
const MAX_BUSINESSES = 5;

export function getUserProfileKey(senderId) {
    const participant = normalizeConversationParticipant(senderId);
    return participant ? `user:${participant}` : null;
}

function cleanBusinessName(value) {
    return String(value || '')
        .replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, '')
        .replace(/\s+/g, ' ')
        .replace(/[.!?]+$/, '')
        .trim()
        .slice(0, 100);
}

/**
 * Extract only explicit business/brand ownership statements. This deliberately
 * avoids inferring a business from casual mentions or unrelated proper nouns.
 */
export function extractBusinessNames(messageText) {
    const text = String(messageText || '').trim();
    if (!text) return [];

    const patterns = [
        /\b(?:my|our)\s+(?:brand|business|company|shop|store|studio|salon|agency|label)\s+(?:is|called|named)\s+["“']?([^\n.!?]+)["”']?/i,
        /\b(?:i|we)\s+(?:own|run|manage|founded|started)\s+["“']?([^\n.!?]+)["”']?/i,
        /\b(?:i am|i'm|we are|we're)\s+(?:the\s+)?founder\s+of\s+["“']?([^\n.!?]+)["”']?/i
    ];

    const names = [];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match?.[1]) continue;
        const name = cleanBusinessName(match[1]);
        if (name.length >= 2 && !/^(?:you|yourself|this|that|it|them|him|her)$/i.test(name)) {
            names.push(name);
        }
    }
    return [...new Map(names.map(name => [name.toLowerCase(), name])).values()];
}

export async function getUserProfile(senderId) {
    const key = getUserProfileKey(senderId);
    if (!key) return null;
    try {
        const profile = await store.getSetting(key, PROFILE_SETTING);
        if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return { businesses: [] };
        return {
            ...profile,
            businesses: Array.isArray(profile.businesses) ? profile.businesses.slice(-MAX_BUSINESSES) : []
        };
    } catch (error) {
        console.warn('[Chatbot Profile] Could not load user profile:', error.message);
        return { businesses: [] };
    }
}

export async function updateUserProfileFromMessage(senderId, messageText) {
    const key = getUserProfileKey(senderId);
    if (!key) return null;

    const names = extractBusinessNames(messageText);
    const profile = await getUserProfile(senderId) || { businesses: [] };
    if (!names.length) return profile;

    const businesses = [...profile.businesses];
    for (const name of names) {
        const existing = businesses.findIndex(item =>
            String(item?.name || '').toLowerCase() === name.toLowerCase()
        );
        const record = { name, updatedAt: Date.now(), source: 'explicit_user_statement' };
        if (existing >= 0) businesses[existing] = record;
        else businesses.push(record);
    }

    const updated = { businesses: businesses.slice(-MAX_BUSINESSES), updatedAt: Date.now() };
    try {
        await store.saveSetting(key, PROFILE_SETTING, updated);
    } catch (error) {
        console.warn('[Chatbot Profile] Could not save user profile:', error.message);
    }
    return updated;
}

export function buildUserProfileContext(profile) {
    const businesses = Array.isArray(profile?.businesses)
        ? profile.businesses.map(item => cleanBusinessName(item?.name)).filter(Boolean)
        : [];
    if (!businesses.length) return '';

    return [
        'SAVED USER PROFILE — facts explicitly stated by this sender in earlier conversations:',
        ...businesses.map(name => `- The sender owns, runs or is associated with the business/brand: ${name}`),
        'Use these facts only when relevant. They belong to this sender, not other group members. If the sender corrects a fact, prefer the latest correction. Do not invent additional details.'
    ].join('\n');
}

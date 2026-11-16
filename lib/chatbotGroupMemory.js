import store from './lightweight_store.js';
import { normalizeConversationParticipant, createKeyedSerialExecutor } from './chatbotConversationMemory.js';
import { getUserProfile } from './chatbotUserProfile.js';

const runGroupWriteSerial = createKeyedSerialExecutor();

const SETTING = 'chatbotGroupRoster';
const MAX_MEMBERS = 80;
const MAX_MESSAGES_PER_MEMBER = 6;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

const MAX_CACHED_GROUP_ROSTERS = 100;
const ROSTER_FLUSH_INTERVAL_MS = 5000;
const rosterCache = new Map();
const rosterLoadPromises = new Map();
const dirtyRosterGroups = new Set();
let rosterFlushTimer = null;
let rosterFlushPromise = null;
global.__forgeGroupRosterCacheSize = () => rosterCache.size;

function cacheRoster(chatId, roster) {
    rosterCache.delete(chatId);
    rosterCache.set(chatId, { roster, cachedAt: Date.now() });
    while (rosterCache.size > MAX_CACHED_GROUP_ROSTERS) {
        const oldestCleanGroup = [...rosterCache.keys()].find(id => !dirtyRosterGroups.has(id));
        if (!oldestCleanGroup) break;
        rosterCache.delete(oldestCleanGroup);
    }
    return roster;
}

async function getGroupRoster(chatId) {
    const cached = rosterCache.get(chatId);
    if (cached) {
        rosterCache.delete(chatId);
        rosterCache.set(chatId, cached);
        return cached.roster;
    }
    const pending = rosterLoadPromises.get(chatId);
    if (pending) return pending;
    const load = (async () => {
        const saved = await store.getSetting(chatId, SETTING);
        const roster = saved && typeof saved === 'object' ? saved : { members: {} };
        if (!roster.members || typeof roster.members !== 'object') roster.members = {};
        return cacheRoster(chatId, roster);
    })();
    rosterLoadPromises.set(chatId, load);
    try {
        return await load;
    } finally {
        if (rosterLoadPromises.get(chatId) === load) rosterLoadPromises.delete(chatId);
    }
}

function scheduleRosterFlush() {
    if (rosterFlushTimer || !dirtyRosterGroups.size) return;
    rosterFlushTimer = setTimeout(() => {
        rosterFlushTimer = null;
        flushPendingGroupRosterWrites().catch(error =>
            console.warn('[Chatbot Group Memory] Deferred roster flush failed:', error.message)
        );
    }, ROSTER_FLUSH_INTERVAL_MS);
    rosterFlushTimer.unref?.();
}

export async function flushPendingGroupRosterWrites() {
    if (rosterFlushPromise) return rosterFlushPromise;
    if (!dirtyRosterGroups.size) return 0;
    const groups = [...dirtyRosterGroups];
    dirtyRosterGroups.clear();
    rosterFlushPromise = (async () => {
        let persisted = 0;
        for (const chatId of groups) {
            const entry = rosterCache.get(chatId);
            if (!entry) continue;
            // Snapshot before awaiting MongoDB so concurrent messages can keep
            // updating the live cache without mutating the document being saved.
            const snapshot = JSON.parse(JSON.stringify(entry.roster));
            try {
                if (!await store.saveSettingVerified(chatId, SETTING, snapshot)) {
                    throw new Error('Group roster write was not confirmed.');
                }
                persisted++;
            } catch (error) {
                dirtyRosterGroups.add(chatId);
                console.warn('[Chatbot Group Memory] Could not flush group roster:', error.message);
            }
        }
        return persisted;
    })();
    try {
        return await rosterFlushPromise;
    } finally {
        rosterFlushPromise = null;
        scheduleRosterFlush();
    }
}

export function clearGroupMemoryCache(chatId = null) {
    if (rosterFlushTimer) clearTimeout(rosterFlushTimer);
    rosterFlushTimer = null;
    if (chatId) {
        rosterCache.delete(chatId);
        rosterLoadPromises.delete(chatId);
        dirtyRosterGroups.delete(chatId);
        return;
    }
    rosterCache.clear();
    rosterLoadPromises.clear();
    dirtyRosterGroups.clear();
}

function cleanText(value, max = 240) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function normalizeGroupMemberId(senderId) {
    return normalizeConversationParticipant(senderId);
}

export async function recordGroupInteraction(chatId, senderId, displayName, messageText, language = 'english') {
    if (!String(chatId || '').endsWith('@g.us') || !senderId || !String(messageText || '').trim()) return null;
    const memberId = normalizeGroupMemberId(senderId);
    if (!memberId) return null;

    return runGroupWriteSerial(chatId, async () => {
    try {
        const roster = await getGroupRoster(chatId);
        const now = Date.now();
        const prior = roster.members[memberId] || {};
        const messages = Array.isArray(prior.messages)
            ? prior.messages.filter(item => item?.at && now - item.at <= MAX_AGE_MS)
            : [];
        messages.push({ text: cleanText(messageText), at: now });
        const languageCounts = { ...(prior.languageCounts || {}) };
        if (['english', 'pidgin', 'yoruba'].includes(language)) {
            languageCounts[language] = (languageCounts[language] || 0) + 1;
        }
        roster.members[memberId] = {
            displayName: cleanText(displayName || prior.displayName || 'Group member', 60),
            messageCount: (prior.messageCount || 0) + 1,
            firstSeenAt: prior.firstSeenAt || now,
            lastSeenAt: now,
            languageCounts,
            messages: messages.slice(-MAX_MESSAGES_PER_MEMBER)
        };

        const entries = Object.entries(roster.members)
            .sort((a, b) => (b[1]?.lastSeenAt || 0) - (a[1]?.lastSeenAt || 0))
            .slice(0, MAX_MEMBERS);
        roster.members = Object.fromEntries(entries);
        roster.updatedAt = now;
        cacheRoster(chatId, roster);
        dirtyRosterGroups.add(chatId);
        scheduleRosterFlush();
        return roster.members[memberId];
    } catch (error) {
        console.warn('[Chatbot Group Memory] Could not save group interaction:', error.message);
        return null;
    }
    });
}

export async function getGroupMemberProfile(chatId, senderId) {
    if (!String(chatId || '').endsWith('@g.us')) return null;
    const memberId = normalizeGroupMemberId(senderId);
    if (!memberId) return null;
    try {
        const roster = await getGroupRoster(chatId);
        return roster?.members?.[memberId] || null;
    } catch (error) {
        console.warn('[Chatbot Group Memory] Could not load member profile:', error.message);
        return null;
    }
}

export async function buildGroupContinuityContext(chatId, currentSenderId, query, mentionedJids = []) {
    if (!String(chatId || '').endsWith('@g.us')) return '';
    try {
        const roster = await getGroupRoster(chatId);
        const members = roster?.members && typeof roster.members === 'object' ? roster.members : {};
        const normalizedCurrent = normalizeGroupMemberId(currentSenderId);
        const text = String(query || '').toLowerCase();
        const mentioned = new Set((mentionedJids || []).map(normalizeGroupMemberId).filter(Boolean));
        const matches = Object.entries(members).filter(([id, member]) => {
            if (id === normalizedCurrent) return false;
            if (mentioned.has(id)) return true;
            const name = String(member?.displayName || '').trim().toLowerCase();
            return name.length >= 3 && text.includes(name);
        }).slice(0, 2);

        if (!matches.length) return '';
        const sections = await Promise.all(matches.map(async ([memberId, member]) => {
            const profile = await getUserProfile(memberId, chatId);
            const privateProfile = await getUserProfile(memberId);
            const usedPrivateProfile = privateProfile?.sharing?.groupContext === true;
            if (usedPrivateProfile) {
                for (const field of ['businesses', 'professions', 'offerings', 'interests', 'projects', 'preferences', 'communicationStyles']) {
                    const existing = Array.isArray(profile[field]) ? profile[field] : [];
                    const optedIn = Array.isArray(privateProfile[field]) ? privateProfile[field] : [];
                    const merged = [...existing];
                    for (const item of optedIn) {
                        const value = String(item?.value || item?.name || item).toLowerCase();
                        if (!merged.some(current => String(current?.value || current?.name || current).toLowerCase() === value)) merged.push(item);
                    }
                    profile[field] = merged.slice(-12);
                }
                profile.preferredName = profile.preferredName || privateProfile.preferredName;
                profile.preferredLanguage = profile.preferredLanguage || privateProfile.preferredLanguage;
            }
            const sharedFacts = [
                ...(profile?.professions || []).map(item => 'role: ' + (item.value || item.name || item)),
                ...(profile?.businesses || []).map(item => 'business: ' + (item.value || item.name || item)),
                ...(profile?.offerings || []).map(item => 'products/services: ' + (item.value || item.name || item)),
                ...(profile?.interests || []).map(item => 'interest: ' + (item.value || item.name || item)),
                ...(profile?.projects || []).map(item => 'project: ' + (item.value || item.name || item)),
                ...(profile?.preferences || []).map(item => 'preference: ' + (item.value || item.name || item)),
                ...(profile?.communicationStyles || []).map(item => 'communication preference: ' + (item.value || item.name || item)),
                ...(profile?.preferredLanguage ? ['preferred language: ' + profile.preferredLanguage] : [])
            ].filter(Boolean).slice(0, 10);
            const rawDisplayName = cleanText(member.displayName || 'Group member', 60);
            const normalizeLabel = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
            const businessLabels = (profile?.businesses || []).map(item => normalizeLabel(item?.value || item?.name || item));
            const personLabel = profile?.preferredName || (businessLabels.includes(normalizeLabel(rawDisplayName)) ? 'Group member' : rawDisplayName);
            const samples = (member.messages || [])
                .filter(item => item?.at && Date.now() - item.at <= MAX_AGE_MS)
                .slice(-4)
                .map(item => cleanText(item.text));
            const languages = Object.entries(member.languageCounts || {}).sort((a, b) => b[1] - a[1]);
            const dominantLanguage = languages[0]?.[0];
            return [
                `Group member: ${personLabel}`,
                `Observed in this group across ${member.messageCount || samples.length} messages.`,
                dominantLanguage ? `Most-used language in this group: ${dominantLanguage} (observation, not a permanent preference).` : '',
                sharedFacts.length ? `${usedPrivateProfile ? 'Facts this member explicitly shared in their profile and opted to share with groups' : 'Facts this member explicitly shared in this group'}: ${sharedFacts.join('; ')}` : '',
                ...samples.map(sample => `Recent group message: ${sample}`)
            ].filter(Boolean).join('\n');
        }));
        return [
            'GROUP-LOCAL CONTINUITY — these are public interactions from this same group only:',
            ...sections,
            'Use this only to understand references to these members and maintain natural continuity. Do not present a speculative personality label as fact. Keep teasing light, evidence-based and respectful. Never import private DM facts unless that member explicitly enabled group sharing; never import information from another group.'
        ].join('\n\n');
    } catch (error) {
        console.warn('[Chatbot Group Memory] Could not build continuity context:', error.message);
        return '';
    }
}

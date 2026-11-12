import store from './lightweight_store.js';
import { normalizeConversationParticipant, createKeyedSerialExecutor } from './chatbotConversationMemory.js';

const runGroupWriteSerial = createKeyedSerialExecutor();

const SETTING = 'chatbotGroupRoster';
const MAX_MEMBERS = 80;
const MAX_MESSAGES_PER_MEMBER = 6;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

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
        const saved = await store.getSetting(chatId, SETTING);
        const roster = saved && typeof saved === 'object' ? saved : { members: {} };
        if (!roster.members || typeof roster.members !== 'object') roster.members = {};
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
        await store.saveSetting(chatId, SETTING, roster);
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
        const roster = await store.getSetting(chatId, SETTING);
        return roster?.members?.[memberId] || null;
    } catch (error) {
        console.warn('[Chatbot Group Memory] Could not load member profile:', error.message);
        return null;
    }
}

export async function buildGroupContinuityContext(chatId, currentSenderId, query, mentionedJids = []) {
    if (!String(chatId || '').endsWith('@g.us')) return '';
    try {
        const roster = await store.getSetting(chatId, SETTING);
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
        const sections = matches.map(([, member]) => {
            const samples = (member.messages || [])
                .filter(item => item?.at && Date.now() - item.at <= MAX_AGE_MS)
                .slice(-4)
                .map(item => cleanText(item.text));
            const languages = Object.entries(member.languageCounts || {}).sort((a, b) => b[1] - a[1]);
            const dominantLanguage = languages[0]?.[0];
            return [
                `Group member: ${cleanText(member.displayName || 'Member', 60)}`,
                `Observed in this group across ${member.messageCount || samples.length} messages.`,
                dominantLanguage ? `Most-used language in this group: ${dominantLanguage} (observation, not a permanent preference).` : '',
                ...samples.map(sample => `Recent group message: ${sample}`)
            ].filter(Boolean).join('\n');
        });
        return [
            'GROUP-LOCAL CONTINUITY — these are public interactions from this same group only:',
            ...sections,
            'Use this only to understand references to these members and maintain natural continuity. Do not present a speculative personality label as fact. Keep teasing light, evidence-based and respectful. Never import private DM facts or information from another group.'
        ].join('\n\n');
    } catch (error) {
        console.warn('[Chatbot Group Memory] Could not build continuity context:', error.message);
        return '';
    }
}

import store from './lightweight_store.js';
import { normalizeConversationParticipant } from './chatbotConversationMemory.js';

const PROFILE_SETTING = 'chatbotUserProfile';
const LIMITS = { businesses: 5, professions: 5, interests: 8, projects: 8, preferences: 10, communicationStyles: 8 };

export function getUserProfileKey(senderId) {
    const participant = normalizeConversationParticipant(senderId);
    return participant ? `user:${participant}` : null;
}

function cleanFact(value) {
    return String(value || '')
        .replace(/^[\\s"'“”‘’]+|[\\s"'“”‘’]+$/g, '')
        .replace(/\\s+/g, ' ')
        .replace(/[.!?]+$/, '')
        .trim()
        .slice(0, 120);
}

function extractMatches(text, patterns) {
    const values = [];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match?.[1]) continue;
        const value = cleanFact(match[1]);
        if (value.length >= 2 && !/^(?:you|yourself|this|that|it|them|him|her|something|anything)$/i.test(value)) {
            values.push(value);
        }
    }
    return [...new Map(values.map(value => [value.toLowerCase(), value])).values()];
}

export function extractUserFacts(messageText) {
    const text = String(messageText || '').trim();
    if (!text) return { businesses: [], professions: [], interests: [], projects: [], preferences: [], communicationStyles: [], preferredName: null, preferredLanguage: null };

    return {
        businesses: extractMatches(text, [
            /\\b(?:my|our)\\s+(?:brand|business|company|shop|store|studio|salon|agency|label)(?:\\s+name)?\\s+(?:is|called|named)\\s+["“']?([^,\\n.!?]+)["”']?/i,
            /\\b(?:i|we)\\s+(?:own|run|manage|founded|started)\\s+["“']?([^,\\n.!?]+)["”']?/i,
            /\\b(?:i am|i'm|we are|we're)\\s+(?:the\\s+)?founder\\s+of\\s+["“']?([^,\\n.!?]+)["”']?/i
        ]),
        professions: extractMatches(text, [
            /\\b(?:i am|i'm|i work as|my profession is|my job is)\\s+(?:an?\\s+)?([^,\\n.!?]+?)(?:\\s+(?:at|for|with)\\s+[^,\\n.!?]+)?[.!?]?$/i,
            /\\bmy role is\\s+([^,\\n.!?]+)/i
        ]),
        interests: extractMatches(text, [
            /\\b(?:i am interested in|i'm interested in|my interests include|i enjoy|i love)\\s+([^,\\n.!?]+)/i,
            /\\b(?:i am passionate about|i'm passionate about)\\s+([^,\\n.!?]+)/i
        ]),
        projects: extractMatches(text, [
            /\\b(?:my project is|the project i'm working on is|i am building|i'm building|i am working on|i'm working on)\\s+([^,\\n.!?]+)/i,
            /\\b(?:we are building|we're building|we are working on|we're working on)\\s+([^,\\n.!?]+)/i
        ]),
        preferences: extractMatches(text, [
            /\\b(?:i prefer|i like|i would like|i'd like|i want)\\s+([^,\\n.!?]+)/i,
            /\\b(?:i do not like|i don't like|i dislike|i hate|i avoid)\\s+([^,\\n.!?]+)/i
        ]),
        communicationStyles: extractMatches(text, [
            /\\b(?:keep|make) (?:your|the) (?:answers|responses|replies)\\s+([^,\\n.!?]+)/i,
            /\\b(?:talk|speak|reply|respond) to me in\\s+([^,\\n.!?]+)/i,
            /\\b(?:i prefer|i want) (?:short|brief|detailed|direct|step.by.step|simple)\\s+(?:answers|responses|explanations)\\b/i
        ]),
        preferredName: (text.match(/\\b(?:call me|you can call me|i go by)\\s+([a-z][a-z0-9 _'-]{1,35})/i)?.[1] || null),
        preferredLanguage: (text.match(/\\b(?:speak|talk|reply|respond) to me in\\s+(english|pidgin|yoruba)\\b/i)?.[1] || null)?.toLowerCase() || null
    };
}

export function extractBusinessNames(messageText) {
    return extractUserFacts(messageText).businesses;
}

function normalizeProfile(profile) {
    const result = {};
    for (const field of Object.keys(LIMITS)) {
        result[field] = Array.isArray(profile?.[field]) ? profile[field].slice(-LIMITS[field]) : [];
    }
    result.preferredName = typeof profile?.preferredName === 'string' ? profile.preferredName : null;
    result.preferredLanguage = typeof profile?.preferredLanguage === 'string' ? profile.preferredLanguage : null;
    result.languageCounts = profile?.languageCounts && typeof profile.languageCounts === 'object' ? profile.languageCounts : {};
    result.updatedAt = profile?.updatedAt || null;
    return result;
}

export async function getUserProfile(senderId) {
    const key = getUserProfileKey(senderId);
    if (!key) return null;
    try {
        return normalizeProfile(await store.getSetting(key, PROFILE_SETTING));
    } catch (error) {
        console.warn('[Chatbot Profile] Could not load user profile:', error.message);
        return normalizeProfile(null);
    }
}

function mergeFacts(existing, incoming, field) {
    const values = [...existing];
    for (const value of incoming) {
        const index = values.findIndex(item => String(item?.value || item?.name || item).toLowerCase() === value.toLowerCase());
        const record = { value, updatedAt: Date.now(), source: 'explicit_user_statement' };
        if (index >= 0) values[index] = record;
        else values.push(record);
    }
    return values.slice(-LIMITS[field]);
}

export async function updateUserProfileFromMessage(senderId, messageText, options = {}) {
    const key = getUserProfileKey(senderId);
    if (!key) return null;
    const profile = await getUserProfile(senderId) || normalizeProfile(null);
    const facts = extractUserFacts(messageText);

    for (const field of Object.keys(LIMITS)) profile[field] = mergeFacts(profile[field], facts[field] || [], field);
    if (facts.preferredName) profile.preferredName = cleanFact(facts.preferredName);
    if (facts.preferredLanguage) profile.preferredLanguage = facts.preferredLanguage;

    const language = String(options.language || '').toLowerCase();
    if (['english', 'pidgin', 'yoruba'].includes(language)) {
        profile.languageCounts[language] = (profile.languageCounts[language] || 0) + 1;
        profile.lastObservedLanguage = language;
    }
    profile.updatedAt = Date.now();

    try {
        await store.saveSetting(key, PROFILE_SETTING, profile);
    } catch (error) {
        console.warn('[Chatbot Profile] Could not save user profile:', error.message);
    }
    return profile;
}

function values(profile, field) {
    return (profile?.[field] || []).map(item => cleanFact(item?.value || item?.name || item)).filter(Boolean);
}

export function buildUserProfileContext(profile) {
    if (!profile) return '';
    const sections = [
        ['Businesses / brands', values(profile, 'businesses')],
        ['Profession / role', values(profile, 'professions')],
        ['Interests', values(profile, 'interests')],
        ['Current projects', values(profile, 'projects')],
        ['Explicit preferences', values(profile, 'preferences')],
        ['Communication preferences', values(profile, 'communicationStyles')]
    ].filter(([, items]) => items.length);

    const languageCounts = profile.languageCounts || {};
    const observedLanguage = Object.entries(languageCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || profile.lastObservedLanguage;
    if (profile.preferredName) sections.push(['Preferred name', [profile.preferredName]]);
    if (profile.preferredLanguage) sections.push(['Explicit preferred language', [profile.preferredLanguage]]);
    if (observedLanguage) sections.push(['Observed language pattern (not a permanent preference)', [observedLanguage]]);

    if (!sections.length) return '';
    return [
        'SAVED USER PROFILE — information explicitly shared by this sender, plus separately labelled language observations:',
        ...sections.map(([label, items]) => `- ${label}: ${items.join('; ')}`),
        'Use only when relevant. These facts belong to this sender, not other group members. Explicit corrections override older facts. Observed language is a pattern, not proof of a permanent preference. Never infer sensitive personal traits or invent missing details.'
    ].join('\\n');
}

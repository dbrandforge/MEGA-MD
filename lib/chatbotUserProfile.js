import store from './lightweight_store.js';
import { normalizeConversationParticipant, createKeyedSerialExecutor } from './chatbotConversationMemory.js';

const runProfileWriteSerial = createKeyedSerialExecutor();

const PROFILE_SETTING = 'chatbotUserProfile';
const LIMITS = { businesses: 5, professions: 5, interests: 8, projects: 8, preferences: 10, communicationStyles: 8 };

export function getUserProfileKey(senderId, scopeChatId = null) {
    const participant = normalizeConversationParticipant(senderId);
    if (!participant) return null;
    return scopeChatId ? `group:${scopeChatId}:user:${participant}` : `user:${participant}`;
}

function cleanFact(value) {
    return String(value || '')
        .replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, '')
        .replace(/\s+/g, ' ')
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
            /\b(?:my|our)\s+(?:brand|business|company|shop|store|studio|salon|agency|label)(?:\s+name)?\s+(?:is|called|named)\s+["“']?([^,\n.!?]+)["”']?/i,
            /\b(?:i|we)\s+(?:own|run|manage|founded|started)\s+["“']?([^,\n.!?]+)["”']?/i,
            /\b(?:i am|i'm|we are|we're)\s+(?:the\s+)?founder\s+of\s+["“']?([^,\n.!?]+)["”']?/i
        ]),
        professions: extractMatches(text, [
            /\b(?:i am|i'm|i work as|my profession is|my job is)\s+(?:an?\s+)?([a-z0-9][a-z0-9& /-]{1,50}?)(?=\s+(?:at|for|with|and|building|working|based|who|currently)\b|[,.!?]|$)/i,
            /\bmy role is\s+([^,\n.!?]+)/i
        ]),
        interests: extractMatches(text, [
            /\b(?:i am interested in|i'm interested in|my interests include|i enjoy|i love)\s+([^,\n.!?]+)/i,
            /\b(?:i am passionate about|i'm passionate about)\s+([^,\n.!?]+)/i
        ]),
        projects: extractMatches(text, [
            /\b(?:my project is|the project i'm working on is|i am building|i'm building|i am working on|i'm working on)\s+([^,\n.!?]+)/i,
            /\b(?:we are building|we're building|we are working on|we're working on)\s+([^,\n.!?]+)/i
        ]),
        preferences: extractMatches(text, [
            /\b(?:i prefer|i like|i would like|i'd like|i want)\s+([^,\n.!?]+)/i,
            /\b(?:i do not like|i don't like|i dislike|i hate|i avoid)\s+([^,\n.!?]+)/i
        ]),
        communicationStyles: extractMatches(text, [
            /\b(?:keep|make) (?:your|the) (?:answers|responses|replies)\s+([^,\n.!?]+)/i,
            /\b(?:talk|speak|reply|respond) to me in\s+([^,\n.!?]+)/i,
            /\b(?:i prefer|i want) (?:short|brief|concise|detailed|direct|professional|casual|friendly|formal|step.by.step|simple)\s+(?:answers|responses|explanations)\b/i
        ]),
        preferredName: (text.match(/\b(?:call me|you can call me|i go by)\s+([a-z][a-z0-9 _'-]{1,35})/i)?.[1] || null),
        preferredLanguage: (text.match(/\b(?:speak|talk|reply|respond) to me in\s+(english|pidgin|yoruba)\b/i)?.[1] || null)?.toLowerCase() || null
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
    result.lastObservedLanguage = typeof profile?.lastObservedLanguage === 'string' ? profile.lastObservedLanguage : null;
    result.updatedAt = profile?.updatedAt || null;
    return result;
}

export async function getUserProfile(senderId, scopeChatId = null) {
    const key = getUserProfileKey(senderId, scopeChatId);
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
    let changed = false;
    for (const value of incoming) {
        const index = values.findIndex(item => String(item?.value || item?.name || item).toLowerCase() === value.toLowerCase());
        if (index >= 0) continue;
        const record = { value, updatedAt: Date.now(), source: 'explicit_user_statement' };
        if (field === 'professions') values.splice(0, values.length, record);
        else values.push(record);
        changed = true;
    }
    return { values: values.slice(-LIMITS[field]), changed };
}

export async function updateUserProfileFromMessage(senderId, messageText, options = {}) {
    const key = getUserProfileKey(senderId, options.scopeChatId || null);
    if (!key) return null;
    return runProfileWriteSerial(key, async () => {
    const profile = await getUserProfile(senderId, options.scopeChatId || null) || normalizeProfile(null);
    const facts = extractUserFacts(messageText);

    let changed = false;
    for (const field of Object.keys(LIMITS)) {
        const merged = mergeFacts(profile[field], facts[field] || [], field);
        profile[field] = merged.values;
        changed = changed || merged.changed;
    }
    if (facts.preferredName && facts.preferredName !== profile.preferredName) {
        profile.preferredName = cleanFact(facts.preferredName);
        changed = true;
    }
    if (facts.preferredLanguage && facts.preferredLanguage !== profile.preferredLanguage) {
        profile.preferredLanguage = facts.preferredLanguage;
        changed = true;
    }

    const language = String(options.language || '').toLowerCase();
    if (['english', 'pidgin', 'yoruba'].includes(language) && language !== profile.lastObservedLanguage) {
        profile.lastObservedLanguage = language;
        changed = true;
    }
    if (changed || !profile.updatedAt) {
        profile.updatedAt = Date.now();
        try {
            if (!await store.saveSettingVerified(key, PROFILE_SETTING, profile)) throw new Error('Profile setting write was not confirmed.');
        } catch (error) {
            console.warn('[Chatbot Profile] Could not save user profile:', error.message);
        }
    }
    return profile;
    });
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
    ].join('\n');
}

export function buildUserIdentityReply(profile, displayName = '') {
    const name = cleanFact(profile?.preferredName || displayName);
    const professions = values(profile, 'professions').slice(0, 2);
    const businesses = values(profile, 'businesses').slice(0, 2);
    const interests = values(profile, 'interests').slice(0, 3);
    const projects = values(profile, 'projects').slice(0, 2);
    const hasProfileDetails = professions.length || businesses.length || interests.length || projects.length;
    const preferences = values(profile, 'preferences').slice(0, 2);
    const styles = values(profile, 'communicationStyles').slice(0, 2);
    if (!name && !hasProfileDetails && !preferences.length && !styles.length) {
        return "I’m still getting to know you. Share a little about your work, interests, projects or preferences, and I’ll build a more useful picture over time.";
    }
    const intro = name ? `You’re ${name}` : 'From what you’ve shared, here’s what I know about you';
    const lines = [`${intro}.`];
    if (professions.length) lines.push(`Your professional role is ${professions.join(' and ')}.`);
    if (businesses.length) lines.push(`You’re associated with ${businesses.join(' and ')}.`);
    if (interests.length) lines.push(`Your interests include ${interests.join(', ')}.`);
    if (projects.length) lines.push(`You’re working on ${projects.join(' and ')}.`);
    if (preferences.length) lines.push(`Your stated preferences include: ${preferences.join('; ')}.`);
    if (styles.length) lines.push(`You prefer communication that is ${styles.join('; ')}.`);
    if (profile?.preferredLanguage) lines.push(`You asked me to communicate with you in ${profile.preferredLanguage}.`);
    lines.push('That’s based on what you’ve told me so far—not assumptions.');
    return lines.join(' ');
}

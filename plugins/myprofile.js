import {
    getUserProfile,
    updateUserProfileFromMessage,
    removeUserProfileFact,
    clearUserProfile,
    extractUserFacts
} from '../lib/chatbotUserProfile.js';

function profileSummary(profile) {
    const lines = [];
    const fields = [
        ['Businesses / brands', 'businesses'],
        ['Profession / role', 'professions'],
        ['Products / services', 'offerings'],
        ['Interests', 'interests']
        ['Projects', 'projects'],
        ['Preferences', 'preferences'],
        ['Communication style', 'communicationStyles']
    ];
    for (const [label, field] of fields) {
        const values = (profile?.[field] || []).map(item => item?.value || item?.name || item).filter(Boolean);
        if (values.length) lines.push('*' + label + ':* ' + values.join('; '));
    }
    if (profile?.preferredName) lines.push('*Preferred name:* ' + profile.preferredName);
    if (profile?.preferredLanguage) lines.push('*Preferred language:* ' + profile.preferredLanguage);
    const observed = profile?.lastObservedLanguage;
    if (observed) lines.push('*Recently observed language:* ' + observed + ' (observation, not a permanent preference)');
    return lines.length ? lines.join('\n') : 'I don’t have much saved about you yet. You can add details with .myprofile update followed by what you want me to remember.';
}

export default {
    command: 'myprofile',
    aliases: ['myinfo', 'mybotprofile'],
    category: 'general',
    description: 'View and manage the information Forge Guard remembers about you.',
    usage: '.myprofile | .myprofile update <facts> | .myprofile remove <field> [value] | .myprofile clear',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const isGroup = context.isGroup ?? chatId.endsWith('@g.us');
        const senderId = context.senderId || message.key.participant || chatId;
        const scopeChatId = isGroup ? chatId : null;
        const action = String(args?.[0] || 'view').toLowerCase();

        if (action === 'update') {
            const details = args.slice(1).join(' ').trim();
            if (!details) {
                return sock.sendMessage(chatId, { text: 'Tell me what to add. Example: .myprofile update My business is Ray’s Glitz & Glam. I specialize in bridal makeup.' }, { quoted: message });
            }
            const facts = extractUserFacts(details);
            const recognized = ['businesses', 'professions', 'offerings', 'interests', 'projects', 'preferences', 'communicationStyles']
                .some(field => (facts[field] || []).length) || Boolean(facts.preferredName || facts.preferredLanguage);
            if (!recognized) {
                return sock.sendMessage(chatId, { text: 'I couldn’t identify a clear profile fact in that update. Use explicit wording such as “My business is…”, “I work as…”, “I enjoy…”, “I’m building…”, or “I prefer…”.' }, { quoted: message });
            }
            const updated = await updateUserProfileFromMessage(senderId, details, { scopeChatId });
            return sock.sendMessage(chatId, { text: '🧠 I’ve updated the profile information you explicitly shared. It will be kept in this ' + (isGroup ? 'group' : 'private chat') + ' scope.\n\n' + profileSummary(updated) }, { quoted: message });
        }

        if (action === 'remove') {
            const field = String(args?.[1] || '').toLowerCase();
            const value = args.slice(2).join(' ').trim();
            if (!field) {
                return sock.sendMessage(chatId, { text: 'Tell me which field to remove. Example: .myprofile remove interests or .myprofile remove businesses Ray’s Glitz & Glam.' }, { quoted: message });
            }
            const updated = await removeUserProfileFact(senderId, field, value, { scopeChatId });
            if (!updated) {
                return sock.sendMessage(chatId, { text: 'I couldn’t match that profile field. Try businesses, profession, interests, projects, preferences, communication, name or language.' }, { quoted: message });
            }
            return sock.sendMessage(chatId, { text: 'Updated. Here is what remains in your profile:\n\n' + profileSummary(updated) }, { quoted: message });
        }

        if (action === 'clear') {
            await clearUserProfile(senderId, { scopeChatId });
            return sock.sendMessage(chatId, { text: 'Your saved profile for this ' + (isGroup ? 'group' : 'private chat') + ' has been cleared.' }, { quoted: message });
        }

        if (action !== 'view' && action !== 'status') {
            return sock.sendMessage(chatId, { text: 'Usage: .myprofile | .myprofile update <facts> | .myprofile remove <field> [value] | .myprofile clear' }, { quoted: message });
        }
        const profile = await getUserProfile(senderId, scopeChatId);
        return sock.sendMessage(chatId, { text: '*WHAT I REMEMBER ABOUT YOU*\n\n' + profileSummary(profile) + '\n\nUse .myprofile update, remove or clear to manage this information.' }, { quoted: message });
    }
};

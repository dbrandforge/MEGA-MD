import { resolveIdentity } from '../lib/identity.js';
import { getVerifiedCreatorProfile } from '../lib/forgeKnowledge.js';
import {
    getUserProfile,
    updateUserProfileFromMessage,
    removeUserProfileFact,
    clearUserProfile,
    setUserProfileGroupSharing,
    extractUserFacts
} from '../lib/chatbotUserProfile.js';

function profileSummary(profile, identity = null) {
    const lines = [];
    const fields = [
        ['Businesses / brands', 'businesses'],
        ['Profession / role', 'professions'],
        ['Products / services', 'offerings'],
        ['Interests', 'interests'],
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
    const hasExplicitProfileFacts = lines.length > 0;
    if (identity?.role === 'creator') {
        const creator = getVerifiedCreatorProfile();
        lines.unshift('*Verified identity:* ' + creator.publicIdentity);
        lines.push('*Professional roles:* ' + creator.roles.join('; '));
        lines.push('*Professional focus:* ' + creator.professionalFocus.join('; '));
        lines.push('*BrandForge and active work:* ' + creator.activeEcosystem.join('; '));
        lines.push('*Known brand and client/project work discussed:* ' + creator.knownBrandAndClientWork.join('; '));
        lines.push('*Creative direction:* ' + creator.creativePrinciples.join('; '));
        lines.push('*Working preferences:* ' + creator.workingPreferences.join('; '));
        lines.push('*Avoid:* ' + creator.avoid.join('; '));
    }
    const observed = profile?.lastObservedLanguage;
    // Language is a conversational observation, not a meaningful personal profile by itself.
    if (observed && (hasExplicitProfileFacts || identity?.role === 'creator')) {
        lines.push('*Recently observed language:* ' + observed + ' (observation, not a permanent preference)');
    }
    if (profile?.sharing?.groupContext === true) lines.push('*Profile sharing:* You allowed your private profile facts to be used in group conversations.');
    else lines.push('*Profile sharing:* Private by default; DM facts are not used in groups.');
    if (!hasExplicitProfileFacts && identity?.role !== 'creator') lines.unshift('No personal profile facts are saved yet.');
    return lines.length ? lines.join('\n') : 'I don’t have much saved about you yet. You can add details with .myprofile update followed by what you want me to remember.';
}

export default {
    command: 'myprofile',
    aliases: ['myinfo', 'mybotprofile'],
    category: 'general',
    description: 'View and manage the information Forge Guard remembers about you.',
    usage: '.myprofile | .myprofile update <facts> | .myprofile remove <field> [value] | .myprofile privacy private|groups | .myprofile clear',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const isGroup = context.isGroup ?? chatId.endsWith('@g.us');
        const senderId = context.senderId || message.key.participant || chatId;
        const scopeChatId = isGroup ? chatId : null;
        const action = String(args?.[0] || 'view').toLowerCase();
        const identity = resolveIdentity(senderId);

        if (action === 'privacy') {
            if (isGroup) {
                return sock.sendMessage(chatId, { text: 'Change your profile-sharing preference in a private chat with me: .myprofile privacy private or .myprofile privacy groups.' }, { quoted: message });
            }
            const choice = String(args?.[1] || 'status').toLowerCase();
            if (['groups', 'group', 'on', 'share'].includes(choice)) {
                const updated = await setUserProfileGroupSharing(senderId, true);
                return sock.sendMessage(chatId, { text: 'Your private profile facts may now be used in group conversations when relevant. You can reverse this with .myprofile privacy private.\n\n' + profileSummary(updated, identity) }, { quoted: message });
            }
            if (['private', 'off', 'none'].includes(choice)) {
                const updated = await setUserProfileGroupSharing(senderId, false);
                return sock.sendMessage(chatId, { text: 'Your profile is private again. DM facts will not be used in group conversations.\n\n' + profileSummary(updated, identity) }, { quoted: message });
            }
            const profile = await getUserProfile(senderId, null);
            return sock.sendMessage(chatId, { text: 'Profile sharing: ' + (profile?.sharing?.groupContext ? 'GROUPS ENABLED' : 'PRIVATE') + '\nUse .myprofile privacy groups or .myprofile privacy private.' }, { quoted: message });
        }

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
            return sock.sendMessage(chatId, { text: '🧠 I’ve updated the profile information you explicitly shared. It will be kept in this ' + (isGroup ? 'group' : 'private chat') + ' scope.\n\n' + profileSummary(updated, identity) }, { quoted: message });
        }

        if (action === 'remove') {
            const field = String(args?.[1] || '').toLowerCase();
            const value = args.slice(2).join(' ').trim();
            if (!field) {
                return sock.sendMessage(chatId, { text: 'Tell me which field to remove. Example: .myprofile remove interests or .myprofile remove businesses Ray’s Glitz & Glam.' }, { quoted: message });
            }
            const updated = await removeUserProfileFact(senderId, field, value, { scopeChatId });
            if (!updated) {
                return sock.sendMessage(chatId, { text: 'I couldn’t match that profile field. Try businesses, profession, offerings, interests, projects, preferences, communication, name or language.' }, { quoted: message });
            }
            return sock.sendMessage(chatId, { text: 'Updated. Here is what remains in your profile:\n\n' + profileSummary(updated, identity) }, { quoted: message });
        }

        if (action === 'clear') {
            await clearUserProfile(senderId, { scopeChatId });
            return sock.sendMessage(chatId, { text: 'Your saved profile for this ' + (isGroup ? 'group' : 'private chat') + ' has been cleared.' }, { quoted: message });
        }

        if (action !== 'view' && action !== 'status') {
            return sock.sendMessage(chatId, { text: 'Usage: .myprofile | .myprofile update <facts> | .myprofile remove <field> [value] | .myprofile privacy private|groups | .myprofile clear' }, { quoted: message });
        }
        const profile = await getUserProfile(senderId, scopeChatId);
        return sock.sendMessage(chatId, { text: '*WHAT I REMEMBER ABOUT YOU*\n\n' + profileSummary(profile, identity) + '\n\nUse .myprofile update, remove or clear to manage this information.' }, { quoted: message });
    }
};

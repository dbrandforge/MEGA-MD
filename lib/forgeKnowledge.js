import config from '../config.js';
import { PRIMARY_FEATURE_GROUP } from './featureGroups.js';

const BRAND_LINKEDIN = 'https://linkedin.com/in/abraham-oyetunji';

function normalize(text = '') {
    return String(text || '').toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim();
}

function asksBrandDetails(text) {
    return /\b(?:what is|what's|tell me about|describe|explain|what do you know about|remember)\b.{0,60}\b(?:the )?brandforge\b/.test(text)
        || /\b(?:the )?brandforge\b.{0,60}\b(?:about|services|work|do|offer|company|agency|business)\b/.test(text);
}

function asksBrandSocials(text) {
    return /\b(?:brandforge|brand forge)\b.{0,70}\b(?:socials?|handles?|instagram|threads|youtube|twitter|\bx\b|pages?)\b/.test(text)
        || /\b(?:instagram|threads|youtube|twitter|\bx\b)\b.{0,50}\b(?:brandforge|brand forge|dbrandforge)\b/.test(text);
}

function asksCreatorDetails(text) {
    return /\\b(?:tell me about|describe|what do you know about|what does)\\s+(?:your creator|the founder|forge(?: dcreative)?|abraham)\\b/.test(text)
        || /\\b(?:forge dcreative|abraham)\\b.{0,50}\\b(?:work|profession|career|business|role)\\b/.test(text);
}

function asksCreatorContact(text) {
    return /\b(?:contact|reach|call|phone|whatsapp|number|mobile)\b.{0,60}\b(?:forge|creator|abraham|founder)\b/.test(text)
        || /\b(?:forge|creator|abraham|founder)\b.{0,60}\b(?:contact|reach|call|phone|whatsapp|number|mobile)\b/.test(text)
        || /\b(?:your creator|your founder|forge dcreative)\b.{0,40}\b(?:number|contact|phone|whatsapp)\b/.test(text)
        || /\b(?:your|forge'?s|creator'?s|abraham'?s|founder'?s)\s+(?:personal\s+)?(?:phone|whatsapp|mobile)?\s*number\b/.test(text);
}

export function buildGroupConversationModeContext(groupProfile, chatId = '') {
    if (!String(chatId || '').endsWith('@g.us')) return '';
    const matured = chatId === PRIMARY_FEATURE_GROUP || groupProfile?.featureSets?.maturedMinded === true;
    if (matured) {
        return [
            'GROUP CONVERSATION MODE: MATURED MINDED.',
            'This group has an adult-oriented conversational culture and may discuss mature or explicit topics.',
            'Do not force mature topics into unrelated conversations. Follow the actual topic and each participant’s current tone; never assume every member wants sexual discussion.',
            'Keep all sexual discussion strictly between consenting adults. Never sexualize minors, facilitate coercion, exploitation, harassment, or non-consensual activity.',
            'Respect a participant’s boundaries and change direction when they indicate discomfort. If a discussion is becoming personally explicit and an individual’s comfort is unclear, ask for a simple opt-in or keep it non-graphic.',
            'This group context applies only inside this group. Do not transfer its adult tone or assumptions into private chats or other groups.'
        ].join('\n');
    }
    return [
        'GROUP CONVERSATION MODE: GENERAL.',
        'Use the group’s actual conversation and configured features as context. Do not import the adult-oriented tone of another group.',
        'Follow the topic participants are actually discussing; do not assume the group is always about business.'
    ].join('\n');
}

export function buildForgeKnowledgeContext(query = '', identity = null) {
    const text = normalize(query);
    const contactRequested = asksCreatorContact(text);
    const brandRequested = asksBrandDetails(text) || asksBrandSocials(text);
    const creatorRequested = /\b(?:creator|founder|forge dcreative|abraham|who made you|who created you)\b/.test(text);
    const sections = [
        'IDENTITY SAFEGUARD: a person’s business or employer is not their personal name. Never greet someone using a business name or infer that they own a brand merely because it appears in conversation.',
        'Only state that a person owns, founded or works for a business when that relationship is explicitly confirmed in that person’s own profile.'
    ];
    if (brandRequested || creatorRequested || identity?.role === 'creator') {
        sections.push(
            'VERIFIED CREATOR AND BRANDFORGE FACTS (use these as the source of truth; do not embellish):',
            'Creator: Forge dcreative. First name: Abraham. Professional role: Creative Director. Founder of The BrandForge.',
            'Legal entity: AB BRANDFORGE ENTERPRISE. The BrandForge is a premium, strategy-led branding, creative consultancy, training and business-development organization.',
            'Its work includes brand strategy and positioning, brand identity and visual communication, creative direction and design systems, digital marketing, content and storytelling, consultancy, training, and business development.',
            'Positioning: branding is business infrastructure, not merely decoration.',
            'Preferred tagline: “Forging Brands | Fueling Growth”. Brand philosophy: “Your brand should be hard to forget.”',
            'Official BrandForge social handle: @dbrandforge on Instagram, X, Threads and YouTube.',
            'Creator LinkedIn: ' + BRAND_LINKEDIN
        );
    }
    if (contactRequested) {
        const contact = String(config.creatorContactNumber || '').replace(/\D/g, '');
        sections.push(contact
            ? 'Creator contact number (explicitly requested by the user): +' + contact + '. Share only in response to a direct contact/phone-number request; do not volunteer it in unrelated replies.'
            : 'The creator contact number is not configured in the application knowledge settings. Do not guess or substitute the bot account number.');
    }
    if (identity?.role === 'creator') {
        sections.push('CURRENT SENDER IDENTITY: verified Creator and Founder Forge. Address him as Forge. Be respectful of creator authority while keeping the established playful banter; never turn sincere appreciation into antagonistic or dismissive replies.');
    }
    return sections.join('\n');
}

export function getForgeKnowledgeReply(query = '') {
    const text = normalize(query);
    if (asksCreatorContact(text)) {
        const contact = String(config.creatorContactNumber || '').replace(/\D/g, '');
        if (contact) return 'You can reach Forge dcreative, the founder of The BrandForge, on +'+contact+'. The BrandForge is also on Instagram, X, Threads and YouTube at @dbrandforge.';
        return 'You can find The BrandForge on Instagram, X, Threads and YouTube at @dbrandforge. The creator’s direct phone contact is not configured in my verified contact records, so I won’t guess or give you the wrong number.';
    }
    if (asksCreatorDetails(text)) {
        return 'Forge dcreative is a Creative Director and the founder of The BrandForge. His work focuses on strategic branding, brand identity, visual communication, creative direction, design systems, digital strategy, content and business growth. His professional LinkedIn is https://linkedin.com/in/abraham-oyetunji.';
    }
    if (asksBrandSocials(text)) {
        return 'The BrandForge is on Instagram, X, Threads and YouTube: @dbrandforge. Forge’s professional LinkedIn is https://linkedin.com/in/abraham-oyetunji.';
    }
    if (asksBrandDetails(text)) {
        return 'The BrandForge is a premium, strategy-led branding, creative consultancy, training and business-development organization founded by Forge dcreative, a Creative Director. Its work spans brand strategy and positioning, brand identity, visual communication, creative direction, design systems, digital marketing, content, storytelling, consultancy and business development. The philosophy is that branding is business infrastructure—not just decoration. Our tagline is “Forging Brands | Fueling Growth”, and the aim is simple: your brand should be hard to forget. 😎';
    }
    return null;
}

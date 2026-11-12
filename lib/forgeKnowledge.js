import config from '../config.js';
import { PRIMARY_FEATURE_GROUP } from './featureGroups.js';

const BRAND_LINKEDIN = 'https://linkedin.com/in/abraham-oyetunji';

function normalize(text = '') {
    return String(text || '').toLowerCase()
        .replace(/[’‘`]/g, "'")
        .replace(/[^\p{L}\p{N}' ]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function asksBrandDetails(text) {
    return /\b(?:what is|what's|tell me about|describe|explain|what do you know about|remember|give me an overview of)\b.{0,80}\b(?:the )?brandforge\b/.test(text)
        || /\b(?:the )?brandforge\b.{0,80}\b(?:about|services|work|do|offer|company|agency|business|organization|organisation)\b/.test(text)
        || /\b(?:tell me about|describe|explain|what is|what's|what do you know about|give me an overview of)\b.{0,80}\b(?:the|your|our)?\s*(?:creator'?s?\s+)?(?:creators?\s+)?(?:marketing|branding|creative|brand)?\s*(?:agency|company|business|organization|organisation)\b/.test(text)
        || /\b(?:your|our)\s+(?:creators?\s+)?(?:marketing|branding|creative|brand)\s+agency\b/.test(text);
}

function asksBrandSocials(text) {
    return /\b(?:brandforge|brand forge)\b.{0,70}\b(?:socials?|handles?|instagram|threads|youtube|twitter|\bx\b|pages?)\b/.test(text)
        || /\b(?:instagram|threads|youtube|twitter|\bx\b|linkedin)\b.{0,50}\b(?:brandforge|brand forge|dbrandforge|forge|creator|founder|abraham)\b/.test(text)
        || /\b(?:your|our)\s+(?:socials?|instagram|threads|youtube|twitter|linkedin)\b/.test(text)
        || /\b(?:creator|founder|forge|abraham)\b.{0,50}\b(?:socials?|instagram|threads|youtube|twitter|linkedin)\b/.test(text);
}

function asksCreatorDetails(text) {
    // Match a person, not the substring "forge" inside the company name BrandForge.
    const mentionsCreator = /\b(?:forge(?: dcreative)?|abraham|founder|creator)\b/.test(text)
        && !/\bbrandforge\b/.test(text);
    const asksForDetails = /^(?:tell me about|describe|what do you know about|what does|who is|who's)\b/.test(text);
    return mentionsCreator && asksForDetails;
}

function asksCreatorContact(text) {
    return /\b(?:contact|reach|call|phone|whatsapp|number|mobile)\b.{0,60}\b(?:forge|creator|abraham|founder)\b/.test(text)
        || /\b(?:forge|creator|abraham|founder)\b.{0,60}\b(?:contact|reach|call|phone|whatsapp|number|mobile)\b/.test(text)
        || /\b(?:your creator|your founder|forge dcreative)\b.{0,40}\b(?:number|contact|phone|whatsapp)\b/.test(text)
        || /\b(?:your|forge'?s|creator'?s|abraham'?s|founder'?s)\s+(?:personal\s+)?(?:phone|whatsapp|mobile)?\s*number\b/.test(text)
        || /\b(?:contact|reach|call|phone|whatsapp|number|mobile)\b.{0,60}\b(?:the )?brand ?forge\b/.test(text)
        || /\b(?:brand ?forge)\b.{0,60}\b(?:contact|reach|call|phone|whatsapp|number|mobile)\b/.test(text);
}

const VERIFIED_CREATOR_PROFILE = Object.freeze({
    publicIdentity: 'Forge dcreative (Abraham), Creative Director and founder of The BrandForge; surname is private and must not be volunteered.',
    roles: ['Creative Director', 'business owner', 'marketing-agency operator', 'vibecoder'],
    organization: 'The BrandForge, operating under AB BRANDFORGE ENTERPRISE',
    professionalFocus: ['strategic branding', 'brand strategy and positioning', 'brand identity', 'visual communication', 'creative direction', 'design systems', 'digital marketing', 'content and storytelling', 'consultancy', 'training', 'business development'],
    activeEcosystem: ['The BrandForge', 'Forge Guard / FORGE BOT'],
    knownBrandAndClientWork: ['AA Yogurt', 'Ray’s Glitz & Glam', 'YOMIKUN BITES', 'HavenLynk', 'Bravoe Gadgets', 'Innis Tech', 'Apple Fix', 'Vibe Extra'],
    creativePrinciples: ['premium, modern, editorial and human-centered', 'strategy before decoration', 'concept before decoration', 'clear hierarchy and intentional whitespace', 'distinctive, commercially effective communication', 'natural and realistic human imagery'],
    workingPreferences: ['precision and continuity', 'originality and strong creative judgment', 'direct, strategic feedback', 'execution over generic advice', 'concise communication for simple tasks and depth when the work requires it'],
    avoid: ['generic AI-looking design', 'template-driven Canva aesthetics', 'clip art', 'clutter', 'invented brand assets or logos', 'unnecessary follow-up questions', 'repeating established context']
});

export function getVerifiedCreatorProfile() {
    return Object.fromEntries(Object.entries(VERIFIED_CREATOR_PROFILE).map(([key, value]) => [
        key, Array.isArray(value) ? [...value] : value
    ]));
}

export function buildGroupConversationModeContext(groupProfile, chatId = '') {
    if (!String(chatId || '').endsWith('@g.us')) return '';
    const matured = chatId === PRIMARY_FEATURE_GROUP || groupProfile?.featureSets?.maturedMinded === true;
    if (matured) {
        return [
            'GROUP CONVERSATION MODE: MATURED MINDED.',
            'This group has an adult-oriented conversational culture and may discuss mature or explicit topics.',
            'Do not force mature topics into unrelated conversations. Follow the actual topic and each participant’s current tone; never assume every member wants sexual discussion.',
            'Keep all sexual discussion strictly between consenting adults. Never sexualize minors, facilitate coercion, exploitation, harassment, or non-consensual activity. Do not assume someone is an adult based on group membership; if adult status is unclear, keep it non-graphic.',
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
    const creatorRequested = /\b(?:creator|founder|forge dcreative|abraham|who made you|who created you)\b/.test(text) || asksCreatorDetails(text);
    const sections = [
        'IDENTITY SAFEGUARD: a person’s business or employer is not their personal name. Never greet someone using a business name or infer that they own a brand merely because it appears in conversation.',
        'Only state that a person owns, founded or works for a business when that relationship is explicitly confirmed in that person’s own profile.'
    ];
    if (brandRequested) {
        sections.push(
            'VERIFIED BRANDFORGE COMPANY FACTS (answer company questions about the organization, not with the founder biography):',
            'The BrandForge operates under AB BRANDFORGE ENTERPRISE. It is a premium, strategy-led branding, creative consultancy, training and business-development organization founded by Forge dcreative (Abraham), a Creative Director.',
            'Its work includes brand strategy and positioning, brand identity, visual communication, creative direction, design systems, digital marketing, content and storytelling, consultancy, training, and business development.',
            'Positioning: branding is business infrastructure, not merely decoration.',
            'Preferred tagline: “Forging Brands | Fueling Growth”. Brand philosophy: “Your brand should be hard to forget.”',
            'Official BrandForge social handle: @dbrandforge on Instagram, X, Threads and YouTube.',
            'Creator LinkedIn: ' + BRAND_LINKEDIN,
            'Previously discussed brands and client/project work include AA Yogurt, Ray’s Glitz & Glam, YOMIKUN BITES, HavenLynk, Bravoe Gadgets, Innis Tech, Apple Fix and Vibe Extra. Do not invent case-study results or claim a specific service was delivered to a brand unless confirmed.'
        );
    }
    if (creatorRequested || identity?.role === 'creator') {
        const creator = getVerifiedCreatorProfile();
        sections.push(
            'VERIFIED CREATOR PROFILE (private creator context; use only when relevant):',
            creator.publicIdentity,
            'Professional roles: ' + creator.roles.join(', ') + '.',
            'Professional focus: ' + creator.professionalFocus.join(', ') + '.',
            'Active ecosystem: ' + creator.activeEcosystem.join(', ') + '.',
            'Creative principles: ' + creator.creativePrinciples.join('; ') + '.',
            'Working preferences: ' + creator.workingPreferences.join('; ') + '.',
            'Avoid: ' + creator.avoid.join('; ') + '.',
            'Known brands and client/project work discussed: ' + creator.knownBrandAndClientWork.join(', ') + '. Treat these as context, not permission to invent project outcomes.'
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
    // Resolve company intent before founder intent. BrandForge contains the word "forge",
    // but a company question must never collapse into a founder biography.
    if (asksBrandSocials(text)) {
        return 'The BrandForge is on Instagram, X, Threads and YouTube: @dbrandforge. Forge’s professional LinkedIn is https://linkedin.com/in/abraham-oyetunji.';
    }
    if (asksBrandDetails(text)) {
        return 'The BrandForge operates under AB BRANDFORGE ENTERPRISE. It is a premium, strategy-led branding, creative consultancy, training and business-development organization founded by Forge dcreative (Abraham), a Creative Director. It helps businesses build distinctive, strategically aligned brands through brand strategy and positioning, brand identity, visual communication, creative direction, design systems, digital marketing, content and storytelling, consultancy, training and business development. Its philosophy is that branding is business infrastructure—not just decoration. Its tagline is “Forging Brands | Fueling Growth”. The guiding principle: Your brand should be hard to forget. Previously discussed brand and client/project work includes AA Yogurt, Ray’s Glitz & Glam, YOMIKUN BITES, HavenLynk, Bravoe Gadgets, Innis Tech, Apple Fix and Vibe Extra. 😎';
    }
    if (asksCreatorDetails(text)) {
        return 'Forge dcreative (Abraham) is a Creative Director, business owner and the founder of The BrandForge. His work spans strategic branding, brand identity, visual communication, creative direction, design systems, digital strategy, content, storytelling and business growth. He is also building Forge Guard and the wider BrandForge business ecosystem. His professional LinkedIn is https://linkedin.com/in/abraham-oyetunji.';
    }
    return null;
}

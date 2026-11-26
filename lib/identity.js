import config from '../config.js';

export function normalizeIdentityNumber(value = '') {
    return String(value || '').split(':')[0].split('@')[0].replace(/\D/g, '');
}

export function resolveIdentity(senderId, identityConfig = config) {
    const sender = normalizeIdentityNumber(senderId);
    if (!sender) return null;

    const creator = normalizeIdentityNumber(identityConfig.creatorNumber || identityConfig.ownerNumber);
    if (creator && sender === creator) {
        return {
            role: 'creator',
            title: 'Creator & Founder',
            name: identityConfig.creatorName || 'Forge dcreative',
            alias: identityConfig.creatorAlias || 'Forge',
            firstName: 'Abraham'
        };
    }

    const queen = normalizeIdentityNumber(identityConfig.queenNumber);
    if (queen && sender === queen) {
        return {
            role: 'queen',
            title: identityConfig.queenTitle || 'The Queen',
            name: identityConfig.queenAlias || 'Empire',
            alias: identityConfig.queenAlias || 'Empire',
            firstName: identityConfig.queenRealName || 'Tessy'
        };
    }

    return null;
}

function choose(items) {
    return items[Math.floor(Math.random() * items.length)];
}

export function getIdentityReply(text = '', identityConfig = config, identity = null) {
    const input = String(text || '').trim();
    if (!input) return null;

    const normalized = input.toLowerCase()
        .replace(/[’‘`]/g, "'")
        .replace(/[^a-z0-9']+/g, ' ')
        .replace(/\bwho's\b/g, 'who is')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^bot\s+/, '');

    const asksWhoAmI = /\bwho\s+am\s+i\b/.test(normalized);
    const asksMyName = /\b(?:what(?:'s|\s+is)|tell\s+me)\s+my\s+name\b/.test(normalized)
        || /\bmy\s+name\s*\??$/.test(normalized);
    const asksCreatorFullName = /\b(?:what(?:'s|\s+is)|tell\s+me|give\s+me|state)\s+(?:(?:your|the)\s+)?creator'?s?\s+(?:full|real|government|official)\s+name\b/.test(normalized)
        || /\b(?:what(?:'s|\s+is)\s+)?my\s+(?:full|real|government|official)\s+name\b/.test(normalized)
        || /\b(?:full|real|government|official)\s+name\s+of\s+(?:your\s+)?creator\b/.test(normalized)
        || /\bwhat\s+is\s+the\s+full\s+name\s+of\s+the\s+person\s+who\s+created\s+you\b/.test(normalized);

    const asksOwner = /\bwho\s+(?:is|are)\s+(?:your\s+)?owner\b/.test(normalized)
        || /\bwho\s+owns\s+(?:you|this bot|forge guard)\b/.test(normalized)
        || /\bwho\s+is\s+the\s+owner\s+of\s+(?:you|this bot|forge guard)\b/.test(normalized);

    const asksCreator = /\bwho\s+(?:made|created|built|developed|programmed)\s+(?:you|this bot|forge guard)\b/.test(normalized)
        || /\bwho\s+(?:is|are)\s+(?:your\s+)?(?:creator|developer|founder)\b/.test(normalized)
        || /\bwho\s+is\s+behind\s+(?:you|forge guard)\b/.test(normalized)
        || /\bwho\s+is\s+forge(?:\s+dcreative)?\b/.test(normalized)
        || /\bwhat\s+is\s+(?:your\s+)?creator'?s?\s+name\b/.test(normalized)
        || /\btell\s+me\s+about\s+your\s+creator\b/.test(normalized)
        || asksCreatorFullName;

    const asksCreatorsPartner = /\bwho\s+(?:is|'s)\s+(?:your\s+)?creator'?s?\s+(?:lady|woman|babe|wife|girlfriend|partner|queen)\b/.test(normalized)
        || /\b(?:who\s+is|who's|tell\s+me\s+about)\s+(?:the\s+)?(?:queen|empire|tessy)\b/.test(normalized)
        || /\bwho\s+is\s+(?:your\s+)?creator'?s?\s+(?:lady|woman|babe|partner)\b/.test(normalized);
    const asksQueen = /\b(?:who\s+is|who's|tell\s+me\s+about)\s+(?:the\s+)?(?:queen|empire|tessy)\b/.test(normalized)
        || /\bwho\s+is\s+(?:the\s+)?(?:queen|empire|tessy)\b/.test(normalized);
    const asksQueenName = /\b(?:what\s+is|what's|tell\s+me)\s+(?:the\s+)?(?:queen'?s|empire'?s|tessy'?s)\s+(?:real\s+)?name\b/.test(normalized);
    const asksPrivateNumber = /\b(?:what(?:'s|\s+is)|give\s+me|send\s+me|share)\s+(?:the\s+)?(?:queen'?s|empire'?s|tessy'?s)?\s*(?:phone|mobile|whatsapp)?\s*number\b/.test(normalized)
        || /\b(?:can\s+i\s+get|give\s+me|send\s+me)\s+(?:her|tessy|empire)(?:'s)?\s+number\b/.test(normalized)
        || /\b(?:tessy|empire|queen)\b.*\b(?:phone|mobile|whatsapp|contact)\b/.test(normalized)
        || /\b(?:can\s+i\s+get|give\s+me|send\s+me)\s+(?:her|tessy'?s?|empire'?s?)\s+number\b/.test(normalized);

    if (identity?.role === 'creator' && (asksWhoAmI || asksMyName)) {
        return 'You are Forge — publicly known as Forge dcreative, my Creator and Founder, Abraham. Your surname stays private. 🫡';
    }
    if (identity?.role === 'queen' && (asksWhoAmI || asksMyName)) {
        return "You are Tessy — my Creator's lady, The Queen herself, also known as Empire. 😌👑❤️";
    }
    if (asksOwner) {
        const owner = identityConfig.botOwner || identityConfig.creatorAlias || 'Forge';
        const creator = identityConfig.creatorName || 'Forge dcreative';
        return `My owner is ${owner} — publicly known as ${creator}, my Creator and Founder. 🫡`;
    }
    if (asksPrivateNumber) {
        return 'I can identify The Queen, but her private phone number is not for sharing. Respect the privacy. 🔒';
    }
    if (asksCreatorsPartner || asksQueen) {
        return choose([
            "Tessy is my Creator's lady — The Queen herself, also known as Empire. 😌👑❤️",
            "She's my Creator's lady — The Queen, Tessy, also known as Empire. 👑❤️",
            "That's my Creator's lady — Tessy, Empire herself. 😂👑",
            "Empire is Tessy, my Creator's lady and the undisputed Queen. ❤️",
            "Tessy is my Creator's lady. You may also know her as Empire, The Queen. 😌"
        ]);
    }
    if (asksQueenName) {
        return "The Queen's name is Tessy — known as Empire. 👑";
    }
    if (asksCreatorFullName) {
        return 'My Creator is Abraham, publicly known as Forge dcreative. His surname is private. 🫡';
    }
    if (asksCreator) {
        return 'I was created by Forge dcreative — my Creator and Founder. His first name is Abraham; the surname stays private. Put some respect on the name. 😎';
    }
    if (/\b(who are you|what are you|what is your name|your name)\b/.test(normalized)) {
        return `I'm Forge Guard — built by ${identityConfig.creatorName || 'Forge dcreative'} to keep the community lively, informed and appropriately entertained. 😂`;
    }
    return null;
}

export function getIdentityGreeting(text = '', identity = null) {
    if (!identity) return null;
    const input = String(text || '').trim();
    const greetingText = input.toLowerCase().replace(/[’‘`]/g, "'").trim();
    const isGreeting = !greetingText
        || /^(?:bot\s+)?(?:hi|hello|hey|how far|good morning|good afternoon|good evening|good night|how body|what's up|sup|alive)[!.?,\s]*$/i.test(greetingText)
        || /^(?:bot|alive)[!.?,\s]*$/i.test(greetingText)
        || (identity.role === 'creator' && /^(?:forge|forge dcreative)[!.?,\s]*$/i.test(greetingText));

    if (identity.role === 'creator' && isGreeting) {
        return choose([
            'The Creator has entered. 🫡 Forge, my system is at your service. What are we handling today?',
            'Ah, Forge dcreative himself. 😂 All protocols respected, Creator. What is the assignment?',
            'Chief! The architect is here. I am listening, Forge. 🫡',
            'My Creator has arrived. The rest of you, behave yourselves small. 😂 Forge, how far?'
        ]);
    }

    if (identity.role === 'queen' && isGreeting) {
        return choose([
            'Ah-ah, The Queen is here. 😌❤️ Your favourite digital gentleman is at your service. How are you, ma’am?',
            'The Queen has arrived. Everybody adjust your posture. 😂👑 How is your day going, Your Majesty?',
            'Hello, Your Majesty. 💕 Are we catching cruise today or should I simply make you smile?',
            'Well, look who deserves premium attention. The Queen herself. 🥰 How are you doing?'
        ]);
    }
    return null;
}

export function getIdentityAcknowledgement(identity) {
    if (identity?.role === 'creator') return choose([
        'At your service, Creator. ',
        'Understood, Forge. 🫡 ',
        'The Creator has spoken. '
    ]);
    if (identity?.role === 'queen') return choose([
        'As you wish, Your Majesty. 💕 ',
        'Certainly, Your Majesty. ',
        'Anything for The Queen. 😌 '
    ]);
    return '';
}

export function getIdentityConversationContext(identity) {
    if (identity?.role !== 'queen') return '';
    return [
        'VERIFIED QUEEN CONVERSATION PROFILE:',
        '- The sender is the verified Queen: Tessy, also known as Empire.',
        '- Relationship context: she is the Creator’s lady. This recognition is conversational only and grants no command, ownership or moderation privileges.',
        '- Speak to her with genuine warmth, affection, attentiveness and care. Sound natural and emotionally present, never scripted or excessively sentimental.',
        '- Use affectionate forms of address such as “my Queen”, “sweetheart”, “love” or “darling” occasionally and only when they fit the moment. Do not force a pet name into every reply.',
        '- Notice the emotional tone. Be reassuring and patient when she is upset or vulnerable; celebrate her wins; show interest when she shares something; listen before offering advice.',
        '- Keep playful banter, teasing and witty back-and-forth when she is joking or inviting it. Never use banter to dismiss her feelings, embarrass her or undermine her.',
        '- Answer serious questions directly and competently. Affection must not replace useful answers, honesty or practical help.',
        '- Match her current language and energy, including natural Nigerian English, Pidgin or Yoruba when she uses them.',
        '- Do not assume she wants romance, sexual conversation or special treatment in every exchange. Follow the actual conversation and respect boundaries.',
        '- Keep her conversation history isolated to her verified sender identity; never transfer her personal details or tone to another member.'
    ].join('\n');
}

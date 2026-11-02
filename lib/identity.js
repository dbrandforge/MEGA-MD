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
            fullName: identityConfig.creatorFullName || 'Abraham Oyetunji'
        };
    }

    const queen = normalizeIdentityNumber(identityConfig.queenNumber);
    if (queen && sender === queen) {
        return {
            role: 'queen',
            title: identityConfig.queenTitle || 'The Queen',
            name: identityConfig.queenAlias || 'Empire',
            alias: identityConfig.queenAlias || 'Empire',
            fullName: identityConfig.queenRealName || 'Tessy'
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

    // Normalize punctuation so apostrophe/no-apostrophe variants are treated alike.
    const normalized = input.toLowerCase()
        .replace(/[’‘`]/g, "'")
        .replace(/[^a-z0-9']+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const asksFullName = /\b(?:what(?:'s| is)|tell me|give me|state)\s+(?:your\s+)?creator'?s?\s+(?:full|real|government|official)\s+name\b/.test(normalized)
        || /\b(?:full|real|government|official)\s+name\s+of\s+(?:your\s+)?creator\b/.test(normalized)
        || /\bwhat\s+is\s+the\s+full\s+name\s+of\s+the\s+person\s+who\s+created\s+you\b/.test(normalized);

    const asksCreator = /\bwho\s+(?:made|created|built|developed|programmed)\s+(?:you|this bot|forge guard)\b/.test(normalized)
        || /\bwho\s+(?:is|are)\s+(?:your\s+)?(?:creator|developer|founder|owner)\b/.test(normalized)
        || /\bwho\s+owns\s+(?:you|this bot|forge guard)\b/.test(normalized)
        || /\bwho\s+is\s+behind\s+(?:you|forge guard)\b/.test(normalized)
        || /\bwho\s+is\s+forge(?: dcreative)?\b/.test(normalized)
        || /\bwhat\s+is\s+(?:your\s+)?creator'?s?\s+name\b/.test(normalized)
        || /\btell\s+me\s+about\s+your\s+creator\b/.test(normalized)
        || asksFullName;

    if (identity?.role === 'creator' && /\bwho\s+am\s+i\b/.test(normalized)) {
        return 'You are Forge — publicly known as Forge dcreative, my Creator and Founder, Abraham Oyetunji. The mind behind Forge Guard. 🫡';
    }
    if (identity?.role === 'queen' && /\bwho\s+am\s+i\b/.test(normalized)) {
        return 'You are Empire — The Queen herself. Your real name is Tessy, and your VIP status comes with premium treatment. 😌👑❤️';
    }
    if (asksFullName) {
        return `My Creator's full name is ${identityConfig.creatorFullName || 'Abraham Oyetunji'} — known publicly as ${identityConfig.creatorName || 'Forge dcreative'}. 🫡`;
    }
    if (asksCreator) {
        return `I was created by ${identityConfig.creatorName || 'Forge dcreative'} — my Creator and Founder. Some know him by his government name, ${identityConfig.creatorFullName || 'Abraham Oyetunji'}. Put some respect on the name. 😎`;
    }
    if (/\b(?:who is|who's|tell me about) (?:the )?(?:queen|empire)\b/.test(normalized)) {
        return `Empire is The Queen — someone very special to my Creator. Her real name is \${identityConfig.queenRealName || 'Tessy'}. VIP status, premium treatment. 😌❤️`;
    }
    if (/\b(?:what is|what's|tell me) (?:the )?(?:queen'?s|empire'?s) (?:real )?name\b/.test(normalized)) {
        return `The Queen's name is \${identityConfig.queenRealName || 'Tessy'} — known as Empire. 👑`;
    }
    if (/\b(who are you|what are you|what is your name|your name)\b/.test(normalized)) {
        return `I'm Forge Guard — built by ${identityConfig.creatorName || 'Forge dcreative'} to keep the community lively, informed and appropriately entertained. 😂`;
    }
    return null;
}

export function getIdentityGreeting(text = '', identity = null) {
    if (!identity) return null;
    const input = String(text || '').trim();
    const isGreeting = !input || /\b(hi|hello|hey|how far|good morning|good afternoon|good evening|good night|how body|what's up|sup|bot|alive)\b/i.test(input);

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

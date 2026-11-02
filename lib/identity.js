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
            fullName: identityConfig.creatorFullName || 'Abraham Oyetunji'
        };
    }

    const queen = normalizeIdentityNumber(identityConfig.queenNumber);
    if (queen && sender === queen) {
        return {
            role: 'queen',
            title: identityConfig.queenTitle || 'The Queen',
            name: identityConfig.queenTitle || 'The Queen'
        };
    }

    return null;
}

function choose(items) {
    return items[Math.floor(Math.random() * items.length)];
}

export function getIdentityReply(text = '', identityConfig = config) {
    const input = String(text || '').trim();
    if (!input) return null;

    const asksCreator = /\b(who (?:made|created|built|developed|programmed) (?:you|this bot|forge guard)|who (?:is|are) (?:your )?(?:creator|developer|founder|owner)|who owns (?:you|this bot|forge guard)|who is behind (?:you|forge guard)|who is forge guard|what is (?:your )?creator(?:'s)? name|tell me (?:about )?your creator)\b/i.test(input)
        || /\b(who is forge|who is forge dcreative)\b/i.test(input);
    const asksFullName = /\b(real name|full name|government name|official name|creator's name|creator name)\b/i.test(input);

    if (asksCreator && asksFullName) {
        return `My creator is ${identityConfig.creatorName || 'Forge dcreative'}, also known as ${identityConfig.creatorFullName || 'Abraham Oyetunji'}. The mind behind Forge Guard. 🫡`;
    }
    if (asksCreator) {
        return `I was created by ${identityConfig.creatorName || 'Forge dcreative'} — my Creator and Founder. Some know him by his government name, ${identityConfig.creatorFullName || 'Abraham Oyetunji'}. Put some respect on the name. 😎`;
    }
    if (/\b(who is the queen|who's the queen|who is your queen|who is queen)\b/i.test(input)) {
        return 'The Queen is someone very special to my Creator. VIP status, premium treatment. The rest of the details stay private. 😌❤️';
    }
    if (/\b(who are you|what are you|what is your name|your name)\b/i.test(input)) {
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

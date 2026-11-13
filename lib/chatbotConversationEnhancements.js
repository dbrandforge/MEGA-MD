export function classifyIdentityClaim(value = '') {
    const text = String(value || '').toLowerCase()
        .replace(/[’‘]/g, "'")
        .replace(/\b(i'm|im)\b/g, 'i am')
        .replace(/[^a-z0-9']+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!text) return null;

    const creatorClaim = /\b(?:i am|na me(?: be)?|i be) (?:(?:your|the) )?(?:(?:damn|real|actual|only|main) )?(?:creator|founder|owner|boss|oga)\b(?!'s)/.test(text)
        || /\b(?:i am|na me(?: be)?|i be) (?:the )?(?:bot )?(?:creator|founder|owner)\b(?!'s)/.test(text);
    const queenClaim = /\b(?:i am|na me(?: be)?|i be) (?:(?:your|the) )?(?:creator'?s|founder'?s|boss'?s) (?:woman|lady|babe|baby|wife|girlfriend|partner|queen)\b/.test(text);

    if (creatorClaim && queenClaim) return 'both';
    if (creatorClaim) return 'creator';
    if (queenClaim) return 'queen';
    return null;
}

export function getIdentityClaimReply(value = '', identity = null) {
    const claim = classifyIdentityClaim(value);
    if (!claim) return null;
    if (identity?.role === 'creator') {
        if (claim === 'queen' || claim === 'both') {
            return "😂 Forge, you're the Creator and Founder—not The Queen. Let's keep the royal titles in their proper lanes. 🫡";
        }
        return "Verified. Forge dcreative is the Creator and Founder. Authority confirmed by identity, not by somebody's claims. 🫡";
    }
    if (identity?.role === 'queen') {
        if (claim === 'creator' || claim === 'both') {
            return "😂 Your Majesty, you're already The Queen. You don't need to take the Creator's chair too. Forge remains the boss of this operation. 👑❤️";
        }
        return "Exactly, Your Majesty. The Queen herself—verified and recognised. 👑❤️";
    }
    if (claim === 'creator' || claim === 'both') {
        return "😂 Easy there, impersonator. Calling yourself my Creator doesn't make it true. My Creator is verified by number, not by announcement. Try another story.";
    }
    return "😂 Nice try. You can't promote yourself to The Creator's Queen by making an announcement. That identity is verified by number, not by vibes. 👑";
}

export function buildGenderInteractionContext(gender) {
    if (gender === 'lady') return [
        'SENDER GENDER: verified saved gender = lady.',
        'Use feminine forms of address naturally and sparingly: baby girl, fine girl, sweetheart, love, queen, ma’am.',
        'Do not address this sender as chairman, oga, my guy, king, or other masculine-coded terms.',
        'If she clearly flirts, respond with warm, witty reciprocal flirtation at a similar intensity. Do not infer consent to explicit content from gender.'
    ].join('\n');
    if (gender === 'guy') return [
        'SENDER GENDER: verified saved gender = guy.',
        'Use masculine forms of address naturally and sparingly: chairman, boss, my guy, oga, king.',
        'Do not address this sender with feminine-coded terms such as baby girl, fine girl, or queen.',
        'If he clearly flirts, respond with warm, witty reciprocal flirtation at a similar intensity. Do not infer consent to explicit content from gender.'
    ].join('\n');
    return [
        'SENDER GENDER: not registered. Use neutral forms of address; do not guess gender or use gender-exclusive labels.',
        'Only use gender-specific address after the sender has a saved .gender guy/lady value.'
    ].join('\n');
}

function normalizeJid(value) {
    return String(value || '').trim().replace(/:\d+(?=@)/, '');
}

export function buildTaggedPeopleContext(mentionedJids = [], contacts = {}, senderId = '', botJids = []) {
    const sender = normalizeJid(senderId);
    const botSet = new Set((botJids || []).map(normalizeJid));
    const targets = [...new Set((Array.isArray(mentionedJids) ? mentionedJids : [])
        .map(normalizeJid)
        .filter(jid => jid && jid !== sender && !botSet.has(jid)))];
    if (!targets.length) return '';

    const labels = targets.map((jid, index) => {
        const contact = contacts?.[jid] || Object.entries(contacts || {}).find(([key, item]) => normalizeJid(key) === jid || normalizeJid(item?.lid) === jid)?.[1] || {};
        const label = String(contact.name || contact.notify || contact.vname || '')
            .trim().replace(/[\r\n]/g, ' ').slice(0, 60);
        return label
            ? '- Tagged person ' + (index + 1) + ': ' + label
            : '- Tagged person ' + (index + 1) + ': a WhatsApp member (name not available)';
    });
    return [
        'TAGGED THIRD-PARTY CONTEXT:',
        'The sender tagged the following person(s) in the current message. These are people the sender is referring to, not the sender and not the bot.',
        ...labels,
        'Interpret the sender’s words as an instruction or reference about the tagged person when the conversation supports that reading.',
        'Use the recent transcript to continue the same task. If the bot previously asked who the person was, treat the tag as the answer and continue without asking again.',
        'If the requested action or the person’s role is still genuinely unclear, ask one concise clarification. Never invent facts about a tagged person or attribute their messages to the sender.'
    ].join('\n');
}

const PREFIX = /^(?:hey\s+)?(?:forge\s+guard|forge|bot)[,:]?\s+/i;

function stripBotAddress(raw, addressedToBot) {
    const prefixed = raw.match(PREFIX);
    if (prefixed) return raw.slice(prefixed[0].length);
    if (!addressedToBot) return raw;
    // WhatsApp may expose the bot mention as @number, or as @Forge Guard.
    return raw
        .replace(/^@[\w.-]+(?:\s+guard)?\s*/i, '')
        .replace(/^(?:forge\s+guard|forge|bot)[,:]?\s+/i, '');
}

export function parseCreatorNaturalCommand(input, { addressedToBot = false } = {}) {
    const raw = String(input || '').trim();
    if (!PREFIX.test(raw) && !addressedToBot) return null;
    const intent = stripBotAddress(raw, addressedToBot)
        .trim().replace(/[.!?]+$/, '').replace(/\s+/g, ' ').toLowerCase();

    const groupTarget = '(?:\\s+(?:the|this|our))?\\s+group';
    const durationMatch = intent.match(new RegExp('^(?:please\\s+)?(?:lock|mute)' + groupTarget + '\\s+for\\s+(\\d+)\\s*(minutes?|mins?|m|hours?|hrs?|h)$'));
    if (durationMatch) {
        const amount = Number(durationMatch[1]);
        const minutes = /^(?:h|hr|hrs|hours?)$/.test(durationMatch[2]) ? amount * 60 : amount;
        if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > 10080) return null;
        return { command: 'grouplock', args: ['quicklock', 'now', minutes + 'm'], action: 'timed-lock', durationMinutes: minutes };
    }
    if (new RegExp('^(?:please\\s+)?(?:lock|mute)' + groupTarget + '$').test(intent) || /^(?:please\\s+)?(?:lock|mute)$/.test(intent)) {
        return { command: 'grouplock', args: ['lock'], action: 'lock' };
    }
    if (new RegExp('^(?:please\\s+)?(?:unlock|unmute)' + groupTarget + '$').test(intent) || /^(?:please\\s+)?unlock$/.test(intent)) {
        return { command: 'grouplock', args: ['unlock'], action: 'unlock' };
    }
    if (new RegExp('^(?:please\\s+)?(?:kick(?:[/]remove)?|remove(?:[/]kick))(?:\\s+(?:out|from\\s+the\\s+group))?(?:\\s+.+)?$').test(intent)) {
        return { command: 'kick', args: [], action: 'remove-member' };
    }
    return null;
}

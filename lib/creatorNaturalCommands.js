const PREFIX = /^(?:hey\s+)?(?:forge\s+guard|forge|bot)[,:]?\s+/i;

export function parseCreatorNaturalCommand(input, { addressedToBot = false } = {}) {
    const raw = String(input || '').trim();
    const match = raw.match(PREFIX);
    if (!match && !addressedToBot) return null;
    const intent = (match ? raw.slice(match[0].length) : raw.replace(/^@[\\w.-]+\\s*/, ''))
        .trim().replace(/[.!?]+$/, '').replace(/\s+/g, ' ').toLowerCase();

    const durationMatch = intent.match(/^(?:please\s+)?(?:lock|mute)(?:\s+the)?\s+group\s+for\s+(\d+)\s*(minutes?|mins?|m|hours?|hrs?|h)$/);
    if (durationMatch) {
        const amount = Number(durationMatch[1]);
        const minutes = /^(?:h|hr|hrs|hours?)$/.test(durationMatch[2]) ? amount * 60 : amount;
        if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > 10080) return null;
        return { command: 'grouplock', args: ['quicklock', 'now', minutes + 'm'], action: 'timed-lock', durationMinutes: minutes };
    }
    if (/^(?:please\s+)?(?:lock|mute)(?:\s+the)?\s+group$/.test(intent) || /^(?:please\s+)?(?:lock|mute)$/.test(intent)) {
        return { command: 'grouplock', args: ['lock'], action: 'lock' };
    }
    if (/^(?:please\s+)?(?:unlock|unmute)(?:\s+the)?\s+group$/.test(intent) || /^(?:please\s+)?unlock$/.test(intent)) {
        return { command: 'grouplock', args: ['unlock'], action: 'unlock' };
    }
    if (/^(?:please\s+)?(?:kick(?:[/]remove)?|remove(?:[/]kick))(?:\s+(?:out|from\s+the\s+group))?(?:\s+.+)?$/.test(intent)) {
        return { command: 'kick', args: [], action: 'remove-member' };
    }
    return null;
}

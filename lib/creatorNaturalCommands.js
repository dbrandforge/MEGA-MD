const PREFIX = /^(?:hey\s+)?(?:forge\s+guard|forge|bot)[,:]?\s+/i;

export function parseCreatorNaturalCommand(input) {
    const raw = String(input || '').trim();
    const match = raw.match(PREFIX);
    if (!match) return null;
    const intent = raw.slice(match[0].length).trim().replace(/[.!?]+$/, '').replace(/\s+/g, ' ').toLowerCase();
    if (/^(?:please\s+)?lock(?:\s+the)?\s+group$/.test(intent) || /^(?:please\s+)?lock$/.test(intent)) {
        return { command: 'grouplock', args: ['lock'], action: 'lock' };
    }
    if (/^(?:please\s+)?unlock(?:\s+the)?\s+group$/.test(intent) || /^(?:please\s+)?unlock$/.test(intent)) {
        return { command: 'grouplock', args: ['unlock'], action: 'unlock' };
    }
    if (/^(?:please\s+)?(?:kick(?:[/]remove)?|remove(?:[/]kick)?)(?:\s+(?:out|from\s+the\s+group))?(?:\s+.+)?$/.test(intent)) {
        return { command: 'kick', args: [], action: 'remove-member' };
    }
    return null;
}

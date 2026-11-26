import { describe, expect, it } from 'vitest';
import { parseCreatorNaturalCommand } from '../../lib/creatorNaturalCommands.js';

describe('explicit PICK YOUR SIN opening', () => {
    it.each(['open picksin', 'open Pick Your Sin', 'open Pick Your Sin game'])('routes %s to .picksin open', input => {
        expect(parseCreatorNaturalCommand(input, { addressedToBot: true })).toMatchObject({
            command: 'picksin', args: ['open'], action: 'open-game', game: 'picksin'
        });
    });
});

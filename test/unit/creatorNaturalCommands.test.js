import { describe, expect, it } from 'vitest';
import { parseCreatorNaturalCommand } from '../../lib/creatorNaturalCommands.js';

describe('creator natural-language command parser', () => {
    it('maps a group lock request to the existing grouplock command', () => {
        expect(parseCreatorNaturalCommand('bot lock the group')).toEqual({ command: 'grouplock', args: ['lock'], action: 'lock' });
    });

    it('maps an unlock request to the existing grouplock command', () => {
        expect(parseCreatorNaturalCommand('Forge Guard, please unlock the group')).toEqual({ command: 'grouplock', args: ['unlock'], action: 'unlock' });
    });

    it('maps kick and remove requests without inventing a target', () => {
        expect(parseCreatorNaturalCommand('bot kick @member')).toEqual({ command: 'kick', args: [], action: 'remove-member' });
        expect(parseCreatorNaturalCommand('bot kick/remove @member')).toEqual({ command: 'kick', args: [], action: 'remove-member' });
        expect(parseCreatorNaturalCommand('bot remove this person')).toEqual({ command: 'kick', args: [], action: 'remove-member' });
    });

    it('does not interpret unrelated conversation as an action', () => {
        expect(parseCreatorNaturalCommand('bot what is the weather?')).toBeNull();
        expect(parseCreatorNaturalCommand('lock the group')).toBeNull();
    });
});

import { describe, expect, it } from 'vitest';
import { parseCreatorNaturalCommand } from '../../lib/creatorNaturalCommands.js';

describe('creator gender-tag and duration commands', () => {
    it.each([['tag ladies', 'ladies'], ['tag all ladies', 'ladies'], ['tag guys', 'guys'], ['tag all guys', 'guys']])('routes %s to saved-gender tagging', (input, gender) => {
        expect(parseCreatorNaturalCommand(input, { addressedToBot: true })).toMatchObject({ command: 'tag', args: [gender], action: 'tag-gender', gender });
    });
    it('routes mute durations without treating them as a member target', () => {
        expect(parseCreatorNaturalCommand('mute 10m', { addressedToBot: true })).toMatchObject({ command: 'mute', args: ['10m'], action: 'soft-mute-member' });
        expect(parseCreatorNaturalCommand('mute 10 minutes', { addressedToBot: true })).toMatchObject({ command: 'mute', args: ['10m'], action: 'soft-mute-member' });
    });
});

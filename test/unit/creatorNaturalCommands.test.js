import { describe, expect, it } from 'vitest';
import { parseCreatorNaturalCommand } from '../../lib/creatorNaturalCommands.js';

describe('creator natural-language command routing', () => {
    it('parses prefixed group lock and unlock instructions', () => {
        expect(parseCreatorNaturalCommand('Bot, lock the group')).toMatchObject({
            command: 'grouplock', args: ['lock'], action: 'lock'
        });
        expect(parseCreatorNaturalCommand('Forge Guard unlock the group')).toMatchObject({
            command: 'grouplock', args: ['unlock'], action: 'unlock'
        });
    });

    it('parses timed group locks as immediate one-off locks', () => {
        expect(parseCreatorNaturalCommand('Bot, mute the group for 30 minutes')).toMatchObject({
            command: 'grouplock', args: ['quicklock', 'now', '30m'], action: 'timed-lock', durationMinutes: 30
        });
        expect(parseCreatorNaturalCommand('lock the group for 2 hours')).toBeNull();
        expect(parseCreatorNaturalCommand('Bot lock the group for 2 hours')).toMatchObject({
            args: ['quicklock', 'now', '120m'], durationMinutes: 120
        });
    });

    it('accepts unprefixed instructions only when the message is addressed to the bot', () => {
        expect(parseCreatorNaturalCommand('lock the group')).toBeNull();
        expect(parseCreatorNaturalCommand('lock the group', { addressedToBot: true })).toMatchObject({
            command: 'grouplock', args: ['lock']
        });
        expect(parseCreatorNaturalCommand('mute the group for 30 minutes', { addressedToBot: true })).toMatchObject({
            args: ['quicklock', 'now', '30m']
        });
    });

    it('does not turn unrelated conversation into commands', () => {
        expect(parseCreatorNaturalCommand('Bot, what is the weather?')).toBeNull();
        expect(parseCreatorNaturalCommand('hello everyone', { addressedToBot: true })).toBeNull();
    });
});

import { describe, expect, it } from 'vitest';
import { parseCreatorNaturalCommand, parseHumanDuration } from '../../lib/creatorNaturalCommands.js';

describe('creator natural-language command routing', () => {
    it('requires a bot prefix, mention, or reply context', () => {
        expect(parseCreatorNaturalCommand('lock the group')).toBeNull();
        expect(parseCreatorNaturalCommand('hello everyone', { addressedToBot: true })).toBeNull();
        expect(parseCreatorNaturalCommand('Bot, what is the weather?')).toBeNull();
    });

    it('routes group controls and timed locks without changing their timing semantics', () => {
        expect(parseCreatorNaturalCommand('Bot, lock the group')).toMatchObject({ command: 'grouplock', args: ['lock'] });
        expect(parseCreatorNaturalCommand('Forge Guard unlock the group')).toMatchObject({ command: 'grouplock', args: ['unlock'] });
        expect(parseCreatorNaturalCommand('Bot mute the group for 30 minutes')).toMatchObject({
            command: 'grouplock', args: ['quicklock', 'now', '30m'], action: 'timed-lock', durationMinutes: 30
        });
        expect(parseCreatorNaturalCommand('lock this group for 2 hours', { addressedToBot: true })).toMatchObject({
            args: ['quicklock', 'now', '120m'], durationMinutes: 120
        });
    });

    it.each([
        ['send me the activities of the day', 'activity', []],
        ['show me all activities', 'activities', []],
        ['show me the full list of all activities', 'activities', []],
        ['send the full activity schedule', 'activities', []],
        ['list all group activities', 'activities', []],
        ['remove @user', 'kick', []],
        ['kick @user', 'kick', []],
        ['tag @all', 'tagall', []],
        ['mute @user', 'mute', []],
        ['unmute @user', 'unmute', []],
        ['lock games', 'gamelock', ['on']],
        ['unlock games', 'gamelock', ['off']],
        ['bypass TOD for an hour', 'bypass', ['tod', '60m']],
        ['schedule the group lock for an hour', 'grouplock', ['quicklock', 'now', '60m']],
        ['start trivia game', 'trivia', ['mixed']],
        ['start maths game', 'math', []],
        ['start truth or dare', 'tod', []],
        ['start hot seat', 'hotseat', []],
        ['start hangman', 'hangman', []],
        ['end truth or dare', 'endtod', []],
        ['end basket game', 'endbasket', []],
        ['end hot seat', 'endhotseat', []],
    ])('maps "%s" to the registered command and arguments', (phrase, command, args) => {
        expect(parseCreatorNaturalCommand(phrase, { addressedToBot: true })).toMatchObject({ command, args });
    });

    it.each([
        ['I need you to remove @user', 'kick', []],
        ['I want you to start trivia', 'trivia', ['mixed']],
        ['Could you lock this group for 2 hours?', 'grouplock', ['quicklock', 'now', '120m']],
        ['Do me a favour and tag everyone', 'tagall', []],
        ["Let's start hot seat", 'hotseat', []],
        ['When you get a chance, send me the activities of the day', 'activity', []],
        ['Please show me all activities', 'activities', []],
        ['Also, unlock games', 'gamelock', ['off']],
        ['Can we start trivia?', 'trivia', ['mixed']],
        ['Please, start hangman', 'hangman', []],
        ['I was hoping you could lock the group', 'grouplock', ['lock']]
    ])('understands conversational instruction "%s"', (phrase, command, args) => {
        expect(parseCreatorNaturalCommand(phrase, { addressedToBot: true })).toMatchObject({ command, args });
    });

    it('routes creator-only plain group instructions when the caller authenticates creator identity', () => {
        expect(parseCreatorNaturalCommand('Lock the group', { addressedToBot: true })).toMatchObject({
            command: 'grouplock', args: ['lock']
        });
        expect(parseCreatorNaturalCommand('Bot lock the group')).toMatchObject({
            command: 'grouplock', args: ['lock']
        });
    });

    it('routes the overloaded .remove alias to member removal only when a member is targeted', () => {
        expect(parseCreatorNaturalCommand('.remove @user', { addressedToBot: true })).toMatchObject({
            command: 'kick', action: 'remove-member'
        });
        expect(parseCreatorNaturalCommand('.remove 5', { addressedToBot: true })).toBeNull();
        expect(parseCreatorNaturalCommand('.remove 5 messages', { addressedToBot: true })).toBeNull();
    });

    it('maps voice-mode natural language to the setting command', () => {
        expect(parseCreatorNaturalCommand('Enable voicemode', { addressedToBot: true })).toMatchObject({
            command: 'voicemode', args: ['on'], action: 'voice-mode-on'
        });
        expect(parseCreatorNaturalCommand('Disable voice mode', { addressedToBot: true })).toMatchObject({
            command: 'voicemode', args: ['off'], action: 'voice-mode-off'
        });
    });

    it('converts a Lagos clock deadline into a one-off lock duration', () => {
        const now = new Date('2026-11-26T06:00:00.000Z'); // 07:00 in Lagos
        expect(parseCreatorNaturalCommand('lock the group till 8am', { addressedToBot: true, now })).toMatchObject({
            command: 'grouplock',
            args: ['quicklock', 'now', '60m'],
            action: 'timed-lock',
            durationMinutes: 60,
            untilClock: true
        });
    });

    it('understands the spoken maths-game phrasing', () => {
        expect(parseCreatorNaturalCommand('start trivia game maths', { addressedToBot: true })).toMatchObject({
            command: 'math',
            args: [],
            action: 'start-game'
        });
    });

    it('routes trivia defaults, maths grades and PICK YOUR SIN conversational starts', () => {
        expect(parseCreatorNaturalCommand('Start trivia game', { addressedToBot: true })).toMatchObject({ command: 'trivia', args: ['mixed'] });
        expect(parseCreatorNaturalCommand('Start trivia maths game easy', { addressedToBot: true })).toMatchObject({ command: 'math', args: ['easy'] });
        expect(parseCreatorNaturalCommand('Starts trivia maths easy', { addressedToBot: true })).toMatchObject({ command: 'math', args: ['easy'] });
        expect(parseCreatorNaturalCommand('Start picksin', { addressedToBot: true })).toMatchObject({ command: 'picksin', args: ['start'] });
        expect(parseCreatorNaturalCommand('Start Pick Your Sin', { addressedToBot: true })).toMatchObject({ command: 'picksin', args: ['start'] });
    });

    it('asks which game to end when the creator says only “end game”', () => {
        expect(parseCreatorNaturalCommand('end game', { addressedToBot: true })).toMatchObject({
            action: 'clarify',
            clarification: expect.stringContaining('Which game should I end')
        });
    });

    it('routes per-game locks and message scheduling', () => {
        expect(parseCreatorNaturalCommand('lock trivia game', { addressedToBot: true })).toMatchObject({
            command: 'gamelock', args: ['trivia', 'on']
        });
        expect(parseCreatorNaturalCommand('schedule in 30 minutes send group meeting starts now', { addressedToBot: true })).toMatchObject({
            command: 'schedule', args: ['30m', 'group meeting starts now']
        });
    });

    it('accepts WhatsApp bot mentions and bot-message replies', () => {
        expect(parseCreatorNaturalCommand('@2348012345678 mute the group for 30 minutes', { addressedToBot: true })).toMatchObject({
            args: ['quicklock', 'now', '30m'], action: 'timed-lock'
        });
        expect(parseCreatorNaturalCommand('tag everyone', { addressedToBot: true })).toMatchObject({
            command: 'tagall'
        });
    });

    it('rejects invalid or excessive durations rather than guessing', () => {
        expect(parseCreatorNaturalCommand('Bot bypass TOD for 0 hours')).toBeNull();
        expect(parseCreatorNaturalCommand('Bot bypass TOD for 200 hours')).toBeNull();
        expect(parseCreatorNaturalCommand('Bot lock group for 200 hours')).toBeNull();
    });

    it.each([
        ['Lock the group for 1 hour and 50 minutes', 110],
        ['Could you lock this group for 1h 50m?', 110],
        ['Please lock the group for one hour and fifty minutes', 110],
        ['Schedule the group lock for 2 days and 3 hours', 3060]
    ])('parses compound lock duration in "%s"', (phrase, minutes) => {
        expect(parseCreatorNaturalCommand(phrase, { addressedToBot: true })).toMatchObject({
            command: 'grouplock',
            args: ['quicklock', 'now', minutes + 'm'],
            action: 'timed-lock',
            durationMinutes: minutes
        });
    });

    it.each([
        'How do I lock the group for two hours?',
        'Can you tell me how to lock the group?',
        'What happens if I lock the group?',
        'What do you think about locking the group?',
        'Should we lock the group?'
    ])('keeps informational question "%s" in the chatbot lane', phrase => {
        expect(parseCreatorNaturalCommand(phrase, { addressedToBot: true })).toBeNull();
    });

    it('parses compound durations directly and rejects unsupported trailing text', () => {
        expect(parseHumanDuration('1 hour and 50 minutes')).toBe(110);
        expect(parseHumanDuration('one hour fifty minutes')).toBe(110);
        expect(parseHumanDuration('1d 2h 15m')).toBe(1575);
        expect(parseHumanDuration('1 hour and then maybe later')).toBeNull();
        expect(parseHumanDuration('200 hours')).toBeNull();
    });

});

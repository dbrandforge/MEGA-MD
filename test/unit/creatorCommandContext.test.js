import { afterEach, describe, expect, it } from 'vitest';
import {
    clearAllPendingCreatorCommands,
    clearPendingCreatorCommand,
    getPendingCreatorCommand,
    setPendingCreatorCommand
} from '../../lib/creatorCommandContext.js';

describe('creator command clarification context', () => {
    afterEach(() => clearAllPendingCreatorCommands());

    it('keeps a clarification scoped to the same creator and chat', () => {
        setPendingCreatorCommand('creator@s.whatsapp.net', 'group@g.us', 'end game', 'Which game?');
        expect(getPendingCreatorCommand('creator@s.whatsapp.net', 'group@g.us')).toMatchObject({
            instruction: 'end game', clarification: 'Which game?'
        });
        expect(getPendingCreatorCommand('creator@s.whatsapp.net', 'other@g.us')).toBeNull();
        expect(getPendingCreatorCommand('other@s.whatsapp.net', 'group@g.us')).toBeNull();
    });

    it('expires pending clarification context after ten minutes', () => {
        setPendingCreatorCommand('creator', 'chat', 'start game', 'Which game?', 1000);
        expect(getPendingCreatorCommand('creator', 'chat', 1000 + 10 * 60 * 1000)).toBeNull();
    });

    it('clears context after the clarification is resolved', () => {
        setPendingCreatorCommand('creator', 'chat', 'end game', 'Which game?');
        expect(clearPendingCreatorCommand('creator', 'chat')).toBe(true);
        expect(getPendingCreatorCommand('creator', 'chat')).toBeNull();
    });
});

import { describe, expect, it } from 'vitest';
import { normalizeCreatorCommandMessage } from '../../lib/creatorCommandMessage.js';

describe('creator command message normalization', () => {
    it('normalizes conversation text while preserving the original message object', () => {
        const source = { key: { id: 'one' }, message: { conversation: 'please remove @user' } };
        const normalized = normalizeCreatorCommandMessage(source, { command: 'kick', args: [] });
        expect(normalized.message.conversation).toBe('.kick');
        expect(source.message.conversation).toBe('please remove @user');
    });

    it('normalizes extended text while preserving mentions and quoted targets', () => {
        const contextInfo = { mentionedJid: ['123@s.whatsapp.net'], participant: '456@s.whatsapp.net' };
        const source = { message: { extendedTextMessage: { text: 'remove this person', contextInfo } } };
        const normalized = normalizeCreatorCommandMessage(source, { command: 'kick', args: [] });
        expect(normalized.message.extendedTextMessage.text).toBe('.kick');
        expect(normalized.message.extendedTextMessage.contextInfo).toBe(contextInfo);
    });

    it('passes model-derived arguments to plugins that parse raw command text', () => {
        const source = { message: { conversation: 'I need you to delete the last three messages' } };
        const normalized = normalizeCreatorCommandMessage(source, { command: 'delete', args: ['3'] }, '!');
        expect(normalized.message.conversation).toBe('!delete 3');
    });

    it('normalizes media captions without discarding media metadata', () => {
        const source = { message: { imageMessage: { caption: 'tag everyone', mimetype: 'image/jpeg' } } };
        const normalized = normalizeCreatorCommandMessage(source, { command: 'tagall', args: [] });
        expect(normalized.message.imageMessage).toMatchObject({ caption: '.tagall', mimetype: 'image/jpeg' });
    });
});

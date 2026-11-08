import { describe, expect, it } from 'vitest';
import {
    createKeyedSerialExecutor,
    getConversationMemoryKey,
    normalizeConversationParticipant
} from '../../lib/chatbotConversationMemory.js';

describe('Forge Guard individual conversation memory scopes', () => {
    it('isolates different participants inside the same group', () => {
        const forge = getConversationMemoryKey({
            chatId: '120363000000000000@g.us',
            senderId: '2348011111111@s.whatsapp.net',
            isGroup: true
        });
        const member = getConversationMemoryKey({
            chatId: '120363000000000000@g.us',
            senderId: '2348022222222@s.whatsapp.net',
            isGroup: true
        });
        expect(forge).not.toBe(member);
        expect(forge).toContain('group:120363000000000000@g.us:user:2348011111111@s.whatsapp.net');
    });

    it('keeps one participant separate across different groups', () => {
        const senderId = '2348011111111@s.whatsapp.net';
        const first = getConversationMemoryKey({ chatId: 'group-a@g.us', senderId, isGroup: true });
        const second = getConversationMemoryKey({ chatId: 'group-b@g.us', senderId, isGroup: true });
        expect(first).not.toBe(second);
    });

    it('uses an individual DM scope rather than a shared group scope', () => {
        const first = getConversationMemoryKey({
            chatId: '2348011111111@s.whatsapp.net',
            senderId: '2348011111111@s.whatsapp.net',
            isGroup: false
        });
        const second = getConversationMemoryKey({
            chatId: '2348022222222@s.whatsapp.net',
            senderId: '2348022222222@s.whatsapp.net',
            isGroup: false
        });
        expect(first).not.toBe(second);
        expect(first).toBe('dm:2348011111111@s.whatsapp.net');
    });

    it('normalizes Baileys device-qualified JIDs to the same participant identity', () => {
        expect(normalizeConversationParticipant('2348011111111:7@s.whatsapp.net'))
            .toBe('2348011111111@s.whatsapp.net');
    });

    it('refuses to create a shared group-memory key without a participant identity', () => {
        expect(getConversationMemoryKey({
            chatId: '120363000000000000@g.us',
            senderId: '',
            isGroup: true
        })).toBeNull();
    });

    it('serializes requests from one person while allowing different people to proceed independently', async () => {
        const run = createKeyedSerialExecutor();
        const order = [];
        let releaseFirst;
        const firstGate = new Promise(resolve => { releaseFirst = resolve; });
        const first = run('group:user-a', async () => {
            order.push('a-start');
            await firstGate;
            order.push('a-end');
        });
        const second = run('group:user-a', async () => { order.push('a-next'); });
        const other = run('group:user-b', async () => { order.push('b-start'); });
        await other;
        expect(order).toContain('b-start');
        expect(order).not.toContain('a-next');
        releaseFirst();
        await Promise.all([first, second]);
        expect(order).toEqual(['a-start', 'b-start', 'a-end', 'a-next']);
    });
});

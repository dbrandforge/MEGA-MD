import { describe, expect, it, vi } from 'vitest';

const getAllMessageCounts = vi.fn();
const getUserGender = vi.fn(async () => 'guy');

vi.mock('../../lib/lightweight_store.js', () => ({
    default: { getAllMessageCounts: (...args) => getAllMessageCounts(...args) }
}));
vi.mock('../../plugins/gender.js', () => ({
    getUserGender: (...args) => getUserGender(...args)
}));

import rankPlugin from '../../plugins/rank.js';

describe('.rank all-time group leaderboard', () => {
    it('uses cumulative counts for the current group and does not use weekly counters', async () => {
        getAllMessageCounts.mockResolvedValue({
            messageCount: {
                'group-a@g.us': { '111@s.whatsapp.net': 40, '222@s.whatsapp.net': 12 },
                'group-b@g.us': { '333@s.whatsapp.net': 999 }
            }
        });
        const sent = [];
        const sock = {
            groupMetadata: vi.fn(async () => ({ participants: [] })),
            getName: vi.fn(async jid => jid.split('@')[0]),
            sendMessage: vi.fn(async (_jid, content) => { sent.push(content); })
        };
        await rankPlugin.handler(sock, { key: { remoteJid: 'group-a@g.us' } }, [], { chatId: 'group-a@g.us' });
        expect(sent[0].text).toContain('ALL-TIME GROUP RANKING');
        expect(sent[0].text).toContain('40 messages');
        expect(sent[0].text).toContain('12 messages');
        expect(sent[0].text).not.toContain('999 messages');
        expect(sent[0].text).not.toContain('WEEKLY');
    });

    it('returns an empty-state message when the group has no cumulative counts', async () => {
        getAllMessageCounts.mockResolvedValue({ messageCount: { 'empty@g.us': {} } });
        const sock = { groupMetadata: vi.fn(async () => ({ participants: [] })), sendMessage: vi.fn() };
        await rankPlugin.handler(sock, { key: { remoteJid: 'empty@g.us' } }, [], { chatId: 'empty@g.us' });
        expect(sock.sendMessage.mock.calls[0][1].text).toContain('No group activity recorded yet');
    });
});

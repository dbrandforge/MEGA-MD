import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/lightweight_store.js', () => ({
  default: { getSetting: vi.fn() }
}));
vi.mock('../../lib/featureGroups.js', () => ({ isFeatureGroup: vi.fn(() => true) }));

import store from '../../lib/lightweight_store.js';
import gamerank from '../../plugins/gamerank.js';

describe('.gamerank all-time leaderboards', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ['trivia', 'triviaRecords', { points: 85, wins: 3, matches: 5 }, '85 points'],
    ['math', 'mathRecords', { points: 120, wins: 4, matches: 6 }, '120 points'],
    ['hangman', 'hangmanHighScores', { totalSolved: 22, rounds: 3 }, '22 words solved']
  ])('shows the top ten cumulative %s records', async (game, key, record, expected) => {
    store.getSetting.mockResolvedValue({
      '111@s.whatsapp.net': record,
      '222@s.whatsapp.net': game === 'hangman' ? { totalSolved: 4 } : { points: 10, wins: 0, matches: 1 }
    });
    const sent = [];
    const sock = {
      groupMetadata: vi.fn().mockResolvedValue({ participants: [] }),
      getName: vi.fn(async jid => jid.split('@')[0]),
      sendMessage: vi.fn(async (_chat, payload) => sent.push(payload))
    };
    const chatId = '120363000000000000@g.us';

    await gamerank.handler(sock, { key: { remoteJid: chatId } }, [game], { chatId });

    expect(store.getSetting).toHaveBeenCalledWith(chatId, key);
    expect(sent[0].text).toContain('ALL-TIME TOP 10');
    expect(sent[0].text).toContain(expected);
    expect(sent[0].text).toContain('No weekly reset');
  });

  it('does not clear or mutate stored records', async () => {
    const records = { '111@s.whatsapp.net': { points: 50, wins: 2, matches: 2 } };
    store.getSetting.mockResolvedValue(records);
    const sock = { groupMetadata: vi.fn().mockResolvedValue({ participants: [] }), getName: vi.fn(), sendMessage: vi.fn() };
    await gamerank.handler(sock, { key: { remoteJid: '120363000000000000@g.us' } }, ['trivia'], { chatId: '120363000000000000@g.us' });
    expect(store.getSetting).toHaveBeenCalledTimes(1);
    expect(records['111@s.whatsapp.net'].points).toBe(50);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({}));
vi.mock('../../lib/lightweight_store.js', () => ({
  default: {
    getSetting: vi.fn(async (_chatId, key) => state[key] ?? {}),
    saveSettingVerified: vi.fn(async (_chatId, key, value) => { state[key] = value; return true; })
  }
}));
vi.mock('../../plugins/gender.js', () => ({ getUserGender: vi.fn(async () => 'guy') }));
vi.mock('../../data/todLists.js', () => ({ getTruths: vi.fn(() => Array.from({ length: 220 }, (_, i) => `Private adult truth ${i}`)) }));
vi.mock('../../plugins/daylock.js', () => ({ isGameAllowed: vi.fn(async () => ({ ok: true })) }));
vi.mock('../../lib/featureGroups.js', () => ({ isFeatureGroup: vi.fn(() => true) }));
vi.mock('../../lib/whatsappIdentity.js', () => ({
  canonicalWhatsAppUserId: vi.fn(async (_sock, id) => id),
  sameWhatsAppUser: vi.fn(async (_sock, a, b) => a === b)
}));

import { beginPickYourSinSession, handlePickYourSinMessage } from '../../plugins/pick-your-sin.js';

const chatId = '120363000000000000@g.us';
const players = Array.from({ length: 5 }, (_, i) => `23480000000${i}@s.whatsapp.net`);

describe('Pick Your Sin sessions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    for (const key of Object.keys(state)) delete state[key];
  });
  afterEach(() => vi.useRealTimers());

  it('creates five independent players with 50 cards per colour and gender', async () => {
    const sock = { sendMessage: vi.fn(async () => ({ key: { id: 'announcement' } })) };
    await beginPickYourSinSession(sock, chatId, players, '234899999999@s.whatsapp.net');

    const session = Object.values(state.pickYourSinSessions)[0];
    expect(session.players).toHaveLength(5);
    expect(Object.keys(session.playerStates)).toHaveLength(5);
    for (const color of ['red', 'green', 'yellow', 'orange']) {
      const deck = session.decks[`guy:${color}`];
      expect(deck.truths).toHaveLength(42);
      expect(deck.dares).toHaveLength(8);
    }
  });

  it('accepts a colour emoji and enforces a 30-second per-player cooldown', async () => {
    let sent = 0;
    const sock = { user: { id: '234899999999:1@s.whatsapp.net' }, sendMessage: vi.fn(async () => ({ key: { id: `bot-${++sent}` } })) };
    await beginPickYourSinSession(sock, chatId, players, 'admin@s.whatsapp.net');

    await handlePickYourSinMessage(sock, chatId, { key: { fromMe: false }, message: { conversation: '❤️' } }, '❤️', players[0]);
    let session = Object.values(state.pickYourSinSessions)[0];
    expect(session.playerStates[players[0]].color).toBe('red');
    const firstPromptId = session.playerStates[players[0]].questionMessageId;

    const answer = {
      key: { fromMe: false },
      message: { extendedTextMessage: { contextInfo: { stanzaId: firstPromptId } } }
    };
    await handlePickYourSinMessage(sock, chatId, answer, 'My answer', players[0]);
    const promptCountAfterAnswer = sock.sendMessage.mock.calls.length;

    await vi.advanceTimersByTimeAsync(29_999);
    expect(sock.sendMessage).toHaveBeenCalledTimes(promptCountAfterAnswer);
    await vi.advanceTimersByTimeAsync(1);
    expect(sock.sendMessage).toHaveBeenCalledTimes(promptCountAfterAnswer + 1);
    session = Object.values(state.pickYourSinSessions)[0];
    expect(session.playerStates[players[0]].step).toBe(1);
  });

  it('rejects non-selected participants', async () => {
    const sock = { sendMessage: vi.fn(async () => ({ key: { id: 'announcement' } })) };
    await beginPickYourSinSession(sock, chatId, players, 'admin@s.whatsapp.net');
    const handled = await handlePickYourSinMessage(
      sock,
      chatId,
      { key: { fromMe: false }, message: { conversation: 'red' } },
      'red',
      '234811111111@s.whatsapp.net'
    );
    expect(handled).toBe(false);
    expect(sock.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('allows one pass per session without advancing the truth count', async () => {
    let sent = 0;
    const sock = { user: { id: '234899999999:1@s.whatsapp.net' }, sendMessage: vi.fn(async () => ({ key: { id: `bot-${++sent}` } })) };
    await beginPickYourSinSession(sock, chatId, players, 'admin@s.whatsapp.net');
    await handlePickYourSinMessage(sock, chatId, { key: { fromMe: false }, message: { conversation: 'red' } }, 'red', players[0]);
    let session = Object.values(state.pickYourSinSessions)[0];
    const promptId = session.playerStates[players[0]].questionMessageId;
    const passMessage = { key: { fromMe: false }, message: { extendedTextMessage: { contextInfo: { stanzaId: promptId } } } };

    await handlePickYourSinMessage(sock, chatId, passMessage, 'pass', players[0]);
    session = Object.values(state.pickYourSinSessions)[0];
    expect(session.playerStates[players[0]].passUsed).toBe(true);
    expect(session.playerStates[players[0]].step).toBe(0);

    await vi.advanceTimersByTimeAsync(30_000);
    session = Object.values(state.pickYourSinSessions)[0];
    const replacementId = session.playerStates[players[0]].questionMessageId;
    await handlePickYourSinMessage(
      sock,
      chatId,
      { key: { fromMe: false }, message: { extendedTextMessage: { contextInfo: { stanzaId: replacementId } } } },
      'pass',
      players[0]
    );
    session = Object.values(state.pickYourSinSessions)[0];
    expect(session.playerStates[players[0]].step).toBe(0);
    expect(session.playerStates[players[0]].passUsed).toBe(true);
  });

});

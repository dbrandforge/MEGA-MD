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

  it('requires a different colour on consecutive turns and enforces the cooldown', async () => {
    let sent = 0;
    const sock = { user: { id: '234899999999:1@s.whatsapp.net' }, sendMessage: vi.fn(async () => ({ key: { id: `bot-${++sent}` } })) };
    await beginPickYourSinSession(sock, chatId, players, 'admin@s.whatsapp.net');

    await handlePickYourSinMessage(sock, chatId, { key: { fromMe: false }, message: { conversation: '❤️' } }, '❤️', players[0]);
    let session = Object.values(state.pickYourSinSessions)[0];
    expect(session.playerStates[players[0]].color).toBe('red');
    const firstPromptId = session.playerStates[players[0]].questionMessageId;
    await handlePickYourSinMessage(sock, chatId, {
      key: { fromMe: false },
      message: { extendedTextMessage: { contextInfo: { stanzaId: firstPromptId } } }
    }, 'My answer', players[0]);
    const afterAnswer = sock.sendMessage.mock.calls.length;

    await vi.advanceTimersByTimeAsync(29_999);
    expect(sock.sendMessage).toHaveBeenCalledTimes(afterAnswer);
    await vi.advanceTimersByTimeAsync(1);
    expect(sock.sendMessage).toHaveBeenCalledTimes(afterAnswer + 1);

    await handlePickYourSinMessage(sock, chatId, { key: { fromMe: false }, message: { conversation: 'yellow' } }, 'yellow', players[0]);
    session = Object.values(state.pickYourSinSessions)[0];
    expect(session.playerStates[players[0]].step).toBe(1);
    expect(session.playerStates[players[0]].color).toBe('yellow');
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

  it('allows one pass on a truth only and rejects pass on a dare', async () => {
    let sent = 0;
    const sock = { user: { id: '234899999999:1@s.whatsapp.net' }, sendMessage: vi.fn(async () => ({ key: { id: `bot-${++sent}` } })) };
    await beginPickYourSinSession(sock, chatId, players, 'admin@s.whatsapp.net');
    await handlePickYourSinMessage(sock, chatId, { key: { fromMe: false }, message: { conversation: 'red' } }, 'red', players[0]);
    let session = Object.values(state.pickYourSinSessions)[0];
    let promptId = session.playerStates[players[0]].questionMessageId;
    const passMessage = { key: { fromMe: false }, message: { extendedTextMessage: { contextInfo: { stanzaId: promptId } } } };

    await handlePickYourSinMessage(sock, chatId, passMessage, 'pass', players[0]);
    session = Object.values(state.pickYourSinSessions)[0];
    expect(session.playerStates[players[0]].passUsed).toBe(true);
    expect(session.playerStates[players[0]].step).toBe(0);

    await vi.advanceTimersByTimeAsync(30_000);
    await handlePickYourSinMessage(sock, chatId, { key: { fromMe: false }, message: { conversation: 'green' } }, 'green', players[0]);
    session = Object.values(state.pickYourSinSessions)[0];
    promptId = session.playerStates[players[0]].questionMessageId;
    await handlePickYourSinMessage(sock, chatId, {
      key: { fromMe: false },
      message: { extendedTextMessage: { contextInfo: { stanzaId: promptId } } }
    }, 'answer', players[0]);

    const colors = ['yellow', 'orange', 'red', 'green'];
    for (const color of colors) {
      await vi.advanceTimersByTimeAsync(30_000);
      await handlePickYourSinMessage(sock, chatId, { key: { fromMe: false }, message: { conversation: color } }, color, players[0]);
      session = Object.values(state.pickYourSinSessions)[0];
      promptId = session.playerStates[players[0]].questionMessageId;
      await handlePickYourSinMessage(sock, chatId, {
        key: { fromMe: false },
        message: { extendedTextMessage: { contextInfo: { stanzaId: promptId } } }
      }, 'answer', players[0]);
    }
    session = Object.values(state.pickYourSinSessions)[0];
    expect(session.playerStates[players[0]].currentType).toBe('dare');
    const dareId = session.playerStates[players[0]].questionMessageId;
    await handlePickYourSinMessage(sock, chatId, {
      key: { fromMe: false },
      message: { extendedTextMessage: { contextInfo: { stanzaId: dareId } } }
    }, 'pass', players[0]);
    session = Object.values(state.pickYourSinSessions)[0];
    expect(session.playerStates[players[0]].step).toBe(5);
    expect(session.playerStates[players[0]].passUsed).toBe(true);
    expect(session.playerStates[players[0]].waiting).toBe(true);
    expect(sock.sendMessage.mock.calls.at(-1)[1].text).toContain('only be used on a TRUTH');
  });

  it('does not consume the pass when a participant tries to use it on a dare', async () => {
    let sent = 0;
    const sock = { user: { id: '234899999999:1@s.whatsapp.net' }, sendMessage: vi.fn(async () => ({ key: { id: `bot-${++sent}` } })) };
    await beginPickYourSinSession(sock, chatId, players, 'admin@s.whatsapp.net');
    await handlePickYourSinMessage(sock, chatId, { key: { fromMe: false }, message: { conversation: 'red' } }, 'red', players[0]);

    const colors = ['green', 'yellow', 'orange', 'red', 'green'];
    for (const color of colors) {
      let session = Object.values(state.pickYourSinSessions)[0];
      let promptId = session.playerStates[players[0]].questionMessageId;
      await handlePickYourSinMessage(sock, chatId, {
        key: { fromMe: false },
        message: { extendedTextMessage: { contextInfo: { stanzaId: promptId } } }
      }, 'answer', players[0]);
      await vi.advanceTimersByTimeAsync(30_000);
      await handlePickYourSinMessage(sock, chatId, { key: { fromMe: false }, message: { conversation: color } }, color, players[0]);
    }

    const session = Object.values(state.pickYourSinSessions)[0];
    expect(session.playerStates[players[0]].currentType).toBe('dare');
    const dareId = session.playerStates[players[0]].questionMessageId;
    await handlePickYourSinMessage(sock, chatId, {
      key: { fromMe: false },
      message: { extendedTextMessage: { contextInfo: { stanzaId: dareId } } }
    }, 'pass', players[0]);
    const after = Object.values(state.pickYourSinSessions)[0].playerStates[players[0]];
    expect(after.step).toBe(5);
    expect(after.passUsed).toBe(false);
    expect(after.waiting).toBe(true);
    expect(sock.sendMessage.mock.calls.at(-1)[1].text).toContain('only be used on a TRUTH');
  });

  it('blocks a participant who has already completed today', async () => {
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    state.pickYourSinDailyCompletions = { [day]: [players[0]] };
    const sock = { sendMessage: vi.fn(async () => ({ key: { id: 'announcement' } })) };
    await expect(beginPickYourSinSession(sock, chatId, players, 'admin@s.whatsapp.net'))
      .rejects.toThrow('already completed PICK YOUR SIN today');
  });

});

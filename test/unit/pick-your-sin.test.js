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

import pickYourSinPlugin, { beginPickYourSinSession, handlePickYourSinMessage, resetPickYourSinDailyCount } from '../../plugins/pick-your-sin.js';

const chatId = '120363000000000000@g.us';
const goodTruthAnswer = 'I remember that moment clearly because it happened after our first date and changed how I felt.';
const players = Array.from({ length: 5 }, (_, i) => `23480000000${i}@s.whatsapp.net`);
const colorMessage = text => ({
  key: { fromMe: false },
  message: { extendedTextMessage: { text, contextInfo: { mentionedJid: ['234899999999@s.whatsapp.net'] } } }
});

describe('Pick Your Sin sessions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    for (const key of Object.keys(state)) delete state[key];
  });
  afterEach(() => vi.useRealTimers());

  it('creates five independent players with 150 truths and 30 dares per colour and gender', async () => {
    const sock = { sendMessage: vi.fn(async () => ({ key: { id: 'announcement' } })) };
    await beginPickYourSinSession(sock, chatId, players, '234899999999@s.whatsapp.net');

    const session = Object.values(state.pickYourSinSessions)[0];
    expect(session.players).toHaveLength(5);
    expect(Object.keys(session.playerStates)).toHaveLength(5);
    for (const color of ['red', 'yellow', 'orange', 'ash']) {
      const deck = session.decks[`guy:${color}`];
      expect(deck.truths).toHaveLength(150);
      expect(deck.dares).toHaveLength(30);
    }
  });

  it('never repeats a truth between different players in the same session', async () => {
    let sent = 0;
    const sock = { user: { id: '234899999999:1@s.whatsapp.net' }, sendMessage: vi.fn(async () => ({ key: { id: `bot-${++sent}` } })) };
    await beginPickYourSinSession(sock, chatId, players, 'admin@s.whatsapp.net');
    await handlePickYourSinMessage(sock, chatId, colorMessage('red'), 'red', players[0]);
    await handlePickYourSinMessage(sock, chatId, colorMessage('red'), 'red', players[1]);
    const session = Object.values(state.pickYourSinSessions)[0];
    expect(session.playerStates[players[0]].currentCard).not.toBe(session.playerStates[players[1]].currentCard);
    expect(session.usedPromptKeys).toHaveLength(2);
  });
  it('does not send a schedule-bypass reply to ordinary messages from an active player', async () => {
    const sock = { user: { id: '234899999999:1@s.whatsapp.net' }, sendMessage: vi.fn(async () => ({ key: { id: 'prompt' } })) };
    await beginPickYourSinSession(sock, chatId, players, 'admin@s.whatsapp.net');
    await handlePickYourSinMessage(sock, chatId, colorMessage('red'), 'red', players[0]);
    const { isGameAllowed } = await import('../../plugins/daylock.js');
    vi.mocked(isGameAllowed).mockClear();
    const sentBefore = sock.sendMessage.mock.calls.length;

    const handled = await handlePickYourSinMessage(sock, chatId, {
      key: { id: 'ordinary-1', fromMe: false },
      message: { conversation: 'just chatting with everyone' }
    }, 'just chatting with everyone', players[0]);

    expect(handled).toBe(false);
    expect(sock.sendMessage).toHaveBeenCalledTimes(sentBefore);
    expect(isGameAllowed).not.toHaveBeenCalled();
  });

  it('requires a different colour on consecutive turns and enforces the cooldown', async () => {
    let sent = 0;
    const sock = { user: { id: '234899999999:1@s.whatsapp.net' }, sendMessage: vi.fn(async () => ({ key: { id: `bot-${++sent}` } })) };
    await beginPickYourSinSession(sock, chatId, players, 'admin@s.whatsapp.net');

    await handlePickYourSinMessage(sock, chatId, colorMessage('❤️'), '❤️', players[0]);
    let session = Object.values(state.pickYourSinSessions)[0];
    expect(session.playerStates[players[0]].color).toBe('red');
    const firstPromptId = session.playerStates[players[0]].questionMessageId;
    await handlePickYourSinMessage(sock, chatId, {
      key: { fromMe: false },
      message: { extendedTextMessage: { contextInfo: { stanzaId: firstPromptId } } }
    }, goodTruthAnswer, players[0]);
    const afterAnswer = sock.sendMessage.mock.calls.length;

    await vi.advanceTimersByTimeAsync(29_999);
    expect(sock.sendMessage).toHaveBeenCalledTimes(afterAnswer);
    await vi.advanceTimersByTimeAsync(1);
    expect(sock.sendMessage).toHaveBeenCalledTimes(afterAnswer + 1);

    await handlePickYourSinMessage(sock, chatId, colorMessage('yellow'), 'yellow', players[0]);
    session = Object.values(state.pickYourSinSessions)[0];
    expect(session.playerStates[players[0]].step).toBe(1);
    expect(session.playerStates[players[0]].color).toBe('yellow');
  });

  it('rejects one-word and yes/no truth replies without advancing the player', async () => {
    const sock = { user: { id: '234899999999:1@s.whatsapp.net' }, sendMessage: vi.fn(async () => ({ key: { id: 'prompt' } })) };
    await beginPickYourSinSession(sock, chatId, players, 'admin@s.whatsapp.net');
    await handlePickYourSinMessage(sock, chatId, colorMessage('red'), 'red', players[0]);
    const session = Object.values(state.pickYourSinSessions)[0];
    const promptId = session.playerStates[players[0]].questionMessageId;
    const reply = answer => ({
      key: { fromMe: false },
      message: { extendedTextMessage: { text: answer, contextInfo: { stanzaId: promptId } } }
    });

    await handlePickYourSinMessage(sock, chatId, reply('No'), 'No', players[0]);
    let player = Object.values(state.pickYourSinSessions)[0].playerStates[players[0]];
    expect(player.step).toBe(0);
    expect(player.waiting).toBe(true);

    await handlePickYourSinMessage(sock, chatId, reply('I have not'), 'I have not', players[0]);
    player = Object.values(state.pickYourSinSessions)[0].playerStates[players[0]];
    expect(player.step).toBe(0);
    expect(player.waiting).toBe(true);

    await handlePickYourSinMessage(sock, chatId, reply(goodTruthAnswer), goodTruthAnswer, players[0]);
    player = Object.values(state.pickYourSinSessions)[0].playerStates[players[0]];
    expect(player.step).toBe(1);
    expect(player.waiting).toBe(false);
  });

  it('requires dare proof as voice note, image or video and rejects text-only replies', async () => {
    let sent = 0;
    const sock = { user: { id: '234899999999:1@s.whatsapp.net' }, sendMessage: vi.fn(async () => ({ key: { id: `bot-${++sent}` } })) };
    await beginPickYourSinSession(sock, chatId, players, 'admin@s.whatsapp.net');
    await handlePickYourSinMessage(sock, chatId, colorMessage('red'), 'red', players[0]);

    const colors = ['ash', 'red', 'ash', 'red', 'ash'];
    for (const color of colors) {
      let session = Object.values(state.pickYourSinSessions)[0];
      const promptId = session.playerStates[players[0]].questionMessageId;
      await handlePickYourSinMessage(sock, chatId, {
        key: { fromMe: false },
        message: { extendedTextMessage: { text: goodTruthAnswer, contextInfo: { stanzaId: promptId } } }
      }, goodTruthAnswer, players[0]);
      await vi.advanceTimersByTimeAsync(30_000);
      await handlePickYourSinMessage(sock, chatId, colorMessage(color), color, players[0]);
    }

    let session = Object.values(state.pickYourSinSessions)[0];
    expect(session.playerStates[players[0]].currentType).toBe('dare');
    const dareId = session.playerStates[players[0]].questionMessageId;
    await handlePickYourSinMessage(sock, chatId, {
      key: { fromMe: false },
      message: { extendedTextMessage: { text: 'Done', contextInfo: { stanzaId: dareId } } }
    }, 'Done', players[0]);
    session = Object.values(state.pickYourSinSessions)[0];
    expect(session.playerStates[players[0]].step).toBe(5);
    expect(session.playerStates[players[0]].waiting).toBe(true);

    await handlePickYourSinMessage(sock, chatId, {
      key: { fromMe: false },
      message: { imageMessage: { caption: 'Completed', contextInfo: { stanzaId: dareId } } }
    }, 'Completed', players[0]);
    session = Object.values(state.pickYourSinSessions)[0];
    expect(session.playerStates[players[0]].step).toBe(6);
    expect(session.playerStates[players[0]].waiting).toBe(false);
  });

  it('accepts an unquoted view-once video for the active dare and records response metadata only', async () => {
    let sent = 0;
    const sock = { user: { id: '234899999999:1@s.whatsapp.net' }, sendMessage: vi.fn(async () => ({ key: { id: `bot-${++sent}` } })) };
    await beginPickYourSinSession(sock, chatId, players, 'admin@s.whatsapp.net');
    await handlePickYourSinMessage(sock, chatId, colorMessage('red'), 'red', players[0]);

    const nextColors = ['ash', 'red', 'ash', 'red', 'ash'];
    for (const color of nextColors) {
      const session = Object.values(state.pickYourSinSessions)[0];
      const promptId = session.playerStates[players[0]].questionMessageId;
      await handlePickYourSinMessage(sock, chatId, {
        key: { fromMe: false },
        message: { extendedTextMessage: { text: goodTruthAnswer, contextInfo: { stanzaId: promptId } } }
      }, goodTruthAnswer, players[0]);
      await vi.advanceTimersByTimeAsync(30_000);
      await handlePickYourSinMessage(sock, chatId, colorMessage(color), color, players[0]);
    }

    let session = Object.values(state.pickYourSinSessions)[0];
    expect(session.playerStates[players[0]].currentType).toBe('dare');
    const handled = await handlePickYourSinMessage(sock, chatId, {
      key: { id: 'view-once-dare-proof', fromMe: false },
      message: { viewOnceMessageV2: { message: { videoMessage: {} } } }
    }, '', players[0]);

    session = Object.values(state.pickYourSinSessions)[0];
    expect(handled).toBe(true);
    expect(session.playerStates[players[0]].step).toBe(6);
    expect(session.playerStates[players[0]].responses.at(-1)).toMatchObject({
      type: 'dare', mediaKind: 'video', messageId: 'view-once-dare-proof', viewOnce: true
    });
  });

  it('rejects non-selected participants', async () => {
    const sock = { sendMessage: vi.fn(async () => ({ key: { id: 'announcement' } })) };
    await beginPickYourSinSession(sock, chatId, players, 'admin@s.whatsapp.net');
    const handled = await handlePickYourSinMessage(
      sock,
      chatId,
      colorMessage('red'),
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
    await handlePickYourSinMessage(sock, chatId, colorMessage('red'), 'red', players[0]);
    let session = Object.values(state.pickYourSinSessions)[0];
    let promptId = session.playerStates[players[0]].questionMessageId;
    const passMessage = { key: { fromMe: false }, message: { extendedTextMessage: { contextInfo: { stanzaId: promptId } } } };

    await handlePickYourSinMessage(sock, chatId, passMessage, 'pass', players[0]);
    session = Object.values(state.pickYourSinSessions)[0];
    expect(session.playerStates[players[0]].passUsed).toBe(true);
    expect(session.playerStates[players[0]].step).toBe(0);

    await vi.advanceTimersByTimeAsync(30_000);
    await handlePickYourSinMessage(sock, chatId, colorMessage('green'), 'green', players[0]);
    session = Object.values(state.pickYourSinSessions)[0];
    promptId = session.playerStates[players[0]].questionMessageId;
    await handlePickYourSinMessage(sock, chatId, {
      key: { fromMe: false },
      message: { extendedTextMessage: { contextInfo: { stanzaId: promptId } } }
    }, goodTruthAnswer, players[0]);

    const colors = ['yellow', 'orange', 'red', 'green'];
    for (const color of colors) {
      await vi.advanceTimersByTimeAsync(30_000);
      await handlePickYourSinMessage(sock, chatId, colorMessage(color), color, players[0]);
      session = Object.values(state.pickYourSinSessions)[0];
      promptId = session.playerStates[players[0]].questionMessageId;
      await handlePickYourSinMessage(sock, chatId, {
        key: { fromMe: false },
        message: { extendedTextMessage: { contextInfo: { stanzaId: promptId } } }
      }, goodTruthAnswer, players[0]);
    }
    await vi.advanceTimersByTimeAsync(30_000);
    await handlePickYourSinMessage(sock, chatId, colorMessage('yellow'), 'yellow', players[0]);
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
    await handlePickYourSinMessage(sock, chatId, colorMessage('red'), 'red', players[0]);

    const colors = ['green', 'yellow', 'orange', 'red', 'green'];
    for (const color of colors) {
      let session = Object.values(state.pickYourSinSessions)[0];
      let promptId = session.playerStates[players[0]].questionMessageId;
      await handlePickYourSinMessage(sock, chatId, {
        key: { fromMe: false },
        message: { extendedTextMessage: { contextInfo: { stanzaId: promptId } } }
      }, goodTruthAnswer, players[0]);
      await vi.advanceTimersByTimeAsync(30_000);
      await handlePickYourSinMessage(sock, chatId, colorMessage(color), color, players[0]);
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

  it('reminds at five minutes and removes only the inactive player at ten minutes', async () => {
    let sent = 0;
    const sock = { user: { id: '234899999999:1@s.whatsapp.net' }, sendMessage: vi.fn(async () => ({ key: { id: `bot-${++sent}` } })) };
    await beginPickYourSinSession(sock, chatId, players, 'admin@s.whatsapp.net');
    await handlePickYourSinMessage(sock, chatId, colorMessage('red'), 'red', players[0]);

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(sock.sendMessage.mock.calls.some(([, content]) => content.text?.includes('five more minutes') && content.mentions?.includes(players[0]))).toBe(true);

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    let session = Object.values(state.pickYourSinSessions)[0];
    expect(session.playerStates[players[0]].status).toBe('out');
    expect(session.playerStates[players[0]].waitingForReplacement).toBe(true);
    expect(session.playerStates[players[1]].status).toBe('active');

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    session = Object.values(state.pickYourSinSessions)[0];
    expect(session.playerStates[players[0]].replacementExpired).toBe(true);
    expect(session.playerStates[players[1]].status).toBe('active');
  });
  it('exposes resetday as a tagged-player admin command', async () => {
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    state.pickYourSinDailyCompletions = { [day]: [players[0], players[1]] };
    const sock = { sendMessage: vi.fn(async () => ({ key: { id: 'reply' } })) };
    const message = {
      key: { remoteJid: chatId, participant: 'admin@s.whatsapp.net' },
      message: { extendedTextMessage: { text: '.picksin resetday @user', contextInfo: { mentionedJid: [players[0]] } } }
    };

    await pickYourSinPlugin.handler(sock, message, ['resetday'], { chatId, senderId: 'admin@s.whatsapp.net' });
    expect(state.pickYourSinDailyCompletions[day]).toEqual([players[1]]);
    expect(sock.sendMessage.mock.calls.at(-1)[1].text).toContain('daily completion has been cleared');
  });

  it('allows an admin reset helper to clear only the selected player from today’s completion list', async () => {
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    state.pickYourSinDailyCompletions = { [day]: [players[0], players[1]] };

    const result = await resetPickYourSinDailyCount(chatId, players[0]);
    expect(result).toEqual({ reset: true, count: 1 });
    expect(state.pickYourSinDailyCompletions[day]).toEqual([players[1]]);

    const missing = await resetPickYourSinDailyCount(chatId, players[0]);
    expect(missing).toEqual({ reset: false, count: 1 });
    expect(state.pickYourSinDailyCompletions[day]).toEqual([players[1]]);
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

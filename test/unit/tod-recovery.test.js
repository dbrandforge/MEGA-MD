import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({}));
vi.mock('../../lib/lightweight_store.js', () => ({
  default: {
    getSetting: vi.fn(async (_chatId, key) => state[key] ?? {}),
    saveSettingVerified: vi.fn(async (_chatId, key, value) => { state[key] = value; return true; })
  }
}));
vi.mock('../../plugins/gender.js', () => ({ getUserGender: vi.fn(async () => 'guy') }));
vi.mock('../../data/todLists.js', () => ({
  getTruths: vi.fn(() => ['A fresh truth prompt']),
  getDares: vi.fn(() => ['A fresh dare prompt']),
  randomFrom: vi.fn(list => list[0])
}));
vi.mock('../../plugins/daylock.js', () => ({ isGameAllowed: vi.fn(async () => ({ ok: true })) }));
vi.mock('../../lib/whatsappIdentity.js', () => ({
  canonicalWhatsAppUserId: vi.fn(async (_sock, id) => id),
  sameWhatsAppUser: vi.fn(async (_sock, a, b) => a === b)
}));

import { recoverTodPlayer, replaceTodPlayer } from '../../plugins/tod.js';

const chatId = '120363000000000000@g.us';
const removed = '234800000000@s.whatsapp.net';
const partner = '234800000001@s.whatsapp.net';
const replacement = '234800000002@s.whatsapp.net';

function pausedSession() {
  return {
    tod_1: {
      id: 'tod_1', status: 'paused', mode: 'paired',
      players: [removed, partner], starterGender: 'lady', partnerGender: 'guy',
      round: 1, waitingFor: removed, currentAnswerer: removed,
      currentType: 'truth', currentGender: 'lady',
      currentPrompt: 'The original saved truth prompt',
      questionMessageId: 'old-prompt', removedPlayer: removed,
      removedAt: Date.now() - 1000,
      recoveryDeadlineAt: Date.now() + 15 * 60 * 1000,
      questionsCompleted: { [removed]: 3, [partner]: 2 },
      lastActivity: Date.now() - 10 * 60 * 1000
    }
  };
}

describe('Truth or Dare inactivity recovery', () => {
  beforeEach(() => {
    for (const key of Object.keys(state)) delete state[key];
    state.todSessions = pausedSession();
  });

  it('resumes the original player on the exact saved round and prompt', async () => {
    let sent = 0;
    const sock = { sendMessage: vi.fn(async () => ({ key: { id: `tod-resume-${++sent}` } })) };

    expect(await recoverTodPlayer(sock, chatId, removed)).toBe(true);
    expect(state.todSessions.tod_1).toMatchObject({
      status: 'active', round: 1, waitingFor: removed,
      currentPrompt: 'The original saved truth prompt',
      questionsCompleted: { [removed]: 3, [partner]: 2 }
    });
    expect(sock.sendMessage.mock.calls[0][1].text).toContain('The original saved truth prompt');
  });

  it('gives a substitute a fresh personal count and a new prompt', async () => {
    const sock = { sendMessage: vi.fn(async () => ({ key: { id: 'tod-substitute-prompt' } })) };

    expect(await replaceTodPlayer(sock, chatId, removed, replacement)).toBe(true);
    expect(state.todSessions.tod_1.players).toEqual([replacement, partner]);
    expect(state.todSessions.tod_1.questionsCompleted).toEqual({
      [partner]: 2, [replacement]: 0
    });
    expect(state.todSessions.tod_1).toMatchObject({
      status: 'active', waitingFor: replacement,
      currentPrompt: 'A fresh truth prompt', starterGender: 'guy'
    });

    expect(await recoverTodPlayer(sock, chatId, removed)).toBe(true);
    expect(state.todSessions.tod_1.players).toEqual([removed, partner]);
    expect(state.todSessions.tod_1).toMatchObject({
      status: 'active', waitingFor: removed,
      currentPrompt: 'The original saved truth prompt',
      questionsCompleted: { [removed]: 3, [partner]: 2 },
      starterGender: 'lady'
    });
  });
});

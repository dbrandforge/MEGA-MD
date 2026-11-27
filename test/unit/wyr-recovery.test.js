import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({}));
vi.mock('../../lib/lightweight_store.js', () => ({
  default: {
    getSetting: vi.fn(async (_chatId, key) => key === 'wouldYouRatherUsedQuestions' ? (state[key] ?? []) : (state[key] ?? {})),
    saveSettingVerified: vi.fn(async (_chatId, key, value) => { state[key] = value; return true; })
  }
}));
vi.mock('../../plugins/gender.js', () => ({ getUserGender: vi.fn(async () => 'guy') }));
vi.mock('../../lib/featureGroups.js', () => ({ isFeatureGroup: vi.fn(() => true) }));
vi.mock('../../plugins/daylock.js', () => ({ isGameAllowed: vi.fn(async () => ({ ok: true })) }));
vi.mock('../../data/wyrPairs.js', () => ({ FALLBACK: [['Fresh option A', 'Fresh option B']] }));

import { recoverWyrPlayer, replaceWyrPlayer } from '../../plugins/wyr.js';

const chatId = '120363000000000000@g.us';
const removed = '234800000000@s.whatsapp.net';
const replacement = '234800000001@s.whatsapp.net';

describe('Would You Rather inactivity recovery', () => {
  beforeEach(() => {
    for (const key of Object.keys(state)) delete state[key];
  });

  it('restores the previous dilemma and preserves attempted answers', async () => {
    state.wouldYouRatherSessions = {
      [removed]: {
        status: 'active', gender: 'guy',
        currentOptions: ['Saved option A', 'Saved option B'],
        questionMessageId: 'old-prompt', questionsAsked: 7,
        questionsAttempted: 6, answers: ['A', 'B', 'A'],
        updatedAt: Date.now() - 30 * 60 * 1000,
        expiresAt: Date.now() - 1000
      }
    };
    const sock = { sendMessage: vi.fn(async () => ({ key: { id: 'wyr-resumed-prompt' } })) };

    expect(await recoverWyrPlayer(sock, chatId, removed)).toBe(true);
    expect(state.wouldYouRatherSessions[removed]).toMatchObject({
      status: 'active', questionsAsked: 7, questionsAttempted: 6,
      answers: ['A', 'B', 'A'], currentOptions: ['Saved option A', 'Saved option B'],
      questionMessageId: 'wyr-resumed-prompt'
    });
    expect(sock.sendMessage.mock.calls[0][1].text).toContain('Saved option A');
  });

  it('starts a WYR substitute with a fresh question count and answer history', async () => {
    state.wouldYouRatherSessions = {
      [removed]: {
        status: 'expired', gender: 'lady',
        currentOptions: ['Old A', 'Old B'], questionsAsked: 9,
        questionsAttempted: 8, answers: ['A', 'A'],
        expiresAt: Date.now() - 1000,
        recoveryDeadlineAt: Date.now() + 15 * 60 * 1000
      }
    };
    const sock = { sendMessage: vi.fn(async () => ({ key: { id: 'wyr-new-prompt' } })) };

    expect(await replaceWyrPlayer(sock, chatId, removed, replacement)).toBe(true);
    expect(state.wouldYouRatherSessions[removed].status).toBe('replaced');
    expect(state.wouldYouRatherSessions[replacement]).toMatchObject({
      status: 'active', questionsAsked: 1, questionsAttempted: 0,
      answers: [], currentOptions: ['Fresh option A', 'Fresh option B']
    });
    expect(state.wouldYouRatherSessions[removed].status).toBe('replaced');

    expect(await recoverWyrPlayer(sock, chatId, removed)).toBe(true);
    expect(state.wouldYouRatherSessions[removed]).toMatchObject({
      status: 'active', questionsAsked: 9, questionsAttempted: 8,
      answers: ['A', 'A'], currentOptions: ['Old A', 'Old B']
    });
    expect(state.wouldYouRatherSessions[replacement].questionsAttempted).toBe(0);
  });
});

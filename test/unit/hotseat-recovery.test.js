import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({}));
vi.mock('../../lib/lightweight_store.js', () => ({
  default: {
    getSetting: vi.fn(async (_chatId, key) => state[key] ?? null),
    saveSettingVerified: vi.fn(async (_chatId, key, value) => { state[key] = value; return true; })
  }
}));
vi.mock('../../config.js', () => ({
  default: { hotseatSessionHours: 2, hotseatAnswerMinutes: 5, hotseatAdjustmentMinutes: 10 }
}));
vi.mock('../../plugins/daylock.js', () => ({ isGameAllowed: vi.fn(async () => ({ ok: true })) }));
vi.mock('../../plugins/gender.js', () => ({ getUserGender: vi.fn(async () => 'guy') }));
vi.mock('../../lib/featureGroups.js', () => ({ isFeatureGroup: vi.fn(() => true) }));
vi.mock('../../plugins/softmute.js', () => ({ softUnmuteUser: vi.fn(async () => true) }));
vi.mock('../../data/hotseatQuestions.js', () => ({
  getHotSeatQuestions: vi.fn(() => Array.from({ length: 40 }, (_, i) => `Hot Seat question ${i + 1}`))
}));

import {
  handleHotSeatAnswer,
  recoverHotSeatPlayer,
  replaceHotSeatPlayer
} from '../../plugins/hotseat.js';

const chatId = '120363000000000000@g.us';
const player = '234800000000@s.whatsapp.net';
const replacement = '234800000001@s.whatsapp.net';

function activeSession() {
  return {
    status: 'active',
    startedAt: Date.now(),
    players: [player],
    usedQuestions: [],
    usedGuy: [],
    usedLady: [],
    playerStates: {
      [player]: {
        status: 'active', waiting: true, waitingForGender: false,
        questionsAnswered: 0, lastAnsweredAt: null, nextQuestionAt: null,
        genderDeadlineAt: null, questionId: 'question-0',
        questionMessageId: 'prompt-0', currentQuestion: 'Saved question 1',
        questionAskedAt: Date.now(), timeoutToken: null
      }
    }
  };
}

function answerMessage(promptId) {
  return {
    key: { fromMe: false },
    message: { extendedTextMessage: { contextInfo: { stanzaId: promptId } } }
  };
}

function makeSocket() {
  let sent = 0;
  return {
    user: { id: '234899999999:1@s.whatsapp.net' },
    sendMessage: vi.fn(async () => ({ key: { id: `bot-${++sent}` } }))
  };
}

describe('Hot Seat question limits and recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    for (const key of Object.keys(state)) delete state[key];
  });
  afterEach(() => vi.useRealTimers());

  it('ends each participant after exactly 15 answered questions and uses a 30-second cooldown', async () => {
    state.hotseatSession = activeSession();
    const sock = makeSocket();

    for (let index = 0; index < 15; index += 1) {
      const current = state.hotseatSession.playerStates[player];
      await handleHotSeatAnswer(sock, chatId, answerMessage(current.questionMessageId), player);
      if (index === 0) {
        const sentAfterAnswer = sock.sendMessage.mock.calls.length;
        await vi.advanceTimersByTimeAsync(29_999);
        expect(sock.sendMessage).toHaveBeenCalledTimes(sentAfterAnswer);
        await vi.advanceTimersByTimeAsync(1);
      } else if (index < 14) {
        await vi.advanceTimersByTimeAsync(30_000);
      }
    }

    expect(state.hotseatSession.playerStates[player]).toMatchObject({
      status: 'complete', questionsAnswered: 15
    });
    expect(sock.sendMessage.mock.calls.some(([, payload]) => payload.text?.includes('completed all *15 Hot Seat questions*'))).toBe(true);
  });

  it('restores the original Hot Seat player with the same question and count', async () => {
    const session = activeSession();
    session.playerStates[player].status = 'out';
    session.playerStates[player].waiting = false;
    session.playerStates[player].questionsAnswered = 6;
    session.playerStates[player].removalReason = 'answer-timeout';
    session.playerStates[player].removedAt = Date.now() - 1000;
    session.playerStates[player].recoveryDeadlineAt = Date.now() + 15 * 60 * 1000;
    state.hotseatSession = session;
    const sock = makeSocket();

    expect(await recoverHotSeatPlayer(sock, chatId, player)).toBe(true);
    expect(state.hotseatSession.playerStates[player]).toMatchObject({
      status: 'active', waiting: true, questionsAnswered: 6,
      currentQuestion: 'Saved question 1'
    });
    const { softUnmuteUser } = await import('../../plugins/softmute.js');
    expect(softUnmuteUser).toHaveBeenCalledWith(chatId, player, sock);
    expect(sock.sendMessage.mock.calls.at(-1)[1].text).toContain('Saved question 1');
  });

  it('starts a Hot Seat substitute at question one with zero inherited progress', async () => {
    const session = activeSession();
    session.playerStates[player].status = 'out';
    session.playerStates[player].waiting = false;
    session.playerStates[player].questionsAnswered = 9;
    session.playerStates[player].removalReason = 'answer-timeout';
    session.playerStates[player].recoveryDeadlineAt = Date.now() + 15 * 60 * 1000;
    state.hotseatSession = session;
    const sock = makeSocket();

    expect(await replaceHotSeatPlayer(sock, chatId, player, replacement)).toBe(true);
    expect(state.hotseatSession.players).toEqual([replacement]);
    expect(state.hotseatSession.playerStates[replacement]).toMatchObject({
      status: 'active', questionsAnswered: 0, waiting: true
    });
    expect(state.hotseatSession.playerStates[player]).toBeUndefined();

    expect(await recoverHotSeatPlayer(sock, chatId, player)).toBe(true);
    expect(state.hotseatSession.players).toEqual([player]);
    expect(state.hotseatSession.playerStates[player]).toMatchObject({
      status: 'active', questionsAnswered: 9, currentQuestion: 'Saved question 1'
    });
    expect(state.hotseatSession.playerStates[replacement]).toBeUndefined();
  });
});

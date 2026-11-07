import { describe, expect, it } from 'vitest';
import {
  NO_PARTICIPATION_GRACE_MS,
  startNoParticipationGrace,
  isNoParticipationGraceExpired,
  hasNoParticipation
} from '../../lib/gameTimeouts.js';

describe('game no-participation grace period', () => {
  it('closes the unanswered question and starts a five-minute hold', () => {
    const now = 1_000_000;
    const game = { active: true, questionClosed: false, matchExpiresAt: now + 60_000 };
    const held = startNoParticipationGrace(game, now);

    expect(held.questionClosed).toBe(true);
    expect(held.noParticipationExpiresAt).toBe(now + 5 * 60_000);
    expect(held.matchExpiresAt).toBeGreaterThan(held.noParticipationExpiresAt);
    expect(held.active).toBe(true);
    expect(NO_PARTICIPATION_GRACE_MS).toBe(5 * 60_000);
  });

  it('does not expire before five minutes and expires at the deadline', () => {
    const now = 2_000_000;
    const held = startNoParticipationGrace({ active: true }, now);

    expect(isNoParticipationGraceExpired(held, now + NO_PARTICIPATION_GRACE_MS - 1)).toBe(false);
    expect(isNoParticipationGraceExpired(held, now + NO_PARTICIPATION_GRACE_MS)).toBe(true);
  });


  it('starts the hold only when nobody has submitted anything', () => {
    expect(hasNoParticipation({})).toBe(true);
    expect(hasNoParticipation(null)).toBe(true);
    expect(hasNoParticipation({ 'player-1': 1 })).toBe(false);
    expect(hasNoParticipation({ 'player-1': { correct: false } })).toBe(false);
  });

  it('does not treat a normal active question as a grace-period expiry', () => {
    expect(isNoParticipationGraceExpired({ active: true, questionClosed: false }, Date.now())).toBe(false);
  });
});

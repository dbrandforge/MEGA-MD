export const NO_PARTICIPATION_GRACE_MS = 5 * 60 * 1000;

export function startNoParticipationGrace(game, now = Date.now()) {
  const noParticipationExpiresAt = now + NO_PARTICIPATION_GRACE_MS;
  return {
    ...game,
    questionClosed: true,
    noParticipationExpiresAt,
    matchExpiresAt: Math.max(Number(game.matchExpiresAt) || 0, noParticipationExpiresAt + 60_000)
  };
}

export function isNoParticipationGraceExpired(game, now = Date.now()) {
  return Number.isFinite(Number(game?.noParticipationExpiresAt))
    && Number(game.noParticipationExpiresAt) > 0
    && Number(game.noParticipationExpiresAt) <= now;
}

export function hasNoParticipation(submissions = {}) {
  return Object.keys(submissions || {}).length === 0;
}

export function calculateMathScore(questionTime, roundStartedAt, answeredAt) {
  const duration = Math.max(1, Number(questionTime) || 1);
  const started = Number(roundStartedAt) || Number(answeredAt) || Date.now();
  const submitted = Number(answeredAt) || started;
  const elapsedMs = Math.min(duration, Math.max(0, submitted - started));
  const speedBonus = Math.floor(((duration - elapsedMs) / duration) * 5);
  return {
    basePoints: 10,
    speedBonus,
    points: 10 + speedBonus,
    elapsedMs
  };
}

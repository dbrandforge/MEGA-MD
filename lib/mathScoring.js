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

export function recordCorrectMathAnswer(game, senderId, answeredAt = Date.now()) {
  if (!game || !senderId) throw new Error('A game and player ID are required to record a correct Maths answer.');
  game.correctAnswers = Array.isArray(game.correctAnswers) ? game.correctAnswers : [];
  if (game.correctAnswers.some(entry => entry.senderId === senderId)) {
    return { accepted: false, fastest: false, score: null };
  }
  const score = calculateMathScore(game.questionTime, game.roundStartedAt, answeredAt);
  const fastest = !game.roundWinner;
  game.correctAnswers.push({ senderId, answeredAt, ...score });
  if (fastest) game.roundWinner = senderId;
  game.scores = game.scores || {};
  game.scores[senderId] = (game.scores[senderId] || 0) + score.points;
  return { accepted: true, fastest, score };
}

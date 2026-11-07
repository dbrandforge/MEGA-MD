import { describe, expect, it } from 'vitest';
import { calculateMathScore, recordCorrectMathAnswer } from '../../lib/mathScoring.js';

describe('Maths Arena speed scoring', () => {
  it('awards every correct player a base score plus a time-proportional bonus', () => {
    expect(calculateMathScore(10000, 1000, 1000)).toEqual({
      basePoints: 10, speedBonus: 5, points: 15, elapsedMs: 0
    });
    expect(calculateMathScore(10000, 1000, 6000)).toEqual({
      basePoints: 10, speedBonus: 2, points: 12, elapsedMs: 5000
    });
    expect(calculateMathScore(10000, 1000, 10000)).toEqual({
      basePoints: 10, speedBonus: 0, points: 10, elapsedMs: 9000
    });
  });

  it('never awards more points to a slower correct answer', () => {
    const scores = [0, 1000, 2500, 5000, 7500, 9000].map(elapsed =>
      calculateMathScore(10000, 0, elapsed).points
    );
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('clamps late answers to the minimum score and negative elapsed time to the maximum', () => {
    expect(calculateMathScore(10000, 1000, 20000).points).toBe(10);
    expect(calculateMathScore(10000, 1000, 0).points).toBe(15);
  });
  it('records multiple correct players and preserves the fastest player as round winner', () => {
    const game = { questionTime: 10000, roundStartedAt: 1000, scores: {}, correctAnswers: [] };
    const first = recordCorrectMathAnswer(game, 'first@s.whatsapp.net', 1000);
    const second = recordCorrectMathAnswer(game, 'second@s.whatsapp.net', 3000);
    const third = recordCorrectMathAnswer(game, 'third@s.whatsapp.net', 8000);

    expect(first).toMatchObject({ accepted: true, fastest: true, score: { points: 15 } });
    expect(second).toMatchObject({ accepted: true, fastest: false, score: { points: 14 } });
    expect(third).toMatchObject({ accepted: true, fastest: false, score: { points: 11 } });
    expect(game.roundWinner).toBe('first@s.whatsapp.net');
    expect(game.correctAnswers).toHaveLength(3);
    expect(game.scores).toEqual({
      'first@s.whatsapp.net': 15,
      'second@s.whatsapp.net': 14,
      'third@s.whatsapp.net': 11
    });
  });

  it('prevents the same player from receiving multiple correct-answer awards in one round', () => {
    const game = { questionTime: 10000, roundStartedAt: 1000, scores: {}, correctAnswers: [] };
    recordCorrectMathAnswer(game, 'player@s.whatsapp.net', 1000);
    expect(recordCorrectMathAnswer(game, 'player@s.whatsapp.net', 2000)).toMatchObject({ accepted: false });
    expect(game.correctAnswers).toHaveLength(1);
    expect(game.scores['player@s.whatsapp.net']).toBe(15);
  });

});

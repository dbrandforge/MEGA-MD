import { describe, expect, it } from 'vitest';
import { calculateMathScore } from '../../lib/mathScoring.js';

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
});

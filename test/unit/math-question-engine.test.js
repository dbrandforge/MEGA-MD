import { describe, expect, it } from 'vitest';
import { generateMathQuestion } from '../../lib/mathQuestionEngine.js';

describe('Maths Arena question quality', () => {
  it('varies missing-number questions across all four operations', () => {
    const operators = new Set();
    for (let i = 0; i < 1200; i++) {
      const question = generateMathQuestion('easy');
      if (question.type !== 'missing') continue;
      for (const operator of ['+', '−', '×', '÷']) {
        if (question.expression.includes(operator)) operators.add(operator);
      }
      expect(Number.isInteger(Number(question.answer))).toBe(true);
      expect(Number(question.answer)).toBeGreaterThan(0);
    }
    expect([...operators]).toEqual(expect.arrayContaining(['+', '−', '×', '÷']));
  });

  it('uses calibrated percentage examples with clean integer answers', () => {
    for (let i = 0; i < 1200; i++) {
      const question = generateMathQuestion('normal');
      if (question.type !== 'percent') continue;
      expect(question.expression).toMatch(/^\d+(\.\d+)?% of \d+$/);
      expect(Number.isInteger(Number(question.answer))).toBe(true);
      expect(Number(question.answer)).toBeGreaterThan(0);
      expect(Number(question.answer)).toBeLessThanOrEqual(150);
    }
  });

  it('mixes square-root and cube-root questions without fractional answers', () => {
    const rootSymbols = new Set();
    for (let i = 0; i < 1600; i++) {
      const question = generateMathQuestion('hard');
      if (question.type !== 'roots') continue;
      if (question.expression.startsWith('√')) rootSymbols.add('square');
      if (question.expression.startsWith('∛')) rootSymbols.add('cube');
      expect(Number.isInteger(Number(question.answer))).toBe(true);
    }
    expect([...rootSymbols]).toEqual(expect.arrayContaining(['square', 'cube']));
  });

  it('keeps negative operands opt-in and returns positive integer results', () => {
    for (const mode of ['easy', 'normal', 'hard', 'extreme', 'impossible', 'impossible2']) {
      const question = generateMathQuestion(mode, { includeNegative: true });
      expect(question.hasNegative).toBe(true);
      expect(Number.isInteger(Number(question.answer))).toBe(true);
      expect(Number(question.answer)).toBeGreaterThan(0);
    }
    expect(generateMathQuestion('noob', { includeNegative: true }).hasNegative).toBe(false);
  });
});

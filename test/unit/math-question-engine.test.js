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
      const question = generateMathQuestion('extreme');
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


function gcd(a, b) { return b ? gcd(b, a % b) : Math.abs(a); }

function evaluateGeneratedQuestion(question) {
  const e = question.expression;
  let m;
  if (['addition', 'subtraction', 'multiplication', 'division', 'arithmetic'].includes(question.type)) {
    if ((m = e.match(/^(\d+) \+ \(-(\d+)\)$/))) return Number(m[1]) - Number(m[2]);
    if ((m = e.match(/^(\d+) - \(-(\d+)\)$/))) return Number(m[1]) + Number(m[2]);
    if ((m = e.match(/^(\d+) ([+−×÷]) (\d+)$/))) {
      const a = Number(m[1]), b = Number(m[3]);
      return ({ '+': a + b, '−': a - b, '×': a * b, '÷': a / b })[m[2]];
    }
  }
  if (question.type === 'missing') {
    if ((m = e.match(/^\? \+ (\d+) = (\d+)$/))) return Number(m[2]) - Number(m[1]);
    if ((m = e.match(/^\? − (\d+) = (\d+)$/))) return Number(m[1]) + Number(m[2]);
    if ((m = e.match(/^\? × (\d+) = (\d+)$/))) return Number(m[2]) / Number(m[1]);
    if ((m = e.match(/^\? ÷ (\d+) = (\d+)$/))) return Number(m[1]) * Number(m[2]);
  }
  if (question.type === 'percent' && (m = e.match(/^(\d+(?:\.\d+)?)% of (\d+)$/))) return Number(m[1]) * Number(m[2]) / 100;
  if (question.type === 'fraction' && (m = e.match(/^(\d+)\/(\d+) of (\d+)$/))) return Number(m[1]) * Number(m[3]) / Number(m[2]);
  if (question.type === 'ratio' && (m = e.match(/^Split (\d+) in the ratio (\d+):(\d+)\. Find the larger share\.$/))) {
    return Number(m[1]) * Math.max(Number(m[2]), Number(m[3])) / (Number(m[2]) + Number(m[3]));
  }
  if (question.type === 'order' && (m = e.match(/^(\d+) \+ (\d+) × (\d+)$/))) return Number(m[1]) + Number(m[2]) * Number(m[3]);
  if (question.type === 'algebra' && (m = e.match(/^Solve for x: (\d+)x \+ (\d+) = (\d+)$/))) return (Number(m[3]) - Number(m[2])) / Number(m[1]);
  if (question.type === 'sequence' && (m = e.match(/^Find the next number: ([\d, ]+), \?$/))) {
    const values = m[1].split(',').map(Number);
    return values[values.length - 1] + (values[1] - values[0]);
  }
  if (question.type === 'powers' && (m = e.match(/^(\d+)\^(\d+) - (\d+)$/))) return Number(m[1]) ** Number(m[2]) - Number(m[3]);
  if (question.type === 'roots') {
    if ((m = e.match(/^√(\d+) \+ (\d+)$/))) return Math.sqrt(Number(m[1])) + Number(m[2]);
    if ((m = e.match(/^∛(\d+) \+ (\d+)$/))) return Math.cbrt(Number(m[1])) + Number(m[2]);
  }
  if (question.type === 'quadratic' && (m = e.match(/^Solve x² - (\d+)x \+ (\d+) = 0\. Give the smaller root\.$/))) {
    const sum = Number(m[1]), product = Number(m[2]);
    return (sum - Math.sqrt(sum * sum - 4 * product)) / 2;
  }
  if (question.type === 'logs' && (m = e.match(/^Find x: log(\d+)\((\d+)\) = x$/))) return Math.log(Number(m[2])) / Math.log(Number(m[1]));
  if (question.type === 'gcd' && (m = e.match(/^Find the HCF of (\d+) and (\d+)$/))) return gcd(Number(m[1]), Number(m[2]));
  if (question.type === 'lcm' && (m = e.match(/^Find the LCM of (\d+) and (\d+)$/))) {
    const a = Number(m[1]), b = Number(m[2]);
    return (a * b) / gcd(a, b);
  }
  throw new Error('Unrecognized generated Maths question: ' + e + ' (' + question.type + ')');
}

describe('Maths Arena answer-key verification', () => {
  it('checks generated answers against the mathematics in every difficulty pool', () => {
    const covered = new Set();
    for (const mode of ['noob', 'easy', 'normal', 'hard', 'extreme', 'impossible', 'impossible2']) {
      for (let i = 0; i < 1800; i++) {
        const question = generateMathQuestion(mode, { includeNegative: i % 11 === 0 });
        covered.add(question.type);
        const evaluated = evaluateGeneratedQuestion(question);
        expect(Number.isInteger(Number(question.answer))).toBe(true);
        expect(evaluated).toBeCloseTo(Number(question.answer), 10);
      }
    }
    for (const type of ['addition', 'subtraction', 'multiplication', 'division', 'missing', 'percent', 'fraction', 'ratio', 'order', 'algebra', 'sequence', 'powers', 'roots', 'quadratic', 'logs', 'gcd', 'lcm', 'arithmetic']) {
      expect(covered.has(type), 'question type ' + type).toBe(true);
    }
  });
});

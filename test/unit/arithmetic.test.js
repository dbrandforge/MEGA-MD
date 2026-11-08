import { describe, expect, it } from 'vitest';
import { evaluateArithmetic, evaluateArithmeticFollowup, formatArithmeticAnswer } from '../../lib/arithmetic.js';

describe('conversational arithmetic', () => {
  it('calculates square roots expressed in natural language and symbols', () => {
    expect(evaluateArithmetic('Calculate the square root of 8800')).toBe(93.8083151965);
    expect(evaluateArithmetic('√8800')).toBe(93.8083151965);
  });
  it('calculates cube roots', () => {
    expect(evaluateArithmetic('Cube root of 156')).toBe(5.3832126121);
    expect(evaluateArithmetic('∛156')).toBe(5.3832126121);
  });
  it('calculates HCF/GCD and LCM', () => {
    expect(evaluateArithmetic('H.C.F of 50 and 10')).toBe(10);
    expect(evaluateArithmetic('LCM of 12 and 18')).toBe(36);
  });
  it('preserves normal operator precedence and chained multiplication', () => {
    expect(evaluateArithmetic('47 x 300')).toBe(14100);
    expect(evaluateArithmetic('6700 x 56 x 9900 x 37 ÷ 437')).toBe(314498306.6361556);
    expect(evaluateArithmetic('Multiply 6700 x 56 x 9900 x 37 ÷ 437')).toBe(314498306.6361556);
    expect(evaluateArithmetic('Multiply 6700 x 56 x 9900 x 37 then divide it by 437')).toBe(314498306.6361556);
  });
  it('calculates the large mixed-operator expression exactly', () => {
    expect(evaluateArithmetic('99,000 x 778 x 77,800 ÷ 60 + 5,678,000')).toBe(99877538000);
  });
  it('resolves short divide follow-ups from the previous bot result', () => {
    const history = [{ name: 'Forge Bot', text: 'The answer is *99,877,538,000*.' }];
    expect(evaluateArithmeticFollowup('Divide it by 777', history)).toBeCloseTo(128542519.94851995, 7);
    expect(evaluateArithmeticFollowup('÷ 777', history)).toBeCloseTo(128542519.94851995, 7);
    expect(evaluateArithmeticFollowup('divide am by 777', history)).toBeCloseTo(128542519.94851995, 7);
    expect(evaluateArithmeticFollowup('pín un sí 777', history)).toBeCloseTo(128542519.94851995, 7);
    expect(evaluateArithmeticFollowup('divide it by 0', history)).toBeNull();
    expect(evaluateArithmeticFollowup('divide it by 777', [{ name: 'Forge Bot', text: 'The current time is 10:55 WAT.' }])).toBeNull();
  });
  it('does not pretend to solve expressions with unknown variables', () => {
    expect(evaluateArithmetic('2x - 7y + 88 x 27')).toBeNull();
  });
  it('formats numeric answers consistently', () => {
    expect(formatArithmeticAnswer(14100)).toBe('14,100');
  });
});

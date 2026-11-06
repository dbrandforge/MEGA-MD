const MODES = Object.freeze({
  noob: { types: ['addition', 'subtraction'], range: [1, 20], negativeRate: 0 },
  easy: { types: ['addition', 'subtraction', 'multiplication', 'division', 'missing'], range: [2, 30], negativeRate: 0.05 },
  normal: { types: ['arithmetic', 'division', 'missing', 'percent', 'fraction', 'order'], range: [3, 60], negativeRate: 0.05 },
  hard: { types: ['arithmetic', 'percent', 'fraction', 'ratio', 'order', 'algebra', 'sequence'], range: [5, 120], negativeRate: 0.10 },
  extreme: { types: ['algebra', 'sequence', 'powers', 'roots', 'ratio', 'percent', 'order'], range: [8, 180], negativeRate: 0.10 },
  impossible: { types: ['algebra', 'quadratic', 'sequence', 'powers', 'roots', 'logs', 'ratio'], range: [10, 250], negativeRate: 0.125 },
  impossible2: { types: ['quadratic', 'logs', 'gcd', 'lcm', 'sequence', 'powers', 'algebra'], range: [12, 400], negativeRate: 0.15 }
});
const pick = values => values[Math.floor(Math.random() * values.length)];
const int = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const gcd = (a, b) => b ? gcd(b, a % b) : Math.abs(a);

function arithmetic(mode, includeNegative) {
  const [min, max] = MODES[mode].range;
  const operators = includeNegative || mode === 'noob' ? ['+', '-'] : ['+', '-', '×', '÷'];
  let a = int(min, max), b = int(min, max);
  const op = pick(operators);
  if (op === '÷') {
    b = int(2, Math.min(15, max));
    const quotient = int(2, Math.min(20, max));
    a = b * quotient;
    return { expression: a + ' ÷ ' + b, answer: quotient, type: 'division' };
  }
  if (op === '×') {
    a = int(2, Math.min(20, max));
    b = int(2, Math.min(12, max));
    return { expression: a + ' × ' + b, answer: a * b, type: 'multiplication' };
  }
  if (includeNegative) {
    if (op === '+') {
      if (b >= a) [a, b] = [b + 1, a];
      return { expression: a + ' + (-' + b + ')', answer: a - b, type: 'addition' };
    }
    return { expression: a + ' - (-' + b + ')', answer: a + b, type: 'subtraction' };
  }
  if (op === '+') return { expression: a + ' + ' + b, answer: a + b, type: 'addition' };
  if (b > a) [a, b] = [b, a];
  return { expression: a + ' - ' + b, answer: a - b, type: 'subtraction' };
}

function buildQuestion(type, mode, includeNegative) {
  const [min, max] = MODES[mode].range;
  const n = (low = min, high = max) => int(low, high);
  switch (type) {
    case 'addition': case 'subtraction': case 'multiplication': case 'division': case 'arithmetic':
      return arithmetic(mode, includeNegative);
    case 'missing': {
      const a = n(2, 25), b = n(2, 25);
      return { expression: '? + ' + a + ' = ' + (a + b), answer: b, type };
    }
    case 'percent': {
      const percent = pick([5, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75]);
      const base = n(20, 200);
      const cleanBase = Number.isInteger(base * percent / 100) ? base : Math.ceil(base / 100) * 100;
      return { expression: percent + '% of ' + cleanBase, answer: cleanBase * percent / 100, type };
    }
    case 'fraction': {
      const denominator = n(2, 12), multiplier = n(2, 15);
      const numerator = int(1, denominator - 1), whole = denominator * multiplier;
      return { expression: numerator + '/' + denominator + ' of ' + whole, answer: numerator * multiplier, type };
    }
    case 'ratio': {
      const a = n(2, 9), b = n(2, 9), unit = n(3, 15), total = (a + b) * unit;
      return { expression: 'Split ' + total + ' in the ratio ' + a + ':' + b + '. Find the larger share.', answer: Math.max(a, b) * unit, type };
    }
    case 'order': {
      const a = n(2, 20), b = n(2, 12), c = n(2, 12);
      return { expression: a + ' + ' + b + ' × ' + c, answer: a + b * c, type };
    }
    case 'algebra': {
      const x = n(2, 15), a = n(2, 9), b = n(2, 20);
      return { expression: 'Solve for x: ' + a + 'x + ' + b + ' = ' + (a * x + b), answer: x, type };
    }
    case 'sequence': {
      const start = n(1, 30), step = n(2, 12);
      const values = Array.from({ length: 4 }, (_, index) => start + step * index);
      return { expression: 'Find the next number: ' + values.join(', ') + ', ?', answer: start + step * 4, type };
    }
    case 'powers': {
      const base = n(2, mode === 'impossible2' ? 8 : 6), power = pick([2, 3, 4]);
      const subtract = n(1, Math.min(30, (base ** power) - 1));
      return { expression: base + '^' + power + ' - ' + subtract, answer: base ** power - subtract, type };
    }
    case 'roots': {
      const root = n(3, 20), add = n(2, 30);
      return { expression: '√' + (root * root) + ' + ' + add, answer: root + add, type };
    }
    case 'quadratic': {
      const rootA = n(2, 12), rootB = n(rootA + 1, rootA + 12);
      return { expression: 'Solve x² - ' + (rootA + rootB) + 'x + ' + (rootA * rootB) + ' = 0. Give the smaller root.', answer: rootA, type };
    }
    case 'logs': {
      const base = pick([2, 3, 5, 10]), exponent = n(2, 6);
      return { expression: 'Find x: log' + base + '(' + (base ** exponent) + ') = x', answer: exponent, type };
    }
    case 'gcd': {
      const factor = n(2, 15), a = n(2, 12), b = n(2, 12);
      return { expression: 'Find the HCF of ' + (factor * a) + ' and ' + (factor * b), answer: factor * gcd(a, b), type };
    }
    case 'lcm': {
      const a = n(2, 12), b = n(2, 12);
      return { expression: 'Find the LCM of ' + a + ' and ' + b, answer: (a * b) / gcd(a, b), type };
    }
    default: return arithmetic(mode, false);
  }
}

export const MATH_NEGATIVE_RATES = Object.freeze(Object.fromEntries(
  Object.entries(MODES).map(([mode, settings]) => [mode, settings.negativeRate])
));
export function getMathNegativeQuestionCount(mode, totalRounds) {
  return Math.floor(Math.max(0, totalRounds) * (MATH_NEGATIVE_RATES[mode] ?? MATH_NEGATIVE_RATES.normal));
}
export function generateMathQuestion(mode = 'normal', options = {}) {
  const selectedMode = Object.hasOwn(MODES, mode) ? mode : 'normal';
  const includeNegative = selectedMode !== 'noob' && options.includeNegative === true;
  const type = includeNegative ? 'arithmetic' : pick(MODES[selectedMode].types);
  const question = buildQuestion(type, selectedMode, includeNegative);
  if (!Number.isInteger(question.answer)) throw new Error('Maths generator produced a non-integer answer for ' + selectedMode);
  return {
    expression: question.expression,
    answer: String(Object.is(question.answer, -0) ? 0 : question.answer),
    mode: selectedMode,
    type: question.type,
    hasNegative: /(^|[^\w])-\d/.test(question.expression),
    time: ({ noob: 20000, easy: 20000, normal: 30000, hard: 45000, extreme: 60000, impossible: 60000, impossible2: 60000 })[selectedMode]
  };
}

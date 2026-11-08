// Safe arithmetic evaluator for simple conversational maths.
// Supports +, -, *, /, ^, %, parentheses and implicit multiplication is intentionally excluded.
function integerGcd(a, b) {
  a = Math.abs(Math.trunc(a)); b = Math.abs(Math.trunc(b));
  while (b) [a, b] = [b, a % b];
  return a;
}

function evaluateSpecialArithmetic(raw) {
  const text = String(raw || '').trim().replace(/,/g, '');
  let match = text.match(/^(?:what is |calculate |compute )?(?:the )?square root of ([0-9]+(?:\.[0-9]+)?)\??$/i)
    || text.match(/^(?:what is |calculate )?sqrt\s*\(?([0-9]+(?:\.[0-9]+)?)\)?\??$/i)
    || text.match(/^√\s*([0-9]+(?:\.[0-9]+)?)\??$/);
  if (match) return Math.sqrt(Number(match[1]));
  match = text.match(/^(?:what is |calculate |compute )?(?:the )?cube root of (-?[0-9]+(?:\.[0-9]+)?)\??$/i)
    || text.match(/^∛\s*(-?[0-9]+(?:\.[0-9]+)?)\??$/)
    || text.match(/^cbrt\s*\(?(-?[0-9]+(?:\.[0-9]+)?)\)?\??$/i);
  if (match) return Math.cbrt(Number(match[1]));
  match = text.match(/^(?:what is |calculate )?(?:the )?(?:h\.?c\.?f\.?|g\.?c\.?d\.?) of (\d+) and (\d+)\??$/i);
  if (match) return integerGcd(Number(match[1]), Number(match[2]));
  match = text.match(/^(?:what is |calculate )?(?:the )?l\.?c\.?m\.? of (\d+) and (\d+)\??$/i);
  if (match) {
    const a = Number(match[1]), b = Number(match[2]);
    return a === 0 || b === 0 ? 0 : Math.abs((a / integerGcd(a, b)) * b);
  }
  return undefined;
}

export function evaluateArithmetic(input = '') {
  const raw = String(input || '').trim();
  if (!raw || raw.length > 120) return null;
  const special = evaluateSpecialArithmetic(raw);
  if (special !== undefined) return Number.isFinite(special) ? Math.round((special + Number.EPSILON) * 1e10) / 1e10 : null;

  let expression = raw
    .replace(/^[\s]*(?:what is|what's|calculate|compute|solve|multiply|add|subtract|divide|evaluate)\s+/i, '')
    .replace(/\b(?:multiplied by|times)\b/gi, '*')
    .replace(/\b(?:divided by|over)\b/gi, '/')
    .replace(/\bplus\b/gi, '+')
    .replace(/\bminus\b/gi, '-')
    .replace(/\bthen divide it by\b/gi, '/')
    .replace(/[?=]/g, '')
    .replace(/[×✕]/g, '*')
    .replace(/\s[xX]\s/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/,/g, '')
    .trim();

  // Only evaluate a clear arithmetic expression containing at least one operator.
  if (!expression || !/[+*/^%\-]/.test(expression)) return null;
  if (!/^[\d\s.+*/^%()\-]+$/.test(expression)) return null;

  const tokens = expression.match(/\d+(?:\.\d+)?|[()+*/^%-]/g);
  if (!tokens || tokens.join('') !== expression.replace(/\s+/g, '')) return null;

  let index = 0;
  const peek = () => tokens[index];
  const consume = () => tokens[index++];

  function primary() {
    const token = consume();
    if (token === '(') {
      const value = addSub();
      if (consume() !== ')') throw new Error('Unmatched parenthesis');
      return value;
    }
    if (token === '+') return primary();
    if (token === '-') return -primary();
    if (!token || !/^\d+(?:\.\d+)?$/.test(token)) throw new Error('Expected number');
    return Number(token);
  }

  function power() {
    const left = primary();
    if (peek() === '^') {
      consume();
      return left ** power();
    }
    return left;
  }

  function multiplyDivide() {
    let value = power();
    while (['*', '/', '%'].includes(peek())) {
      const operator = consume();
      const right = power();
      if ((operator === '/' || operator === '%') && right === 0) throw new Error('Division by zero');
      if (operator === '*') value *= right;
      if (operator === '/') value /= right;
      if (operator === '%') value %= right;
    }
    return value;
  }

  function addSub() {
    let value = multiplyDivide();
    while (peek() === '+' || peek() === '-') {
      const operator = consume();
      const right = multiplyDivide();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  }

  try {
    const result = addSub();
    if (index !== tokens.length || !Number.isFinite(result)) return null;
    const rounded = Math.round((result + Number.EPSILON) * 1e10) / 1e10;
    return Object.is(rounded, -0) ? 0 : rounded;
  } catch {
    return null;
  }
}

export function formatArithmeticAnswer(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 10 }).format(value);
}

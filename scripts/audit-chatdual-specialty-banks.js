import yoruba from '../data/chatDual/chatDual_yoruba_data.js';
import conversational from '../data/chatDual/chatDual_conversational_data.js';
import gist from '../data/chatDual/chatDual_gist_data.js';
import money from '../data/chatDual/chatDual_money_data.js';
import relationship from '../data/chatDual/chatDual_rel_life_data.js';

const banks = [
  ['yoruba', yoruba, 400],
  ['conversational', conversational, 500],
  ['gist', gist, 375],
  ['money', money, 375],
  ['relationship', relationship, 450],
];

const normalize = value => String(value ?? '')
  .normalize('NFKC')
  .toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}₦]+/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function tokenSet(value) {
  return new Set(normalize(value).split(' ').filter(Boolean));
}

function similarity(left, right) {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

let failed = false;
let totalRows = 0;

for (const [name, rows, expected] of banks) {
  const validRows = Array.isArray(rows) ? rows : [];
  const aValues = validRows.map(row => normalize(row?.a));
  const bValues = validRows.map(row => normalize(row?.b));
  const pairValues = validRows.map((row, index) => `${aValues[index]}\u0000${bValues[index]}`);
  const uniqueA = new Set(aValues).size;
  const uniqueB = new Set(bValues).size;
  const uniquePairs = new Set(pairValues).size;
  const malformed = validRows.filter(row =>
    typeof row?.a !== 'string' || typeof row?.b !== 'string' ||
    !row.a.trim() || !row.b.trim() || normalize(row.a) === normalize(row.b)
  ).length;

  // Flag highly similar side entries, not merely exact string duplicates.
  const values = [...validRows.flatMap(row => [row?.a, row?.b])].filter(value => typeof value === 'string');
  const nearDuplicatePairs = [];
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      if (normalize(values[i]) === normalize(values[j])) continue;
      if (similarity(values[i], values[j]) >= 0.88) {
        nearDuplicatePairs.push([i, j]);
      }
    }
  }

  const inventoryOk = validRows.length === expected;
  const uniquenessOk = uniqueA / Math.max(1, expected) >= 0.95 &&
    uniqueB / Math.max(1, expected) >= 0.95 &&
    uniquePairs === expected;
  const structureOk = malformed === 0;
  const bankOk = inventoryOk && uniquenessOk && structureOk;
  failed ||= !bankOk;
  totalRows += validRows.length;

  console.log(JSON.stringify({
    bank: name,
    rows: validRows.length,
    expected,
    uniqueA,
    uniqueB,
    uniquePairs,
    malformed,
    nearDuplicatePairs: nearDuplicatePairs.length,
    inventoryOk,
    uniquenessOk,
    structureOk,
    status: bankOk ? 'PASS' : 'REWRITE_REQUIRED',
  }));
}

console.log(JSON.stringify({ totalRows, expectedTotal: 2100, status: totalRows === 2100 && !failed ? 'PASS' : 'REWRITE_REQUIRED' }));
if (totalRows !== 2100 || failed) process.exitCode = 1;

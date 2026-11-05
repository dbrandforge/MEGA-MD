// Read-only audit for review-only Trivia candidate JSONL files.
// This never assigns difficulty or promotes records into the live bank.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/triviaCandidates');
const normalize = value => String(value ?? '').normalize('NFKC')
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const files = (await readdir(root)).filter(name => name.endsWith('.jsonl')).sort();
const ids = new Map();
const wording = new Map();
const bySource = {};
const byProposal = {};
const errors = [];
const reviewFlags = [];
const quarantinedDuplicateIds = new Set(['otqa-video-games-0031', 'otqa-video-games-0055', 'otqa-video-games-0056', 'otqa-video-games-0129']);
const quarantinedDuplicatesSeen = new Set();
let total = 0;
let ungraded = 0;
let invalidOptions = 0;
let missingCategory = 0;
let duplicateWording = 0;

for (const file of files) {
  const rows = (await readFile(path.join(root, file), 'utf8')).split(/\r?\n/);
  for (let index = 0; index < rows.length; index++) {
    const line = rows[index].trim();
    if (!line) continue;
    const label = file + ':' + (index + 1);
    let question;
    try {
      question = JSON.parse(line);
    } catch (error) {
      errors.push(label + ': invalid JSON (' + error.message + ')');
      continue;
    }
    if (!question || typeof question !== 'object' || Array.isArray(question)) {
      errors.push(label + ': record must be a JSON object');
      continue;
    }
    total++;
    const source = question.sourceCategory || 'unclassified-source';
    const proposal = question.proposedCategory || 'needs-category-review';
    bySource[source] = (bySource[source] || 0) + 1;
    byProposal[proposal] = (byProposal[proposal] || 0) + 1;

    if (!question.id || ids.has(question.id)) {
      errors.push(label + ': missing or duplicate candidate ID ' + (question.id || '(empty)'));
    } else {
      ids.set(question.id, label);
    }

    const fingerprint = normalize(question.question);
    if (!fingerprint) errors.push(label + ': empty question text');
    else if (wording.has(fingerprint)) {
      duplicateWording++;
      if (quarantinedDuplicateIds.has(question.id)) {
        quarantinedDuplicatesSeen.add(question.id);
        reviewFlags.push(label + ': duplicate wording is quarantined and must not be promoted');
      } else {
        errors.push(label + ': duplicate wording also found at ' + wording.get(fingerprint));
      }
    } else wording.set(fingerprint, label);

    const options = Array.isArray(question.options) ? question.options : [];
    const normalizedOptions = options.map(normalize);
    if (options.length !== 4 || normalizedOptions.some(value => !value) ||
        new Set(normalizedOptions).size !== 4 ||
        !Number.isInteger(question.answer) || question.answer < 0 || question.answer > 3) {
      invalidOptions++;
      errors.push(label + ': requires four distinct non-empty options and answer index 0–3');
    }

    if (!question.proposedCategory) {
      missingCategory++;
      reviewFlags.push(label + ': category not assigned; inspect content rather than trusting source pool');
    }
    if (!question.difficulty) {
      ungraded++;
      reviewFlags.push(label + ': difficulty not assigned');
    }
    if (/[ÃÂâ€]|�/.test(question.question || '') ||
        options.some(option => /[ÃÂâ€]|�/.test(String(option)))) {
      reviewFlags.push(label + ': possible character-encoding corruption');
    }
    if (String(question.question || '').trim().length < 24) {
      reviewFlags.push(label + ': unusually short stem; check whether it is a complete question');
    }
    if (!/[?]/.test(question.question || '')) {
      reviewFlags.push(label + ': stem has no question mark; check clarity and whether it is a usable prompt');
    }
    if (/highest[- ]grossing|#\s?\d+ on the list|this year|current record|latest record/i.test(question.question || '')) {
      reviewFlags.push(label + ': potentially time-sensitive or ranking-dependent fact; verify and date-anchor');
    }
  }
}

console.log('Trivia candidate audit: ' + total + ' records across ' + files.length + ' JSONL files');
console.log('Unique IDs: ' + ids.size + ' | Duplicate wording: ' + duplicateWording + ' | Ungraded: ' + ungraded);
console.log('Records needing category review: ' + missingCategory + ' | Invalid option/answer structures: ' + invalidOptions);
console.log('Quarantined duplicate records: ' + quarantinedDuplicatesSeen.size + ' (excluded from promotion)');
console.log('Editorial review flags: ' + reviewFlags.length);
console.log('\nBy source pool:');
for (const [name, count] of Object.entries(bySource).sort()) console.log('- ' + name + ': ' + count);
console.log('\nBy proposed live category:');
for (const [name, count] of Object.entries(byProposal).sort()) console.log('- ' + name + ': ' + count);
if (reviewFlags.length) {
  console.log('\nEditorial review flags (first 100):');
  for (const flag of reviewFlags.slice(0, 100)) console.log('- ' + flag);
  if (reviewFlags.length > 100) console.log('- ... ' + (reviewFlags.length - 100) + ' additional flags omitted');
}
for (const id of quarantinedDuplicateIds) {
  if (!quarantinedDuplicatesSeen.has(id)) errors.push('Quarantine entry is stale or no longer a duplicate: ' + id);
}
if (errors.length) {
  console.error('\nCandidate integrity findings: ' + errors.length);
  for (const error of errors.slice(0, 100)) console.error('- ' + error);
  if (errors.length > 100) console.error('- ... ' + (errors.length - 100) + ' additional findings omitted');
  process.exitCode = 1;
}
console.log('\nNOTE: Candidate records are not approved/live questions. This audit does not fact-check answers, establish difficulty, grant rights, or promote records.');

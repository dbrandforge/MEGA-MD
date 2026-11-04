// Fetches OpenTriviaQA into a REVIEW-ONLY staging file.
// It does not assign difficulty, approve answers, or add questions to the live bank.
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const SOURCE_REPO = 'https://github.com/uberspot/OpenTriviaQA';
const SOURCE_BASE = 'https://raw.githubusercontent.com/uberspot/OpenTriviaQA/master/categories';
const SOURCE_LICENSE = 'CC BY-SA 4.0';
const SOURCE_CATEGORIES = [
  'music', 'movies', 'television', 'geography', 'history', 'literature',
  'sports', 'general', 'hobbies', 'humanities', 'entertainment',
  'celebrities', 'animals', 'brain-teasers'
];
const SAFE_PROPOSALS = {
  music: 'music', movies: 'movies', television: 'series',
  geography: 'geography', history: 'history', literature: 'literature'
};
const normalize = value => String(value || '').normalize('NFKC')
  .toLowerCase().replace(/[^\\p{L}\\p{N}]+/gu, ' ').trim();
const stableId = value => 'otqa-' + createHash('sha1').update(value).digest('hex').slice(0, 14);

function parseCategory(raw, sourceCategory) {
  const records = [];
  let current = null;
  let activeField = null;
  const flush = () => {
    if (!current) return;
    const options = ['A', 'B', 'C', 'D'].map(key => current.options[key]?.trim() || '');
    const answer = normalize(current.correct);
    const answerIndex = options.findIndex(option => normalize(option) === answer);
    if (current.question?.trim() && answerIndex >= 0 &&
        options.every(Boolean) && new Set(options.map(normalize)).size === 4) {
      const fingerprint = normalize(current.question);
      records.push({
        id: stableId(sourceCategory + ':' + fingerprint),
        question: current.question.trim(),
        options,
        answer: answerIndex,
        sourceCategory,
        proposedCategory: SAFE_PROPOSALS[sourceCategory] || null,
        difficulty: null,
        status: 'needs-editorial-review',
        source: SOURCE_REPO,
        license: SOURCE_LICENSE
      });
    }
    current = null;
    activeField = null;
  };

  for (const rawLine of String(raw).replace(/\\r/g, '').split('\\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('#Q ')) {
      flush();
      current = { question: line.slice(3).trim(), options: {} };
      activeField = 'question';
      continue;
    }
    if (!current) continue;
    if (line.startsWith('^ ')) {
      current.correct = line.slice(2).trim();
      activeField = 'correct';
      continue;
    }
    const option = line.match(/^([A-D])\\s+(.*)$/);
    if (option) {
      current.options[option[1]] = option[2].trim();
      activeField = option[1];
      continue;
    }
    if (activeField === 'question' || activeField === 'correct') {
      current[activeField] += ' ' + line;
    } else if (activeField && current.options[activeField] !== undefined) {
      current.options[activeField] += ' ' + line;
    }
  }
  flush();
  return records;
}

const combined = [];
const seen = new Set();
for (const category of SOURCE_CATEGORIES) {
  const response = await fetch(`${SOURCE_BASE}/${category}`);
  if (!response.ok) {
    console.warn(`SKIP ${category}: HTTP ${response.status}`);
    continue;
  }
  const parsed = parseCategory(await response.text(), category);
  let added = 0;
  for (const question of parsed) {
    const fingerprint = normalize(question.question);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    combined.push(question);
    added += 1;
  }
  console.log(`${category}: ${parsed.length} valid candidates, ${added} unique additions`);
}

await mkdir('data/triviaCandidates', { recursive: true });
const output = {
  generatedAt: new Date().toISOString(),
  source: SOURCE_REPO,
  license: SOURCE_LICENSE,
  attribution: 'OpenTriviaQA contributors — https://github.com/uberspot/OpenTriviaQA',
  warning: 'Review every item for factual accuracy, category fit, ambiguity, cultural fit and rights before assigning a difficulty or promoting it to the live Trivia bank.',
  count: combined.length,
  questions: combined
};
await writeFile('data/triviaCandidates/open-trivia-qa.review.json', JSON.stringify(output, null, 2) + '\\n');
console.log(`\\nStaged ${combined.length} review-only candidates. None were added to the live bank.`);

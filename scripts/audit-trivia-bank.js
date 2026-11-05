import { NIGERIA_TRIVIA } from '../data/nigeriaTrivia.js';
import { auditTriviaBank, TRIVIA_DIFFICULTY_LEVELS, TRIVIA_BANK_TARGETS } from '../lib/triviaBankAudit.js';

const report = auditTriviaBank(NIGERIA_TRIVIA);
const requiredArg = process.argv.slice(2).find(arg => arg.startsWith('--require='));
const requiredCategories = requiredArg
  ? requiredArg.slice('--require='.length).split(',').map(value => value.trim()).filter(Boolean)
  : Object.keys(report.categories);
const unknownCategories = requiredCategories.filter(category => !Object.hasOwn(report.categories, category));
const blockingDeficits = report.deficits.filter(deficit => requiredCategories.includes(deficit.category));
console.log(`Trivia bank: ${report.totalQuestions} questions / ${report.uniqueIds} unique IDs`);
for (const [category, result] of Object.entries(report.categories)) {
  const grades = TRIVIA_DIFFICULTY_LEVELS.map(level => `${level}: ${result.byDifficulty[level]}`).join(' | ');
  console.log(`${category.padEnd(16)} ${String(result.total).padStart(5)} total | ${grades}`);
}
if (report.errors.length) {
  console.error('\nQuality errors:');
  for (const error of report.errors) console.error(`- ${error}`);
}
if (report.deficits.length) {
  console.error(`\nCoverage deficits: ${report.deficits.length} category/grade combinations remain below ${TRIVIA_BANK_TARGETS.perDifficulty}.`);
  for (const deficit of report.deficits) {
    console.error(`- ${deficit.category} / ${deficit.difficulty}: ${deficit.actual}/${deficit.required} (need ${deficit.missing})`);
  }
}
if (unknownCategories.length) {
  console.error(`\nUnknown required Trivia categories: ${unknownCategories.join(', ')}`);
  process.exitCode = 1;
} else if (report.errors.length || blockingDeficits.length) {
  console.error(`\nRelease gate failed for required categories: ${requiredCategories.join(', ')}`);
  for (const deficit of blockingDeficits) {
    console.error(`- ${deficit.category} / ${deficit.difficulty}: ${deficit.actual}/${deficit.required} (need ${deficit.missing})`);
  }
  process.exitCode = 1;
} else if (requiredCategories.length === Object.keys(report.categories).length) {
  console.log('\nPASS: every Trivia category meets the 200-question / four-grade initial release requirement.');
} else {
  const deferredCount = report.deficits.length - blockingDeficits.length;
  console.log(`\nPASS: staged release categories meet 200 questions / 50 per grade (${requiredCategories.join(', ')}). ${deferredCount} incomplete category/grade pools remain visible for later expansion.`);
}

import { NIGERIA_TRIVIA } from '../data/nigeriaTrivia.js';
import { auditTriviaBank, TRIVIA_DIFFICULTY_LEVELS, TRIVIA_BANK_TARGETS } from '../lib/triviaBankAudit.js';

const report = auditTriviaBank(NIGERIA_TRIVIA);
const args = process.argv.slice(2);
const requiredArg = args.find(arg => arg.startsWith('--require='));
const requiredGradeArg = args.find(arg => arg.startsWith('--require-grade='));
const requiredCategories = requiredArg
  ? requiredArg.slice('--require='.length).split(',').map(value => value.trim()).filter(Boolean)
  : Object.keys(report.categories);
const requiredGrades = requiredGradeArg
  ? requiredGradeArg.slice('--require-grade='.length).split(',').map(value => {
      const [category, difficulty] = value.trim().split(':');
      return { category, difficulty };
    }).filter(value => value.category && value.difficulty)
  : [];
const unknownCategories = requiredCategories.filter(category => !Object.hasOwn(report.categories, category));
const unknownRequiredGrades = requiredGrades.filter(({ category, difficulty }) =>
  !Object.hasOwn(report.categories, category) || !TRIVIA_DIFFICULTY_LEVELS.includes(difficulty)
);
const blockingDeficits = report.deficits.filter(deficit => requiredCategories.includes(deficit.category));
const blockingGradeDeficits = report.deficits.filter(deficit =>
  requiredGrades.some(required => required.category === deficit.category && required.difficulty === deficit.difficulty)
);
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
if (unknownCategories.length || unknownRequiredGrades.length) {
  if (unknownCategories.length) {
    console.error(`\nUnknown required Trivia categories: ${unknownCategories.join(', ')}`);
  }
  if (unknownRequiredGrades.length) {
    console.error('\nUnknown required Trivia grade checks: ' + unknownRequiredGrades.map(
      value => value.category + ':' + value.difficulty
    ).join(', '));
  }
  process.exitCode = 1;
} else if (report.errors.length || blockingDeficits.length || blockingGradeDeficits.length) {
  console.error(`\nRelease gate failed for required categories: ${requiredCategories.join(', ')}`);
  for (const deficit of blockingDeficits) {
    console.error(`- ${deficit.category} / ${deficit.difficulty}: ${deficit.actual}/${deficit.required} (need ${deficit.missing})`);
  }
  for (const deficit of blockingGradeDeficits) {
    console.error(`- required grade ${deficit.category} / ${deficit.difficulty}: ${deficit.actual}/${deficit.required} (need ${deficit.missing})`);
  }
  process.exitCode = 1;
} else if (requiredCategories.length === Object.keys(report.categories).length && requiredGrades.length === 0) {
  console.log('\nPASS: every Trivia category meets the 200-question / four-grade initial release requirement.');
} else {
  const deferredCount = report.deficits.length - new Set([
    ...blockingDeficits.map(d => d.category + ':' + d.difficulty),
    ...blockingGradeDeficits.map(d => d.category + ':' + d.difficulty)
  ]).size;
  const gradeSummary = requiredGrades.length
    ? ' and required grades (' + requiredGrades.map(value => value.category + ':' + value.difficulty).join(', ') + ')'
    : '';
  console.log(`\nPASS: staged release categories meet 200 questions / 50 per grade (${requiredCategories.join(', ')})${gradeSummary}. ${deferredCount} incomplete category/grade pools remain visible for later expansion.`);
}

import { NIGERIA_TRIVIA } from '../data/nigeriaTrivia.js';
import { auditTriviaBank, TRIVIA_DIFFICULTY_LEVELS } from '../lib/triviaBankAudit.js';

const report = auditTriviaBank(NIGERIA_TRIVIA);
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
  console.error(`\nCoverage deficits: ${report.deficits.length} category/grade combinations remain below 250.`);
  for (const deficit of report.deficits) {
    console.error(`- ${deficit.category} / ${deficit.difficulty}: ${deficit.actual}/${deficit.required} (need ${deficit.missing})`);
  }
}
if (!report.ready) process.exitCode = 1;
else console.log('\nPASS: every Trivia category meets the 1,000-question / four-grade requirement.');

import { readdir, readFile } from 'node:fs/promises';
import { auditTriviaCandidates } from '../lib/triviaCandidateAudit.js';

const directory = 'data/triviaCandidates';
const files = (await readdir(directory)).filter(file => file.endsWith('.jsonl')).sort();
const rows = [];
const parseErrors = [];

for (const file of files) {
  const content = await readFile(\`\${directory}/\${file}\`, 'utf8');
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      rows.push({ ...JSON.parse(line), file: \`\${file}:line-\${index + 1}\` });
    } catch (error) {
      parseErrors.push(\`\${file}:line-\${index + 1}: \${error.message}\`);
    }
  }
}

const report = auditTriviaCandidates(rows);
console.log(\`Candidate files: \${files.length}\`);
console.log(\`Candidate rows: \${report.totalCandidates}\`);
console.log(\`Unique IDs: \${report.uniqueIds}\`);
console.log(\`Unique question wording: \${report.uniqueQuestionWordings}\`);
console.log('\\nBy proposed category:');
for (const [category, count] of Object.entries(report.byProposedCategory).sort()) {
  console.log(\`- \${category}: \${count}\`);
}
console.log('\\nBy source pool:');
for (const [category, count] of Object.entries(report.bySource).sort()) {
  console.log(\`- \${category}: \${count}\`);
}
const errors = [...parseErrors, ...report.errors];
if (errors.length) {
  console.error(\`\\nCandidate audit found \${errors.length} issue(s):\`);
  for (const error of errors) console.error(\`- \${error}\`);
  process.exitCode = 1;
} else {
  console.log('\\nPASS: all staged candidates have valid choices, answer indices and source metadata.');
}

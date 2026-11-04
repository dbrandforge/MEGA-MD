// Audit the review-only Trivia candidate inventory. This never promotes candidates.
const normalize = value => String(value || '').normalize('NFKC')
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function auditTriviaCandidates(rows) {
  const source = Array.isArray(rows) ? rows : [];
  const errors = [];
  const ids = new Set();
  const fingerprints = new Map();
  const bySource = {};
  const byProposedCategory = {};

  for (let index = 0; index < source.length; index += 1) {
    const row = source[index];
    const label = row?.id || row?.file || ('row-' + (index + 1));
    if (!row || typeof row !== 'object') {
      errors.push(label + ': candidate must be an object');
      continue;
    }
    if (!row.id || ids.has(row.id)) errors.push(label + ': missing or duplicate candidate ID');
    ids.add(row.id);
    const fingerprint = normalize(row.question);
    if (!fingerprint) errors.push(label + ': empty question text');
    else if (fingerprints.has(fingerprint)) {
      errors.push(label + ': duplicate question wording (also ' + fingerprints.get(fingerprint) + ')');
    } else fingerprints.set(fingerprint, label);

    if (!Array.isArray(row.options) || row.options.length !== 4) {
      errors.push(label + ': exactly four options are required');
    } else {
      const options = row.options.map(normalize);
      if (options.some(value => !value) || new Set(options).size !== 4) {
        errors.push(label + ': options must be non-empty and unique');
      }
      if (!Number.isInteger(row.answer) || row.answer < 0 || row.answer > 3) {
        errors.push(label + ': answer must be an option index from 0 to 3');
      }
    }
    if (row.difficulty !== null) errors.push(label + ': candidate must remain ungraded until review');
    if (row.status !== 'needs-editorial-review') errors.push(label + ': candidate is not marked for editorial review');
    if (!row.source || !row.license || !row.attribution) errors.push(label + ': source attribution and license are required');

    const sourceCategory = row.sourceCategory || 'unknown';
    const proposedCategory = row.proposedCategory || 'unclassified';
    bySource[sourceCategory] = (bySource[sourceCategory] || 0) + 1;
    byProposedCategory[proposedCategory] = (byProposedCategory[proposedCategory] || 0) + 1;
  }

  return {
    totalCandidates: source.length,
    uniqueIds: ids.size,
    uniqueQuestionWordings: fingerprints.size,
    bySource,
    byProposedCategory,
    errors,
    ready: errors.length === 0
  };
}

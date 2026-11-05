// Preserve symbol-only answers (for example currency symbols) during option validation.
export const normalizeTriviaOption = value => String(value ?? '').normalize('NFKC')
  .toLowerCase().replace(/\s+/g, ' ').trim();

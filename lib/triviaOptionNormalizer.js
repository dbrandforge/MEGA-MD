// Preserve currency symbols while normalizing answer options for duplicate checks.
export const normalizeTriviaOption = value => String(value ?? '').normalize('NFKC')
  .toLowerCase().replace(/[^\p{L}\p{N}\p{Sc}]+/gu, ' ').trim();

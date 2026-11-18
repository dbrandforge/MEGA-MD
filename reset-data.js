// Legacy broad reset intentionally disabled. It previously overwrote operational
// settings and could erase unrelated configuration. Use the allowlisted reset.
console.warn('[reset-data] Broad reset disabled for safety.');
console.warn('[reset-data] Run: npm run reset-user-memory -- --apply');
await import('./scripts/reset-user-memory.js');

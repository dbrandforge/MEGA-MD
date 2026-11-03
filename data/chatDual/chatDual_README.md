# Chat Dual Bank Expansion (isolated)

Content-only dual response packs for future integration.

## Files
- `chatDual_reasoned_core.js` — quality-first reasoned pairs (~175)
- `chatDual_reasoned_expand_out.js` — volume reasoned pairs (~2900)
- `chatDual_yoruba_pure.js` — pure Yoruba
- `chatDual_conversational.js` — pure conversational
- `chatDual_gist.js` — gist / story-pulling
- `chatDual_money.js` — financial / money talk
- `chatDual_rel_life.js` — relationship + life

## Status
NOT wired into plugins/chatbot.js or any production import.
Do not merge until primary developer reviews and integrates.

Shape: `{ a: string, b: string }` per pair.
Modes supported by design: pick a | pick b | merge | blend clauses.

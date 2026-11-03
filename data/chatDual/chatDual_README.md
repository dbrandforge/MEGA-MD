# Chat Dual Bank Expansion (isolated) — COMPLETE

Content-only dual response packs for future integration.

## Canonical entry
- `chatDual_expansion_index.js` — imports and merges everything; call `dualExpansionStats()`

## Data modules
| File | Content |
|------|---------|
| `chatDual_core_data.js` | 175 quality-first reasoned pairs (10 categories) |
| `expand_vol_0.js` … `expand_vol_3.js` | 2908 volume reasoned pairs |
| `chatDual_yoruba_data.js` | 400 pure Yoruba pairs |
| `chatDual_conversational_data.js` | 500 pure conversational pairs |
| `chatDual_gist_data.js` | 375 gist pairs |
| `chatDual_money_data.js` | 375 financial/money pairs |
| `chatDual_rel_life_data.js` | 450 relationship/life pairs |

## Totals
- Core: 175
- Expand: 2908
- Extras: 2100
- **Grand total pairs: 5183**

## Status
NOT wired into `plugins/chatbot.js` or any production import.
Do not merge until primary developer reviews and integrates.

Shape: `{ a: string, b: string }` per pair.
Modes supported by design: pick a | pick b | merge | blend clauses.

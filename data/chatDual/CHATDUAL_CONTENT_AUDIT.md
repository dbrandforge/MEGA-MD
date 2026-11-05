# ChatDual content quality audit

Audit scope: the 22 imported JavaScript content modules on `feat/forge-guard-chatdual-integration`.

## Verified inventory

- Total declared pairs: **5,183**.
- Core: 175 pairs.
- Expansion modules: 2,908 pairs across 16 files.
- Yoruba: 400 pairs.
- Conversational: 500 pairs.
- Gist: 375 pairs.
- Financial: 375 pairs.
- Relationship: 450 pairs.
- All 22 module hashes and byte sizes matched the supplied manifest in the prior import validation.

## Diversity findings

The 16 expansion modules were inspected individually. Each contains 181–182 rows, but only 31–32 distinct prompt strings and 24–30 distinct response strings. The repeated rows commonly vary only by short appended phrases such as “Simple”, “Next”, “Your move”, “Talk”, or “That is it”.

The specialty banks show the same five-rows-per-prompt pattern:

| Bank | Rows | Distinct prompts | Distinct responses |
|---|---:|---:|---:|
| Core | 175 | 175 | 136 |
| Conversational | 500 | 100 | 100 |
| Yoruba | 400 | 80 | 100 |
| Gist | 375 | 75 | 75 |
| Financial | 375 | 75 | 75 |
| Relationship | 450 | 90 | 75 |

These figures measure exact string diversity, not semantic diversity. They establish that the 5,183 figure is a row count, not 5,183 independently authored exchanges.

## Release decision

**Content quality is not yet release-ready.** Keep the bank's existing row inventory intact while content is rewritten and re-audited. Do not describe the bank as having 5,183 unique exchanges. The core bank is materially more varied than the mechanically expanded modules.

## Engineering follow-up

The selector has been extended to route the classifier's `friendship` intent into the relationship pool and `workLife` into the existing advice pool. Unit tests now explicitly exercise those paths and the major supported category routes. This does not alter the personality bank's ownership of pure dirty-talk prompts.


## Rewrite progress (2026-11-05)

The first expansion module, `ev_0_0.js`, has been rewritten without changing its 182-row inventory. Its 182 repeated prompt/response variants were replaced with 182 distinct, substantive sexual-health and consent response statements. Each row contains two different statements, and each side has 182 distinct strings. The rewrite covers consent, boundaries, safer sex, contraception, STI testing, symptoms that warrant clinical care, privacy, digital consent, aftercare, and coercion-aware safety.

A regression test now locks the module at 182 rows and verifies 182 distinct strings on both response sides. This is a first module-level correction, not a claim that the full 5,183-row bank is now release-ready. The other 15 expansion modules and the specialty banks still require the same substantive rewrite and re-audit.

The second expansion module, `ev_0_1.js`, has now also been rewritten while preserving its 182-row inventory. It contains 182 distinct statements on each response side, covering consent, boundaries, contraception, STI testing, digital privacy, safer-sex practices, aftercare, communication, and access to clinical support. The regression test now checks both rewritten modules independently. This remains partial progress: the remaining 14 expansion modules and specialty banks still require substantive rewriting and re-audit.

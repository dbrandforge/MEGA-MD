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

The third expansion module, `ev_0_2.js`, has now been rewritten with 182 distinct statements on each response side while preserving its 182-row inventory. The new material addresses consent and negotiation, sexual-health testing and prevention, contraception, clinical care, privacy, reproductive autonomy, trauma-informed communication, and relationship boundaries. The regression test now validates all three rewritten modules independently. Twelve expansion modules and the specialty banks remain outstanding; the full bank is still not release-ready.


### Fourth module checkpoint (2026-11-06)

`ev_0_3.js` was initially replaced at 182 rows, but CI exposed that the original module inventory was 181 rows. The module has now been restored to 181 rows, and the regression test checks the preserved inventory for all four modules (182, 182, 182, 181). Exact-string uniqueness is a structural check only: `ev_0_3.js` still contains templated, semantically repetitive statements and is not accepted as a substantive editorial rewrite. The remaining twelve expansion modules and specialty banks are not yet rewritten.

The first CI run for this checkpoint failed only on the expansion inventory assertion: 2,909 expansion pairs were observed instead of the expected 2,908 (5,184 total instead of 5,183). The row-count regression has been corrected on the feature branch; a fresh CI result is still required.


## Contextual response selection (2026-11-06)

The live chatbot now passes the current message and up to eight recent conversation messages into ChatDual. The selector scores each candidate pair against the current message, gives the current message greater weight than older context, and returns the A or B side with the stronger topical match. If neither side has a meaningful distinction, it uses a tie-break rather than pretending the evidence is decisive. The normal chatbot path uses this reasoned mode; explicit A, B, and both modes remain available to callers.

This is deterministic lexical relevance scoring informed by the existing intent classifier and conversation history. It is not an LLM-based semantic reasoning layer. The content still needs to be authored so the alternatives genuinely differ in angle and remain appropriate to the same situation. The fourth module, `ev_0_3.js`, remains a known content-quality blocker and has not yet been rewritten.


## Follow-up context routing (2026-11-06)

The selector now uses recent conversation context to recover the topic for short follow-ups (for example, "What if they say no?") when the current message does not introduce a clear new subject. The current message remains the primary scoring signal; older context contributes only a smaller relevance weight. A regression test covers recovery of a consent topic from the preceding turn.

The fourth expansion module, `ev_0_3.js`, has now been substantively rewritten while preserving its verified 181-row inventory. All 181 A statements and all 181 B statements are distinct, and no statement is shared across the two sides. The replacement content covers consent, boundaries, safer sex, contraception, STI/HIV prevention, clinical symptoms, privacy, dating safety, survivor support, accessibility, and inclusive care. Each A/B pair addresses the same broad situation from a different practical angle.

A dedicated regression check now locks the module at 181 rows, verifies 362 distinct statements, enforces a minimum response length, and rejects known legacy template fragments. These are structural and editorial guardrails, not a substitute for human review of every pair. Twelve expansion modules and the specialty banks remain outstanding; the complete 5,183-row bank is not release-ready.

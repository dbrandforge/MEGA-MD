# Trivia editorial triage — 2026-11-05

Scope: sample-based editorial inspection of review-only OpenTriviaQA candidates. This document records rejection/rewrite risks; it does not approve, grade, or promote any candidate.

## Music pool: rewrite/reject before promotion

The first 35 records in `open-trivia-qa-music.jsonl` show several patterns that make the source pool unsafe to count as playable questions without editorial work:

- `otqa-music-0001`–`0010`: several stems are bare member-name lists with no explicit question. They need a clear prompt (for example, identify the band) and fact verification.
- `otqa-music-0012`, `0014`, `0016`, `0017`, `0019`: chart positions, sales figures, dates and historical claims need authoritative source checks and precise date/territory framing.
- `otqa-music-0022`: contains obvious spelling/grammar corruption ("county singer", "move").
- `otqa-music-0023` and `0027`: answer options contain likely misspellings of artist names; correct before use.
- `otqa-music-0033`–`0034`: film-credit and historical claims need source verification; do not infer correctness from the source answer index.

The candidate audit's "no question mark" flag is useful but not sufficient: a statement with a question mark can still be ambiguous, outdated or factually wrong. Require a complete, unambiguous stem, independently verified answer, plausible distinct distractors, and an evidence-based grade.

## Lifestyle pool: category fit and regional relevance risks

The first 35 records in `open-trivia-qa-hobbies.jsonl` are heavily weighted toward US diner slang, food trivia, old product history and alcoholic beverages. Examples include `otqa-hobbies-0001`–`0012` (diner shorthand) and `otqa-hobbies-0023`–`0032` (country-specific alcoholic drinks).

These records should not be accepted as a balanced general Lifestyle bank merely because the source folder is labelled "hobbies". Reclassify suitable food/drink items to Food or Culture where appropriate; reject dated, obscure, unverifiable or low-value diner-code questions. Lifestyle should cover useful, globally understandable everyday-life themes and maintain meaningful Nigerian/African representation alongside international content.

## Promotion gate

A candidate is eligible only after all of the following are recorded:
1. Correct category based on the actual subject, not source filename.
2. Complete, clear question stem.
3. Independently verified correct answer.
4. Four distinct, plausible distractors with one unambiguous correct answer.
5. No duplicate or near-duplicate in the live bank or other approved pools.
6. Evidence-based Easy / Normal / Hard / Expert grade.
7. Regional and cultural relevance review.
8. Source attribution and license obligations retained.

Until then, all records remain review-only. Do not use candidate totals as playable coverage.

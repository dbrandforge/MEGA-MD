# Forge Guard Trivia Expansion — Continuity Checkpoint

Last verified: 2026-11-05
Repository: `dbrandforge/MEGA-MD`
Working branch: `forge/trivia-expansion-quality-gates`
Draft pull request: https://github.com/dbrandforge/MEGA-MD/pull/87

## Locked expansion target

**Initial release milestone:** every selectable Trivia category must have at least **100 approved, unique playable questions**, distributed evenly:

- Easy: 25
- Normal: 25
- Hard: 25
- Expert: 25

The long-term target remains **1,000 per category / 250 per difficulty**. Expand in subsequent quality-gated batches; this first milestone does not replace the long-term ambition.

Do not count raw candidate inventory as playable coverage. Do not assign difficulty or promote records automatically. Preserve the existing non-Trivia games and all current gameplay behavior unless separately authorized.

## Current live-bank baseline

- 133 questions in `data/nigeriaTrivia.js`
- 133 unique IDs
- 80 category/difficulty combinations below the 25-question initial-release grade target across the 20 player-selectable pools
- The Naira-symbol validation false positive was fixed with a symbol-preserving option normalizer and a regression test.
- Current coverage is still far below target. The live-bank audit is intentionally non-blocking in the candidate workflow so the baseline remains visible.

Selected live pool counts (categories overlap through aliases and the Nigeria subset; do not sum these rows):

| Selectable pool | Live questions | Easy | Normal | Hard | Expert |
|---|---:|---:|---:|---:|---:|
| Music | 10 | 3 | 5 | 1 | 1 |
| Football | 10 | 3 | 5 | 1 | 1 |
| Movies aggregate | 20 | 5 | 7 | 5 | 3 |
| Lifestyle | 11 | 5 | 2 | 2 | 2 |
| Geography | 20 | 7 | 11 | 1 | 1 |
| History | 10 | 2 | 5 | 1 | 2 |
| Culture | 10 | 4 | 4 | 1 | 1 |
| Food | 9 | 4 | 3 | 1 | 1 |
| Technology | 6 | 2 | 2 | 1 | 1 |
| Business | 8 | 1 | 4 | 2 | 1 |
| Science | 4 | 1 | 1 | 1 | 1 |
| Gaming | 4 | 1 | 1 | 1 | 1 |
| Literature | 4 | 1 | 1 | 1 | 1 |
| Nigeria | 63 | 28 | 35 | 0 | 0 |
| Nollywood | 6 | 2 | 2 | 1 | 1 |
| Hollywood | 4 | 1 | 1 | 1 | 1 |
| Bollywood | 3 | 1 | 1 | 1 | 0 |
| Animation | 3 | 0 | 1 | 1 | 1 |
| Series | 3 | 1 | 1 | 1 | 0 |
| Current Affairs | 7 | 2 | 2 | 1 | 1 |

The audit scope is aligned to the 20 actual player-facing category choices in the Trivia menu. Hidden legacy aliases (sports, everyday, tech) and the unadvertised empty general mode are not separate coverage targets. The command aliases still route sports to Football, everyday to Lifestyle, and tech to Technology; general is rejected.

## First approved content batch

Four original, source-linked Current Affairs questions were added (`fx001`–`fx004`), covering the 2025 FIFA Club World Cup winner, COP30 host city, tournament field size and total goals. Each carries a review date and an authoritative FIFA or UNFCCC source URL. The Current Affairs pool now has seven approved questions, including one each at Hard and Expert; it remains below the 25-per-grade milestone.

## Staged candidate inventory

Automated audit of 22 JSONL files:

- 18,653 staged records
- 18,653 unique IDs
- 4 duplicate-wording records explicitly quarantined; **18,649 non-quarantined records remain for editorial review**
- 8,958 records have no proposed live category
- 18,653 records are still ungraded
- 0 invalid four-option / answer-index structures
- 33,340 editorial review flags (many are expected because every record is ungraded or needs category review)

Candidate counts by source pool:

| Source pool | Records |
|---|---:|
| Animals | 1,000 |
| Brain teasers | 154 |
| Celebrities | 1,000 |
| Entertainment | 221 |
| For kids | 584 |
| General | 1,000 |
| Geography | 777 |
| History | 1,000 |
| Hobbies | 1,000 |
| Humanities | 948 |
| Literature | 1,000 |
| Movies | 996 |
| Music | 1,000 |
| Newest | 999 |
| People | 1,000 |
| Rated | 1,000 |
| Religion & faith | 520 |
| Science & technology | 1,000 |
| Sports | 1,000 |
| Television | 1,000 |
| Video games | 454 |
| World | 1,000 |
| **Total** | **18,653** |

Existing proposed-category counts are not approvals:

- Culture: 1,468
- Science: 1,000
- History: 1,000
- Lifestyle: 1,000
- Literature: 1,000
- Music: 1,000
- Series: 1,000
- Movies: 996
- Geography: 777
- Gaming: 454
- Needs category review: 8,958

## Quarantine

Four duplicate video-game prompts overlap with the Entertainment pool and must not be promoted:

- `otqa-video-games-0031`
- `otqa-video-games-0055`
- `otqa-video-games-0056`
- `otqa-video-games-0129`

Seventeen other duplicate rows were removed. The candidate audit fails if an unquarantined duplicate appears or a quarantine entry becomes stale.

## Confirmed source-quality risks

- The Sports source pool includes at least one Aristotle/metaphysics question; source folder labels are not reliable category assignments.
- Some Music entries are clue fragments, not complete question stems.
- Some text contains mojibake/encoding corruption.
- The Newest pool contains old ranking and grossing claims; these must be re-sourced, date-anchored or rejected.
- The candidate inventory is review-only and carries OpenTriviaQA CC BY-SA 4.0 attribution requirements.

## Automated validation

Latest verified branch checks:

- Candidate quality gate: **passed**
- Forge Bot unit tests: **passed** (includes currency-symbol regression test and the corrected category registry)
- Forge Guard integration tests: **passed**
- Trivia unit/regression tests: **passed**
- Blocking live-bank coverage audit: **failed as intended**; the 20 selectable pools remain below 100 total / 25 per grade
- No candidate records promoted into the live bank
- No merge or deployment performed

Useful commands:

- `npm run trivia:candidates:audit` — staged candidate integrity and editorial-flag report
- `npm run trivia:audit` — actual live-bank validation against the initial 100 / 25-per-grade release target

## Next execution sequence

1. Build the first 100-question bank for each selectable category, with 25 verified questions at each difficulty; prioritize categories with the largest deficits.
2. Fact-check every answer and distractor; rewrite incomplete stems and repair encoding.
3. Date-anchor or reject volatile/current-affairs and ranking-dependent claims.
4. Assign difficulty only after editorial review.
5. Fact-check and grade every first-release question; keep unreviewed OpenTriviaQA candidates staged and respect their CC BY-SA 4.0 attribution obligations.
6. Promote only approved questions into the live bank.
7. Run the live-bank audit and unit/integration tests.
8. Once every category meets 100 / 25 and all quality gates pass, merge and deploy the first milestone. Continue expanding toward 1,000 / 250 afterward.

## Recovery after an app interruption

Resume from this file and PR #87. The GitHub branch contains the committed work; reopening ChatGPT is not required to preserve it. Do not restart the audit from scratch and do not deploy this draft.

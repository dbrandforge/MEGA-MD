# Forge Guard Trivia Expansion — Continuity Checkpoint

Last verified: 2026-11-05
Repository: `dbrandforge/MEGA-MD`
Working branch: `forge/trivia-expansion-quality-gates`
Draft pull request: https://github.com/dbrandforge/MEGA-MD/pull/87

## Locked expansion target

Every selectable Trivia category must have at least **1,000 approved, unique playable questions**, distributed evenly:

- Easy: 250
- Normal: 250
- Hard: 250
- Expert: 250

Do not count raw candidate inventory as playable coverage. Do not assign difficulty or promote records automatically. Preserve the existing non-Trivia games and all current gameplay behavior unless separately authorized.

## Current live-bank baseline

- 129 questions in `data/nigeriaTrivia.js`
- 129 unique IDs
- 96 category/difficulty combinations below the 250-question grade target
- The Naira-symbol validation false positive was fixed with a symbol-preserving option normalizer and a regression test.
- Current coverage is still far below target. The live-bank audit is intentionally non-blocking in the candidate workflow so the baseline remains visible.

Selected live pool counts (categories overlap through aliases and the Nigeria subset; do not sum these rows):

| Selectable pool | Live questions |
|---|---:|
| Music | 10 |
| Football | 10 |
| Movies aggregate | 20 |
| Lifestyle | 11 |
| Geography | 20 |
| History | 10 |
| Culture | 10 |
| Food | 9 |
| Technology | 6 |
| Business | 8 |
| Science | 4 |
| Gaming | 4 |
| Literature | 4 |
| Nigeria | 63 |
| Nollywood | 6 |
| Hollywood | 4 |
| Bollywood | 3 |
| Animation | 3 |
| Series | 3 |
| Current Affairs | 3 |
| General | 0 |

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
- Forge Bot unit tests: **passed** (includes currency-symbol regression test)
- Forge Guard integration tests: **passed**
- No candidate records promoted into the live bank
- No merge or deployment performed

Useful commands:

- `npm run trivia:candidates:audit` — staged candidate integrity and editorial-flag report
- `npm run trivia:audit` — actual live-bank validation against the 1,000 / 250-per-grade target

## Next execution sequence

1. Classify the 8,958 unassigned candidates by actual question content, not source filename.
2. Fact-check every answer and distractor; rewrite incomplete stems and repair encoding.
3. Date-anchor or reject volatile/current-affairs and ranking-dependent claims.
4. Assign difficulty only after editorial review.
5. Fill the under-supplied pools: Nigeria, Nollywood, Hollywood, Bollywood, Animation, Food, Business, Current Affairs, Gaming, Science, and the remaining category gaps.
6. Promote only approved questions into the live bank.
7. Run the live-bank audit and unit/integration tests.
8. Merge and deploy only after all quality gates pass.

## Recovery after an app interruption

Resume from this file and PR #87. The GitHub branch contains the committed work; reopening ChatGPT is not required to preserve it. Do not restart the audit from scratch and do not deploy this draft.

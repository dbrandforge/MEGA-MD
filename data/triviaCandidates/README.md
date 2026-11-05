# Trivia candidate source attribution

The optional candidate-intake script can retrieve question material from:

- **Source:** OpenTriviaQA contributors
- **Repository:** https://github.com/uberspot/OpenTriviaQA
- **Source license:** Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)
- **License text:** https://creativecommons.org/licenses/by-sa/4.0/

Any candidate dataset generated from that source must retain attribution and the applicable ShareAlike terms. Do not treat the repository's root MIT license as changing the source dataset's license. Review source provenance and third-party rights before promoting any candidate into the live bot bank.

Imported records are staging material only. They must be fact-checked, checked for ambiguity and category fit, assigned an evidence-based difficulty, and reviewed for cultural and regional balance before use.

## Staged candidate batches (not live questions)

The first intake batches contain **12,175 review-only candidate records confirmed in committed JSONL files** across these source pools:

| Candidate pool | Staged | Proposed use |
|---|---:|---|
| Music | 1,000 | Music |
| Movies | 996 | Movies |
| Television | 1,000 | Series |
| History | 1,000 | History |
| Literature | 1,000 | Literature |
| Hobbies | 1,000 | Lifestyle |
| Humanities | 948 | Culture |
| Video games | 454 | Gaming |
| Science & technology | 1,000 | Unclassified; editorial split required |
| World | 1,000 | Unclassified; editorial split required |
| People | 1,000 | Unclassified; editorial split required |
| General | 1,000 | Unclassified; editorial split required |

These figures are **candidate counts, not approved/live bank counts**. Every record currently has `difficulty: null` and `status: needs-editorial-review`. The 250-per-grade target has not been met by these staged records. Reviewers must verify factual accuracy, correct answer, distractors, category fit, regional balance, duplication, currentness and third-party rights before assigning a grade and promoting a question.

The music batch excludes obvious lyric-fragment and multi-line entries. This is not a substitute for individual rights and accuracy review.

## Additional candidate intake batch

A third review-only batch adds **6,478 more records after duplicate cleanup**:

| Candidate pool | Staged | Proposed use |
|---|---:|---|
| Animals | 1,000 | Science |
| Celebrities | 1,000 | Unclassified |
| Sports | 1,000 | Unclassified; not all are association football |
| Newest | 999 | Unclassified; not automatically current affairs |
| Rated | 1,000 | Unclassified |
| Religion & faith | 520 | Culture |
| Entertainment | 221 | Unclassified |
| For kids | 584 | Unclassified |
| Brain teasers | 154 | Unclassified |

The committed JSONL files verified in the repository total **18,653 candidate records** across the available batches. The Television source file is present in the committed candidate inventory and provides a 1,000-record review-only Series pool. This is a raw review inventory, not the approved bank. Some sources overlap; global duplicate detection and editorial classification are required before promotion. Every record remains ungraded and excluded from live gameplay.

## Candidate audit commands

Run `npm run trivia:candidates:audit` to scan every staged JSONL file for malformed records, missing or duplicate IDs, duplicate question wording across files, invalid four-option answer structures, missing category proposals and ungraded records. The command is read-only and intentionally does not approve, grade or promote candidates.

Run `npm run trivia:audit` to audit the actual live `NIGERIA_TRIVIA` bank against the selectable category and difficulty coverage requirements. Candidate inventory totals must never be reported as live playable coverage.

The importer fetch list is unique by source category; duplicate entries previously caused redundant source requests and misleading repeated per-pool logs.


## Known editorial risks from sample inspection

- The `sports` source pool contains at least one clearly non-sports question (an Aristotle/metaphysics item), so source-folder membership cannot be trusted as a live category assignment.
- Some music records are clue fragments rather than complete question stems and need rewriting before approval.
- Some imported text shows possible mojibake/encoding corruption; the candidate audit flags suspicious characters.
- The `newest` pool contains historical ranking claims and outdated monetary/grossing figures. These must be independently re-sourced, date-anchored or rejected rather than treated as current facts.
- No automated difficulty assignment or source-category-to-live-category promotion is permitted.


## Duplicate cleanup and quarantine

The automated cross-file audit initially found 21 duplicate question stems. Seventeen duplicate rows were removed from the staged candidate files. Four remaining video-game prompts overlap with the Entertainment pool and are explicitly quarantined by candidate ID (`otqa-video-games-0031`, `otqa-video-games-0055`, `otqa-video-games-0056`, `otqa-video-games-0129`). They remain visible for provenance but are not eligible for promotion. The audit fails if any unquarantined duplicate appears or if a quarantine entry becomes stale.

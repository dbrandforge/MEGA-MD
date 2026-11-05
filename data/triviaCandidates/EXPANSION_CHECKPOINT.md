# Forge Guard Trivia Expansion — Continuity Checkpoint

Last verified: 2026-11-05
Repository: `dbrandforge/MEGA-MD`
Working branch: `forge/trivia-expansion-quality-gates`
Draft pull request: https://github.com/dbrandforge/MEGA-MD/pull/87

## Locked expansion target

**Initial release milestone:** every selectable Trivia category must have at least **200 approved, unique playable questions**, distributed evenly:

- Easy: 50
- Normal: 50
- Hard: 50
- Expert: 50

The long-term target remains **1,000 per category / 250 per difficulty**. Expand in subsequent quality-gated batches; this first milestone does not replace the long-term ambition.

Do not count raw candidate inventory as playable coverage. Do not assign difficulty or promote records automatically. Preserve the existing non-Trivia games and all current gameplay behavior unless separately authorized.

## Current live-bank baseline

- 270 questions in `data/nigeriaTrivia.js`
- 270 unique IDs
- 83 category/difficulty combinations below the 50-question first-cycle grade target across the 21 player-selectable pools
- The Naira-symbol validation false positive was fixed with a symbol-preserving option normalizer and a regression test.
- Current coverage is still far below target. The live-bank audit is intentionally non-blocking in the candidate workflow so the baseline remains visible.

Selected live pool counts (categories overlap through aliases and the Nigeria subset; do not sum these rows):

| Selectable pool | Live questions | Easy | Normal | Hard | Expert |
|---|---:|---:|---:|---:|---:|
| Music | 14 | 4 | 6 | 2 | 2 |
| Football | 14 | 4 | 6 | 2 | 2 |
| Movies aggregate | 23 | 6 | 7 | 5 | 5 |
| Lifestyle | 11 | 5 | 2 | 2 | 2 |
| Geography | 20 | 7 | 11 | 1 | 1 |
| History | 18 | 2 | 5 | 5 | 6 |
| Culture | 10 | 4 | 4 | 1 | 1 |
| Food | 9 | 4 | 3 | 1 | 1 |
| Technology | 6 | 2 | 2 | 1 | 1 |
| Business | 8 | 1 | 4 | 2 | 1 |
| Science | 12 | 3 | 3 | 3 | 3 |
| Gaming | 8 | 2 | 2 | 2 | 2 |
| Literature | 8 | 2 | 2 | 2 | 2 |
| Nigeria | 71 | 28 | 35 | 4 | 4 |
| Nollywood | 6 | 2 | 2 | 1 | 1 |
| Hollywood | 4 | 1 | 1 | 1 | 1 |
| Bollywood | 4 | 1 | 1 | 1 | 1 |
| Animation | 4 | 1 | 1 | 1 | 1 |
| Series | 4 | 1 | 1 | 1 | 1 |
| Current Affairs | 7 | 3 | 2 | 1 | 1 |
| Forge | 102 | 50 | 50 | 1 | 1 |

The audit scope is aligned to the 21 actual player-facing category choices in the Trivia menu. Hidden legacy aliases (sports, everyday, tech) and the unadvertised empty general mode are not separate coverage targets. The Forge pool is a dedicated cross-disciplinary session for branding, creative direction, design, marketing, content strategy and entrepreneurship. Its Easy grade is now complete at 50 questions; Normal, Hard and Expert each have one question and remain to be expanded. The command aliases still route sports to Football, everyday to Lifestyle, and tech to Technology; general is rejected.

## First approved content batch

Four original, source-linked Current Affairs questions were added (`fx001`–`fx004`), covering the 2025 FIFA Club World Cup winner, COP30 host city, tournament field size and total goals. Each carries a review date and an authoritative FIFA or UNFCCC source URL. The Current Affairs pool now has seven approved questions, including one each at Hard and Expert; it remains below the 25-per-grade milestone.

## Second approved content batch

Four original, source-linked Science questions were added (`fx005`–`fx008`), covering atmospheric composition, the definition of a light-year, the first confirmed pulsar planets, and pulsar-timing detection. The Science pool now has eight approved questions, evenly distributed at two per difficulty; it remains below the 25-per-grade milestone.

## Third approved content batch

Four original, source-linked Nigeria history questions were added (`fx009`–`fx012`), covering the 1954 Lyttleton Constitution, the 1914 amalgamation, and the Asquith and Elliot Commissions. They are tagged for the Nigeria regional pool at two Hard and two Expert. The Nigeria pool now has 67 approved questions, including its first Hard and Expert entries; both grades remain below 25.

## Fourth approved content batch

Three original, source-linked questions were added (`fx013`–`fx015`), filling the first missing difficulty slots in Bollywood (Expert), Animation (Easy), and Series (Expert). Sources are the Academy of Motion Picture Arts and Sciences, Studio Ghibli, and Apple TV episode listing. These additions also raise the Movies aggregate pool to 23. Each question has a review date and a source URL; all three remain far below the 25-per-grade release target.

## Fifth approved content batch

Two original, source-linked Nigeria history questions were added (`fx016`–`fx017`), one Hard and one Expert. They cover the West African Currency Board’s role before the CBN began issuing Nigerian currency, and the 1962 banknote inscription change reflecting Nigeria’s republican status. Both use Central Bank of Nigeria historical references and carry a review date. The Nigeria pool now has 69 approved questions, with three Hard and three Expert entries; these grades remain below the 25-question target.

## Sixth approved content batch

Four original, source-linked Science questions were added (`fx018`–`fx021`), one at each difficulty. They cover iron’s atomic number, the estimated age of the universe, electron capacity in a p subshell, and the Pauli exclusion principle. Sources are the Royal Society of Chemistry, NASA, NIST and OpenStax. The Science pool now has 12 approved questions, evenly distributed at three per difficulty; it remains below the 25-per-grade target.

## Seventh approved content batch

Two original, source-linked Nigeria history questions were added (`fx022`–`fx023`), one Hard and one Expert. They cover the First Republic presidency of Dr. Nnamdi Azikiwe and Professor Kenneth Onwuka Dike’s status as the first Nigerian Vice-Chancellor of the University College Ibadan. Sources are the State House and University of Ibadan. The Nigeria pool now has 71 approved questions, including four Hard and four Expert entries; both grades remain below the 25-question target.

## Eighth approved content batch

Eight original, source-linked questions were added (`gl063`–`gl070`): four Gaming and four Literature, with one new question at each difficulty in each pool. Gaming additions cover Nintendo release-history milestones, the creation of Tetris, and the full Hades launch. Literature additions cover Jane Austen’s *Pride and Prejudice* and its first-edition publication details, plus the first newspaper publication of Poe’s *The Raven*. Sources include Nintendo, The Tetris Company, Supergiant Games, Jane Austen’s House and the Morgan Library & Museum. Both pools now have eight approved questions, evenly distributed at two per difficulty; neither is close to the 25-per-grade release target.

## Ninth approved content batch

Eight original, source-linked questions were added (`gl079`–`gl086`): four Music and four Football, one at each difficulty in each pool. Music covers Freddie Mercury’s authorship of “Bohemian Rhapsody,” Taylor Swift’s record-setting *1989* GRAMMY win, and Alban Berg’s opera *Wozzeck*. Football covers standard match duration, the 2026 FIFA World Cup winner, the first World Cup goalscorer, and Just Fontaine’s single-tournament scoring record. Sources include Queen, the Recording Academy, the Metropolitan Opera, IFAB and FIFA. Both pools now have 14 approved questions, distributed at four Easy, six Normal, two Hard and two Expert; all four grades remain below the 25-question milestone.

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

Latest verified branch checks (Forge session included):

- Candidate quality gate: **passed**
- Forge Bot unit tests: **passed** (includes currency-symbol regression test and the corrected category registry)
- Forge Guard integration tests: **passed**
- Trivia and game unit regression suite: **passed** (134 unit tests); the separate live-bank coverage audit **fails as intended** with 83 category/grade deficits
- Blocking live-bank coverage audit: **failed as intended**; the 21 selectable pools remain below 200 total / 50 per grade
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


## Tenth approved content batch — Forge session

Four original, source-linked questions (`fg001`–`fg004`) establish the new dedicated **Forge** Trivia category. The starter set covers the AMA definition of a brand, brand identity elements, brand positioning, and the four components of a useful positioning statement. Sources are the American Marketing Association and NielsenIQ. One question is present at each difficulty. The session is now routable as `.trivia forge` and `.trivia forge expert`; the content bank will continue expanding across branding, creative direction, design, marketing, content strategy and entrepreneurship. This new pool is not yet at the 25-per-grade release target.


## New production sequence — 50-question grade blocks

The approved production order is now sequential by category and grade: complete 50 Easy questions, then 50 Normal, 50 Hard and 50 Expert for the same category before moving to the next category. The first cycle therefore establishes 200 questions per category. Repeat in further 50-question blocks per grade until each category reaches 1,000 questions (250 per grade). The first category in this sequence is **Forge**. Its Easy bank is currently 11/50; Normal, Hard and Expert are each 1/50. The latest batch adds ten original Easy questions (`fg005`–`fg014`) covering brand marketing, personal/corporate branding, brand equity, trademarks, brand guidelines, accessibility contrast, people-first SEO content and typography. Sources include AMA, USPTO, WIPO, W3C, Google Search Central and AIGA.


### Forge Easy — second content batch

Ten further original, source-linked questions (`fg015`–`fg024`) bring Forge to 24 approved questions: 21 Easy, one Normal, one Hard and one Expert. The new Easy set covers trademark scope and protection, copyright basics, image alt text, search-result relevance, WCAG large-text contrast and Google Analytics key events. Sources include USPTO, U.S. Copyright Office, Google Search Central, W3C and Google Analytics.


### Forge Easy — third content batch

Ten additional original, source-linked questions (`fg025`–`fg034`) bring Forge to 34 approved questions: 31 Easy, one Normal, one Hard and one Expert. This batch covers brand-marketing channels, consumer behaviour research, goods versus services, patents, WIPO brand search, typography leading and tracking, colour accessibility, image context and original SEO content. Sources include AMA, NIQ, USPTO, WIPO, AIGA, W3C and Google Search Central.


### Forge Easy — fourth content batch

Ten original questions (`fg035`–`fg044`) extend the Easy pool to 41/50. This batch covers positioning statements, messaging versus copywriting, audience insights and needs, points of difference, reasons to believe, voice and tone, calls to action, core messages and messaging hierarchy. The questions are grounded in the American Advertising and Marketing Association's positioning and messaging framework.


### Forge Easy — fifth content batch and grade completion

Nine original, source-linked questions (`fg045`–`fg053`) complete the Forge Easy grade at **50/50**. Topics include NIQ Brand Choice and Brand Premium, primary benefits, feature-versus-benefit thinking, competitive alternatives, brand personality, supporting benefits, proof points and conversion measurement. Sources include NIQ, the American Advertising and Marketing Association and Google Analytics. Forge now contains 53 questions overall: Easy 50, Normal 1, Hard 1 and Expert 1. The next step is Forge Normal, building from 1 to 50 before moving to Hard and Expert.


### Forge Normal — first content batch

Nine original, source-linked questions (`fg054`–`fg062`) begin the Normal grade, bringing it to 10/50. They cover target-audience research, competitive alternatives, meaningful differentiation, evidence standards, positioning evaluation, strategic focus, brand-health measurement and the distinction between Google Analytics key events and conversions. Sources include the American Advertising and Marketing Association, NIQ and Google Analytics.


### Forge Normal — second content batch

Ten original, source-linked questions (`fg063`–`fg072`) bring Forge Normal to 20/50. They cover the distinction between brand strategy and identity, non-visual identity assets, distinctive brand cues, voice consistency, audience insight quality, evidence for claims, competitive framing, deliverability and positioning versus slogans. Sources include the American Advertising and Marketing Association.


### Forge Normal — third content batch

Ten source-linked questions (`fg073`–`fg082`) bring Forge Normal to 30/50. This batch covers WCAG contrast and text resizing, accessible heading structure, crawlable links, competitive framing, copyright versus ideas, patents, international brand-name checks and positioning credibility. Sources include W3C, Google Search Central, Google developer documentation, the U.S. Copyright Office, USPTO, WIPO and the AAMA positioning framework.


### Forge Normal — fourth content batch

Ten source-linked questions (`fg083`–`fg092`) bring Forge Normal to 40/50. They cover marketing strategy, go-to-market planning, marketing research, segmentation-targeting-positioning, the four Ps, promotion, distribution, marketing plans, competitive analysis and value propositions. Sources include the American Marketing Association and U.S. Small Business Administration.


### Forge Normal — fifth content batch and grade completion

Ten original, source-linked questions (`fg093`–`fg102`) complete Forge Normal at **50/50**. They cover the AMA marketing definition, marketing plans, market research, direct research methods, indirect competitors, value propositions, the five-A customer path, the four As, the four Cs and the marketing-planning sequence. Sources include the American Marketing Association and U.S. Small Business Administration. Forge now has 102 questions: Easy 50, Normal 50, Hard 1 and Expert 1. The next grade block is Forge Hard.

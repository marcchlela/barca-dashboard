# StatsHawk reliability and coverage audit

Run date: **2026-09-25**  
Branch: **`data-backbone-v2`**  
Endpoint: **`GET /api/dev/data-lab/statshawk-reliability`**

## Decision

**StatsHawk is promising, but it is not yet reliable enough to become the primary current-season player-match source.** Its resolved La Liga and Champions League payloads have a useful, consistent player-stat shape, but only **1 of 3** deliberately varied La Liga matches resolved. The other two fixtures were independently confirmed by football-data.org and openfootball, so their absence cannot be dismissed as bad local match identity.

This is a coverage verdict, not a data-quality rejection. For both matches StatsHawk did resolve, all immutable facts agreed and the player rows were internally coherent. Production ingestion must remain off until match availability is understood across a broader slice or StatsHawk confirms the gap.

No Prisma model, migration, production sync path, UI, provider mapping, player row, or statistic row was changed.

## Experiment scope and quota

The lab selected finished Barcelona matches from the current local season rather than hardcoding fixtures.

| Label | Competition | Fixture | Result | Selection reason | StatsHawk |
|---|---|---|---:|---|---|
| LL1 | La Liga | Sevilla FC - FC Barcelona | 1-3 | Latest; away match | Resolved |
| LL2 | La Liga | FC Barcelona - Racing Santander | 7-2 | Home-match variety; goals | Not available |
| LL3 | La Liga | FC Barcelona - Rayo Vallecano | 5-2 | Highest remaining score; goals | Not available |
| UCL1 | Champions League | FC Barcelona - Feyenoord | 5-1 | Latest available UCL match | Resolved |

The single live reliability run made **17 HTTP requests** and consumed **25 weighted StatsHawk units**, from **4,951 to 4,926** remaining. The client enforces a hard **120-unit** ceiling before making any request. Competition discovery and capabilities were fetched once per competition; the Barcelona team ID and one 35-row roster response were reused.

The 17 requests comprised 1 competition index, 2 capability calls, 4 dated schedules, 2 contest details, 2 box scores, 1 roster, 4 La Liga player overviews, and 1 Champions League player overview. A subsequent endpoint request was served from the six-hour in-memory cache and spent no additional units.

## Competition discovery

| Competition | StatsHawk slug | StatsHawk ID | Selected | Resolved |
|---|---|---|---:|---:|
| La Liga | `laliga` | `comp_06fhmv124hzf52b300gyb739nr` | 3 | 1 |
| UEFA Champions League | `ucl` | `comp_06fhmzyt8hw83db2s0vbpr9h04` | 1 | 1 |

The resolved UCL box score has the same observed field set as the resolved La Liga box score. This is only one match per competition, so it establishes compatibility, not long-term consistency. Player overview totals are competition-scoped; an all-competitions page should query each competition separately and sum only additive measures with explicit provenance.

## Actual field consistency matrix

Legend: **NZ** = present with at least one non-zero value, **0** = present but zero-only, **A** = absent from the actual payload, **?** = match did not resolve so field coverage is unknown.

| Field | LL1 | LL2 | LL3 | UCL1 |
|---|:---:|:---:|:---:|:---:|
| minutes | NZ | ? | ? | NZ |
| goals | NZ | ? | ? | NZ |
| assists | NZ | ? | ? | NZ |
| shots | NZ | ? | ? | NZ |
| shotsOnTarget | NZ | ? | ? | NZ |
| shotAccuracy | NZ | ? | ? | NZ |
| passes | NZ | ? | ? | NZ |
| completedPasses | NZ | ? | ? | NZ |
| passAccuracy | NZ | ? | ? | NZ |
| tackles | NZ | ? | ? | NZ |
| interceptions | NZ | ? | ? | NZ |
| fouls | NZ | ? | ? | NZ |
| yellowCards | 0 | ? | ? | NZ |
| redCards | 0 | ? | ? | 0 |
| saves | NZ | ? | ? | NZ |
| savePercentage | NZ | ? | ? | NZ |
| goalsConceded | NZ | ? | ? | NZ |
| cleanSheet | 0 | ? | ? | 0 |
| xG | A | ? | ? | A |
| xA | A | ? | ? | A |

Zero is kept distinct from missing. Although both competition capability documents advertise `xg` and `xa`, neither field appeared in either resolved box score or any of the five player-overview responses. Actual xG/xA coverage therefore remains **false**.

## Player-row semantics

Each resolved match returned 46 provider appearances: 23 Barcelona rows, of which 16 had minutes above zero and 7 had exactly zero minutes. Across the two resolved matches:

| Audit | Count |
|---|---:|
| Barcelona appearance rows | 46 |
| Minutes above zero | 32 |
| Minutes equal zero | 14 |
| Non-zero statistic despite zero minutes | 0 |
| All-zero, zero-minute rows | 14 |
| Duplicate player IDs | 0 |
| Duplicate same-phase rows | 0 |
| Goalkeeper phase rows | 2 |
| Outfield phase rows | 44 |

The zero-minute rows look like provider appearance/squad observations with all-zero stat lines. They do **not** establish a bench or substitute role. The proposed future ingestion rule is:

1. Create a canonical `PlayerMatchStatistic` when `minutes > 0`.
2. Also create one when minutes are zero but a non-zero match action proves participation.
3. Do not create a canonical statistic from an all-zero zero-minute row alone; retain it only in provider observation/raw audit evidence.
4. Deduplicate by match, resolved player, and team. Route duplicate same-phase rows to review rather than summing blindly.

This rule still does not infer starter, substitute, formation, match position, or shirt number.

## Full Barcelona roster audit

Every one of the **35** returned roster associations was inspected.

| Field | Populated | Coverage |
|---|---:|---:|
| Provider person ID | 35 | 100% |
| Display name | 35 | 100% |
| Broad position | 35 | 100% |
| Shirt number | 0 | 0% |
| Birth date | 35 | 100% |
| Nationality | 0 | 0% |
| Birth country | 0 | 0% |
| Preferred foot | 0 | 0% |
| Height | 34 | 97% |
| Weight | 30 | 86% |
| Portrait/photo | 0 | 0% |
| Membership status | 0 | 0% |

There were 35 unique person IDs and no duplicates. Source associations were 24 `appearance` and 11 `membership`. Broad roster positions are useful identity evidence, but roster membership is not lineup evidence. Height and weight are provider numbers in imperial units in the observed payload; any future normalized columns should convert explicitly and retain raw values.

## Player overview audit

Four roles returned successful La Liga overviews, plus one UCL split for Rodri.

| Player | Role | Competition | Game-log rows | Actual season totals observed |
|---|---|---|---:|---|
| Joan García | Goalkeeper | La Liga | 6 | 495 minutes, 11 saves, 5 conceded, 3 clean sheets, 0.6875 save rate |
| João Cancelo | Defender | La Liga | 7 | 206 minutes, 1 goal, passing/defensive/shooting totals |
| Rodri | Midfielder | La Liga | 6 | 356 minutes, 391 passes, 365 completed, 12 tackles, 8 interceptions |
| Lamine Yamal | Forward | La Liga | 7 | 581 minutes, 7 goals, 4 assists, 38 shots, 14 on target |
| Rodri | Midfielder | UCL | 1 | 83 minutes, 85 passes, 82 completed, 2 tackles |

Observed identity/profile fields were provider person ID, display name, broad position, team name, birth date, height, and weight. Team ID, nationality, birth country, preferred foot, and portrait were absent in these responses. `appearances` and `starts` aggregate fields were absent; game-log row count is reported separately and is not relabeled as either.

Season totals and sampled box-score fields use compatible names and 0-1 rate scales. The sampled match sums are naturally lower than season totals because only one resolved league box score was retrieved. No equality claim is made.

## Immutable-fact cross-check

- StatsHawk, football-data.org, and openfootball agree on date, teams, score, and competition for LL1.
- football-data.org and openfootball agree on LL2 and LL3; StatsHawk did not supply a safely resolvable candidate.
- StatsHawk and football-data.org agree on exact UCL kickoff, teams, score, and competition for UCL1.
- Openfootball has no 2026/27 Champions League dataset for that check, so UCL open-data status is `not_available`, not disagreement.

The hardened resolver never silently selects StatsHawk when required identity evidence disagrees.

## Concrete schema proposal — not applied

Later, after ingestion is approved, add nullable columns to `PlayerMatchStatistic`:

| Field | Suggested type | Reason |
|---|---|---|
| `fouls` | `Int?` | Direct additive match measure, consistently observed |
| `saves` | `Int?` | Core goalkeeper match measure |
| `goalsConceded` | `Int?` | Core goalkeeper match measure |
| `cleanSheet` | `Boolean?` | Meaningfully distinguishes zero/false from missing |

Do not add `shotAccuracy` or `savePercentage` yet. Derive shot accuracy from shots on target / shots when valid, and derive save percentage cautiously from saves and goals conceded when denominator semantics are valid. Keep the existing `passAccuracy`, normalize it to 0-1, derive it from completed passes / passes, and retain provider rates in `rawData` for validation.

For the first ingestion phase, one canonical `PlayerMatchStatistic` should be owned completely by StatsHawk through `dataSourceId`, with a sanitized source observation retained in `rawData`. Do not merge individual fields from multiple providers into that row yet. If a second provider later supplies useful unique fields such as xG, add provider-observation rows keyed by match, player, team, and source; materialize the canonical row from explicit source priorities. Add compact field-provenance JSON only if canonical rows actually become hybrid.

`Player` already has birth date, nationality, position, foot, and portrait fields. Populate only values actually supplied after identity resolution; never copy birth country into nationality. Consider nullable metric height/weight fields only if the broad roster coverage remains stable in later runs. `SquadMembership.shirtNumber` must stay empty until a real membership or lineup field exists.

## Player identity and mapping strategy

Future automatic evidence order:

1. Existing `ProviderMapping` for the StatsHawk person ID.
2. The exact StatsHawk person ID retained in a reviewed import candidate.
3. A unique accent-folded exact full name within the same team/season, plus exact birth date and compatible position.
4. Manual review for everything else; do not create a mapping until approved.

Accent folding, punctuation cleanup, whitespace normalization, and known abbreviations are candidate-generation tools only. Preserve the original name and never match surname-only. Duplicate surnames, missing dates of birth, conflicting positions, youth/first-team collisions, or multiple candidates must not auto-merge. Reviewed aliases and name changes belong in mapping metadata.

The eventual target is `ProviderMapping(dataSource=statshawk, entityType=player, internalId=Player.id, providerId=StatsHawk person ID)`.

## Still unresolved

- Confirmed starting XI and substitute/bench roles — `NO_FREE_RELIABLE_SOURCE`
- Formation and match-specific positions — `NO_FREE_RELIABLE_SOURCE`
- Match shirt numbers
- Player ratings
- Timestamped events and substitutions
- Actual xG/xA and shot/event coordinates
- Current soccer injuries and suspensions
- 3D kit assets and the interactive pitch presentation

The future Match Center must use a legitimate lineup source or the existing manual-verified override architecture. Minutes and generic roster positions must never be converted into a lineup.

## Endpoint and safety

```text
GET /api/dev/data-lab/statshawk-reliability
GET /api/dev/data-lab/statshawk-reliability?refresh=1
```

- Development only; production returns 404 before database or provider work.
- Six-hour in-memory cache plus in-flight request deduplication.
- `refresh=1` deliberately bypasses a completed cache entry.
- HTTP response is compact, sanitized, and `private, no-store`.
- Provider failures are isolated per match or audit section.
- Database work is read-only; the report states zero writes and no schema change.

The compact, sanitized evidence snapshot is in [samples/statshawk-reliability.json](samples/statshawk-reliability.json).

## Validation record

- TypeScript: `tsc --noEmit` passed.
- Targeted ESLint for the reliability route and Data Lab modules passed with no warnings.
- Production build passed; the reliability route is emitted as a dynamic server route.
- Development endpoint returned HTTP 200 for the live run.
- Immediate repeat request reported `cache.hit: true`, retained quota 4,926, and made no new provider requests.
- Production server returned HTTP 404 with `{"ok":false,"error":"Not found."}`.
- Sanitized sample JSON parsed successfully.
- Secret scan found no committed StatsHawk key assignment, bearer token, or literal API key.
- Mutation scan found no create, update, upsert, delete, or raw-query operation in the new reliability files.
- Prisma diff is empty; no contract or migration changed.
- `git diff --check` passed.

# Final free-provider audit

Run date: **2026-09-25**  
Branch: **`data-backbone-v2`**  
Endpoint: **`GET /api/dev/data-lab/final-provider-audit`**

## Decision

The remaining free-data gaps are materially smaller, but production ingestion must remain disabled.

- **GOAL API is the verified owner candidate for lineup, formation, bench, shirt number, and match-position data.** It resolved all four selected matches and supplied exactly 11 named Barcelona starters, the bench, a formation, player IDs, shirt numbers, positions, lineup ordinals, images, and a coach every time.
- **GOAL API's event response is a scoring-event feed, not a complete timeline.** Its goal rows reconciled perfectly with all four final scores, but it returned no card or substitution event rows.
- **Big Balls Sports Data is the strongest newly verified free source for current La Liga team and player box scores.** It returned populated team metrics plus player minutes, actions, and ratings for all three selected La Liga matches. It returned no rich UCL data in the selected match.
- **Neither provider returned actual xG, xA, xGOT, or shot coordinates for the selected matches.** Keys mentioned in a schema or null-valued event columns remain documentation-only, not coverage.
- There is still **no verified $0 owner for a complete cards/substitutions timeline, xG/xA, or shot spatial data**.

No Prisma model, migration, production sync path, mapping, player, lineup, event, statistic, or UI was changed.

## Scope and resolver evidence

The audit reused the same database-selected matches as the StatsHawk reliability audit. No provider match ID was hardcoded into the resolver.

| Label | Internal fixture | Result | GOAL API | Big Balls | football-data.org |
|---|---|---:|---:|---:|---:|
| LL1 | Sevilla FC - FC Barcelona | 1-3 | Resolved | Resolved | Agree |
| LL2 | FC Barcelona - Racing Santander | 7-2 | Resolved | Resolved | Agree |
| LL3 | FC Barcelona - Rayo Vallecano | 5-2 | Resolved | Resolved | Agree |
| UCL1 | FC Barcelona - Feyenoord | 5-1 | Resolved | Resolved | Agree |

Both new providers resolved **4/4** fixtures through date, teams, score, competition, and exact kickoff evidence. All four football-data.org exact mappings independently agreed. There were zero immutable-fact disagreements.

## GOAL API verdict

Official resources reviewed: [documentation](https://goal-api.com/documentation), [OpenAPI](https://goal-api.com/openapi.json), [coverage](https://goal-api.com/coverage), and [terms](https://goal-api.com/terms). The provider documents Bearer authentication, a free 1,000-request daily tier, and licensed third-party football data subject to its terms.

### Formation and lineup evidence

| Match | Barca side | Formation | Starters | Bench | Names | IDs | Shirts | Positions | Ordinals | Images | Coach |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| LL1 | Away | 4-3-3 | 11 | 12 | 23 | 23 | 23 | 23 | 23 | 21 | 1 |
| LL2 | Home | 4-3-3 | 11 | 12 | 23 | 23 | 23 | 23 | 23 | 22 | 1 |
| LL3 | Home | 4-2-3-1 | 11 | 11 | 22 | 22 | 22 | 22 | 22 | 21 | 1 |
| UCL1 | Home | 4-3-3 | 11 | 12 | 23 | 23 | 23 | 23 | 23 | 22 | 1 |

All four Barcelona lineups meet the strict completeness rule: exactly 11 named starters. GOAL also supplied a classified substitute array and a usable formation in every test. It did not expose a confirmed-versus-predicted flag. An `updatedAt` timestamp appeared on the rows, but it should be treated as provider update time rather than proof of original lineup publication time.

This is enough source evidence for the future pitch/kit interaction, subject to later ingestion approval and separate legitimate kit-asset work.

### Events

| Match | Rows | Goals | Assists | Penalties detected | Cards | Substitutions | Goal count = score |
|---|---:|---:|---:|---:|---:|---:|:---:|
| LL1 | 4 | 4 | 4 | 0 | 0 | 0 | Yes |
| LL2 | 9 | 9 | 5 | 2 | 0 | 0 | Yes |
| LL3 | 7 | 7 | 6 | 0 | 0 | 0 | Yes |
| UCL1 | 6 | 6 | 5 | 0 | 0 | 0 | Yes |

Every row included a minute and scorer ID; assist IDs appeared when an assist was present. Added-time strings did not appear in this sample. The exact row count always equaled the final goal total, and the shape was consistently scorer/assist/score oriented. Therefore:

- Goals and score reconciliation: **verified complete for 4/4**.
- Assists attached to scoring rows: **actually present**.
- Yellow/red cards: **not established**; zero returned is not evidence that the match had no cards.
- Substitutions: **not established**; zero returned despite team-stat substitution totals.
- Complete event timeline: **not verified**.

### Team and player statistics

GOAL returned 25, 25, 24, and 25 team-stat rows for LL1, LL2, LL3, and UCL1. The actual recurring field names were:

`Attacks`, `Ball Possession`, `Corners`, `Dangerous Attacks`, `Fouls`, `Free Kick`, `Goal Kick`, `Off Target`, `Offsides`, `On Target`, `Passes Accurate`, `Passes Total`, `Penalty`, `Saves`, `Shots Blocked`, `Shots Inside Box`, `Shots Off Goal`, `Shots On Goal`, `Shots Outside Box`, `Shots Total`, `Substitution`, `Throw In`, and `Yellow Cards`.

Possession, shots, on/off-target shots, blocked shots, corners, fouls, offsides, passes, accurate passes, and saves were actually populated. Pass accuracy can be derived later from accurate/total passes if ingestion is approved, but an explicit pass-accuracy field was absent.

GOAL returned **zero player-stat rows**. Player ratings, minutes, player goals/assists, key passes, duels, dribbles, tackles, interceptions, xG, xA, and spatial coordinates were not actual GOAL statistics in this test.

## Big Balls Sports Data verdict

Official resources reviewed: [soccer documentation](https://bigballsdata.com/docs/soccer), [OpenAPI](https://bigballsdata.com/openapi.json), [coverage](https://bigballsdata.com/coverage), and [quickstart](https://bigballsdata.com/docs/quickstart). The authenticated account response—not a marketing page—reported plan `free`, 100 requests/minute, and 250 requests/day.

### Lineups

| Match | Barca starters | Unclassified other rows | Formation | Shirts | Positions | Player IDs |
|---|---:|---:|---:|---:|---:|---:|
| LL1 | 11 | 12 | Missing | 23 | 23 | 22 |
| LL2 | 11 | 12 | Missing | 23 | 23 | 23 |
| LL3 | 11 | 11 | Missing | 22 | 22 | 22 |
| UCL1 | 0 | 0 | Missing | 0 | 0 | 0 |

The three La Liga responses explicitly marked 11 Barcelona starters. The remaining rows had no trustworthy bench/substitute marker and are deliberately reported as unclassified, not bench. No formation, lineup ordinal, image, coach, confirmation status, or timestamp was returned. UCL lineup coverage was absent. This makes Big Balls useful corroboration for a La Liga XI, but not the lineup owner over GOAL.

### Events and spatial data

The free response returned scoring events only for the three La Liga matches: 4, 9, and 7 goal rows, each reconciling with the final score. Scorer and assist IDs were populated. Cards and substitutions were not returned; the documented complete `type=all` timeline is plan-gated.

Event objects contained schema keys named `coordinate_x`, `coordinate_y`, `xg`, and `xgot`, but **zero rows contained numeric coordinate, xG, or xGOT values**. Presence of a null key is not actual coverage. The UCL response explicitly reported no coverage.

### Team statistics

Actual recurring La Liga fields were `accurate_passes`, `ball_possession`, `blocked_shots`, `corner_kicks`, `fouls`, `goalkeeper_saves`, `offsides`, `pass_percentage`, `red_cards`, `shots_inside_box`, `shots_off_target`, `shots_on_target`, `shots_outside_box`, `total_passes`, `total_shots`, and `yellow_cards`.

LL3 also returned a second stored-stat representation with populated crosses, long balls, clearances, tackles, interceptions, saves, pass/shot/tackle percentages, corners, cards, possession, and shooting fields. UCL team statistics were absent.

### Player match and season statistics

The three La Liga matches returned 43, 44, and 44 player rows. Actual populated field groups included minutes, goals, assists, shots, on-target shots, total/key passes, pass accuracy, tackles, blocks, interceptions, duels, dribbles, fouls, cards, saves, substitutions, and player rating. The UCL match returned no player rows.

A documented player search resolved Lamine Yamal and the season-stat endpoint returned actual game rows with minutes, goals, assists, shots, passing, key passes, tackles, blocks, interceptions, duels, dribbles, fouls, cards, saves, captain/substitute state, and **rating**. No xG or xA field appeared.

## Actual-versus-missing summary

| Surface | GOAL API | Big Balls Sports Data |
|---|---|---|
| Four test fixtures | Actual 4/4 | Actual 4/4 |
| Complete Barca XI | Actual 4/4 | Actual 3/4 |
| Classified bench | Actual 4/4 | Missing; non-starters unclassified |
| Formation | Actual 4/4 | Missing 4/4 |
| Shirt numbers | Actual 4/4 | Actual on 3 La Liga rosters |
| Scoring events | Actual 4/4 | Actual 3/4 |
| Cards/substitution timeline | Missing | Plan-gated/missing |
| Core team statistics | Actual 4/4 | Actual 3/4 |
| Player match box score | Missing 4/4 | Actual 3/4 |
| Player rating | Missing | Actual 3/4 plus season game rows |
| xG/xA | Documentation-only | Documentation-only |
| Shot coordinates | Documentation-only | Null schema keys only; no actual values |

`present_zero` is retained separately from absent in the endpoint. A zero counts only when the provider supplied the field. Documentation claims and null-only schema keys are not promoted to coverage.

## Six-provider ownership matrix

| Field group | Recommended owner | Supporting/fallback | Reason |
|---|---|---|---|
| Fixtures/results/standings | football-data.org | GOAL, Big Balls, openfootball | Existing exact mappings and stable basic coverage; all live checks agreed |
| Confirmed XI/bench/formation/shirts | GOAL API | Big Balls for La Liga XI corroboration | GOAL was complete in 4/4; Big Balls lacked formation and classified bench |
| Scoring events | GOAL API | Big Balls; football-data.org basic event data | GOAL reconciled goals in 4/4 and supplied scorer/assist IDs |
| Cards/substitutions/full timeline | `NO_FREE_RELIABLE_SOURCE` | None | GOAL was goal-only; Big Balls full stream is gated |
| Core team match statistics | GOAL API | Big Balls | GOAL had core fields in 4/4; Big Balls was richer but only 3/4 |
| Player match box score/ratings | Big Balls, coverage-limited | StatsHawk, availability-limited | Big Balls populated 3/3 La Liga tests; neither covered all four |
| xG/xA/spatial shots | `NO_FREE_RELIABLE_SOURCE` | None | No actual values from either new provider; StatsHawk also lacked xG/xA in its resolved tests |
| Player/team profile fallback | StatsHawk | TheSportsDB | Verified structured roster/overview; TheSportsDB remains best-effort enrichment |
| Independent result cross-check | openfootball | GOAL, Big Balls, StatsHawk | CC0 and independent for La Liga; current UCL dataset was unavailable |

Legal/automation posture:

- football-data.org, StatsHawk, GOAL, Big Balls, and TheSportsDB are documented API channels; credentials remain server-only.
- GOAL expressly describes licensed third-party data and downstream use subject to its terms.
- Big Balls is safe to test through its documented authenticated API. Before production/commercial ingestion, its downstream redistribution/licensing terms should receive explicit review; the audit does not infer rights beyond documented API access.
- openfootball is a CC0 static dataset.

## Quota and cache

The final corrected uncached run used **21 GOAL requests** and **27 Big Balls requests**. Parser hard limits reject request 101 before transmission.

Three bounded live runs were performed while correcting response-shape classification, so authenticated quota usage was **63 GOAL requests** and **79 Big Balls requests**, both below the requested 100-provider ceiling. Two later Big Balls schema-inspection attempts were rejected because the standalone process did not load the credential; they returned no evidence and consumed no observed authenticated quota. Counting those rejected HTTP attempts gives 81 total Big Balls outbound attempts. GOAL's daily remaining header moved from 1,000 before the first run to 937 after the last. Big Balls' final authenticated run moved from 100 to 73 on its per-minute header; `/v1/user/me` reported 250/day.

Successful reports are cached in memory for six hours. A normal repeat returns the cached sanitized report without provider calls. `?refresh=1` deliberately bypasses a completed cache entry. There is no polling.

## Endpoint and safety

```text
GET /api/dev/data-lab/final-provider-audit
GET /api/dev/data-lab/final-provider-audit?refresh=1
```

- Development only; production returns HTTP 404 before database/provider work.
- Database selection is read-only.
- Provider failures are isolated per match.
- The response includes request paths/statuses/quota headers but never authentication headers or environment values.
- The sanitized snapshots are [goal-api.json](samples/goal-api.json) and [big-balls-data.json](samples/big-balls-data.json).

## Still missing at $0

- Complete cards, substitutions, and non-scoring event chronology.
- Actual xG, xA, xGOT, and shot locations for the selected current Barcelona matches.
- One reliable player-match source covering both current La Liga and Champions League.
- Injury/suspension coverage.
- Legally cleared 3D Barcelona kit assets and the interactive pitch UI; these remain a separate manual/UI phase.

Do not infer any missing field from minutes, a roster row, a null schema key, an advertised capability, or another provider's value.

## Validation record

- `tsc --noEmit` passed.
- Targeted ESLint for the route, audit modules, shared resolver, and reused selector passed with no warnings.
- Full-repository ESLint still fails on pre-existing generated Prisma contract/snapshot declarations using the `{}` type; no audit file was reported.
- `next build` passed and emitted `/api/dev/data-lab/final-provider-audit` as a dynamic server route.
- The development live endpoint returned HTTP 200. Immediate normal repeats returned `cache.hit: true` and did not change provider quota.
- The production build returned HTTP 404 with `{"ok":false,"error":"Not found."}` for the route.
- Both sanitized sample files parsed as JSON.
- Secret scan found no key assignment or literal bearer token in source/docs.
- Mutation scan found no create, update, upsert, delete, or raw-query call in the new audit route/modules.
- No Prisma or migration file changed, and `git diff --check` passed.

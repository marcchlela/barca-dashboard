# Data Backbone v2 — development lab report

Run date: **2026-09-25**  
Branch: **`data-backbone-v2`**  
Endpoint: **`GET /api/dev/data-lab/barcelona-match`**

## Outcome

The repository contains an isolated, read-only, development-only provider lab. It resolves one real Barcelona match from the existing database, probes only approved sources, normalizes field coverage, and reports every provider failure independently.

Data Backbone v2 now includes:

- explicit match-time precision instead of synthetic timestamps;
- conservative team identity matching;
- Barcelona-aware TheSportsDB home/away profile selection;
- a live StatsHawk adapter with quota accounting and sanitized evidence;
- deterministic resolver and TheSportsDB-side validation;
- field ownership based only on fields actually returned for the target match.

No dashboard UI, production sync path, Prisma contract, migration, or database row is changed.

## Match tested

| Field | Value |
|---|---|
| Internal match ID | `dc0f3ba4-90ae-439d-b839-f15e15854fd4` |
| Kickoff | `2026-09-19T19:00:00Z` |
| Competition | Primera Division (`PD`) |
| Matchday | 7 |
| Fixture | Sevilla FC vs FC Barcelona |
| Score | 1–3 |
| Existing provider mapping | football-data.org `564690` |

## Match-resolution hardening

Every candidate now declares one temporal precision:

- `exact`: a timezone-aware instant; it must be within 30 minutes;
- `local_time_unknown_zone`: date and local clock are retained, but the clock is never compared as UTC;
- `date_only`: calendar-date evidence only;
- `unknown`: no usable temporal evidence.

The resolver exposes `exactKickoff`, `kickoffDeltaMinutes`, `sameCalendarDate`, `localTimeProvided`, and the provider precision. Openfootball and TheSportsDB no longer manufacture a noon or UTC kickoff.

Team matching no longer uses substring checks. It uses exact normalized identity, a small maintainable alias registry, or a conservative equal-token check. Reserve, academy, and women's markers are identity boundaries: FC Barcelona does not match Barcelona B, Barcelona U19, or Barcelona W.

Provider ID mappings remain the strongest evidence. A finished match without a mapping requires both teams, compatible temporal evidence, exact score, and competition. An upcoming match without scores requires both teams plus exact time and competition, or exact normalized teams plus date and competition.

## TheSportsDB correction

The adapter now determines whether Barcelona is the home or away participant and selects the corresponding `idHomeTeam` or `idAwayTeam`. Its representative player must belong to that Barcelona team ID (or match Barcelona by conservative identity when an ID is absent); it no longer chooses the first lineup row.

Deterministic cases cover Barcelona in both home and away positions. The public free API still caps rich lineup, timeline, and statistic responses at five rows, so those collections remain partial and must not be treated as complete.

## StatsHawk verified result

The configured `STATSHAWK_API_KEY` successfully resolved:

| Field | Verified value |
|---|---|
| Competition | `laliga` / `comp_06fhmv124hzf52b300gyb739nr` |
| Contest | `cst_06g95vb5bhv131tnctf3ykgy60` |
| Kickoff | `2026-09-19T19:00:00Z` (0-minute delta) |
| Result | Sevilla 1–3 Barcelona |
| Venue | Ramón Sánchez Pizjuán Stadium |
| Box score | finalized; 46 appearances, 23 Barcelona rows, 16 with activity |
| Barcelona roster | 35 association rows |
| Player overview | one successful current Barcelona player overview |

The final reproducible adapter run made **7 requests** and consumed **11 weighted units**:

| Request | Units |
|---|---:|
| Competition index | 1 |
| 2026 La Liga dated schedule | 2 |
| Contest detail | 1 |
| Contest box score | 2 |
| Soccer capabilities | 1 |
| Barcelona roster | 3 |
| One player overview | 1 |

The free allowance is 5,000 weighted units/month. Including discovery, one failed local-client retry that still reached the API, schema inspection, and final verification runs, this task consumed 49 units in total. A normal uncached adapter refresh consumes 11; the Data Lab's 15-minute cache avoids repeated calls unless `refresh=1` is requested.

### Actual match fields

The box score actually returned:

- minutes, goals, assists;
- shots, shots on target, shot accuracy;
- passes, completed passes, pass percentage;
- tackles, interceptions, fouls;
- yellow/red card totals;
- goalkeeper saves, save percentage, goals conceded, and clean-sheet value.

Four representative actual rows are in `docs/data-lab/samples/statshawk.json`: Rodri, Eric García, João Cancelo, and Pau Cubarsí.

The capabilities endpoint advertises `xg` and `xa`, but neither appeared in this contest's populated Barcelona rows. Accordingly, actual `xG` coverage is **false**. No ratings, event coordinates, team possession/stat totals, or timestamped event timeline were returned.

### Roster is not a lineup

The roster returned player identity and broad position (`F`, `M`, `G`) but no sampled shirt number. A roster association is not a confirmed match lineup or bench. StatsHawk therefore remains explicitly false/absent for:

- confirmed lineup;
- bench role;
- formation;
- match position;
- match shirt number.

No soccer injury-history call was made. StatsHawk's documented injury coverage currently lists MLB, NFL, NBA, NHL, and WNBA rather than soccer, so injuries/suspensions remain unresolved.

## Actual provider results

| Provider | Status | What the lab actually received |
|---|---|---|
| football-data.org | `ok` | Exact mapped fixture/result and basic metadata; no free rich arrays |
| StatsHawk | `ok` | Exact fixture, venue, finalized player box score, roster associations, capabilities, one player overview |
| openfootball | `ok` | Date, teams, local time, half-time and full-time result |
| TheSportsDB | `ok` after competition alias hardening | Venue/profile enrichment plus five-row partial rich collections |
| StatsBomb Open Data | `not_available` | No current 2026/27 La Liga data |
| Restricted/unclear sources | `skipped_by_policy` | No requests made |

Representative evidence is committed in `docs/data-lab/samples/`. Samples contain no API tokens, authorization headers, or bulk provider payloads.

## Field ownership

| Field group | Owner |
|---|---|
| Fixtures, results, standings | football-data.org |
| Fixture/result cross-check | StatsHawk + openfootball |
| Venue | StatsHawk; TheSportsDB secondary |
| Player profile and roster position | StatsHawk, with roster caveat |
| Player minutes/goals/assists | StatsHawk |
| Player shots/passing/defensive totals | StatsHawk |
| Goalkeeper saves/statistics | StatsHawk |
| Complete lineup/bench/formation | `NO_FREE_RELIABLE_SOURCE` |
| Timestamped event timeline/substitutions | `NO_FREE_RELIABLE_SOURCE` |
| Complete team statistics/possession | `NO_FREE_RELIABLE_SOURCE` |
| Actual xG/shot coordinates | `NO_FREE_RELIABLE_SOURCE` |
| Player ratings | `NO_FREE_RELIABLE_SOURCE` |
| Current soccer injuries/suspensions | `NO_FREE_RELIABLE_SOURCE` |

## Endpoint behavior

```text
GET /api/dev/data-lab/barcelona-match
GET /api/dev/data-lab/barcelona-match?refresh=1
GET /api/dev/data-lab/barcelona-match?matchId=dc0f3ba4-90ae-439d-b839-f15e15854fd4
```

- Without `matchId`, the latest finished Barcelona match is selected.
- `refresh=1` bypasses the in-memory 15-minute cache.
- HTTP output is `private, no-store`.
- Invalid, missing, or non-Barcelona match IDs return 404.
- Outside `NODE_ENV=development`, the route returns 404 before database/provider work.
- One provider failure does not fail the report.
- `report.validation` exposes all deterministic cases and their pass/fail state.

## Keys and cost

- `FOOTBALL_DATA_API_KEY`: free key already configured; 10 requests/minute on the current plan.
- TheSportsDB: no private credential for the documented v1 development key.
- `STATSHAWK_API_KEY`: configured and verified; free tier is 5,000 weighted units/month.
- `STATSHAWK_BASE_URL`: optional; defaults to `https://api.statshawk.ai/v1`.
- API-Football: existing free access does not include the current season.
- PitchAPI: deliberately not called until reuse terms/provenance are clear.

All credentials stay in server-side environment variables. No key is logged, returned by the endpoint, stored in samples, or committed.

## Database safety

Database access remains read-only: `where`, `include`, `orderBy`, `first`, and `all`. The lab has no create, update, upsert, delete, raw SQL, migration, or generated-contract operation. The report explicitly returns:

```json
{
  "database": {
    "mode": "read-only",
    "writesAttempted": 0,
    "schemaChanged": false
  }
}
```

## Validation record

- Deterministic resolver/TheSportsDB checks: 11/11 passed.
- TypeScript: `tsc --noEmit` passed.
- Targeted Data Lab lint: passed.
- Live read-only endpoint: HTTP 200; football-data.org, openfootball, StatsHawk, and TheSportsDB resolve independently.
- StatsHawk final adapter run: 7/7 requests successful, 11 weighted units.
- Provider policy isolation: restricted and unclear sources remain request-free.
- Production build: passed; the Data Lab route remains dynamic and server-rendered.
- Secret scans: no StatsHawk key value or environment assignment exists under `src/` or `docs/`.
- Database-mutation scan: no create, update, upsert, raw-query, or delete operation exists in the Data Lab route/library.
- Git diff: no Prisma model, contract, migration, production sync, or UI file changed.

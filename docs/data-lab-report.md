# Data Backbone v2 — development lab report

Run date: **2026-09-25**  
Branch: **`data-backbone-v2`**  
Endpoint: **`GET /api/dev/data-lab/barcelona-match`**

## Outcome

The repository now contains an isolated, read-only, development-only provider lab. It resolves one real Barcelona match from the existing database, probes only approved sources, normalizes their results, compares field coverage, and returns each failure independently. Restricted or unclear sources are policy records only and cannot make requests.

No production dashboard component, production sync path, Prisma contract, generated contract, migration, or database row was changed by this work.

## Match tested

The default resolver selected the latest finished Barcelona match in the local database:

| Field | Value |
|---|---|
| Internal match ID | `dc0f3ba4-90ae-439d-b839-f15e15854fd4` |
| Kickoff | `2026-09-19T19:00:00Z` |
| Competition | Primera Division (`PD`) |
| Matchday | 7 |
| Fixture | Sevilla FC vs FC Barcelona |
| Score | 1–3 |
| Existing provider mapping | football-data.org `564690` |

## Actual provider results

| Provider | Status | Resolution | What the lab actually received |
|---|---|---:|---|
| football-data.org | `ok` | 1.00 | Exact fixture/result, HT score, matchday, referee; venue null; zero rich-array rows |
| TheSportsDB | `ok` | 0.85 | Event `2506233`, venue, five lineup rows, five timeline rows, five stat rows, plus one Barça team profile and one player profile; formation null |
| StatsBomb Open Data | `not_available` | — | Catalogue available, but 2026/27 La Liga absent; newest La Liga 2020/21 |
| openfootball | `ok` | 0.85 | Exact date, teams, local time, HT 1–1 and FT 1–3 |
| StatsHawk | `not_configured` | — | Safe to trial, but no `STATSHAWK_API_KEY` was configured |
| Understat, FotMob, SofaScore, ESPN, LaLiga, UEFA | `skipped_by_policy` | — | No automated requests were made |
| PitchAPI | `skipped_by_policy` | — | Provenance/terms not clear enough to automate |
| football-data.co.uk | `skipped_by_policy` | — | Site explicitly excludes automated bot/scraper/AI use |
| API-Football | `skipped_by_policy` | — | Current season unavailable on the project's free plan |

Representative evidence is committed in:

- `docs/data-lab/samples/football-data-org.json`
- `docs/data-lab/samples/thesportsdb.json`
- `docs/data-lab/samples/statsbomb-open-data.json`
- `docs/data-lab/samples/openfootball.json`

Samples contain no API tokens, authorization headers, or full bulk payloads.

## Match resolution

Providers do not have to share IDs. The lab scores candidates using:

- an existing exact provider mapping when present;
- kickoff proximity (18-hour tolerance accommodates date-only/local-time data without treating it as an exact instant);
- normalized home and away team names;
- full-time score;
- normalized competition name.

Both teams must match. A provider-ID match is sufficient additional evidence; otherwise compatible kickoff plus score/confidence is required. Every result exposes its criteria and confidence instead of hiding a fuzzy match.

## Normalized response shape

Each provider returns:

- source classification and automation policy;
- probe status and whether a request was made;
- current-season availability;
- normalized candidate match and resolution evidence;
- comprehensive boolean coverage flags;
- explicit completeness (`complete`, `partial`, `absent`, `unknown`);
- human-readable evidence, a small sanitized sample, and an isolated error.

The top-level `comparison.coverageByField` object inverts all 40 normalized coverage flags into provider lists, while `comparison.resolvedProviders` records which providers safely matched the internal fixture. This makes provider overlap and unsupported fields inspectable without coupling a future UI to provider-specific payloads.

The separation between `coverage` and `completeness` is intentional. TheSportsDB can return `lineups: true` while `completeness.lineups` is `partial`; five rows must never masquerade as a complete lineup.

## Endpoint behavior

Development only:

```text
GET /api/dev/data-lab/barcelona-match
GET /api/dev/data-lab/barcelona-match?refresh=1
GET /api/dev/data-lab/barcelona-match?matchId=dc0f3ba4-90ae-439d-b839-f15e15854fd4
```

- Without `matchId`, the latest finished Barcelona match is selected.
- `refresh=1` bypasses the in-memory provider cache.
- Cache TTL is 15 minutes. HTTP output itself is `private, no-store`.
- Invalid, missing, or non-Barcelona match IDs return 404.
- Outside `NODE_ENV=development`, the route returns 404 before any database or provider work.
- One failed provider does not fail the report.

Abridged real output:

```json
{
  "ok": true,
  "report": {
    "environment": "development",
    "database": {
      "mode": "read-only",
      "writesAttempted": 0,
      "schemaChanged": false
    },
    "internalMatch": {
      "id": "dc0f3ba4-90ae-439d-b839-f15e15854fd4",
      "kickoff": "2026-09-19T19:00:00Z",
      "homeTeam": { "name": "Sevilla FC" },
      "awayTeam": { "name": "FC Barcelona" },
      "score": { "home": 1, "away": 3 }
    },
    "providers": [
      {
        "provider": { "id": "football-data-org" },
        "status": "ok",
        "resolution": { "matched": true, "confidence": 1 },
        "coverage": {
          "fixturesResults": true,
          "venue": false,
          "lineups": false,
          "xG": false
        }
      }
    ],
    "comparison": {
      "resolvedProviders": [
        "football-data-org",
        "thesportsdb",
        "openfootball"
      ]
    }
  }
}
```

## Files added

Core:

- `src/lib/data-lab/types.ts`
- `src/lib/data-lab/source-status.ts`
- `src/lib/data-lab/internal-match.ts`
- `src/lib/data-lab/match-resolver.ts`
- `src/lib/data-lab/http.ts`
- `src/lib/data-lab/cache.ts`
- `src/lib/data-lab/probe.ts`
- `src/lib/data-lab/index.ts`

Safe adapters:

- `src/lib/data-lab/providers/football-data.ts`
- `src/lib/data-lab/providers/the-sports-db.ts`
- `src/lib/data-lab/providers/statsbomb.ts`
- `src/lib/data-lab/providers/openfootball.ts`

Route and research:

- `src/app/api/dev/data-lab/barcelona-match/route.ts`
- `docs/free-data-sources.md`
- `docs/data-lab-report.md`
- `docs/data-lab/samples/*.json`

## Recommended ownership and remaining gaps

Use football-data.org as primary for fixtures/results/standings. Use openfootball only to flag disagreements or cover a temporary outage. Treat TheSportsDB venue as secondary enrichment requiring verification. Do not persist its capped lineup/event/stat collections as if complete.

Still missing at a trustworthy current-season $0 level:

- complete lineup, bench, and formation;
- full event timeline including every card/substitution;
- complete team statistics;
- xG, shot coordinates, momentum, and heatmaps;
- per-player match statistics and ratings;
- injuries and suspensions with verified reuse rights.

Every missing ownership entry in the endpoint uses the explicit value `NO_FREE_RELIABLE_SOURCE`; it is not inferred or silently filled.

## Free API keys

- `FOOTBALL_DATA_API_KEY`: already configured. The key is free, but current access is intentionally thin and limited to 10 requests/minute.
- TheSportsDB: no private key is needed for the v1 development API; it uses the documented public key and caps rich collections at five rows.
- `STATSHAWK_API_KEY`: not configured. StatsHawk offers a no-card free test key with 5,000 weighted units/month and is the next worthwhile experiment.
- API-Football: its existing key does not grant the current 2026/27 season on the free plan, so it cannot solve this phase.
- `PITCHAPI_API_KEY`: advertised as free, but the lab intentionally refuses to use it until public reuse terms and source provenance are confirmed.

Keys are server-only `.env` values. None is printed, included in JSON, written to samples, or committed.

## Validation record

- TypeScript: `npx tsc --noEmit` passed.
- Live endpoint: returned HTTP 200 and independently resolved the selected match in three current sources.
- Cache: second call reported a cache hit; `refresh=1` forced a fresh probe.
- Failure isolation: a run with outbound network disabled returned HTTP 200 with independent `error` statuses for all four automated providers; the report itself remained available.
- Existing dashboard overview endpoint continued to respond successfully.
- Targeted lint for the new data-lab code is clean.
- Repository-wide lint still reports pre-existing errors in generated Prisma `contract.d.ts` snapshots plus existing image warnings; no new data-lab lint error was reported.
- Production build: `npm run build` passed; Next classified the data-lab route as dynamic.
- Production guard: the built app was started on an isolated port and the data-lab route returned HTTP 404 under production `NODE_ENV`.
- Git diff confirms no Prisma contract or migration file was modified.
- All new database access is read-only (`where`, `include`, `orderBy`, `first`, `all`); the lab contains no create/update/upsert/delete/raw SQL operation.
- The dashboard-overview response hash was identical immediately before and after a forced fresh lab run (`6AD981BB…BB18`), providing an additional runtime read-only check.

## Next recommended step

Create a StatsHawk free test key, place it server-side as `STATSHAWK_API_KEY`, and add one lab-only adapter to validate the same Sevilla–Barcelona match. Specifically measure whether its box score is complete for player lines, whether it supplies injuries for Barcelona, its exact match-refresh lag, and how many units a dashboard refresh consumes. Keep it in the lab until those facts are reproducible and its production-key requirements are confirmed.

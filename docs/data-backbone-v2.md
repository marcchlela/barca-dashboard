# Production Data Backbone v2

## Scope and status

This phase proves production normalization for one existing match only:

- Sevilla FC 1–3 FC Barcelona
- 2026-09-19 19:00 UTC
- internal match `dc0f3ba4-90ae-439d-b839-f15e15854fd4`

The match remains owned by the existing football-data.org fixture pipeline. The rich sync resolves provider fixtures through immutable date, kickoff, competition, team, and score evidence and never hardcodes a GOAL or Big Balls match ID. No season backfill or Match Center UI is part of this phase.

## Provider ownership

| Data | Owner | Fallback / note |
| --- | --- | --- |
| Fixtures, results, standings, base match identity | football-data.org | openfootball is an independent result cross-check |
| Starting XI, classified bench, formation, shirts, match positions, ordinals, images, coach | GOAL API | Historical finished lineup is marked confirmed |
| Scoring events and scorer/assist identity | GOAL API | Only actual goal rows are stored |
| Core team match statistics | GOAL API | Big Balls richer team payload is retained on match mapping metadata without replacing GOAL ownership |
| La Liga player match statistics and ratings | Big Balls | StatsHawk is registered as the future availability fallback |
| Profile metadata | Existing profile sources | TheSportsDB remains a fallback; it is not called here |

Credentials are read only from the server environment as `GOAL_API_KEY` and `BBS_API_KEY`. They are not returned, logged, stored in raw evidence, or committed.

## Schema additions

The additive Prisma 8 migration adds nullable fields only.

`MatchStatistic`:

- `shotsOffTarget`
- `blockedShots`
- `shotsInsideBox`
- `shotsOutsideBox`
- `saves`
- `attacks`
- `dangerousAttacks`
- `freeKicks`
- `goalKicks`
- `throwIns`
- `substitutions`

`PlayerMatchStatistic`:

- `blocks`
- `dribblesAttempted`
- `successfulDribbles`
- `fouls`
- `saves`
- `goalsConceded`
- `cleanSheet`

`LineupPlayer`:

- `lineupOrdinal`

The migrations are `migrations/app/20260925T1545_rich_match_normalized_fields` and the one-column follow-up `migrations/app/20260925T1616_lineup_ordinal`. Both were applied to the local PostgreSQL database without resets, deletes, or table recreation.

## Identity strategy

Match identity uses a provider-neutral hardened resolver. A finished fixture must agree on both teams, full-time score, competition, and valid temporal evidence unless an existing exact provider mapping supplies the identity.

GOAL seeds both teams' match players. Every player receives a canonical GOAL provider mapping; the numeric legacy event key is also mapped when present so scorer and assist identities resolve without name guessing.

Big Balls resolution is deliberately conservative:

1. existing provider mapping;
2. exact normalized full name within the same target-match team;
3. unique first-initial plus exact surname, exact shirt number, and compatible broad position;
4. otherwise unresolved and retained for review.

Normalization removes accents, punctuation, and whitespace only for comparison. Provider display names are preserved. Surname-only matching and ambiguous auto-merges are forbidden.

## Formation coordinates

The shared formation utility supports `4-3-3` and `4-2-3-1`. It derives deterministic normalized `0–1` display coordinates from the confirmed formation and lineup ordinal for starters. Substitute coordinates remain null.

These are UI formation coordinates for a lineup graphic. They are not tracking data, event coordinates, or measured real-world player positions.

## Sync sequence

`POST /api/dev/sync-rich-match` accepts the approved match ID and `dryRun`.

1. Load and verify the existing internal match.
2. Resolve GOAL and Big Balls dated fixtures through hardened immutable identity.
3. Fetch and normalize GOAL detail, lineups, goals, and team statistics.
4. Fetch and normalize Big Balls team/player statistics.
5. Resolve Big Balls participants against the GOAL-seeded match roster.
6. In dry-run mode, return provider request counts, normalized row counts, and identity results without writes.
7. In actual mode, write data sources, mappings, players, Barcelona memberships, both lineups, goal events, team statistics, and safely resolved player statistics in one transaction.

Every write checks the target record and provider mapping first. The endpoint reports created, updated, and unchanged counts. It returns 404 in production.

`GET /api/dev/qa/rich-match?matchId=...` reads only PostgreSQL. It performs no provider requests and returns match facts, both lineups, formations, bench, shirts, display coordinates, goals, team statistics, Barcelona player statistics, ownership, unresolved identities, explicit gaps, and database invariants.

## Proven target-match result

- GOAL: 46 players, two complete starting XIs, 12 substitutes per team, Sevilla `4-2-3-1`, Barcelona `4-3-3`, four goals, and two normalized team-stat rows.
- Big Balls: 32 rows with participation evidence, 22 safely resolved and persisted, including 11 Barcelona player-stat rows. Ten rows remain unresolved rather than guessed.
- Pass accuracy is always derived as `completedPasses / passes` and stored on a `0–1` scale.
- The final repeated sync created or updated zero rows; all 124 provider mappings, 46 players, 23 Barcelona memberships, two lineups, 46 lineup entries, four events, two team-stat rows, and 22 player-stat rows were unchanged.

## Missing-data and fallback policy

The normalized database intentionally leaves unavailable values null. This phase does not fabricate:

- xG or xA;
- shot or tracking coordinates;
- a complete card timeline;
- a complete substitution timeline;
- heat maps;
- injury data;
- universal ratings.

GOAL's goal-only feed is not expanded into fake card or substitution events, and assists stay attached to their goal through `relatedPlayerId`. Big Balls all-zero, zero-minute rows do not become participation statistics. StatsHawk is registered as the future player-stat fallback, but fallback ingestion and full-season backfill remain separate phases.

## Safety boundary

Writes are scoped to the approved target match, its two lineups and rich data, provider mappings, required player identities, and current-season Barcelona memberships. The sync does not create another `Match`, touch standings, rewrite other fixtures, change Overview behavior, delete data, or backfill the season.

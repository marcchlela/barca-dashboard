# Free football data sources — 2026 audit

Research date: **2026-09-25**. Scope: current FC Barcelona/La Liga data that can legally and safely support a server-side dashboard at zero cost. This is an engineering risk assessment, not legal advice.

## Decision

There is still no single verified, stable, legally reusable, zero-cost source for every desired field. The defensible free stack is:

1. **football-data.org** for primary fixtures, results, and standings.
2. **StatsHawk** for a current-match cross-check, venue, player box-score measures, roster associations, and player overview.
3. **openfootball** as a CC0 fixture/result cross-check and outage fallback.
4. **TheSportsDB** for best-effort venue/profile enrichment only; its five-row cap makes rich match collections partial.
5. **StatsBomb Open Data** for historical research/schema experiments, not current matches.

Do not automate Understat, FotMob, SofaScore, ESPN, official LaLiga pages/apps, or official UEFA pages under their current policies. Do not adopt PitchAPI until its provenance and reuse rights are clarified in writing.

## Classification vocabulary

- `OFFICIAL_API`: documented API/open-data channel published by the provider itself; this does not imply official competition-data rights.
- `PUBLIC_API_UNDOCUMENTED`: public machine-readable source that is not a conventional API, used only with an explicit open licence.
- `PUBLIC_WEB_MANUAL_ONLY`: human inspection only.
- `RESTRICTED_DO_NOT_AUTOMATE`: terms or robots policy blocks automation.
- `UNKNOWN_DO_NOT_AUTOMATE`: permission/provenance is not clear enough for safe automation.

## Provider comparison

| Source | Class | Automation | Current La Liga | Test-match result | Decision |
|---|---|---:|---:|---|---|
| [football-data.org](https://www.football-data.org/pricing) | `OFFICIAL_API` | Allow | Yes | Exact mapped match `564690`; basic score/referee, no free rich arrays | Primary basic backbone |
| [StatsHawk](https://www.statshawk.ai/api) | `OFFICIAL_API` | Allow with key | Yes, verified | Exact contest, venue, finalized player box score, roster, capabilities, player overview | Player-match enrichment |
| [TheSportsDB](https://www.thesportsdb.com/documentation) | `OFFICIAL_API` | Allow | Yes | Exact event `2506233`; venue plus five-row partial collections | Secondary only |
| [StatsBomb Open Data](https://github.com/statsbomb/open-data) | `OFFICIAL_API` | Allow | No | Current season absent; newest La Liga is 2020/21 | Historical only |
| [openfootball/football.json](https://github.com/openfootball/football.json) | `PUBLIC_API_UNDOCUMENTED`* | Allow | Yes | Exact date/teams/HT/FT match | Cross-check |
| [Understat](https://understat.com/) | `RESTRICTED_DO_NOT_AUTOMATE` | Deny | Visible manually | No request | Manual reference only |
| [FotMob](https://www.fotmob.com/) | `RESTRICTED_DO_NOT_AUTOMATE` | Deny | Visible manually | No request | Do not automate |
| [SofaScore](https://www.sofascore.com/de/terms-and-conditions) | `RESTRICTED_DO_NOT_AUTOMATE` | Deny | Visible manually | No request | Do not automate |
| ESPN | `RESTRICTED_DO_NOT_AUTOMATE` | Deny | Visible manually | No supported public soccer API | Do not automate |
| [official LaLiga](https://www.laliga.com/en-GB/legal/legal-oficial) | `RESTRICTED_DO_NOT_AUTOMATE` | Deny | Yes | No public developer API/automation permission | Do not automate |
| [official UEFA](https://www.uefa.com/news-media/news/0256-0dc91ad71f32-ce04913814f0-1000--general-terms-and-conditions/) | `RESTRICTED_DO_NOT_AUTOMATE` | Deny | UEFA only | Systematic collection prohibited | Do not automate |
| [PitchAPI](https://pitchapi.dev/) | `UNKNOWN_DO_NOT_AUTOMATE` | Deny pending proof | Claimed | No public terms/upstream licence found | Seek written clarification |
| [football-data.co.uk](https://www.football-data.co.uk/data.php) | `RESTRICTED_DO_NOT_AUTOMATE` | Deny | Yes | Private-use terms exclude automated bot/scraper/AI use | Do not automate |
| [API-Football](https://www.api-football.com/documentation-v3) | `OFFICIAL_API` | Allow with key | Not on this free plan | Current season unavailable | Historical benchmark only |

\* The requested taxonomy has no `OPEN_DATASET` value. Openfootball is a documented CC0 static dataset; `PUBLIC_API_UNDOCUMENTED` is the closest available classification.

## Verified current-match capability

`Yes` means the field actually appeared for Sevilla 1–3 Barcelona. `Partial` means a known provider cap prevents completeness. Capability-only fields do not count as actual coverage.

| Source | Fixtures | Lineups | Formation | Events | Team stats | Player stats | Ratings | xG | Injuries | Notes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| football-data.org | Yes | No | No | No | No | No | No | No | No | Basic free response |
| StatsHawk | Yes | No | No | No | No | Yes | No | No | No | Finalized player box score; roster is not a lineup |
| TheSportsDB | Yes | Partial (5) | No | Partial (5) | Partial (5) | No | No | No | No | Community data and five-row cap |
| StatsBomb Open Data | Historical | Historical | Historical | Historical | Historical | Historical | No | Historical | No | La Liga ends at 2020/21 |
| openfootball | Yes | No | No | No | No | No | No | No | No | Fixture/result data only |

StatsHawk's capabilities response advertised `xg` and `xa`, but neither appeared in the selected match. The lab therefore reports actual xG coverage as false.

## API keys and zero-cost access

| Provider | Environment variable | $0 access | Repository status |
|---|---|---|---|
| football-data.org | `FOOTBALL_DATA_API_KEY` | 10 requests/minute; basic current La Liga | Configured and verified |
| TheSportsDB | None for v1 development access | Public development key `123`; rich endpoint cap of five | Verified |
| StatsHawk | `STATSHAWK_API_KEY` | 5,000 weighted units/month | Configured and verified |
| StatsHawk base URL | `STATSHAWK_BASE_URL` (optional) | Defaults to `https://api.statshawk.ai/v1` | Default verified |
| API-Football | Provider key | Older seasons on this plan | Not suitable for current season |
| PitchAPI | `PITCHAPI_API_KEY` if ever approved | Advertised free/unlimited | Intentionally not used |

Keys are server-only ignored environment values. None is printed, returned by the endpoint, stored in samples, or committed.

## StatsHawk experiment

The exact contest is `cst_06g95vb5bhv131tnctf3ykgy60`, kickoff `2026-09-19T19:00:00Z`, Sevilla 1–3 Barcelona. The final adapter path used:

| Endpoint | Weight |
|---|---:|
| `GET /v1/competitions` | 1 |
| `GET /v1/competitions/laliga/editions/2026/games?date=2026-09-19` | 2 |
| `GET /v1/contests/{id}` | 1 |
| `GET /v1/contests/{id}/boxscore` | 2 |
| `GET /v1/competitions/laliga/capabilities` | 1 |
| `GET /v1/teams/{barcelona_id}/roster` | 3 |
| `GET /v1/persons/{person_id}/overview?competition=laliga&season=2026` | 1 |

That is 7 requests and 11 weighted units per uncached refresh. The in-memory Data Lab cache lasts 15 minutes.

Actual Barcelona player fields were minutes, goals, assists, shots, shots on target, shot accuracy, passes, completed passes, pass percentage, tackles, interceptions, fouls, yellow/red totals, and keeper measures. Four compact rows are stored in [the sanitized sample](data-lab/samples/statshawk.json).

The roster supplied 35 player associations with broad positions in the sampled rows, but no sampled shirt numbers. It does not establish confirmed starters, substitutes, formation, or match positions.

StatsHawk's documentation describes current injury data for MLB, NFL, NBA, NHL, and WNBA, not soccer. An injury-history request was therefore not useful for this experiment, and injury coverage remains false.

## Other verified source notes

### football-data.org

The [pricing page](https://www.football-data.org/pricing) lists a €0 tier with 12 competitions, fixtures/tables, delayed schedules/scores, and 10 calls per minute. Deep lineups, substitutes, goals, and cards are paid. [La Liga is in free coverage](https://www.football-data.org/coverage).

### TheSportsDB

The [official documentation](https://www.thesportsdb.com/documentation) exposes event, lineup, timeline, event-stat, team, and player endpoints. For Sevilla–Barcelona, it returned venue plus exactly five lineup, five timeline, and five statistic rows. Those rich collections are incomplete. The adapter now selects the team/player profile from Barcelona's actual home/away side rather than assuming Barcelona is away.

### StatsBomb Open Data

The official [open-data repository](https://github.com/statsbomb/open-data) provides rich historical data with attribution requirements. Its current catalogue does not cover the 2026/27 test match.

### openfootball

The generated [football.json repository](https://github.com/openfootball/football.json) is CC0/public domain. Its local match time has no timezone, so the lab retains it as `local_time_unknown_zone` instead of creating a fake UTC instant.

## Field-by-field conclusion

| Desired field | Best verified $0 source | Confidence |
|---|---|---|
| Fixtures/results | football-data.org | High |
| Standings | football-data.org | High |
| Fixture/result cross-check | StatsHawk + openfootball | High/medium |
| Venue | StatsHawk; TheSportsDB secondary | Medium/high |
| Referee | football-data.org when present | Medium/high |
| Player match minutes/goals/assists | StatsHawk | Medium/high |
| Player shots/passing/defensive totals | StatsHawk | Medium/high |
| Goalkeeper match statistics | StatsHawk | Medium/high |
| Complete lineups/bench/formations | None | Gap |
| Timestamped events/substitutions | None | Gap |
| Complete team stats/possession | None | Gap |
| Actual xG and shot coordinates | None current | Gap |
| Player ratings | None current | Gap |
| Soccer injuries/suspensions | None verified | Gap |

Preserve missing values as missing. Do not infer lineup status from a roster, infer xG from advertised capabilities, infer completeness from a five-row response, or replace legal data gaps with scraped feeds.

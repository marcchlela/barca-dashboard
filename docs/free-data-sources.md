# Free football data sources — 2026 audit

Research date: **2026-09-25**. Scope: current FC Barcelona/La Liga data that can legally and safely support a server-side dashboard at zero cost. This is an engineering risk assessment, not legal advice.

## Decision

There is no verified, stable, legally reusable, zero-cost source that supplies the complete desired data set: current fixtures, standings, venue, full lineups and bench, formations, full events, team statistics, xG/shot coordinates, player match statistics/ratings, and injuries.

The defensible free stack is:

1. **football-data.org** for the primary current fixture/result/standings backbone.
2. **openfootball** as a CC0 fixture/result cross-check and outage fallback, not as an authority.
3. **TheSportsDB** for best-effort venue and small representative enrichment only. Its five-row free response cap makes lineups, timelines, and statistics incomplete.
4. **StatsBomb Open Data** for historical research and schema/model experiments, not current matches.
5. **StatsHawk** is the strongest untested follow-up candidate: it has documented terms, La Liga coverage, player match lines/injuries, and 5,000 free units. A user-created key is required before its real coverage can be validated.

Do not build automated adapters for Understat, FotMob, SofaScore, ESPN, official LaLiga pages/apps, or official UEFA pages under their present policies. Do not adopt PitchAPI until its data provenance and reuse rights are clarified in writing.

## Classification vocabulary

- `OFFICIAL_API`: documented API/open-data channel published by the provider itself. This does not mean the vendor is the official competition data rights-holder.
- `PUBLIC_API_UNDOCUMENTED`: publicly reachable machine-readable source that is not a conventional supported API. Use only when an explicit open licence independently permits it.
- `PUBLIC_WEB_MANUAL_ONLY`: page can be inspected by a person, but automation is not authorized.
- `RESTRICTED_DO_NOT_AUTOMATE`: terms, robots policy, or other first-party restriction blocks automation.
- `UNKNOWN_DO_NOT_AUTOMATE`: permission or upstream provenance is not clear enough to automate safely.

## Comparison matrix

| Source | Class | Automation | Current La Liga | Free constraints | Test-match result | Decision |
|---|---|---:|---:|---|---|---|
| [football-data.org](https://www.football-data.org/pricing) | `OFFICIAL_API` | Allow | Yes | 10 requests/minute; basic tier omits deep data | Exact match `564690`; score + referee, no venue/rich arrays | Primary |
| [TheSportsDB](https://www.thesportsdb.com/documentation) | `OFFICIAL_API` | Allow | Yes | 30 requests/minute; rich endpoints return only five rows on free API | Exact event `2506233`; venue plus partial lineups/events/stats | Secondary only |
| [StatsBomb Open Data](https://github.com/statsbomb/open-data) | `OFFICIAL_API` | Allow | No | Open research dataset; attribution rules apply | Current season absent; newest La Liga is 2020/21 | Historical only |
| [openfootball/football.json](https://github.com/openfootball/football.json) | `PUBLIC_API_UNDOCUMENTED`* | Allow | Yes | CC0, daily generated JSON; community maintained | Exact date/teams/HT/FT match | Cross-check |
| [StatsHawk](https://www.statshawk.ai/api) | `OFFICIAL_API` | Allow with key | Claimed yes | 5,000 units/month; hourly soccer refresh; test key | Not tested: no project key | Next trial |
| [Understat](https://understat.com/) | `RESTRICTED_DO_NOT_AUTOMATE` | Deny | Visible manually | `robots.txt` disallows `/` for all agents; no official API/licence found | No automated request | Manual reference only |
| [FotMob](https://www.fotmob.com/) | `RESTRICTED_DO_NOT_AUTOMATE` | Deny | Yes | Terms prohibit robots/crawlers and systematic use | No automated request | Do not automate |
| [SofaScore](https://www.sofascore.com/de/terms-and-conditions) | `RESTRICTED_DO_NOT_AUTOMATE` | Deny | Yes | Terms prohibit scraping/aggregation and server burden from automated requests | No automated request | Do not automate |
| [ESPN](https://www.disneyplus.com/welcome/subscriber-agreement) | `RESTRICTED_DO_NOT_AUTOMATE` | Deny | Yes | No supported public soccer API; service terms prohibit automated extraction/data mining | No automated request | Do not automate |
| [official LaLiga](https://www.laliga.com/en-GB/legal/legal-oficial) | `RESTRICTED_DO_NOT_AUTOMATE` | Deny | Yes | Content limited to personal/private use; reuse requires authorization | No automated request | Do not automate |
| [official UEFA](https://www.uefa.com/news-media/news/0256-0dc91ad71f32-ce04913814f0-1000--general-terms-and-conditions/) | `RESTRICTED_DO_NOT_AUTOMATE` | Deny | Yes for UEFA competitions | General terms prohibit systematic/automated collection | No automated request | Do not automate |
| [PitchAPI](https://pitchapi.dev/) | `UNKNOWN_DO_NOT_AUTOMATE` | Deny pending proof | Claimed yes | Free/unlimited claim, but no public terms or upstream licence found | No automated request | Seek written clarification |
| [football-data.co.uk](https://www.football-data.co.uk/data.php) | `RESTRICTED_DO_NOT_AUTOMATE` | Deny | Yes | Owner limits data to private individuals and excludes bots/scrapers/AI | No automated request | Do not automate |
| [API-Football](https://www.api-football.com/documentation-v3) | `OFFICIAL_API` | Allow with key | Not on this project's free plan | Current season is outside the available free seasons | Not tested | Historical benchmark only |

\* The requested taxonomy has no `OPEN_DATASET` value. openfootball is a documented CC0 static dataset rather than an undocumented API; `PUBLIC_API_UNDOCUMENTED` is the closest available label.

## Requested capability matrix

`Yes` means verified for the selected current match unless marked otherwise. `Partial` means the provider returned data but a known cap made it incomplete. `Visible` means it appears on the consumer site but cannot be automated under the current policy. `Claimed` means first-party API documentation advertises it, but this lab could not test it without a user-created key.

| Source | Classification | Current 2026/27 Barça? | Free? | Automation allowed? | Fixtures | Lineups | Formation | Events | Team stats | Player stats | Ratings | xG | Shot map | Injuries | Limitations | Recommendation |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| football-data.org | `OFFICIAL_API` | Yes | Yes | Yes | Yes | No | No | No | No | No | No | No | No | No | Deep match data is paid | Primary basic backbone |
| TheSportsDB | `OFFICIAL_API` | Yes | Yes | Yes | Yes | Partial (5) | No | Partial (5) | Partial (5) | No match stats | No | No | No | No | Five-row free cap; community data | Venue/profile enrichment only |
| StatsBomb Open Data | `OFFICIAL_API` | No | Yes | Yes | Historical | Historical | Historical | Historical | Historical | Historical | No consumer rating | Historical | Historical | No | La Liga ends at 2020/21 | Historical modelling only |
| openfootball | `PUBLIC_API_UNDOCUMENTED`* | Yes | Yes | Yes | Yes | No | No | No | No | No | No | No | No | No | Community fixture/result data only | Result cross-check |
| StatsHawk | `OFFICIAL_API` | Claimed | Yes | Yes with key | Claimed | Unknown | Unknown | Unknown | Claimed | Claimed | Unknown | Claimed | Unknown | Claimed | No project key; new provider | Next controlled trial |
| Understat | `RESTRICTED_DO_NOT_AUTOMATE` | Visible | Yes to view | No | Visible | No | No | Visible shots | Visible | Visible | No | Visible | Visible | No | robots.txt disallows all automation | Manual reference only |
| FotMob | `RESTRICTED_DO_NOT_AUTOMATE` | Visible | Yes to view | No | Visible | Visible | Visible | Visible | Visible | Visible | Visible | Visible | Visible | Visible | Terms forbid systematic/automated extraction | Do not automate |
| SofaScore | `RESTRICTED_DO_NOT_AUTOMATE` | Visible | Yes to view | No | Visible | Visible | Visible | Visible | Visible | Visible | Visible | Visible | Visible | Visible | Terms forbid scraping/aggregation | Do not automate |
| ESPN | `RESTRICTED_DO_NOT_AUTOMATE` | Visible | Yes to view | No | Visible | Some | Some | Visible | Visible | Visible | No | Limited | No | Limited | Undocumented endpoints; automation prohibited | Do not automate |
| official LaLiga | `RESTRICTED_DO_NOT_AUTOMATE` | Visible | Yes to view | No | Visible | Visible | Visible | Visible | Visible | Visible | No | Unknown | Unknown | Visible | Personal/private content terms; no developer API | Do not automate |
| official UEFA | `RESTRICTED_DO_NOT_AUTOMATE` | UEFA only | Yes to view | No | Visible | Visible | Visible | Visible | Visible | Visible | No | Visible | Visible | Visible | Systematic collection prohibited | Do not automate |
| PitchAPI | `UNKNOWN_DO_NOT_AUTOMATE` | Claimed | Claimed free | Not yet | Claimed | Claimed | Claimed | Claimed | Claimed | Claimed | Unknown | Claimed | Claimed | Unknown | No public terms/upstream licence | Seek written permission/provenance |
| football-data.co.uk | `RESTRICTED_DO_NOT_AUTOMATE` | Yes | Private use | No | Yes | No | No | No | Yes | No | No | No | No | No | Explicit bot/scraper/AI exclusion | Do not automate |
| API-Football | `OFFICIAL_API` | No on free plan | Historical only | Yes with key | Historical | Historical | Historical | Historical | Historical | Historical | Historical | Varies | Varies | Historical | Free access stops at 2024 for this key | Optional historical benchmark |

## API keys and zero-cost access

| Provider | Environment variable | $0 access | Situation in this repository |
|---|---|---|---|
| football-data.org | `FOOTBALL_DATA_API_KEY` | Yes; 10 requests/minute and basic current La Liga coverage | Already configured and verified; never returned or committed |
| TheSportsDB | None for v1 development access | Yes; public development key `123`, 30 requests/minute, five-row rich endpoint cap | Verified without a private secret |
| StatsHawk | `STATSHAWK_API_KEY` | Yes; 5,000 weighted units/month, no card, test API key | Not configured; user must create the free key before a real probe |
| API-Football | Provider-specific key already tested outside this lab | Yes only for older seasons available to the plan | Do not use for current 2026/27 data |
| PitchAPI | `PITCHAPI_API_KEY` if ever approved | Advertises free/unlimited access | Intentionally not requested or used until terms and provenance are clarified |

The lab does not create accounts. Keys must be obtained by the user from the provider and placed only in the local ignored `.env`. A missing optional key is reported as `not_configured`, not treated as a provider failure.

## Verified source notes

### football-data.org

The [pricing page](https://www.football-data.org/pricing) lists a €0 tier with 12 competitions, fixtures/tables, delayed schedules/scores, and 10 calls per minute. The same page places lineups, substitutes, goals, and cards in the paid Deep Data tier. [La Liga is in free coverage](https://www.football-data.org/coverage), and the [v4 policy documentation](https://docs.football-data.org/general/v4/policies.html) confirms the free rate limit.

The actual free match request returned the correct current result, matchday, half-time score, and referee. `venue` was null and the lineup, bench, goals, bookings, and substitutions arrays were empty. It is reliable for the project's existing basic backbone, not for the requested detail expansion.

### TheSportsDB

The [official documentation](https://www.thesportsdb.com/documentation) exposes event, lineup, timeline, and event-stat endpoints and a public development key. It documents a 30-request/minute limit and five-result limit for each of those rich endpoints on v1 free access. The [terms](https://www.thesportsdb.com/docs_terms_of_use.php) distinguish API use from prohibited website scraping, require credit, and reserve app-store publication for paid subscribers.

For Sevilla–Barcelona, lookup returned the stadium plus exactly five lineup rows, five timeline rows, and five statistic rows. Separate official endpoints also returned a Barcelona team profile and an Andreas Christensen player profile (position, shirt number, birth date, nationality, height, and weight). Those profiles are useful reference data, but the capped match collections are incomplete and must not be represented as complete.

### StatsBomb Open Data

The official [open-data repository](https://github.com/statsbomb/open-data) publishes competition, match, lineup, event, and selected 360 data with attribution requirements. Its live catalogue contained 80 competition-season entries during this audit; La Liga ended at 2020/21. This is excellent for historical event-model development but cannot enrich the 2026/27 test match.

### openfootball

The [España source repository](https://github.com/openfootball/espana) and generated [football.json repository](https://github.com/openfootball/football.json) are CC0/public domain. The generated JSON is documented as rebuilding daily from Football.TXT. The 2026/27 La Liga file contained the exact selected match with date, local time, teams, half-time score, and full-time score.

This is the cleanest no-key fallback found, but its community-maintained nature and narrow fields make it a cross-check rather than the canonical feed.

### StatsHawk

StatsHawk's [API page](https://www.statshawk.ai/api) claims La Liga support and 5,000 free lookups. [Pricing](https://www.statshawk.ai/pricing) says standard stats are available on the free plan. Most importantly, its [terms](https://www.statshawk.ai/terms) explicitly allow caching, history, and derived statistics in public applications while forbidding raw-data resale. Its [freshness contract](https://www.statshawk.ai/docs/getting-started/freshness) says soccer refreshes hourly.

This is materially safer than reverse-engineered consumer endpoints, but it is a new service and was discovered late in the audit. No account was created and no key was present, so field completeness for the selected match remains unverified. Trial it next with a user-created test key.

### Restricted consumer and official sites

- Understat served a current 2026/27 La Liga page during manual review, but `https://understat.com/robots.txt` returned `User-agent: *` and `Disallow: /`. No adapter was created.
- FotMob's own site states that automatic services and systematic/regular use are not permitted.
- [SofaScore terms](https://www.sofascore.com/de/terms-and-conditions) prohibit extraction, aggregation, scraping, and burdening its servers with automated requests.
- Current ESPN JSON URLs are undocumented. The Disney agreement covering ESPN services prohibits robots/scripts, data mining, and database compilation.
- [LaLiga's official app terms](https://www.laliga.com/en-GB/legal/legal-oficial) restrict content to personal/private use and prohibit reproduction or public communication without authorization.
- [UEFA's general terms](https://www.uefa.com/news-media/news/0256-0dc91ad71f32-ce04913814f0-1000--general-terms-and-conditions/) prohibit systematic collection via robots, spiders, scripts, or other automated means.

### Unclear or unsuitable alternatives

- PitchAPI has unusually rich documentation and a free/unlimited claim. A [recent community launch post](https://www.reddit.com/r/sportsanalytics/comments/1vp4s09/free_advanced_analytics_football_api/) says the data is aggregated from multiple sources including WhoScored. No public terms or upstream licensing statement was found. That combination is not sufficient for an automated integration.
- football-data.co.uk publishes useful current CSVs, but its [data page](https://www.football-data.co.uk/data.php) explicitly limits free data to private individuals and excludes commercial/data-training uses involving automated bots, scrapers, or AI.
- Libraries such as soccerdata/worldfootballR and public GitHub wrappers are implementation tools, not data licences. If their upstream site is restricted, the wrapper does not make the data safe.

## GitHub and community lead review

Current [Reddit discussions](https://www.reddit.com/r/sportsanalytics/comments/1v8rk3h/looking_for_football_data_sources_and_apis/) correctly surfaced the practical pattern: football-data.org is reliable but thin, API-Football excludes current seasons on free access, and recommendations often drift toward scraping SofaScore/ESPN. Those posts were used only to discover leads; every decision above was checked against first-party documentation, terms, robots policy, or an explicit open licence.

The legitimate GitHub findings were StatsBomb's official open-data repository and openfootball's CC0 repositories. Scraper projects were intentionally not treated as evidence of permission.

## Field-by-field conclusion

| Desired field | Best verified $0 source | Confidence |
|---|---|---|
| Fixtures/results | football-data.org | High |
| Standings | football-data.org | High |
| Fixture/result backup | openfootball | Medium |
| Venue | TheSportsDB, verify independently | Medium/low |
| Referee | football-data.org when present | Medium/high |
| Complete lineups/bench/formations | None | Gap |
| Complete goals/assists/cards/substitutions | None | Gap |
| Complete team stats | None | Gap |
| xG and shot coordinates | StatsBomb historical only | Current gap |
| Player match statistics/ratings | StatsHawk may help; untested | Gap pending trial |
| Injuries/suspensions | StatsHawk may help; untested | Gap pending trial |

The engineering recommendation is to preserve missing values as missing. Do not infer completeness from a non-empty five-row response, do not synthesize unavailable formations or ratings, and do not silently replace legal data gaps with scraped feeds.

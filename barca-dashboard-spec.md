# FC Barcelona Dashboard — Canonical Product & Engineering Spec

**Version:** 0.1.0  
**Status:** Living source of truth  
**Last updated:** 2026-10-03  
**Audited branch:** `match-center-ui`  
**Audited commit:** `26175a6c3c588a39c6ec673038a06b31b3c8af76`  
**Commit:** `build match center diary and automatic match media`

---

## 1. Purpose

This file is the canonical living spec for the FC Barcelona Dashboard.

Update it whenever a meaningful product, design, data, architecture, deployment, provider, or roadmap decision changes. The goal is to keep one reliable source of truth instead of reconstructing the project from old chats.

The project is currently **one user + FC Barcelona first**. Barça-only multi-user support is a realistic later extension. A fully multi-club platform is a much larger future idea and is explicitly **not current scope**.

---

# 2. Product identity

The FC Barcelona Dashboard is a personal **Barça Command Center**.

It is not meant to be a generic scores site, a SofaScore clone, or a normal SaaS dashboard. It combines:

- fixtures and results;
- Match Center;
- live/matchday context;
- squad and player pages;
- team and player analytics;
- season narrative;
- league-race visualizations;
- trophy/history experiences;
- official Barça media;
- a personal match diary;
- a personal Barça archive;
- future AI match predictions;
- future goal-path/replay visualizations;
- a future deep interactive Camp Nou experience.

The overall feeling should be:

> broadcast control room + Barça archive + analytics lab + personal fandom history.

---

# 3. Current scope

Current product scope:

- FC Barcelona men's first team;
- current season first, currently 2026/27;
- modern-era data first;
- one personal user first;
- responsive, desktop-rich UI;
- free-first/low-cost data strategy;
- self-hostable;
- strong provenance;
- conservative provider merging;
- never fabricate unavailable data.

Do not currently generalize into:

- all clubs;
- a public football platform;
- a social network;
- a betting product;
- a paid-provider-dependent architecture.

---

# 4. Core experience

The intended user journey is:

1. Enter the Barça Command Center.
2. Immediately understand current Barça state.
3. Move naturally from overview → match → player → season context.
4. Relive matches through stats, media and personal diary.
5. Build a personal Barça history over time.

The dashboard should react to:

- Normal
- Pre-Match
- Matchday
- Live
- Half Time
- Full Time

The current overview state engine already supports Normal / Matchday / Live / Full Time, with richer state refinement planned.

---

# 5. Design system

## 5.1 Design direction

Primary design language: **Stadium Control Room**.

Use:

- editorial/broadcast composition;
- strong grid structure;
- compact information density;
- rectangular/squared geometry;
- restrained borders;
- subtle layered dark surfaces;
- kit-derived accents;
- tactical/technical visual language;
- real player photography where useful;
- deliberate motion.

Avoid:

- generic SaaS cards;
- heavy rounded corners;
- excessive glow;
- detached floating panels;
- overuse of pills;
- gamer-dashboard clutter;
- emoji as football UI icons.

## 5.2 Navigation

The main left navigation is the **Stadium Rail**.

Current routes:

- Overview
- Matches
- Squad
- Analytics
- Club
- Media
- My Barça
- Settings

`My Match` is not a global rail item. It is specific to an individual match and belongs inside Match Center.

A future `/admin` area should also be separate from the fan-facing rail.

## 5.3 Time format

Use **12-hour AM/PM** throughout user-facing UI.

## 5.4 Icons

Rules:

- Lucide for general interface/navigation/actions;
- dedicated football/SVG icon for football events;
- no football emoji in production UI;
- prefer SVG/icon libraries over PNGs for interface controls.

## 5.5 Scrollbars

Global rule:

- do not use browser-default scrollbars;
- scrollbars inherit the active kit theme;
- use thin themed scrollbars globally;
- use `scrollbar-subtle` where a scrollbar should visually recede;
- apply the same rule to modals, tables, admin surfaces and horizontal panels.

---

# 6. Kit themes

The product uses kit identity instead of conventional light/dark mode.

## Home

Core palette:

- Barça Red `#6B1D2F`
- Barça Blue `#0B1A30`
- Gold `#D39C43`

## Away

Core palette:

- Purple `#4D2280`
- Black
- Gold `#C5A059`

The background should retain a subtle purple/plum undertone rather than becoming generic black mode.

## Third

Current identity:

- Mint
- Teal
- Loyal Blue
- Gym Red

The entire screen should not be flooded with mint. The current dark petrol/teal environment is the right direction.

## Historical kit direction

`getTheme(season, kit)` deliberately keeps `season` in the API so historical seasons can later resolve historical kit palettes.

---

# 7. Current technology stack

Current audited repository stack:

- Next.js 16.3.5
- React 19.2.8
- TypeScript
- Tailwind CSS 4
- Prisma 8 RC contract/ORM
- PostgreSQL
- `@prisma/orm-postgres`
- Three.js
- React Three Fiber
- Drei
- Motion
- Lucide React
- React Icons
- Temporal polyfill
- Docker for local PostgreSQL

Local PostgreSQL has used host port `5434`.

---

# 8. Repository structure

Important current areas:

```text
src/
  app/
    page.tsx
    matches/
      [id]/
    analytics/
    club/
    media/
    my-barca/
    settings/
    squad/
    api/
      dev/

  components/
    dashboard/
    intro/
    match/
    match-center/
    season/
    shell/
    theme/
    icons/

  lib/
    dashboard/
    data-lab/
    matches/
    providers/
      football-data/
      goal-api/
      big-balls/
      statshawk/
      rich-match/
      youtube-fcbarcelona/
      shared/

  prisma/
    contract.prisma
    db.ts

docs/
assets/
tools/
```

Current branch notes:

- `match-center-ui` contains the newest Match Center / My Match / YouTube work;
- `data-backbone-v2` contains earlier data-backbone history;
- `main` should only be considered fully current after deliberate merge.

---

# 9. Top-level route status

## `/` Overview

**Implemented / functional.**

Current features:

- Barça Command Center shell;
- Stadium Rail;
- Match Stage;
- Barça Pulse;
- Season Story;
- Home/Away/Third theme switching;
- automatic match-state engine;
- background data freshness controller;
- themed scrollbars;
- signature 3D intro.

## `/matches`

**Placeholder.**

Planned:

- complete schedule;
- results;
- calendar;
- competition filtering;
- match history;
- watched/rated indicators;
- Match Center links.

## `/squad`

**Placeholder.**

Planned:

- squad browser;
- player pages;
- positions;
- availability;
- season stats;
- favourite/pinned players.

## `/analytics`

**Placeholder.**

Planned:

- advanced team stats;
- player analytics;
- league race;
- heatmaps when trustworthy;
- match analysis;
- prediction model.

## `/club`

**Placeholder.**

Planned:

- trophy cabinet;
- seasons/eras;
- club history;
- deep Camp Nou experience.

## `/media`

**Placeholder.**

Planned:

- official highlights;
- goal clips;
- interviews;
- press conferences;
- training;
- other Barça media.

## `/my-barca`

**Placeholder.**

Planned personal archive:

- watched matches;
- ratings;
- Man of the Match;
- favourite goals;
- notes;
- favourite players;
- season recap.

## `/settings`

**Placeholder.**

Planned:

- themes;
- season preferences;
- dashboard behavior;
- personal settings;
- selected diagnostics where appropriate.

---

# 10. Overview / Command Center

Current layout:

- desktop Stadium Rail;
- central Match Stage;
- Barça Pulse;
- Season Story;
- compact navigation on smaller screens.

Current automatic match-state engine:

- `live` when current/next fixture is live or at half time;
- `fulltime` for a short post-match window after a finished match;
- `matchday` when the next match is today;
- otherwise `normal`.

Developer state overrides must never change real provider polling cadence.

Future state refinement:

- pre-match countdown;
- confirmed lineups available;
- live minute/score;
- half-time specific state;
- post-match state;
- media-available state.

---

# 11. Season Story

Implemented horizontal season timeline with:

- chronological positioning;
- collision avoidance;
- horizontal scrolling;
- left/right navigation;
- match-derived moments;
- `SeasonMoment` support;
- team/competition visuals;
- clickable match moments;
- win/draw/loss/key visual language.

Planned:

- hide arrows automatically at ends;
- richer tooltips;
- injuries/trophies/key moments when trusted;
- deeper links to matches and players.

---

# 12. League Race

Planned visualization:

- all 20 La Liga teams;
- league position across rounds;
- strong Barça emphasis;
- interactive round inspection;
- title/top-four/relegation context.

Not yet implemented.

---

# 13. Trophy Cabinet

Planned:

- current-season trophies;
- all-time trophies;
- images and/or 3D models;
- season metadata;
- rich cabinet presentation.

Schema already includes:

- `Trophy`
- `TrophyWin`

---

# 14. Data backbone philosophy

Core principle:

> Provider data is evidence. The internal database is the canonical product model.

Rules:

- never guess ambiguous player identities;
- preserve provenance;
- use explicit provider mappings;
- missing fields stay `null`;
- zero remains real data;
- no fake xG;
- no fake coordinates;
- no fake event timelines;
- fallback providers fill gaps instead of blindly replacing primary data;
- syncs must be idempotent;
- QA should validate canonical DB invariants.

---

# 15. Provider ownership

## football-data.org

Primary role:

- fixture spine;
- results;
- standings;
- base match identity.

## GOAL API

Where available:

- starting XI;
- bench;
- formation;
- shirt numbers;
- match positions;
- coach;
- goal events;
- scorer/assist;
- team statistics.

Not every fixture is available.

## Big Balls Data

Current role:

- player match stats;
- ratings;
- some enrichment.

Known limitation:

- daily quota;
- incomplete match availability;
- provider identity/name differences.

## StatsHawk

Current role:

- player-stat fallback/enrichment;
- fill missing Big Balls fields;
- provide strong fallback when Big Balls does not cover a match.

Canonical rule:

- Big Balls stays primary when present;
- StatsHawk fills only missing/null primary fields;
- zero is preserved.

## OpenFootball

Independent fixture/result validation.

## TheSportsDB

Profile/venue enrichment and fallback research.

## StatsBomb Open Data

Useful historical/open research, not a current-season primary source.

## Official FC Barcelona YouTube

Current Match Media source.

Official channel:

- Channel ID: `UC14UlmYlSNiQCBe9Eookf_A`
- Upload playlist: `UU14UlmYlSNiQCBe9Eookf_A`

Credential:

- `YOUTUBE_API_KEY`

---

# 16. Canonical identity and merge rules

## Match identity

Provider fixture matching uses:

- both teams;
- competition;
- kickoff/date;
- score for finished fixtures;
- existing provider mapping when available.

## Player identity

Resolution priority:

1. existing provider mapping;
2. exact normalized full name within correct match team;
3. constrained safe evidence such as initial/surname + shirt + broad position;
4. unresolved instead of guessed.

## Pass accuracy

Canonical pass accuracy is derived as:

```text
completedPasses / passes
```

whenever both counts are available.

## Provider discrepancies

Small differences are preserved as provenance without unnecessarily blocking ingestion.

Current direction:

- tiny pass/completed-pass differences → minor discrepancy;
- meaningful differences → review discrepancy;
- blocking conflicts should be rare.

## Goal deduplication

A prior duplicate GOAL-event issue created duplicate goals for Racing and Sevilla.

The repair flow:

- grouped duplicates;
- selected keeper events;
- repointed mappings;
- repointed diary references when necessary;
- removed duplicate rows;
- re-ran QA.

Correct goal counts were restored.

---

# 17. Current rich-match coverage

Current tested 2026/27 La Liga state:

- 7 finished La Liga matches processed;
- all processed successfully;
- canonical player stats ready for all;
- blocking canonical conflicts reduced to zero;
- 5 full-rich matches;
- 2 partial Big Balls/fallback matches;
- StatsHawk filled many missing fields.

A Champions League match against Feyenoord also passed with:

- GOAL for rich match/team data;
- StatsHawk for player stats where Big Balls had no fixture;
- successful persistence and QA.

---

# 18. Match Center

Route:

```text
/matches/[id]
```

This is currently the deepest product area.

Current flow:

1. score hero;
2. previous/next match navigation;
3. Match Center tabs;
4. formation/lineups;
5. Match Timeline;
6. team comparison;
7. player performances;
8. Match Media;
9. My Match.

Internal tabs/sections include:

- Overview
- Lineups
- Stats
- Players
- Media
- My Match

## Score hero

Implemented:

- competition;
- status;
- crests;
- score;
- date;
- 12-hour kickoff;
- venue;
- theme.

## Previous / next match navigation

Implemented across competitions for the season.

Shows:

- opponent;
- crest;
- score if known;
- competition/date;
- direct navigation.

## Formation

Implemented:

- home/away toggle;
- formation;
- shirt numbers;
- names;
- real portraits where available;
- bench;
- cards;
- substitution indicators;
- clickable players.

Formation coordinates are UI layout coordinates, **not tracking data**.

## Cards / substitutions

Current UI:

- yellow-card marker;
- red-card marker;
- red/down marker for subbed-off player;
- green/up marker for player entering.

Do not invent exact card/substitution minute if provider data does not provide it.

## Match Timeline

Implemented broadcast-style chronological timeline.

Current UI vocabulary supports:

- Kick Off
- Half Time
- Full Time
- Goal
- Penalty goal
- Own goal
- Yellow card
- Red card
- Substitution
- Missed penalty
- Shot
- Pass
- Assist
- Carry
- Injury
- Offside
- Foul
- Save

Only display trustworthy timed events at exact minutes.

Barça events receive stronger visual emphasis.

Goal rows show running score.

## Team Comparison

Implemented.

Possible rows include:

- possession;
- shots;
- shots on target;
- passes;
- pass accuracy;
- corners;
- fouls;
- saves.

Visual bars must stop before numeric labels and never run underneath them.

## Player performance table

Implemented.

Goals and assists are separate columns.

Current fields include:

- portrait;
- player;
- position;
- rating;
- minutes;
- goals;
- assists;
- shots;
- pass percentage;
- tackles.

Rating colors should clearly differentiate elite vs average/poor performances.

## Player performance modal

Implemented as a **centered modal**, not a dedicated match-stat page or right drawer.

Entry points include:

- pitch player;
- bench player;
- player-performance row.

Current detail groups may include:

- minutes;
- goals;
- assists;
- rating;
- shooting;
- passing;
- xA when actually available;
- carrying/dribbling;
- defending;
- discipline;
- goalkeeper stats.

A separate full player profile page remains planned for season/career context.

---

# 19. My Match

`My Match` is match-specific and lives inside Match Center.

Global aggregation belongs in `My Barça`.

## Unlock rule

My Match is locked until the match is `finished`.

This rule is enforced both in UI and server/API logic.

## Current fields

Implemented:

- Watched
- Watch type:
  - Live
  - Replay
  - Highlights only
- Personal rating
- Your Man of the Match
- Favourite Goal
- Notes

## Rating

- 0.5–5 stars;
- half stars;
- Letterboxd-like interaction;
- icon based.

## Custom selectors

Man of the Match and Favourite Goal use themed custom selectors rather than generic browser dropdowns.

Player/goal entries include portraits and useful context.

## Persistence

Stored in `MatchDiaryEntry`.

Current model fields:

- `watched`
- `watchType`
- `watchedAt`
- `rating`
- `favouritePlayerId`
- `favouriteGoalEventId`
- `notes`

Potential later personal fields:

- where watched;
- watched with;
- mood/reaction tags;
- personal photos;
- memorable non-goal moment.

---

# 20. My Barça

Planned global personal archive.

Potential aggregate features:

- all watched matches;
- personal ratings;
- average match rating;
- most-selected Man of the Match;
- favourite goals;
- notes;
- favourite players;
- season memories;
- watch history/streaks;
- end-of-season Barça recap / Wrapped-like summary.

---

# 21. Match Media

## Current UI

Implemented in Match Center.

Supports:

- featured media;
- embedded YouTube;
- thumbnail fallback;
- official badge;
- title/type;
- source link;
- additional media cards;
- gold/theme-accent treatment for featured match highlight.

Highlights always rank before secondary media.

## Current media types

- `match_highlight`
- `goal_clip`
- `interview`
- `press_conference`
- `training`
- `historical`
- `other`

## Automatic official YouTube matcher

Current provider:

```text
src/lib/providers/youtube-fcbarcelona/match-media.ts
```

Current workflow:

1. resolve official Barça channel;
2. resolve uploads playlist;
3. fetch uploads around match time;
4. inspect duration/embeddability;
5. normalize title;
6. generate team/opponent aliases;
7. detect exact final score safely;
8. detect competition;
9. score timing;
10. classify media type;
11. hard-reject unrelated Barça categories;
12. score confidence;
13. auto-persist only safe candidates;
14. remain idempotent.

## Hard exclusions

The men's first-team matcher rejects obvious unrelated content including:

- Barça Live/watchalong;
- women's team;
- Liga F / UWCL;
- Barça Athletic / Barça B;
- youth/La Masia age-group videos;
- basketball;
- handball;
- futsal;
- roller hockey.

## Important highlight rule

Official highlights do **not** always contain the literal word `HIGHLIGHTS`.

Strongest signals are:

- opponent;
- exact final score;
- competition;
- upload timing;
- official source;
- embeddability.

## Verified examples

### Barça 7–2 Racing Santander

```text
FC BARCELONA 7 vs 2 RACING SANTANDER | LALIGA 2026/27 MD06
```

- confidence: 165;
- auto-accepted;
- persisted;
- second identical sync returned unchanged;
- embedded correctly in Match Center.

### Sevilla 1–3 Barça

```text
SEVILLA 1 vs 3 FC BARCELONA | LALIGA 2026/27 MD07
```

- confidence: 165;
- auto-accepted;
- persisted;
- displayed correctly.

---

# 22. Media automation requirement

Manual per-match sync is **not** the intended production workflow.

Target flow:

```text
match finishes
  ↓
background worker notices
  ↓
wait/check for official upload
  ↓
match video automatically
  ↓
high confidence → persist
  ↓
ambiguous → Admin Review
  ↓
Match Center updates
```

If no upload exists yet:

- do not permanently fail;
- keep the match eligible for future retry.

The automatic worker should eventually revisit only:

- recently finished matches;
- matches missing official media;
- matches still pending/review/retry.

It should not rescan the whole historical season forever.

---

# 23. Admin Control Room

Planned dedicated area:

```text
/admin
```

Separate from fan-facing navigation.

Potential sections:

- Overview
- Matches
- Media
- Players
- Providers
- Data Issues
- Sync
- Users later

## Admin Media Review

Planned first admin module.

Should support:

- discovered candidates;
- accepted/review/rejected queues;
- confidence score;
- scoring reasons;
- thumbnail/title/channel;
- predicted match;
- approve;
- reject;
- change match;
- change media type;
- mark featured;
- unlink/remove;
- manual URL fallback;
- rescan one match;
- rescan season;
- see why a candidate was rejected.

## Provider/Data admin

Later:

- GOAL health;
- Big Balls quota;
- StatsHawk quota;
- YouTube sync state;
- unresolved identities;
- mapping conflicts;
- missing formations;
- missing portraits;
- missing media;
- incomplete fixtures;
- QA;
- force resync;
- manual overrides.

Existing `ManualOverride` model can support future correction workflows.

---

# 24. Multi-user future

## Barça-only multi-user

Realistic future direction:

- users sign up;
- global Barça data is shared;
- each user has private My Match/My Barça data;
- admins control global football/media data;
- normal users cannot modify canonical provider data.

Possible user-specific data:

- watched;
- ratings;
- Man of the Match;
- favourite goals;
- notes;
- favourite players;
- recap.

## Multi-club platform

Possible much later, but not current scope.

Current code/domain is intentionally Barça-specific in many places:

- `isBarcelona`;
- Barça-specific data access;
- `My Barça`;
- official Barça YouTube;
- Barça theme identity.

Do not prematurely generalize this.

---

# 25. Signature 3D entry — The Threshold

The dashboard already includes a signature 3D entry experience.

Concept:

**The Threshold** — moving through a Camp Nou players' tunnel into the Barça Command Center.

Current implementation includes:

- Blender-built model;
- GLB;
- React Three Fiber;
- Drei;
- dynamic client-only loading;
- session gating;
- Skip;
- Escape;
- fail-safe timeout;
- reduced-motion fallback;
- compact/mobile fallback;
- dashboard made inert during intro;
- target alignment toward Match Stage;
- developer replay.

Current model:

```text
/models/camp-nou-tunnel-final.glb
```

Current session key:

```text
barca-entry-v4-seen
```

Current flight duration is approximately 4.5 seconds.

Visual direction:

- deep blue tunnel surfaces;
- grey floor into turf;
- stainless rails;
- broad access path;
- glazing;
- rectangular lights;
- partial bowl reveal;
- Barça identity without theme-park styling.

---

# 26. Future deep Camp Nou experience

This is a major later Club feature and should be done deeply, not as a basic spinning model.

Desired:

- full 3D Camp Nou;
- drag/rotate;
- orbit/zoom;
- exterior inspection;
- look inside;
- stands/sections;
- potentially internal navigation;
- historical/contextual hotspots;
- strong performance budget;
- progressive loading;
- desktop-rich with sensible fallback.

---

# 27. Analytics roadmap

Planned:

- team season stats;
- player season stats;
- advanced match analytics;
- league race;
- form trends;
- player comparison;
- competition splits;
- home/away splits;
- heatmaps when trustworthy;
- shot maps when trustworthy;
- passing/creation views;
- possession/territory visualizations when supported.

Rule:

> Never create a sophisticated visualization from data the project does not actually possess.

---

# 28. Heatmaps / spatial data

Desired, but current providers do not provide universal trustworthy tracking/event coordinates.

Do not fake heatmaps from formation positions.

Potential later sources:

- legitimate event-coordinate provider;
- suitable open historical event datasets;
- carefully derived visuals with explicit semantics.

---

# 29. Goal replay / path visualization

Future feature.

Desired:

- replay a goal as clip or 2D tactical path;
- event sequence;
- animated buildup;
- player/ball movement only when coordinates actually exist.

Formation coordinates are not tracking data and must not be reused as such.

---

# 30. AI match predictor

Planned.

Schema already includes:

- `ModelVersion`
- `Prediction`

Potential output:

- Barça win probability;
- draw probability;
- opponent win probability;
- score distribution;
- feature snapshot;
- model version;
- pre-kickoff lock;
- historical calibration.

This is analytical/fun, not betting-oriented.

---

# 31. Squad and player pages

Planned after current core route work.

Player page direction:

- portrait;
- position;
- nationality;
- age/basic profile;
- shirt;
- season minutes;
- goals;
- assists;
- shooting/passing/defensive stats;
- form;
- competition splits;
- match log;
- availability/injury when reliable;
- favourite/pin;
- player media.

Match Center click remains a match-specific modal. Full page is for broader player context.

---

# 32. Favourites

Schema includes `FavouritePlayer`.

Future behavior:

- pin favourite players;
- prioritize them in Squad/My Barça;
- use favourites in personal recap.

---

# 33. Core schema foundations

Current schema already includes foundations for:

- Season
- Competition
- Team
- Player
- Match
- Lineup
- LineupPlayer
- MatchEvent
- MatchStatistic
- PlayerMatchStatistic
- StandingSnapshot
- MediaItem
- KitTheme
- Trophy
- TrophyWin
- FavouritePlayer
- MatchDiaryEntry
- ModelVersion
- Prediction
- DataSource
- ProviderMapping
- SeasonMoment
- PlayerAbsence
- ManualOverride

---

# 34. Provenance and trust rules

Every future feature should obey:

1. UI reads canonical DB data where possible.
2. Provider-specific logic stays in provider layer.
3. Track source ownership.
4. Never guess ambiguous identity.
5. Preserve useful raw/provider metadata for debugging.
6. Do not overwrite strong primary data with weaker fallback data.
7. `null` means missing/unknown.
8. `0` means zero.
9. Minor discrepancy is different from blocking conflict.
10. Ambiguity should become reviewable admin state.
11. Syncs should be idempotent.
12. Repair scripts should be narrow and auditable.
13. QA should verify invariants after repair.
14. Secrets remain server-side.

---

# 35. Environment variables

Provider/database variables include or have included:

```text
DATABASE_URL
FOOTBALL_DATA_API_KEY
GOAL_API_KEY
BBS_API_KEY
STATSHAWK_API_KEY
STATSHAWK_BASE_URL
YOUTUBE_API_KEY
```

Rules:

- `.env` is not committed;
- secrets are never returned to client UI;
- secrets are never logged;
- provider errors should be sanitized.

---

# 36. Home-server direction

The project should eventually follow the user's existing GitHub → home-server auto-deploy pattern.

Desired production architecture:

- deploy from repository;
- persistent PostgreSQL;
- fixture sync;
- rich-data refresh;
- scheduled media worker;
- retries;
- health checks;
- backups;
- quota safety.

---

# 37. Automatic media worker target

Future production behavior:

```text
every ~2–3 hours
  ↓
find finished Barça matches that:
  - have no official highlight
  - are recent enough to still receive an upload
  - or are pending/retry
  ↓
query official uploads efficiently
  ↓
score candidates
  ↓
high confidence → persist
  ↓
ambiguous → review
```

Exact cadence should be tuned after testing.

Do not use the development endpoint as the normal production workflow.

---

# 38. Planned media review states

Recommended future states:

```text
pending
waiting_for_upload
auto_matched
needs_review
approved
rejected
complete
```

Do not rush a schema change until the season-wide backfill shows what real review cases look like.

---

# 39. Important UI rules captured from implementation

Keep these consistent:

- Barça events stand out more than opponent events.
- Use a proper football icon, not emoji.
- Use custom dropdowns/pickers where native controls break the design.
- Use real player portraits when trustworthy.
- Rating colors should communicate quality.
- Team-comparison bars never overlap numeric labels.
- Goals and assists stay separate.
- Match-specific player detail is a centered modal.
- My Match stays inside Match Center.
- Future-match diary is visible but locked.
- Highlights receive gold/accent emphasis.
- Themed scrolling is global.
- Use icon libraries/SVGs for controls.

---

# 40. Accessibility / interaction

Rules:

- Escape closes modals/intros where appropriate;
- backdrop click closes centered modal;
- reduced-motion fallback;
- controls remain keyboard accessible;
- loading/failure should fail gracefully;
- intro must never trap the user;
- desktop richness degrades safely on smaller screens.

---

# 41. Development safety

`/api/dev/*` routes are deliberately disabled in production.

Use dev routes for:

- provider testing;
- backfill;
- QA;
- repair;
- Data Lab experimentation.

Production jobs should later use authenticated/internal worker entry points rather than exposing dev tooling.

---

# 42. Known limitations

Current major limitations:

- `/matches` still placeholder;
- `/squad` still placeholder;
- `/analytics` still placeholder;
- `/club` still placeholder;
- global `/media` still placeholder;
- `/my-barca` still placeholder;
- `/settings` still placeholder;
- `/admin` not built;
- authentication/users not built;
- diary is single-user;
- automatic scheduled media sync not built;
- season-wide media backfill is the immediate next task;
- full card/substitution timeline depends on provider coverage;
- xG/xA not universal;
- heatmaps/spatial replay await trustworthy coordinates;
- deep Camp Nou explorer is future work.

---

# 43. Immediate roadmap

## Phase A — media automation

### A1. Season-wide Match Media backfill — NEXT

Requirements:

- load current season;
- finished Barça matches only;
- optional competition filtering;
- reuse trusted single-match matcher;
- dry-run/write modes;
- isolate errors per match;
- report accepted candidates;
- report created/updated/unchanged;
- skip already-covered matches when requested;
- no duplicate writes.

### A2. Incremental automatic media worker

Reuse/refactor the same core:

- recent finished matches;
- missing/pending media only;
- retry until upload found;
- stop checking once complete.

### A3. Home-server scheduler

- automatic execution;
- no manual match IDs;
- quota aware;
- logs;
- retry policy.

## Phase B — Admin

### B1. `/admin` shell

Separate layout/navigation.

### B2. Media Review

First real module.

### B3. Provider/Data health

Quotas, unresolved mappings, missing fields, QA and manual resync.

## Phase C — finish Match Center depth

Potential next work:

- richer trusted event timeline;
- opponent performance view;
- more media types;
- pre-match Match Center;
- live Match Center;
- half-time/full-time transitions;
- goal path when spatial data exists;
- link modal → player page.

## Phase D — real Matches route

Calendar, filters, results, history, watched/rated state.

## Phase E — Squad

Real squad and player profiles.

## Phase F — Analytics

League Race, charts, model/predictor, future spatial analytics.

## Phase G — My Barça

Global personal archive and end-of-season recap.

## Phase H — Club

Trophies, history and deep Camp Nou.

---

# 44. Longer-term ideas

Possible later:

- match reminders;
- “highlight available” notification;
- post-match diary prompt;
- additional verified official media sources;
- historical season browsing;
- historical kit themes;
- season comparison;
- player career arcs;
- private friend sharing;
- Barça-only multi-user accounts;
- eventually a multi-club platform only after Barça is mature.

---

# 45. Permissions direction

If accounts are introduced:

## Normal user

Can:

- browse;
- use My Match;
- build My Barça;
- save favourites;
- change own settings.

Cannot:

- edit canonical match data;
- change provider mappings;
- approve/reject global media;
- run destructive/global sync.

## Admin

Can:

- manage provider sync;
- review data/media;
- create manual overrides;
- manage users later;
- inspect diagnostics.

---

# 46. Product character

The project should feel like something a Barça supporter would genuinely keep open throughout a season.

The current strongest example is Match Center:

- tactical formation;
- real player portraits;
- deep stats;
- official embedded highlight;
- personal diary;
- themed UI.

Future sections should aim for that same depth rather than remain shallow placeholders.

---

# 47. Current milestone snapshot

As of 2026-10-03:

## Strong / functional

- database foundation;
- provider mappings;
- football-data fixture spine;
- GOAL rich data;
- Big Balls data;
- StatsHawk fallback;
- canonical player merge;
- rich-season backfill;
- QA/repair tooling;
- Overview shell;
- Match Stage;
- Barça Pulse;
- Season Story;
- kit themes;
- themed scrollbars;
- 3D Threshold intro;
- Match Center;
- formation/bench;
- Match Timeline;
- team comparison;
- player table;
- centered player-performance modal;
- previous/next navigation;
- My Match diary;
- official Match Media UI;
- official Barça YouTube single-match matcher;
- Racing and Sevilla highlight persistence.

## Immediate WIP

- season-wide media backfill;
- reusable automatic media worker.

## Planned next

- scheduled media ingestion;
- Admin shell;
- Media Review.

## Major future modules

- Matches;
- Squad;
- Analytics;
- League Race;
- My Barça;
- Club/Trophies;
- deep Camp Nou;
- predictor;
- goal replay/spatial analytics.

---

# 48. Spec update policy

Update this file when:

- a feature becomes implemented;
- a route changes status;
- provider ownership changes;
- a provider is approved/removed;
- a major design rule changes;
- schema changes materially;
- roadmap order changes;
- an idea is explicitly deferred/cancelled;
- multi-user/admin scope changes;
- deployment architecture changes.

Prefer editing the relevant canonical section rather than appending contradictory notes.

---

# 49. Changelog

## v0.1.0 — 2026-10-03

First consolidated canonical spec.

Includes:

- current repo audit;
- Stadium Control Room design;
- themes and scrollbar/icon rules;
- Overview and Season Story;
- 3D Threshold;
- data/provider backbone;
- canonical merge rules;
- Match Center;
- player modal;
- My Match;
- official Match Media;
- automatic YouTube matcher;
- verified Racing/Sevilla media;
- Admin direction;
- multi-user direction;
- deferred multi-club idea;
- deep Camp Nou roadmap;
- immediate season media automation roadmap.

# FC Barcelona Dashboard — Canonical Product & Engineering Spec

**Version:** 0.2.0  
**Status:** Living source of truth  
**Last updated:** 2026-10-05
**Audited branch:** `main`  
**Audited commit:** `b658f0da5055ec19aa3b41cc4b6d5fe09b7a55df`  
**Commit:** `finish squad page and official player data pipeline`  
**Post-audit confirmed local state:** official FC Barcelona portraits enabled for the full verified 27-player 2026/27 first-team squad; lint/build validation passed.  

---

## 1. Purpose

This file is the canonical living spec for the FC Barcelona Dashboard.

Update it whenever a meaningful product, design, data, architecture, deployment, provider, or roadmap decision changes. The goal is to keep one reliable source of truth instead of reconstructing the project from old chats.

The project is currently **one user + FC Barcelona first**. Barça-only multi-user support is a realistic later extension. A fully multi-club platform is a much larger future idea and is explicitly **not current scope**.

Current implementation workflow is deliberately page-by-page. Overview, Match Center, Admin, Matches/Calendar, Squad and Analytics are functional. **My Barça is now implemented as the single-user personal archive**; account-based privacy remains future scope.

The spec records both pushed repository state and explicitly confirmed/tested local changes when they are newer than the latest pushed commit.

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

Current repository stack:

- Next.js 16.3.5
- React 19.2.8
- TypeScript 5
- Tailwind CSS 4
- ESLint 9 + `eslint-config-next`
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

Current validation state as of 2026-10-04:

- `npm run lint` passes with **0 errors**;
- remaining lint output is non-blocking warnings in older UI files, mainly raw `<img>` optimization suggestions and one unused variable;
- generated Prisma contract typings and migration snapshots are intentionally ignored by ESLint rather than edited;
- `npm run build` passes successfully under Next.js 16.3.5;
- TypeScript compilation, page-data collection and static generation all complete successfully.

Development rule:

> Never edit generated Prisma contract/snapshot output merely to satisfy application lint rules. Exclude generated artifacts from linting and fix application code instead.

---

# 8. Repository structure

Important current areas:

```text
src/
  app/
    page.tsx
    matches/
      page.tsx
      [id]/
    squad/
      page.tsx
    analytics/
    club/
    media/
    my-barca/
    settings/
    admin/
      page.tsx
      providers/
      issues/
      sync/
      media/
        add/
        review/
    api/
      admin/
        sync/
        squad-audit/
        squad-metadata/
        squad-heatmaps/
        pitch-heatmap-probe/
        media/
      dev/

  components/
    admin/
    dashboard/
    intro/
    match/
    match-center/
    matches/
      MatchesOverview.tsx
      MatchesCalendarView.tsx
      CurrentMatchWindow.tsx
      CompetitionLogo.tsx
    season/
    shell/
    squad/
      SquadOverview.tsx
      PlayerQuickView.tsx
      CountryFlag.tsx
    theme/
    icons/

  lib/
    admin/
    dashboard/
    data-lab/
    matches/
      get-matches-overview.ts
      get-match-center.ts
      get-match-navigation.ts
      get-match-media.ts
    squad/
      get-squad-overview.ts
      official-squad.ts
      sync-official-squad.ts
      sync-squad-metadata.ts
      sync-captains.ts
      sync-player-heatmaps.ts
      player-heatmap.ts
      wikidata-player-metadata.ts
    providers/
      football-data/
      goal-api/
      big-balls/
      statshawk/
      pitch-api/
      sofascore-spatial/
      rich-match/
      youtube-fcbarcelona/
      shared/

  prisma/
    contract.prisma
    contract.d.ts   # generated
    db.ts

migrations/
  snapshots/        # generated historical contract snapshots

docs/
assets/
tools/
```

Canonical repository:

```text
https://github.com/marcchlela/barca-dashboard
```

Current source-of-truth branch is `main`.

Latest audited pushed milestone:

```text
b658f0da5055ec19aa3b41cc4b6d5fe09b7a55df
finish squad page and official player data pipeline
```

The spec may also record explicitly confirmed local changes made after that commit when the user has tested them successfully; those should be pushed at the next checkpoint.

Shared-shell direction remains:

- prefer a route-group layout such as `src/app/(dashboard)/layout.tsx` for persistent fan-facing shell state;
- the Stadium Rail, theme/season context and common dashboard chrome should ultimately be shared rather than duplicated;
- `/admin` remains deliberately separate from the fan-facing shell.

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

Desktop behavior rule:

- Stadium Rail should remain persistent/sticky while the main content scrolls;
- page content should not make the rail visually drift away with ordinary document scrolling.

## `/matches`

**Implemented / functional.**

Current features include:

- full season match list;
- finished/upcoming/status filtering;
- opponent/competition/venue search;
- dynamic competition filters generated from canonical season data;
- competition logos in filters and match rows;
- special contrast treatment for dark UCL artwork on dark backgrounds;
- themed match rows consistent with Home/Away/Third dashboard language;
- more breathing room from viewport edges than the first iteration;
- direct `Open Match` / Match Center navigation;
- automatic current-match window so the page focuses around the latest finished and next upcoming fixture instead of forcing a long manual scroll later in the season;
- FIFA Career Mode-inspired **Season Calendar** alternative view;
- calendar month navigation and current-date/current-period focus;
- match detail focus from calendar tiles.

Competition behavior:

- the page does not hard-code only La Liga/UCL;
- it renders competitions that exist in canonical season data;
- Copa del Rey, Spanish Super Cup and other Barça competitions should appear automatically once fixture ingestion contains them and their assets/mappings are available.

## `/squad`

**Implemented / functional and data-complete for the verified current 2026/27 first-team roster.**

Current features include:

- position-grouped squad browser;
- official FC Barcelona portraits for the full verified first-team squad;
- smooth player-card hover behavior;
- pointer cursor on interactive cards/controls;
- favourite-player persistence/filtering;
- captain treatment;
- centered player quick-view profile;
- previous/next player arrows;
- season stats and advanced per-player context;
- recent form;
- rating history graph;
- real match-derived heatmaps;
- per-match and aggregate heatmap modes;
- nationality flags, age/DOB, preferred foot and availability/profile metadata.

The verified 2026/27 first-team roster currently contains **27 players** and **5 captains**.

## `/analytics`

**Performance Lab implemented, live database-verified, and responsive browser-checked.** The page is a current-season editorial readout with a 20-club League Race, form/goals and observed team-stat trends, competition and venue splits, player leaders/comparison, and side-by-side stored heatmaps. It reads canonical data only and reports contributing-match coverage. Missing values remain gaps; the predictor remains future scope.

2026-10-04 refinement: Analytics now uses squared Stadium Control Room surfaces, icon-led sticky section navigation, a current-season competition filter (All / La Liga / Champions League / Copa del Rey / Spanish Super Cup when fixtures are stored), 20 stored crests and stable club colors in League Race, inspected-round crest markers, in-row qualification/relegation bands, themed round controls, chart axes and keyboard inspection, competition/venue marks, portrait-led mutually exclusive player pickers, and shared Squad-style continuous heatmaps. The display-only lateral heatmap axis is inverted in both Analytics and Squad after checking known flank players; raw `acting_ltr` cells are unchanged. The competition filter applies to Barça trends, splits, player totals/rates, and heatmaps. The All view retains La Liga's League Race. Per-90 values require observed minutes.

2026-10-05 polish: every League Race rank has a dashed guide; the crest marker now follows its club's path at the inspected matchday instead of occupying a misleading fixed left axis. Standings keep only edge-color bands in rows and explain title, Champions League, provisional Europa/Conference League, and relegation below the table. European bands are illustrative because cup winners and UEFA allocations may shift places. Momentum and observed charts show five-match windows with arrow, swipe, and keyboard inspection, explicit zero baselines, integer points/goals ticks, and percent-scale possession/pass-accuracy values. Leader totals omit compact coverage suffixes; comparison includes appearances. Analytics now renders the same continuous canvas heatmap as Squad, retaining display-only Y inversion and stored cells unchanged.

Further Analytics polish: Season Pulse omits provider fixture counts; League Race crest markers have more vertical room at the mobile minimum width. Zone dots are explicitly sized, with gold title, blue Champions League, orange Europa League, green Conference League and red relegation bands. Trend cards preserve exact match values while overlaying a three-match rolling average only across fully observed windows. Touch swipe and horizontal two-finger trackpad scroll advance the five-game window. Player comparison highlights only a strictly higher observed value; ties and missing values remain neutral.

The additive `CompetitionFixtureSnapshot` migration stores full-competition fixtures separately from the canonical Barça match spine. The page reads stored rows only. Admin Sync Control deliberately previews or writes Champions League via football-data.org (full fixture list and official 36-team current table) and Copa/Super Cup via GOAL API (per-row season filtering of its mixed-season fixture feed). Writes use provider IDs idempotently and only promote Barça fixtures into canonical matches when both team identities are unambiguous. Overview's standing lookup is explicitly scoped to La Liga. Bracket paths are drawn only when a stored finished tie identifies a winner and the next fixture confirms the participant; two-legged ties require both legs and penalties are respected. The desktop bracket is scroll-contained; mobile focuses one stage at a time. Club World Cup remains absent until a relevant current-season edition has verified fixtures.

Live validation on 2026-10-04: CL preview found 144 fixtures and a 36-club table; Copa preview filtered 20 current fixtures from 613 mixed-season rows; Super Cup preview found two current fixtures. Initial writes stored these rows, and repeat writes changed zero fixtures and zero CL standings rows. Eight complete La Liga rounds, 27 players and 27 stored heatmaps remain available. Overview retained Barça's La Liga matchday-8 standing (first, 21 points, +24). Headless desktop/mobile checks covered all three kits and all three competition-specific views with no page-level horizontal overflow. Browser interaction checks verified crest selection, keyboard round inspection, mutually exclusive player pickers, and Gordon/Adeyemi heatmap orientation. A hydration warning from an SVG title and tiny SVG opacity rounding differences was fixed and the subsequent browser log was clean.

Admin Sync Control now has bounded preview/write actions for missing historical La Liga rounds (up to eight per run). Each provider response is checked for season, competition, 20 canonical teams, unique positions, and result arithmetic before writing. Filtered historical tables are labelled `results_compiled` and can omit point deductions; unfiltered current standings are labelled `official_current`. The additive standings-provenance migration was applied on 2026-10-04. Provider preview validated rounds 1–7 at 20 teams each; first write stored all seven, and repeat write made no changes. The development-only `/api/dev/qa/analytics` reported eight complete 20-team rounds, eight finished Barça matches with team/player-stat coverage, 27 current players, and 27 stored heatmaps. Overview and Analytics agreed on Barça at matchday 8: first place, 21 points, +24 goal difference.

## `/club`

**Current Club rebuild (2026-10-07):** The former single-page Stage 1–2 cabinet/identity presentation described below has been superseded. `/club` is now a cinematic architectural foyer with three clear doors. `/club/trophies` is a native-scroll, reversible five-stop Blender-authored museum walk (UCL, La Liga, Copa del Rey, Spanish Super Cup, historical Club World Cup), followed by an archive wall covering every other named honour. The architecture is one locally exported GLB with five Blender-rendered stills for no-WebGL, low-power, and reduced-motion use. Trophy meshes load separately near their stops. A case dialog lists stored winning-year labels and links only unambiguous canonical seasons; it does not guess the 1937 Mediterranean League into a season. The walk has direct stop buttons and previous/next controls; closing a dialog returns to the same scroll position. La Liga, Super Cup and historical CWC are honestly labelled image/interpretive cases pending a verified, downloadable and adequately accurate mesh; view-only source models open externally. The supplied 2025 CWC trophy is **not** used to represent Barça's 2009/2011/2015 wins.

`/club/seasons` is the redesigned searchable 128-season index; sourced eras supply context while decades serve navigation only. `/club/seasons/[slug]` is an editorial, title-and-moment exhibit with adjacent-season links and a collapsed provenance section. `/club/identity` presents four keyboard-accessible, horizontally scrollable-on-mobile tabs with one visual chapter visible at a time: the real crest, text-free blaugrana stripes, the supplied newer La Masia photo, and the credited Més que un club seats photograph with the explicit English translation. All routes preserve the canonical history data and read stored curation only; no provider is contacted on render. The private supplied UCL mesh and prepared copy are gitignored; a shareable build falls back to the pre-existing CC0 model. See `assets/source/club-asset-register.md` for the distinctions and `tools/blender/build_club_museum.py` / `prepare_museum_trophy.py` for Blender sources. The deep two-version Camp Nou explorer remains the next distinct Club project.

Current verification: `tools/qa-club-history.mjs` found 128 indexed/stored seasons, 150 stored curated moments, and unchanged current-season ID/match spine; TypeScript and production build passed. `tools/qa-club-rebuild-browser.mjs` checked desktop/mobile routes, five stops, case dialog, no horizontal overflow, three kit accents, and Overview loading without browser exceptions. Local model proof renders caught and corrected the supplied Copa OBJ's sideways axis before display. The older browser QA script below targeted the retired single-page UI and is retained only as historical evidence.

**Stages 1–2 implemented / awaiting museum review.** The Club museum has a men’s first-team history spine spanning every season from 1899/00 through 2026/27 (128 selectable seasons). The landing page uses the shared kit themes and a searchable, keyboard-accessible decade rail; it does not present the decades as historical chapters or duplicate them with an era carousel. Each season links to a shareable `/club/seasons/[slug]` page. Season cards show a title count or “Open season,” while the season page lists titles and selected moments without inventing match facts. A past season with no recorded titles says so plainly; the current season is labelled in progress. Existing stored competition logos identify mapped titles without surrounding boxes; a labelled archive marker stands in when no verified logo is stored or its image cannot load. On-page prose is original/paraphrased, and the assets used in the cabinet and identity chapter are itemised below.

`src/lib/club/history.ts` is the checked-in sourced curation and `tools/seed-club-history.mjs` is the deliberate additive importer (`node --experimental-strip-types tools/seed-club-history.mjs --preview`, then omit `--preview` to write). It creates missing canonical `Season` records and sourced `SeasonMoment` trophy/history records, never updates existing seasons, and asserts that the canonical current-season ID is unchanged. First local import created 127 seasons and 150 moments; a repeat created zero of each. Published honour labels are retained, including `1901-1902`. The year-only Mediterranean League `1937` is not assigned to an arbitrary season. The current match/analytics/My Barça loaders continue to use current-season flags and/or seasons with actual matches, not the museum’s historical rows. Club pages make no provider requests.

The season pages read the stored `SeasonMoment` metadata and source URLs, not a provider response. La Liga is the display label for the source's Spanish League Championship category; original published labels remain in storage. The repeated source links and provenance explanation are consolidated into a collapsed “Sources & archive notes” section on the museum and season pages, so the archive remains shareable without making each title or moment a citation row.

The Stage 2 cabinet covers every category and winning label in the checked-in official men’s honours curation, grouped into Europe/world, Spain and Catalonia. A selected category shows all winning years and links only those with a clear season mapping. The 1937 Mediterranean League label remains year-only. The earlier abstract trophy sculptures were replaced: Champions League opens with a credited photo of the real trophy in Barça's museum and uses a locally prepared CC0 fan-made mesh for rotation; La Liga and Copa del Rey use recognisable public Sketchfab models embedded on demand with local preview images. A project-owner-supplied Barça UCL celebration photograph spans the three featured trophy selectors. The latter 3D viewers need internet; if unavailable, the local previews and source links remain visible. No model files were copied from Sketchfab. Other categories retain an illustrated treatment. Asset provenance, rights, creator links, and the Blender preparation script are recorded in `assets/source/club-asset-register.md` and `tools/blender/prepare_club_model.py`. None of these models are official digital twins. The identity chapter now shows the existing Barça crest, a visible blaugrana stripe treatment, a project-owner-supplied photograph of the newer La Masia building, a credited photograph of Camp Nou's “Més que un club” seats, and the explicit English translation “More than a club.” The source and reuse rights for the two supplied photographs should be confirmed before public distribution. Its explanatory text paraphrases official Barça sources.

`node --experimental-strip-types tools/qa-club-history.mjs` audits continuous coverage, unique sourced records, the unmapped year-only honour and the live match spine. `tools/qa-club-browser.mjs` checks decade selection by pointer/keyboard, mobile page width, cabinet years and on-demand 3D, identity tabs, untitled-season copy, title marks, adjacent-season navigation and three kit backgrounds against a local browser debugging endpoint.

Review gate: get feedback on the revised trophy models, category hierarchy, and identity chapter before Stage 3. Stage 3 is the guided two-version Camp Nou explorer. Women’s football is a separate Stage 4 after the men’s archive is approved.

## `/media`

**Screening-room first release implemented.** The fan-facing route reads stored `MediaItem` records only. It presents a curated/recent featured film, current-season matchday timeline, exact-goal shelf, non-match film shelf, historical archive, searchable/filterable library, and a personal favourite/watch-later shelf. Filters cover season, competition, type and text (including opponent). Video playback uses a click-to-load YouTube embed where applicable; other official films open at their publisher. No provider call runs during page rendering.

Five official historical links seed idempotently via `node tools/seed-media-history.mjs`: Berlin 2015 final highlights/full match and 2017 PSG comeback highlights/full match plus the official Sergi Roberto goal film. These are curated season-linked archive entries, not invented canonical historical match rows. Rights-holder access and premium availability can change. No media files are copied or rehosted.

`MediaSave` persists current single-user favourite/watch-later choices. `MediaMoment` links a canonical `MatchEvent` goal to an exact film, with optional clip seconds, evidence URL, note and review time. `/admin/media/curation` selects one featured film and manually verifies goal moments; a longer highlight requires bounded start/end seconds. It accepts sourced third-party films as well as official uploads. Match Center exposes a “See the goals” dialog only when verified links exist. The schema migration is `20261007T1318_media_library_and_goal_moments`; `node tools/qa-media-foundation.mjs` audits counts and link integrity. The local database now has **51 film records: 49 official and two sourced AS/LaLiga single-goal video pages**. Thirty-two are current-season match-linked and 19 historical; there are still no frame-verified current-season `MediaMoment` links. The AS pages identify Fermín's Valencia 0–2 and Cancelo's Racing 1–0, but automated playback yielded no frames, so their provisional event links were removed pending human confirmation. Four YouTube Shorts were removed after playback showed celebrations instead of the goal action; they must not be re-imported as goal clips. The [media source register](assets/source/media-source-register.md) records source, playback status, and free/API provider options. A match highlight or goal-labelled title alone never proves a particular goal clip.

Valencia and Levante's missing goal rows were restored idempotently from LaLiga's published match reports with `node tools/repair-media-goal-coverage.mjs --write`, taking the eight finished games to **44 scoring events**, the scoreline total. The same repair corrected Villalibre's Racing event to an own goal without replacing its ID. A repeat preview reports zero new rows. The existing GOAL API video key was tested for five relevant September 2026 dates and returned no video rows. Highlightly is the next free-key candidate to trial for this exact fixture set; its free-plan coverage is not yet confirmed.

The matchday timeline has its own bounded vertical scroll, with stored competition/team marks and centered date plates. Each row shows two film actions and a jump to the complete selected-fixture collection when more are stored. Around the Match now includes **all** its stored previews, training, highlights, reactions and features, in bounded pages; future actual goal films will appear there only after verification. The archive is grouped into selectable Rome 2009, Wembley 2011, Berlin 2015 and La Remontada chapters. The competition filter uses the existing crest-bearing themed menu. Film cards omit the redundant playback-source banner and use quieter scrollbars/compact actions.

The existing official Barça YouTube key and channel worker were tested deliberately: a forced dry run inspected 180 uploads in ten requests and proposed no missing automatic highlights; a forced write queued one Valencia preview and left the ten existing safe matches unchanged. Metadata/fixture review initially added 16 current-season official videos through Admin Media, followed by a separately found Elche preview. Four Shorts from that batch were removed after playback showed only celebrations, leaving 13 retained films from that manual expansion. Reimporting a preview was idempotent and cleared its pending review state. A separate `tools/seed-media-youtube-history.mjs` preview/write imported 14 official, public, embeddable YouTube videos into their verified historical season IDs; its repeat write created zero. The previously curated five Barça Play archive films and five Barça Play press-room/reaction clips remain. My Barça/Match Center still require video-level `MediaMoment` verification. The provenance, rejected Shorts, and new non-YouTube goal-footage leads are in `assets/source/media-source-register.md`. No provider fetch occurs on the fan page, and no new API key is needed for the existing films. Future multi-user recommendations and per-account saves need the postponed account/auth milestone.

## `/my-barca`

**Implemented / personal archive.** The current-season view defaults to 2026/27, with a themed season selector for seasons with canonical finished Barça matches. Season Pulse shows watched matches, rated matches and average personal rating with its denominator. Its ten-bin half-star ratings histogram is informational, not a filter. The diary shows only saved personal entries, with themed competition, watch-type and exact half-star rating controls; there is no "not logged" watch filter. Competition choices show stored competition logos, and the rating control opens five outlined stars with half-star selection. Each filter menu is exactly as wide as its trigger. The diary uses slim match-day rows grouped into collapsible months (newest month open), with both stored club crests, Barça-first score, watch context, rating and a note-present icon; each row links to My Match. A season-scoped top-three collection stores manually chosen finished Barça matches in ranked portrait poster slots; empty cards open a centered visual crest/score/date picker. Picks can be replaced or removed, and one match cannot fill multiple slots. Squad favourites, joint top Man of the Match picks, favourite-goal cards and an editorial season-so-far story complete the page. The automatic standout match is the highest-rated match, breaking equal ratings by latest kickoff; this rule is stated on the card. No AI text or missing values are invented.

Top-three choices use the `FavouriteMatch` table and `/api/favourites/match` write route. The route validates season, slot, Barça identity and finished status before writing. Migration `20261005T1327_favourite_matches` has been applied to the local database. This is single-user data until accounts are introduced.

My Match now persists `watchedAt`: live viewing uses canonical kickoff (and displays as game day); replay/highlights default to today when first selected and offer an editable date. Existing live entries with no stored `watchedAt` derive from kickoff in the archive. Existing replay/highlights entries with no date remain unknown until edited. Unmarking watched clears the date. No schema migration was required.

Goal-clip checkpoint: the Media release adds `MediaMoment` for reviewed exact `MatchEvent`–video links. The current local database still has zero such links, so My Barça never labels a general match highlight as a goal clip. Historical standalone Sergi Roberto footage is archive-linked by season only. Exact current-season goals must be reviewed through Admin Media Curation before Match Center offers them. Accounts and multi-user separation remain deferred.

The proposed top-three explanation captions and per-month watched-count/average-rating summaries were declined; do not treat them as planned My Barça work.

## `/settings`

**Placeholder.**

Planned:

- themes;
- season preferences;
- dashboard behavior;
- personal settings;
- selected diagnostics where appropriate.

## `/admin`

**Implemented / functional private control room.**

Current areas include:

- Overview;
- Media manager;
- Media add flow;
- Media review queue;
- Providers;
- Data Issues;
- Sync Control.

Admin remains separate from the fan-facing Stadium Rail.

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

Core rule:

> Providers supply evidence. The canonical database and explicit ownership rules decide product truth.

## football-data.org

Primary role:

- fixture spine;
- results;
- standings;
- competition/team identity;
- base squad metadata fallback where useful.

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
- team statistics;
- many player portraits used historically before the official-portrait switch.

Important ownership change:

- match lineups **do not own `SquadMembership`**;
- a youth/reserve player appearing in one first-team match must not become a permanent first-team squad member because of a lineup sync.

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
- squad metadata evidence;
- fill missing Big Balls fields;
- strong fallback when Big Balls does not cover a match.

Canonical rule:

- Big Balls stays primary when present;
- StatsHawk fills only missing/null primary fields;
- zero is preserved.

## PitchAPI spatial

Current production spatial source for player heatmaps.

Used for:

- per-match player heatmaps;
- stored spatial samples;
- season-average player heatmaps;
- competition-average heatmaps;
- activity-centre/centroid calculation.

Current verified heatmap run:

- all 8 targeted finished Barça matches resolved after the Santander alias fix;
- zero unresolved players in the successful runs;
- data is persisted and reused rather than fabricated client-side.

## SofaScore spatial

Experimental/probe-only.

A server-side attempt returned HTTP `403 Forbidden`, so SofaScore is **not** the current production heatmap source. Keep the adapter/research path only if useful; do not rely on it for core functionality.

## Wikidata

Current role:

- safe metadata fallback where exact identity/DOB evidence permits it;
- nationality/footedness research/fallback.

Coverage is incomplete and must never be treated as universal.

## Official FC Barcelona website

Current authoritative season-roster/profile layer for selected first-team metadata:

- verified 2026/27 first-team roster manifest;
- official player identity/display naming;
- official first-team portrait URLs;
- season squad-number verification where curated.

Current portrait policy:

> Official Barça portraits are preferred for the full verified first-team squad and should not be downgraded by later provider portrait syncs.

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
- existing provider mapping when available;
- conservative explicit team aliases where provider naming differs.

Example fixed edge case:

- `Santander` / `Racing Santander` / `Real Racing Club de Santander` are deliberately normalized to one safe club identity for spatial matching.

Avoid broad fuzzy club matching that could merge genuinely different teams.

## Player identity

Resolution priority:

1. existing provider mapping;
2. exact normalized full name within the relevant team/squad;
3. verified DOB/position or similarly strong constrained evidence;
4. constrained safe alias/token evidence;
5. unresolved instead of guessed.

Mojibake repair is part of normalization and must handle repeated/double encoding where needed.

## Official squad ownership

`SquadMembership` is owned by the verified seasonal first-team roster, not by individual match lineups.

Current files:

```text
src/lib/squad/official-squad.ts
src/lib/squad/sync-official-squad.ts
```

Current 2026/27 rules:

- official manifest expects 27 players;
- missing canonical players may be safely created when the verified manifest supplies identity, DOB, nationality, position, shirt number and preferred foot;
- official roster sync can reactivate/create current memberships;
- stale first-team memberships are closed only when the full manifest resolves safely;
- lineups remain match history and do not permanently promote a player to the first team.

This fixed the earlier incorrect state in which one-off lineup participants polluted the current first-team squad.

## Captain ownership

Current verified 2026/27 captain group contains 5 players:

- Raphinha;
- Pedri;
- Eric García;
- Frenkie de Jong;
- Lamine Yamal.

The UI should present captain status as a compact armband-style `C Captain` treatment, not a generic “captain group” label.

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

# 17. Current rich-match / current-season coverage

Current canonical match-data foundation includes:

- football-data fixture spine;
- GOAL rich match/team data where available;
- Big Balls player data where available;
- StatsHawk fallback/enrichment;
- official YouTube match media;
- PitchAPI player spatial data for stored heatmaps.

Earlier verified rich-data coverage included:

- 7 finished La Liga matches processed successfully;
- canonical player stats ready for the tested matches;
- blocking canonical conflicts reduced to zero;
- 5 full-rich matches;
- 2 partial Big Balls/fallback matches;
- StatsHawk filling many missing fields;
- a Champions League match against Feyenoord successfully persisted with GOAL + StatsHawk fallback.

Current spatial milestone is newer:

- 8 finished Barça matches targeted for heatmap ingestion;
- all 8 now resolve after the Santander team-alias fix;
- player heatmaps are stored for canonical appearances;
- no unresolved player identities in the successful batch.

Do not interpret spatial coverage as proof that every provider/stat field is universal. Coverage remains provider- and match-dependent.

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

Implemented global personal archive. Current aggregate features:

- all watched matches;
- personal ratings;
- season-scoped top-three favourite matches;
- average match rating;
- most-selected Man of the Match;
- favourite goals;
- notes;
- favourite players;
- season memories;
- watch history by match date and recorded watched date;
- editorial season-so-far story.

Watch streaks and the separate cinematic end-of-season recap remain later work; they must be based on enough recorded history rather than inferred viewing dates.

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

Manual per-match media sync is **not** the intended production workflow.

The project now has more than a target design: core automation pieces are implemented.

Current components include:

- trusted single-match matcher;
- season/backfill helper;
- automatic worker;
- review-queue synchronization;
- development worker endpoint;
- internal job endpoint;
- Admin Sync controls.

Current intended flow:

```text
match finishes
  ↓
automatic worker evaluates eligibility
  ↓
query official Barça uploads efficiently
  ↓
score/classify candidates
  ↓
high confidence → persist canonical media
  ↓
ambiguous candidate → Media Review queue
  ↓
no upload yet → remain retry-eligible
  ↓
Match Center updates once canonical media exists
```

Current worker direction:

- inspect finished Barça matches;
- prefer recent/missing-media eligibility rather than rescanning everything forever;
- support force-all-finished/backfill modes for deliberate admin/dev use;
- remain idempotent;
- preserve human-reviewed queue decisions;
- never automatically put an approved/rejected candidate back into `pending` merely because scorer evidence refreshes.

Remaining production gap:

- schedule the internal job reliably on the home server;
- add operational logging/retry visibility;
- keep YouTube/API usage quota-aware.

The development endpoint is not the desired production scheduler.

---

# 23. Admin Control Room

Dedicated private area:

```text
/admin
```

It is **implemented** and remains separate from fan-facing navigation.

Current sections:

- Overview;
- Media;
- Media Add;
- Media Review;
- Providers;
- Data Issues;
- Sync Control.

Future sections may include Players and Users when needed.

## Admin Overview

Implemented control-room summary of current canonical/database state.

The admin visual language should match the product while remaining more diagnostic and operational than the fan-facing pages.

## Admin Media

Implemented tooling includes:

- media manager;
- manual add flow;
- review queue;
- candidate inspection/approval workflows;
- match/media association controls.

The underlying automatic matcher remains responsible for safe auto-persistence when confidence is high.

## Providers

Implemented provider-health/architecture page.

Current design requirements:

- provider logo next to each provider for faster visual scanning;
- live status;
- capability/role summary;
- coverage/counts;
- configured/registered state;
- last activity;
- priority/ownership context;
- quota/health information where available;
- direct link to Media Manager for the media provider.

Provider logos are stored under the app's provider assets and must remain readable on dark surfaces.

## Data Issues

Implemented issue browser.

Current interaction requirements:

- filter controls;
- severity controls;
- clear high/medium/low visual language;
- open/current issue browsing;
- `cursor-pointer` on interactive controls and rows/actions;
- preserve the compact control-room layout rather than generic admin-table styling.

## Sync Control

Implemented and manually tested.

Current supported actions include:

- fixture sync;
- incremental official Barça YouTube media worker;
- per-match rich-data preview/write;
- per-match media preview/write;
- selected canonical sync operations.

Write actions use confirmation/preview patterns where appropriate.

## Squad admin/debug endpoints

Current development/admin endpoints include:

```text
/api/admin/squad-audit
/api/admin/squad-metadata
/api/admin/squad-heatmaps
/api/admin/pitch-heatmap-probe
```

The squad audit became the final source for checking missing DOB, nationality, preferred foot, portrait, position and captain counts.

Current verified squad audit target is fully green:

- 27 current players;
- 5 captains;
- 0 missing birth dates;
- 0 missing nationalities;
- 0 missing preferred feet;
- 0 missing portraits;
- 0 unknown positions.

## Security direction

Admin write/debug endpoints remain development/private until proper admin authentication exists.

Existing `ManualOverride` foundations remain useful for future correction workflows.

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

**This is the next main fan-facing page to build.**

Development process rule from the current page-by-page workflow:

> Finish each major page deeply before moving to the next. Current completed sequence is Overview → Matches/Calendar → Squad → Analytics next.

Desired Analytics identity:

- still Stadium Control Room, not a generic chart dashboard;
- editorial/broadcast composition;
- kit-theme aware;
- use real canonical data only;
- charts/visuals should answer football questions, not exist as decoration.

Planned first-class analytics areas:

- team season stats;
- form trends;
- competition splits;
- home/away splits;
- player season stats;
- player comparisons;
- League Race;
- attacking/defensive profile;
- match-to-match trend lines;
- rating trends;
- passing/creation views where supported;
- possession/territory views where supported;
- heatmaps using the now-working spatial pipeline;
- shot maps only when trustworthy shot coordinates exist;
- standings/title-race context;
- future model/predictor.

Specific requested signature visual:

## League Race

- all 20 La Liga teams;
- horizontal/line-style position evolution across rounds;
- Barça strongly emphasized;
- interactive round inspection;
- title/top-four/relegation context;
- readable team identity without turning into a spaghetti chart.

Potential Analytics page structure to explore next:

1. Season pulse / KPI strip;
2. form + results trend;
3. League Race;
4. team attacking/defensive profile;
5. player leaders;
6. player comparison lab;
7. competition split tabs;
8. spatial section using real heatmap data;
9. predictor later, clearly separated as a model rather than observed truth.

Rule:

> Never create a sophisticated visualization from data the project does not actually possess.

If a requested metric such as xG, shot coordinates, passing network coordinates or territory data is unavailable, the UI should say so or omit the visualization rather than inventing it.

---

# 28. Heatmaps / spatial data

**Implemented for player heatmaps using real provider spatial data.**

Current production source:

```text
PitchAPI spatial
```

Current pipeline:

1. resolve canonical Barça match;
2. resolve provider match identity conservatively;
3. fetch provider player heatmaps;
4. map provider players to canonical match appearances;
5. persist match heatmaps;
6. reuse stored data in player profiles;
7. derive aggregate season/competition heatmaps from real stored match heatmaps.

Current verified state:

- 8 finished matches targeted;
- all 8 resolved after adding the Santander/Racing alias handling;
- no unresolved players in the successful batch;
- sync is idempotent and can distinguish written vs existing samples.

## Player Quick View heatmap modes

Current requested/implemented modes:

- **Season Avg**;
- **La Liga Avg** when matches exist;
- **UCL Avg** when matches exist;
- individual match heatmaps in a horizontally scrollable match selector.

Per-match selector should include:

- opponent crest/logo;
- competition logo;
- fixture context;
- only real matches with stored heatmap data.

## Rendering

The first discrete/blocky renders were rejected visually.

Current target is a TV/broadcast-style **continuous density field**:

- smooth connected gradients;
- multiple intensity bands rather than only “hot” vs “cold”;
- readable over a football pitch;
- restrained enough not to overpower line markings;
- direction normalized so Barça attack reads consistently left → right;
- `Activity Center`/centroid marker represents the weighted centre of the displayed heatmap, not a guessed nominal formation position.

Do not over-penalize lower-density areas; the visualization should preserve intermediate intensity rather than collapsing most of the pitch to one cold color.

## Aggregate semantics

Season/competition averages are derived from stored per-match heatmaps.

They are not an average of formation positions and are not fabricated tracking.

Recent-form match cards and heatmap match choices should only represent matches where that player actually has appearance/data context.

## SofaScore note

A SofaScore spatial experiment returned `403 Forbidden` and is not used for production heatmaps.

## Future spatial work

Potential later additions:

- team-average heatmaps;
- role/zone comparisons;
- shot maps if real coordinates become available;
- passing/creation maps if real event coordinates become available;
- goal-path replay when sequence coordinates are trustworthy.

Formation UI coordinates must never be reused as tracking data.

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

# 31. Squad and player profiles

**Implemented / current major milestone complete.**

## Verified first-team roster

The 2026/27 squad is maintained through an explicit verified roster manifest.

Current verified state:

- **27 current first-team players**;
- **5 captains**;
- stale one-off lineup memberships removed from current-squad state;
- Brian Fariñas is intentionally included as a current first-team player;
- Frenkie de Jong, Roony Bardghji and Jesse Bisiwu were restored correctly after fixing canonical membership ownership.

`SquadMembership` must represent verified season membership, not “appeared in one match”.

## Official portraits

Current product decision:

> Use official FC Barcelona player portraits as the preferred portrait source for the entire verified first-team squad.

Reasons:

- consistent framing;
- consistent kit/pose treatment;
- higher perceived quality;
- visually coherent cards and profile popup.

Provider portraits remain fallback evidence only. Later metadata sync must not downgrade an already stored official Barça portrait.

Current audit target: 0 missing portraits.

## Squad browser

Current features:

- grouped by position;
- polished player cards;
- smooth portrait hover transitions rather than sudden image jumps;
- pointer cursor for clickable cards/actions;
- favourite toggle/filter;
- captain marker;
- preferred foot;
- nationality/flag;
- availability/profile context;
- theme-aware presentation.

## Player Quick View

The chosen final concept is **Profile**.

Rejected direction:

- do not keep a permanent Broadcast/Profile/Hero design toggle in the product;
- the experiments were useful for choosing the final structure, not intended as a feature.

Final popup requirements:

- centered modal;
- **not fullscreen**;
- visible breathing room around it;
- rich enough to act as the current player-profile experience;
- internal modal scrolling when needed;
- background document/body must not scroll while modal is open;
- sticky left identity panel;
- right-side content scrolls;
- previous/next player arrows;
- close control;
- keyboard-safe interaction.

### Sticky left identity panel

Keep:

- position;
- large official portrait;
- shirt number integrated without awkward overlap;
- name;
- nationality with real flag;
- availability;
- captain state when applicable.

Nationality presentation should be visually compact and consistent, e.g. flag + country name.

Age format:

```text
29 (DD/MM/YYYY)
```

### Right-side profile content

Current/desired order:

1. profile/basic information and stat boxes;
2. season performance data;
3. recent form;
4. rating-over-time graph;
5. heatmap/spatial section.

Avoid duplicate availability information on both sides of the modal.

### Recent form

- only matches in which the player actually played/has appearance data;
- display roughly five useful recent matches when space permits;
- horizontal carousel is acceptable when required;
- opponent/competition context should remain visual.

### Rating history

Implemented graph using canonical rating history.

### Heatmap

Implemented with real stored PitchAPI heatmaps.

See section 28 for rendering and aggregate behavior.

## Captain treatment

Use an armband-style icon with `C Captain` semantics rather than plain text such as “Captain Group”.

## Favourite players

`FavouritePlayer` is active in the Squad UI:

- add/remove favourite;
- favourites filter;
- favourites now feed My Barça; richer end-of-season recap use remains future work.

## Final metadata audit

Current green target achieved:

- missing DOB: 0;
- missing nationality: 0;
- missing preferred foot: 0;
- missing portrait: 0;
- unknown position: 0;
- captains: 5.

The full dedicated `/players/[id]` route is no longer required immediately because Quick View is now intentionally rich. A future dedicated career/history page can still be added if the profile scope grows beyond what belongs in the centered modal.

---

# 32. Favourites

Schema includes `FavouritePlayer` and the Squad UI now actively uses it.

Current behavior:

- toggle favourite from player UI;
- persist through `/api/favourites/player`;
- filter Squad to favourites;
- preserve favourite state inside player Quick View.

Future behavior:

- prioritize favourite players in My Barça (implemented);
- surface favourite-player season summaries;
- use favourites in end-of-season personal recap;
- optional favourite-player notifications later if notifications are introduced.

---

# 33. Core schema foundations

Current schema includes foundations for:

- Season
- Competition
- Team
- Player
- SquadMembership
- Lineup
- LineupPlayer
- Match
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

Additional product-level data now built around these foundations includes:

- verified official first-team roster manifest;
- captain reconciliation;
- squad metadata audit;
- stored player heatmap/spatial provider mappings;
- competition-average and season-average heatmap derivation.

Schema/model ownership rule:

> Do not create a new permanent relation from temporary provider evidence when an authoritative season-level concept already exists. The lineup → squad-membership bug is the canonical example.

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
15. Official season roster owns `SquadMembership`; match lineups do not.
16. Official Barça portraits outrank provider portraits for current first-team profile display.
17. Spatial visualizations must be based on actual spatial samples/events, never formation coordinates.
18. Explicit alias tables are preferred to unsafe broad fuzzy matching for clubs/identities.
19. A failed/blocked external source does not justify scraping/fabricating equivalent data; use another legitimate source or show missing data.
20. A sync that cannot safely resolve the complete authoritative roster must avoid destructive membership closure.

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
PITCH_API_KEY
YOUTUBE_API_KEY
```

Rules:

- `.env` is not committed;
- secrets are never returned to client UI;
- secrets are never logged;
- provider errors should be sanitized;
- keys stay server-side;
- client components consume canonical/API output rather than provider credentials;
- adding a new provider key must not make the entire app fail when that provider is optional.

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

# 37. Automatic media worker

**Core worker logic is implemented. Production scheduling remains to be finalized.**

Current code includes:

```text
src/lib/providers/youtube-fcbarcelona/automatic-worker.ts
src/lib/providers/youtube-fcbarcelona/backfill.ts
src/app/api/dev/run-match-media-worker/route.ts
src/app/api/internal/jobs/match-media/route.ts
```

Current behavior direction:

```text
finished Barça matches
  ↓
eligibility decision
  ↓
recent / missing-media / retry candidates
  ↓
batched official-YouTube matching
  ↓
auto-persist safe result
  ↓
review ambiguous candidate
```

Admin/dev modes can deliberately force broader finished-match scans or backfill behavior.

Production target:

```text
scheduled home-server job
  ↓
run incremental worker every few hours
  ↓
retry only useful unfinished media cases
  ↓
stop wasting quota on complete matches
```

Exact cadence should remain quota-aware and can be tuned after real-season observation.

Do not use the development endpoint as the normal production workflow.

---

# 38. Media review state / queue direction

Media review tooling is now implemented rather than purely planned.

Current review-queue behavior includes:

- create `pending` candidates for ambiguous/high-enough-scoring cases that should reach a human;
- remove a stale pending review candidate if a refreshed score becomes safely auto-persistable;
- preserve human-reviewed outcomes instead of automatically resetting them to pending;
- refresh scorer evidence while respecting previous approval/rejection decisions;
- expose candidates through Admin Media Review.

The broader product-level state vocabulary may still evolve as real cases accumulate. Useful conceptual states remain:

```text
waiting_for_upload
pending
approved
auto_matched
rejected
complete
```

Do not add schema/state complexity solely for theoretical cases. Let real review/backfill behavior drive future changes.

---

# 39. Important UI rules captured from implementation

Keep these consistent:

- Barça events stand out more than opponent events.
- Use a proper football icon, not emoji.
- Use custom dropdowns/pickers where native controls break the design.
- Use real player portraits when trustworthy; current Squad preference is official Barça portraits.
- Rating colors should communicate quality.
- Team-comparison bars never overlap numeric labels.
- Goals and assists stay separate.
- Match-specific player detail is a centered modal.
- Squad player Quick View is also centered, not fullscreen, with visible breathing room around it.
- Modal content may scroll internally; opening a modal must lock background scrolling.
- Clickable controls/cards/rows/actions use `cursor-pointer`/hand cursor consistently.
- Player-card portrait hover transitions must animate smoothly rather than pop instantly.
- My Match stays inside Match Center.
- Future-match diary is visible but locked.
- Highlights receive gold/accent emphasis.
- Themed scrolling is global.
- Use icon libraries/SVGs for controls.
- Competition logos should appear where they speed recognition (Matches filters, rows, calendar/heatmap match selectors).
- Dark competition artwork such as the UCL mark needs contrast treatment on dark themes.
- Pages need deliberate outer breathing room; avoid content feeling glued to screen edges.
- Matches and Squad must visually inherit the active Home/Away/Third theme rather than feel like separate products.
- Desktop Stadium Rail should remain persistent while primary page content scrolls.
- Fan-facing times use 12-hour AM/PM.
- Avoid heavy rounded cards, floating SaaS panels and excessive glow.

---

# 40. Accessibility / interaction

Required direction:

- keyboard-accessible controls;
- visible focus states;
- semantic buttons/links;
- Escape closes dismissible modals/intro where appropriate;
- reduced-motion fallback for the 3D intro;
- modal background inert/scroll-locked while open;
- interactive rows/cards visibly communicate clickability with pointer cursor and hover/focus states;
- previous/next player navigation should be operable without precise pointer use;
- image fallbacks must not collapse layout;
- dark logos/crests must remain legible against theme surfaces;
- do not rely on color alone for captain/status/severity meaning;
- horizontal carousels and calendar panels need usable mouse/trackpad/keyboard behavior;
- user-facing timestamps remain consistent in 12-hour format.

---

# 41. Development safety

Rules:

- make changes page-by-page and finish each page before moving to the next;
- prefer full-file replacements when a requested change touches many scattered regions and repeated piecemeal edits would be error-prone;
- use the current `main` branch as code source of truth after the user pushes;
- do not overwrite long current files from stale pasted snippets;
- re-run lint/build after major milestones;
- generated Prisma files are not hand-edited for lint compliance;
- provider writes should be previewable/confirmable where destructive or quota-consuming;
- syncs must be idempotent;
- destructive cleanup must have resolution safety guards;
- do not burn provider quota by repeatedly re-fetching already persisted data without a reason;
- preserve canonical IDs/mappings during repair;
- normalize provider encoding/mojibake at ingestion/canonicalization boundaries rather than hiding every problem in UI formatting.

When a file is very large and the latest version matters, push it and inspect the repository rather than relying on an older chat copy.

---

# 42. Known limitations / remaining cross-cutting work

Major current limitations are no longer Matches or Squad; both are functional.

Remaining major product gaps:

- `/club` history spine is implemented; trophy gallery, identity and deep stadium explorer await staged review;
- global `/media` still placeholder despite strong match-media/admin infrastructure;
- `/settings` still placeholder;
- exact favourite-goal clips need event-to-media linkage and sourcing;
- authentication/users are not built;
- diary is still one-user-first;
- production-grade scheduled provider/background sync still needs finalization;
- overview match-state engine ultimately needs recurring provider refresh rather than relying on stale local DB/manual refresh;
- pre-match/live/half-time Match Center depth remains future work;
- xG/xA are not universal;
- shot maps/passing maps require trustworthy coordinates before implementation;
- goal-path replay is still future work;
- deep Camp Nou explorer is future work;
- some older files still produce non-blocking Next `<img>`/cleanup lint warnings;
- shared fan-facing route-group shell refactor is still desirable;
- admin authentication must exist before exposing write/debug controls publicly.

Spatial note:

- player heatmaps are no longer a limitation; they are implemented through PitchAPI;
- SofaScore spatial remains unusable in the current server flow due `403 Forbidden` and should not be considered a dependency.

---

# 43. Immediate roadmap

Current page-development state:

```text
Overview        DONE / strong
Match Center    DONE / strong core
Admin           DONE / functional core
Matches         DONE
Calendar        DONE
Squad           DONE
Analytics       IMPLEMENTED / COMPETITION SYNC, DATA QA AND RESPONSIVE VISUAL QA PASSED
My Barça        IMPLEMENTED / PERSONAL ARCHIVE AND WATCH-DATE FLOW
```

## Phase F — Analytics — IMPLEMENTED / VERIFIED

Build deeply before moving on.

### F1. Analytics foundation

- define canonical analytics data loader;
- determine exactly which current-season metrics are trustworthy;
- establish competition/home-away split helpers;
- keep active Home/Away/Third theme language;
- avoid generic BI-dashboard styling.

### F2. Team season dashboard

Potential first visuals:

- form/results trend;
- goals for/against trend;
- possession/passing/shooting trends where canonical data exists;
- competition splits;
- home/away splits;
- season leaders.

### F3. League Race

- all 20 La Liga teams;
- position vs round;
- Barça emphasis;
- interactive round inspection;
- title/top-four/relegation zones/context.

### F4. Player analytics / comparison

- compare two or more current players;
- season totals/rates;
- rating history;
- role-aware metric selection;
- competition splits;
- existing heatmap data where useful.

### F5. Advanced spatial views

Use only data already proven trustworthy:

- player heatmap comparisons;
- team/role aggregates if derivable correctly;
- shot maps only after real shot coordinates exist;
- passing/creation maps only after real event coordinates exist.

### F6. Predictor later

- win/draw/loss probability;
- score distribution;
- model version and feature snapshot;
- calibration tracking;
- explicitly analytical/fun, not betting-oriented.

## Cross-cutting production work

Continue after/alongside page work where appropriate:

- recurring background fixture/provider refresh for automatic match-state transitions;
- scheduled media ingestion/retry worker on home server;
- route-group shared fan-facing shell;
- quota-aware logging/health;
- backups/deploy integration;
- admin authentication before remote/public exposure.

## After Analytics

Current broad order:

1. **Club** — trophies/history/deep Camp Nou;
2. **global Media** — browse official Barça media beyond one match, including an exact-goal clip sourcing/linkage pass;
3. **Settings** — preferences/diagnostics;
4. deeper live/pre-match Match Center features;
5. AI predictor and goal replay when data foundations are ready.

Roadmap may shift if a prerequisite/data-source issue appears, but avoid reopening finished pages for cosmetic churn unless a real issue is found.

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
- richer dedicated player career pages if Quick View eventually becomes too dense;
- team/role spatial profiles built from real heatmaps;
- goal replay / 2D path animation from trustworthy event coordinates;
- private friend sharing;
- later account/profile page redesign after the account and data-ownership rollout, with a fuller personal profile and account-management experience; keep this separate from the initial sign-in screen;
- Barça-only multi-user accounts;
- end-of-season Barça Wrapped-style personal recap;
- trophy cabinet with image/3D presentation;
- deep interactive Camp Nou exploration;
- eventually a multi-club platform only after Barça is mature.

Potential notification automation should be useful rather than noisy:

- match starting soon;
- final score/post-match diary prompt;
- official highlight discovered;
- significant provider/data issue requiring admin attention.

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

Current strongest product areas are now:

- Overview / Stadium Control Room;
- Match Center;
- Matches + FIFA-style Season Calendar;
- Squad + rich Player Quick View;
- real player heatmaps;
- Admin Control Room.

The quality bar is:

- meaningful football context;
- real data and provenance;
- editorial/broadcast visual identity;
- rich interactions without clutter;
- strong Barça-specific personality;
- personal fandom features that normal score sites do not provide.

Future sections should aim for the same depth rather than remain shallow placeholders.

This is intentionally **not** a generic SofaScore clone. The differentiators are the Barça-only depth, personal history, theme system, cinematic entry, canonical data tooling, spatial/player profile presentation and future Club/My Barça experiences.

---

# 47. Current milestone snapshot

As of **2026-10-04**:

## Strong / functional

### Data / engineering

- PostgreSQL + Prisma contract/ORM foundation;
- provider mappings/provenance;
- football-data fixture spine;
- GOAL rich data;
- Big Balls player data;
- StatsHawk fallback;
- canonical merge rules;
- rich-season tooling;
- QA/repair tooling;
- conservative identity matching;
- repeated mojibake repair;
- verified official-squad ownership model;
- 27-player current first-team manifest;
- 5-captain reconciliation;
- green squad metadata audit;
- official Barça portraits for the full current first-team squad;
- PitchAPI spatial ingestion;
- all 8 targeted finished matches heatmap-resolved;
- season/competition heatmap aggregation;
- lint: 0 errors;
- production build passes.

### Fan-facing

- Overview shell;
- Stadium Rail;
- Match Stage;
- Barça Pulse;
- Season Story;
- Home/Away/Third kit themes;
- themed scrollbars;
- 3D Threshold intro;
- Match Center;
- formation/bench;
- Match Timeline;
- team comparison;
- player-performance table/modal;
- previous/next match navigation;
- My Match diary;
- official Match Media UI;
- automatic official Barça YouTube matcher;
- Matches season browser;
- dynamic competition filters + logos;
- current-match focus/window;
- FIFA Career Mode-inspired Season Calendar;
- Squad browser;
- favourites;
- rich centered Player Quick View;
- official portraits;
- real flags/nationalities/DOB/age/preferred foot;
- recent form;
- rating history;
- Season/La Liga/UCL average heatmaps;
- per-match heatmap selector with opponent/competition visuals.

### Admin

- Admin shell/overview;
- Media Manager;
- Media Add;
- Media Review;
- Providers with logos/health/context;
- Data Issues with filters/severity;
- Sync Control with tested actions;
- Squad metadata/heatmap/audit endpoints.

## Immediate WIP / next

- **Analytics and My Barça are implemented; My Barça live data QA found eight watched/rated entries and no exact goal clips yet.**
- User declined linked Analytics chart inspection and a data-through-matchday badge; do not carry them as next-step work.
- Next page milestone: Club. Exact-goal clip sourcing/linkage belongs with the global Media pass after the personal goal gallery exposes the need clearly.

## Cross-cutting remaining

- recurring background provider refresh for automatic match-state accuracy;
- production scheduler/media retry integration;
- shared route-group fan shell refactor;
- admin authentication;
- clean remaining non-blocking `<img>`/legacy lint warnings when convenient.

## Major future modules

- Club/Trophies;
- deep Camp Nou;
- global Media;
- Settings;
- predictor;
- goal replay / richer spatial analytics.

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

## v0.2.0 — 2026-10-04

Major milestone update after Admin, Matches/Calendar and Squad work.

Added/updated:

- canonical branch moved to `main`;
- audited pushed milestone `b658f0da5055ec19aa3b41cc4b6d5fe09b7a55df`;
- Admin Control Room now implemented rather than planned;
- Providers page with provider logos and health/context;
- Data Issues page with filters/severity and pointer interaction rules;
- Sync Control implemented/tested;
- `/matches` implemented;
- competition logos in filters/rows;
- UCL logo contrast handling;
- current-match auto-focus/window;
- dynamic competition support;
- FIFA Career Mode-inspired Season Calendar;
- `/squad` implemented;
- smooth card hover/pointer interaction;
- centred non-fullscreen Profile Quick View;
- sticky left identity panel + scrollable right content;
- previous/next player navigation;
- captain armband `C Captain` treatment;
- nationality flags + age/DOB + preferred foot;
- favourites integrated;
- recent-form and rating-history visuals;
- verified 27-player official 2026/27 first-team manifest;
- fixed lineup-created stale squad memberships;
- restored Frenkie de Jong, Roony Bardghji and Jesse Bisiwu to canonical current squad state;
- 5 verified captains;
- green squad audit with no missing core metadata;
- official FC Barcelona portraits preferred for all 27 current first-team players;
- PitchAPI spatial provider integrated;
- SofaScore spatial experiment documented as blocked by 403;
- real per-match player heatmaps persisted;
- season / La Liga / UCL heatmap averages;
- continuous broadcast-style heatmap renderer;
- normalized attacking direction;
- activity-centre centroid;
- opponent + competition logos in heatmap match selector;
- Santander/Racing alias resolution for spatial sync;
- generated Prisma contract/snapshots excluded from ESLint;
- current lint milestone: 0 errors;
- production build confirmed successful;
- Analytics promoted to immediate next page;
- page-by-page completion workflow recorded;
- cross-cutting background-sync/shared-shell/auth work retained on roadmap.

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

---

# Media source register — 2026-10-07

This catalogue stores metadata and links, not copied video files. Every exact-goal claim needs a verified `MediaMoment` to a canonical goal event. A match highlight is never sufficient evidence on its own.

| Source | Useful for | Integration decision |
| --- | --- | --- |
| [Barça Play](https://www.fcbarcelona.com/en/barca-play) | Club films, current and historical matches, documentaries, training | Curated official links; some films may require Premium. No public catalogue API verified. |
| [Official FC Barcelona YouTube](https://www.youtube.com/@FCBarcelona) | Recent match films, previews, features, interviews | Existing YouTube Data API integration and admin review queue; embed approved videos only after click. |
| [LaLiga's Barça video archive](https://www.laliga.com/en-GB/videos?page=1&teamslug=fc-barcelona) | League highlights and occasional standalone goal clips | Source review first; the current Admin Media Add route accepts only the official Barça YouTube channel, so a separate source-aware workflow is needed. |
| [UEFA Champions League video/events](https://www.uefa.com/uefachampionsleague/) | European archive and event evidence | Link to official pages; verify per-film playback and regional/account availability before goal linking. |

Official historical links seeded by `tools/seed-media-history.mjs`:

| Film | URL | Canonical link |
| --- | --- | --- |
| Berlin 2015 final highlights | https://www.fcbarcelona.com/en/videos/817512 | 2014/15 season only |
| Berlin 2015 full match | https://www.fcbarcelona.com/en/videos/817552 | 2014/15 season only |
| Paris comeback highlights | https://www.fcbarcelona.com/en/videos/1607907 | 2016/17 season only |
| Sergi Roberto winner | https://www.fcbarcelona.com/en/videos/966945 | 2016/17 season only; historical standalone goal film |
| Paris comeback full match | https://www.fcbarcelona.com/en/videos/776784 | 2016/17 season only |

Five further official Barça films are fixture-checked and seeded by `node tools/seed-media-around-match.mjs --write` (without `--write`, the script previews its exact canonical mapping):

| Film | Official video | Canonical fixture |
| --- | --- | --- |
| Flick before Sevilla | https://www.fcbarcelona.com/en/videos/4578323 | Sevilla 1–3 Barça, 19 Sep 2026 |
| Flick before Feyenoord | https://www.fcbarcelona.com/en/videos/4573788 | Barça 5–1 Feyenoord, 9 Sep 2026 |
| Flick after Feyenoord | https://www.fcbarcelona.com/en/videos/4574402 | Barça 5–1 Feyenoord, 9 Sep 2026 |
| Flick before Levante | https://www.fcbarcelona.com/en/videos/4575581 | Levante 2–4 Barça, 13 Sep 2026 |
| Flick after Levante | https://www.fcbarcelona.com/en/videos/4575904 | Levante 2–4 Barça, 13 Sep 2026 |

These are short press-room/reaction films, not complete press conferences. Barça's official news confirms [training](https://www.fcbarcelona.com/en/news/4578225/last-session-before-sevilla) and live media availability, but that article was not imported as a video.

## Official YouTube expansion (7 October 2026)

The configured key resolved the official channel `UC14UlmYlSNiQCBe9Eookf_A`. A bounded uploads scan covered 181 videos near the eight stored 2026/27 fixtures. The existing match worker's dry run inspected 180 playable uploads in 10 requests and proposed no new automatic highlights; its deliberate write queued one Valencia preview for review. Seventeen additional uploads were then individually checked for official channel, public/embeddable status, title, description, date, and canonical fixture before being saved with the existing manual Admin Media action. A repeat import of the Valencia preview updated the same item rather than creating a duplicate. That review candidate is now approved. A final bounded official-channel search found an Elche preview published just outside the per-match audit's 24-hour pre-kickoff window; it was verified and added separately. Four purported goal Shorts were subsequently removed after playback showed celebrations rather than the goals.

| Fixture | Newly stored official films (YouTube IDs) |
| --- | --- |
| Elche 0–5 Barça | [Preview](https://www.youtube.com/watch?v=kAsT_Q5o1zo), [match feature](https://www.youtube.com/watch?v=yQGl0CcW42Y), [recovery training](https://www.youtube.com/watch?v=q2aFX1VQCek) |
| Barça 2–0 Athletic | [Preview](https://www.youtube.com/watch?v=MZqJNFrxRDM), [pre-match training](https://www.youtube.com/watch?v=P33GiPUlcHw) |
| Barça 5–2 Rayo | [Preview](https://www.youtube.com/watch?v=btw_foY-deI), [pre-match training](https://www.youtube.com/watch?v=ZfuFBpw8GY8) |
| Valencia 0–5 Barça | [Preview](https://www.youtube.com/watch?v=asaYYhXlxTk) |
| Barça 5–1 Feyenoord | [Champions League preparation](https://www.youtube.com/watch?v=2OJxPW9-gUQ) |
| Levante 2–4 Barça | [Recovery training](https://www.youtube.com/watch?v=P5t8UWkaVFk) |
| Barça 7–2 Racing | [Preview](https://www.youtube.com/watch?v=fltNcs-Emv4), [recovery training](https://www.youtube.com/watch?v=felsOy1BEy0) |
| Sevilla 1–3 Barça | [Preview](https://www.youtube.com/watch?v=PiT0YlRcjKE) |

The removed Shorts were labelled like goals but showed celebrations. None had an exact `MediaMoment` link. Their former video IDs were `ZUi_exnEU0Y`, `ugEpn1jlCDM`, `vSKZasjh9tk`, and `ICd5ZA29Hi4`; these are retained here only as a rejection record, not as media to re-import. The Match Center goal dialog stays empty until footage of the actual play is manually verified. Generic training and Barça Live shows were not silently assigned to a fixture.

## Actual goal footage source audit (7 October 2026)

Goal-clip discovery must verify the **shot and ball entering the goal**, not just a scorer's name, headline, thumbnail, or celebration. No new exact-goal links were approved in this research pass. The strongest candidates are:

| Source | Concrete lead | What remains to check |
| --- | --- | --- |
| [LALIGA video catalogue](https://www.laliga.com/videos) | Official match summaries for the stored 2026/27 league fixtures; the catalogue also has [single-goal pages](https://www.laliga.com/videos/cabezazo-de-capitan-el-gol-de-nemanja-gudelj). Its [September goal-of-the-month article](https://www.laliga.com/en-US/news/joao-cancelo-ea-sports-laliga-goal-of-the-month-for-september) identifies Cancelo's eighth-minute Racing goal. | Find a playable, directly addressable current-season clip for each event; a match summary or written article is not automatically a standalone goal video. |
| [UEFA Champions League Feyenoord page](https://www.uefa.com/uefachampionsleague/clubs/52749--feyenoord/) and [UEFA.tv](https://www.uefa.tv/) | UEFA's club page lists short, named films of Raphinha's finish (22s), Yamal's free kick (21s), and Adeyemi's strike (18s). UEFA.tv additionally lists a 37-second “All Angles: Karim Adeyemi v Feyenoord”, the complete match replay, and matchday all-goals films. [UEFA names one Raphinha strike Goal of the Day](https://www.uefa.com/uefachampionsleague/news/02a9-218d719135c9-b50c80ec606c-1000--every-uefa-champions-league-goal-of-the-day/). | Open the short films to confirm the play and stable per-video URL in the user's region/account, especially which Raphinha goal the 22-second clip shows. Some UEFA.tv videos require sign-in. |
| [AS single-play video](https://as.com/futbol/videos/cancelo-marca-el-posiblemente-mejor-gol-hasta-la-fecha-en-laliga-que-barbaridad-f202609-v/) | A page dedicated to Cancelo's 1–0 against Racing, credited to LALIGA; [AS also has Elche's five-goal video](https://colombia.as.com/videos/primera-division/repasa-los-goles-del-0-5-del-barcelona-en-su-visita-al-elche-f202608-v/). | Play the embedded video to confirm the actual goal and test direct-link/embedding and regional availability. The five-goal compilation needs per-goal timecodes. |
| [beIN's Sevilla goal-by-goal report](https://prod.beinsports.com/en-us/soccer/la-liga/articles/-video-all-goals-from-sevilla-vs-fc-barcelona-in-laliga-2026-09-19) | Separate ESPN FC posts for Raphinha's 22', 52', and 69' goals, each embedded beside the corresponding score. There is also a [Feyenoord all-goals report](https://www.beinsports.com/es-us/football/uefa-champions-league/articles/-video-todos-los-goles-del-barcelona-vs-feyenoord-en-la-uefa-champions-league-2026-09-09). | Open each original broadcaster post, verify that it shows the finish rather than only celebration, and link to the publisher's post—not an extracted video CDN URL. |
| [ScoreBat Video API](https://www.scorebat.com/video-api/docs/) | Official/embeddable video feed with a free, token-gated sample. | Its free feed is explicitly a limited selection, often older games; it is not a reliable source for every 2026/27 goal. No new key is needed until a sample demonstrates useful coverage. |

Sportmonks [warns that goal/event video links are community-sourced and availability is not guaranteed](https://docs.sportmonks.com/v2/endpoint-overview/video-highlights). WSC Sports has genuine event-level “Moments”, but [catalogue access depends on rights-holder/publisher agreements](https://dev.wsc-sports.com/docs/content-catalog-overview); it is not a free public feed. Neither was connected.

The Valencia and Levante gaps identified in the initial audit were repaired from LaLiga's published match reports on 8 October 2026. The eight finished matches now contain 44 scoring events, matching their scorelines. The existing Racing event for Asier Villalibre was corrected to `own_goal` without replacing its canonical ID. The repair is previewable and idempotent via `node tools/repair-media-goal-coverage.mjs` and `node tools/repair-media-goal-coverage.mjs --write`. It does not invent missing opposing-player records; their names remain in event source data.

Two dedicated, single-goal [AS/LaLiga videos](https://as.com/futbol/videos/un-gol-para-sembrar-el-panico-en-todo-el-planeta-futbol-lo-del-0-2-del-barca-rodri-incluido-fue-demasiado-f202609-v/) ([Cancelo's Racing opener](https://as.com/futbol/videos/cancelo-marca-el-posiblemente-mejor-gol-hasta-la-fecha-en-laliga-que-barbaridad-f202609-v/)) are stored as source-labelled `goal_clip` items attached to their canonical matches. Their pages, LaLiga player embeds, and specific goal metadata were checked. The embedded videos did **not** deliver frames during automated browser playback, so neither has a `MediaMoment` verification link and neither appears in “See the goals” yet. Two provisional links created during the repair were removed once that playback limit was confirmed; the underlying video-page records remain. A person should play each clip and verify the ball entering the net before approving an exact event link. The admin curation flow now accepts a non-official publisher item with a recorded `DataSource`, rather than requiring a club-owned upload. No video was downloaded or rehosted.

The existing GOAL API key was tested against `/v1/videos/date/{date}` for 6, 9, 13, 16, and 19 September 2026. All five calls returned HTTP 200 with an empty `data` array; its video endpoint currently adds no footage for these fixtures. The earlier rich-match preview also failed its hardened fixture resolver for Valencia and Levante, which is why the bounded LaLiga report repair was necessary.

Free/API alternatives worth a controlled trial: [Highlightly](https://highlightly.net/football-api/) advertises a no-card free key with 100 requests/day, plus goal and match-video categories. Its [documentation](https://highlightly.net/football-api/documentation/getting-started/pagination/) warns that Free/Basic highlights may be hidden, and its [geo-restriction endpoint](https://highlightly.net/football-api/documentation/highlights/geo-restrictions/) is not on the free tier. Its marketing coverage claim is not proof that these Barça fixtures are present; request a key and preview exact match IDs/dates before implementing an importer. [ScoreBat's free feed](https://www.scorebat.com/video-api/docs/) also needs a token and explicitly samples limited, often older matches, so it is a secondary discovery source rather than guaranteed goal coverage. [GOALISE](https://goalise.com/football-highlights-api) has an especially useful `goal-clip` category, scorer/minute metadata, and fixture/geo fields, but its [pricing](https://goalise.com/checkout) is a seven-day trial followed by a paid plan, not an ongoing free source. Sportmonks' community links remain possible but unguaranteed. All candidates still need exact-goal and playback checks before `MediaMoment` creation.

The historical archive was expanded via `node tools/seed-media-youtube-history.mjs --write`; its default mode previews all mappings. The importer checked official-channel identity, public/embeddable status, subject title, canonical season, and collision-free URLs. First write created 14; repeat write created zero.

| Archive chapter | Official YouTube films |
| --- | --- |
| Rome 2009 | [United final highlights](https://www.youtube.com/watch?v=iVSbEVjD8E4) |
| Wembley 2011 | [United final highlights](https://www.youtube.com/watch?v=fCG5pBNuSbY) |
| Berlin 2015 | [Juventus final highlights](https://www.youtube.com/watch?v=1mVu7AzvCDo), [celebrations](https://www.youtube.com/watch?v=O3potfenY1A), [Berlin training](https://www.youtube.com/watch?v=u07-rXDFr9w), [trophy lift](https://www.youtube.com/watch?v=ftecBmF1vH4), [winners film](https://www.youtube.com/watch?v=XFNSzPytLs8), [Messi interview](https://www.youtube.com/watch?v=ZSrGwGD_Vgc) |
| La Remontada 2017 | [6–1 highlights](https://www.youtube.com/watch?v=h4m68r8kWAc), [final celebrations](https://www.youtube.com/watch?v=SoOHFUh5Dus), [fan reactions](https://www.youtube.com/watch?v=PF7MF9jMNlM), [preview](https://www.youtube.com/watch?v=zg1bFOLsnDk), [training](https://www.youtube.com/watch?v=LmoBNKPJh7o), [Sergi Roberto's later reflection](https://www.youtube.com/watch?v=_vtHu5Yj83I) |

The archived match date and subject season are curated separately from the video upload date; e.g. a 2019-uploaded highlights video about 2009 belongs to 2008/09. No canonical historical Match row was created.

The old matches are not in the canonical Match table; do not manufacture `MatchEvent` rows just to make the clip dialog appear. For current-season goals, inspect the publisher's film, select its canonical goal event, record exact seconds for a longer video, and save a supporting URL in `/admin/media/curation`.

Barça Play also publishes current-season [Racing](https://www.fcbarcelona.com/en/videos/4579618/full-match-fc-barcelona-7-2-racing-de-santander-la-liga-2627) and [Sevilla](https://www.fcbarcelona.com/en/barca-play/videos/4580162/full-match-sevilla-1-3-fc-barcelona-laliga-2627) full-match pages, marked Premium in its catalogue. The current `MediaType` has no `full_match` value; add a proper type and a deliberate import before treating them as a new row rather than mislabelling them `historical` or `match_feature`.

The existing YouTube key covers the first release; no additional key is required. YouTube's [playlist API](https://developers.google.com/youtube/v3/docs/playlistItems/list) can support a later channel/playlist ingest, but candidates must pass match and rights-holder review. Its [developer policies](https://developers.google.com/youtube/terms/developer-policies-guide) rule out downloading/rehosting videos through the API and require metadata freshness. Current links/embeds remain on their publishers' terms. Accounts, permissions, personalised feature ranking, and per-user shelves are later deployment work.

/** Controlled DailyGoal worker QA. Only a disposable localhost PostgreSQL database is writable. */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { registerHooks } from "node:module";
import path from "node:path";
import "dotenv/config";
import pg from "pg";

const root = process.cwd();
const originalUrl = new URL(process.env.DATABASE_URL ?? "");
if (!["localhost", "127.0.0.1", "::1"].includes(originalUrl.hostname)) throw new Error("QA refuses a non-local database.");
if (!originalUrl.pathname || originalUrl.pathname === "/") throw new Error("QA requires a named source database.");
const databaseName = `barca_goal_qa_${randomBytes(6).toString("hex")}`;
const qaUrl = new URL(originalUrl);
qaUrl.pathname = `/${databaseName}`;
const sourceUrl = "https://dailygoal.tv/m/GoalQaFixture42/barcelona-vs-sevilla";
const teamUrl = "https://dailygoal.tv/team/13/barcelona";
const videoId = "AbCdEfGh123";
const ids = Object.fromEntries(["season", "league", "barca", "sevilla", "match", "raphinha", "yamal", "visitor", "raphinhaGoal", "yamalGoal", "visitorGoal", "media", "manualMoment"].map((key) => [key, randomUUID()]));
const real = new pg.Client({ connectionString: originalUrl.toString() });
const isolated = new pg.Client({ connectionString: qaUrl.toString() });
const originalFetch = globalThis.fetch;
const originalNow = Date.now;
const originalDbUrl = process.env.DATABASE_URL;
const originalYoutubeKey = process.env.YOUTUBE_API_KEY;
const originalFootballKey = process.env.FOOTBALL_DATA_API_KEY;
const originalScheduleFlag = process.env.GOAL_MEDIA_SCHEDULE_ENABLED;
const originalInternalSecret = process.env.INTERNAL_JOB_SECRET;
let created = false;
let isolatedConnected = false;
let realConnected = false;
let clock = originalNow();
let phase = "missing";
const requests = { listing: 0, match: 0, youtube: 0 };
let listingGate = null;
const kickoff = new Date(clock - 2 * 3_600_000).toISOString();
const videoPublishedAt = new Date(clock - 30 * 60_000).toISOString();

const clip = (scorer, minute, offset, index) => ({
  "@type": "Clip", name: `Goal: ${scorer} ${minute}' - Barcelona vs Sevilla`,
  startOffset: offset, url: `${sourceUrl}?i=${index}`,
});
function html() {
  const fixture = {
    "@type": "SportsEvent", name: phase === "wrong-score" ? "Barcelona 3-1 Sevilla" : "Barcelona 2-1 Sevilla",
    url: sourceUrl, startDate: kickoff, eventStatus: "https://schema.org/EventCompleted",
    homeTeam: { name: "Barcelona" }, awayTeam: { name: "Sevilla" }, organizer: { name: "La Liga" },
  };
  const video = phase === "missing" ? [] : [{
    "@type": "VideoObject", url: sourceUrl, embedUrl: `https://www.youtube.com/embed/${videoId}`,
    hasPart: [clip("Raphinha", 12, 20, 1), clip("Lamine Yamal", 55, 50, 2), clip("Unknown Visitor", 72, 80, 3)],
  }];
  return `<script type="application/ld+json">${JSON.stringify([fixture, ...video])}</script>`;
}
function response(body, status = 200, type = "text/html") {
  return new Response(body, { status, headers: { "content-type": type } });
}
globalThis.fetch = async (input) => {
  const url = String(input);
  if (url === teamUrl) {
    requests.listing++;
    if (phase === "listing-unavailable") return response("Unavailable", 503);
    if (listingGate) {
      const gate = listingGate;
      gate.arrived();
      await gate.release;
    }
    return response(`<a href="/m/GoalQaFixture42/barcelona-vs-sevilla">Barcelona vs Sevilla</a>`);
  }
  if (url === sourceUrl) {
    requests.match++;
    if (phase === "forbidden") return response("Forbidden", 403);
    if (phase === "rate-limited") return response("Too many requests", 429);
    if (phase === "unavailable") return response("Unavailable", 503);
    return response(html());
  }
  if (url.startsWith("https://www.googleapis.com/youtube/v3/videos?")) {
    requests.youtube++;
    return response(JSON.stringify({ items: [{ id: videoId, snippet: {
      title: "HIGHLIGHTS | Barcelona 2 vs 1 Sevilla", channelId: "UC14UlmYlSNiQCBe9Eookf_A", publishedAt: videoPublishedAt,
    }, contentDetails: { duration: "PT3M39S" }, status: { privacyStatus: "public", embeddable: true } }] }), 200, "application/json");
  }
  throw new Error(`QA blocked an unexpected network request: ${new URL(url).origin}`);
};
Date.now = () => clock;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export%20%7B%7D", shortCircuit: true };
  if (specifier === "next/server") return nextResolve("next/server.js", context);
  try { return nextResolve(specifier, context); }
  catch (error) {
    if (error.code !== "ERR_MODULE_NOT_FOUND" || !specifier.startsWith(".")) throw error;
    return nextResolve(`${specifier}.ts`, context);
  }
} });

async function counts(client) {
  const { rows } = await client.query("select (select count(*)::int from media_moment) as moments, (select count(*)::int from goal_timestamp_candidate where status = 'pending') as reviews");
  return rows[0];
}
async function protectedMediaSnapshot(client) {
  const [moments, candidates] = await Promise.all([
    client.query("select * from media_moment order by id"),
    client.query("select * from goal_timestamp_candidate order by id"),
  ]);
  return { moments: moments.rows, candidates: candidates.rows };
}
async function row(table, where = "") {
  const { rows } = await isolated.query(`select * from ${table} ${where}`);
  assert.equal(rows.length, 1, `Expected one ${table} row, got ${rows.length}`);
  return rows[0];
}
async function isolatedCounts() { return counts(isolated); }
async function seed() {
  await isolated.query('insert into season (id, label, "startYear", "endYear", era, "isCurrent", "updatedAt") values ($1, $2, 2026, 2027, $3, true, now())', [ids.season, "2026/27", "modern"]);
  await isolated.query('insert into competition (id, name, code, type, "updatedAt") values ($1, $2, $3, $4, now())', [ids.league, "La Liga", "PD", "league"]);
  for (const [id, name, code, isBarcelona] of [[ids.barca, "FC Barcelona", "FCB", true], [ids.sevilla, "Sevilla FC", "SEV", false]]) {
    await isolated.query('insert into team (id, name, code, "isBarcelona", "updatedAt") values ($1, $2, $3, $4, now())', [id, name, code, isBarcelona]);
  }
  await isolated.query('insert into football_match (id, "seasonId", "competitionId", "homeTeamId", "awayTeamId", kickoff, status, "homeScore", "awayScore", "updatedAt") values ($1, $2, $3, $4, $5, $6, $7, 2, 1, now())', [ids.match, ids.season, ids.league, ids.barca, ids.sevilla, kickoff, "finished"]);
  for (const [id, name] of [[ids.raphinha, "Raphinha"], [ids.yamal, "Lamine Yamal"], [ids.visitor, "Sevilla Player"]]) {
    await isolated.query('insert into player (id, "displayName", "updatedAt") values ($1, $2, now())', [id, name]);
  }
  for (const [id, team, player, minute] of [[ids.raphinhaGoal, ids.barca, ids.raphinha, 12], [ids.yamalGoal, ids.barca, ids.yamal, 55], [ids.visitorGoal, ids.sevilla, ids.visitor, 72]]) {
    await isolated.query('insert into match_event (id, "matchId", "teamId", "primaryPlayerId", type, minute, "updatedAt") values ($1, $2, $3, $4, $5, $6, now())', [id, ids.match, team, player, "goal", minute]);
  }
  await isolated.query('insert into media_item (id, type, title, url, "externalMediaId", "isOfficial", "seasonId", "matchId", "updatedAt") values ($1, $2, $3, $4, $5, true, $6, $7, now())', [ids.media, "match_highlight", "Barcelona 2-1 Sevilla highlights", `https://www.youtube.com/watch?v=${videoId}`, videoId, ids.season, ids.match]);
  await isolated.query('insert into media_moment (id, "mediaItemId", "matchEventId", "startSecond", "verificationBasis", "verifiedAt", "updatedAt") values ($1, $2, $3, 33, $4, now(), now())', [ids.manualMoment, ids.media, ids.raphinhaGoal, "manual_visual"]);
}

let realBefore;
let protectedBefore;
let run;
try {
  await real.connect(); realConnected = true;
  realBefore = await counts(real);
  protectedBefore = await protectedMediaSnapshot(real);
  await real.query(`create database "${databaseName}"`);
  created = true;
  process.env.DATABASE_URL = qaUrl.toString();
  process.env.YOUTUBE_API_KEY = "qa-mocked-key";
  execFileSync(process.execPath, [path.join(root, "node_modules", "prisma", "dist", "prisma.js"), "db", "migrate", "--yes"], { cwd: root, env: process.env, stdio: "pipe", timeout: 120_000 });
  await isolated.connect(); isolatedConnected = true;
  await seed();
  ({ runGoalMediaBackgroundWorker: run } = await import("../src/lib/providers/dailygoal/background-worker.ts"));
  const { getMatchMedia } = await import("../src/lib/matches/get-match-media.ts");
  const { selectPlayableGoals } = await import("../src/lib/matches/goal-playback.ts");
  const { runScheduledMatchMediaJob } = await import("../src/lib/providers/youtube-fcbarcelona/scheduled-job.ts");
  const { runScheduledFixtureRefresh } = await import("../src/lib/providers/football-data/scheduled-refresh.ts");
  const { runScheduledGoalEventRefresh } = await import("../src/lib/providers/rich-match/scheduled-events.ts");
  const fixtureStub = async () => ({ status: "cooldown", nextAt: null, fetched: 0, error: null });
  const eventStub = async () => ({ status: "complete", matchId: null, nextAt: null, error: null });
  const scheduledJob = (options) => runScheduledMatchMediaJob({ fixtureWorker: fixtureStub, eventWorker: eventStub, ...options });
  const { POST: authenticatedJob } = await import("../src/app/api/internal/jobs/match-media/route.ts");
  delete process.env.INTERNAL_JOB_SECRET;
  assert.equal((await authenticatedJob(new Request("http://localhost/api/internal/jobs/match-media", { method: "POST" }))).status, 503);
  process.env.INTERNAL_JOB_SECRET = "qa-only-secret";
  assert.equal((await authenticatedJob(new Request("http://localhost/api/internal/jobs/match-media", { method: "POST", headers: { authorization: "Bearer wrong" } }))).status, 401);
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const { POST: devMatchesSync } = await import("../src/app/api/dev/sync-football-data/matches/route.ts");
  const { POST: devCompetitionSync } = await import("../src/app/api/dev/sync-football-data/route.ts");
  assert.equal((await devMatchesSync()).status, 404);
  assert.equal((await devCompetitionSync()).status, 404);
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalInternalSecret === undefined) delete process.env.INTERNAL_JOB_SECRET;
  else process.env.INTERNAL_JOB_SECRET = originalInternalSecret;
  delete process.env.GOAL_MEDIA_SCHEDULE_ENABLED;
  const officialOk = async () => ({ counts: { failed: 0, eligible: 1 } });
  let goalCalls = 0;
  const goalStub = async () => { goalCalls++; return { status: "success", goalsPublished: 0, goalsQueued: 0 }; };
  const off = await scheduledJob({ officialWorker: officialOk, goalWorker: goalStub });
  assert.equal(off.goalMedia.status, "disabled");
  assert.equal(goalCalls, 0);
  assert.deepEqual(await isolatedCounts(), { moments: 1, reviews: 0 });
  let fixtureCalls = 0;
  const fixtureOk = async () => { fixtureCalls++; return { fetched: 1, matchesCreated: 0, matchesUpdated: 1 }; };
  assert.equal((await runScheduledFixtureRefresh({ refresh: fixtureOk, now: clock })).status, "success");
  assert.equal((await runScheduledFixtureRefresh({ refresh: fixtureOk, now: clock + 3 * 3_600_000 })).status, "cooldown");
  assert.equal(fixtureCalls, 1, "Persisted success cooldown must prevent another provider request.");
  assert.equal((await runScheduledFixtureRefresh({ refresh: async () => { fixtureCalls++; throw new Error("football-data.org request failed: 429"); }, now: clock + 7 * 3_600_000 })).status, "blocked");
  assert.equal((await runScheduledFixtureRefresh({ refresh: fixtureOk, now: clock + 8 * 3_600_000 })).status, "cooldown");
  assert.equal(fixtureCalls, 2);
  assert.equal((await runScheduledFixtureRefresh({ refresh: fixtureOk, now: clock + 32 * 3_600_000 })).status, "success");
  assert.equal(fixtureCalls, 3);
  await isolated.query("update football_match set status = 'scheduled' where id = $1", [ids.match]);
  await isolated.query("delete from match_event where id = $1", [ids.visitorGoal]);
  process.env.GOAL_MEDIA_SCHEDULE_ENABLED = "true";
  const stageOrder = [];
  const flagged = await scheduledJob({ fixtureWorker: async () => { stageOrder.push("fixture"); await isolated.query("update football_match set status = 'finished' where id = $1", [ids.match]); return { status: "success", nextAt: null, fetched: 1, error: null }; },
    eventWorker: async () => { stageOrder.push("events"); return runScheduledGoalEventRefresh({ sync: async ({ matchId }) => {
      assert.equal(matchId, ids.match);
      await isolated.query('insert into match_event (id, "matchId", "teamId", "primaryPlayerId", type, minute, "updatedAt") values ($1,$2,$3,$4,$5,$6,now())', [ids.visitorGoal, ids.match, ids.sevilla, ids.visitor, "goal", 72]);
      return {};
    }, now: clock }); },
    officialWorker: async () => { stageOrder.push("official"); assert.equal((await isolated.query("select status from football_match where id = $1", [ids.match])).rows[0].status, "finished"); return officialOk(); },
    goalWorker: async () => { stageOrder.push("goal"); return goalStub(); }, youtubeConfigured: true });
  assert.equal(flagged.goalMedia.status, "success");
  assert.deepEqual(stageOrder, ["fixture", "events", "official", "goal"]);
  assert.equal(flagged.eventRefresh.status, "success");
  assert.equal((await runScheduledGoalEventRefresh({ sync: async () => { throw new Error("Must not resync complete events."); }, now: clock + 3 * 3_600_000 })).status, "cooldown");
  let lineupRecoveryCalls = 0;
  const lineupRecovery = await runScheduledGoalEventRefresh({
    sync: async () => { throw new Error("Complete events must not be reimported for a lineup gap."); },
    syncLineups: async ({ matchId }) => { assert.equal(matchId, ids.match); lineupRecoveryCalls++; return {}; },
    now: clock + 7 * 3_600_000,
  });
  assert.equal(lineupRecovery.status, "success");
  assert.equal(lineupRecoveryCalls, 1);
  assert.equal((await runScheduledGoalEventRefresh({ syncLineups: async () => { throw new Error("Cooldown must prevent repeated lineup requests."); }, now: clock + 8 * 3_600_000 })).status, "cooldown");
  const fixtureFailed = await scheduledJob({ fixtureWorker: async () => { throw new Error("mock fixture failure"); }, officialWorker: officialOk, goalWorker: goalStub, goalEnabled: true, youtubeConfigured: true });
  assert.equal(fixtureFailed.fixtureRefresh.status, "failed");
  assert.equal(fixtureFailed.result.counts.failed, 0);
  assert.equal(fixtureFailed.goalMedia.status, "success", "A fixture provider outage must not block media for already-finished matches.");
  assert.equal(goalCalls, 2);
  goalCalls = 0;
  delete process.env.GOAL_MEDIA_SCHEDULE_ENABLED;
  const missingKey = await scheduledJob({ officialWorker: officialOk, goalWorker: goalStub, goalEnabled: true, youtubeConfigured: false });
  assert.equal(missingKey.goalMedia.status, "skipped");
  assert.equal(goalCalls, 0);
  const primaryPartial = await scheduledJob({ officialWorker: async () => ({ counts: { failed: 1, eligible: 1 } }), goalWorker: goalStub, goalEnabled: true, youtubeConfigured: true });
  assert.equal(primaryPartial.result.counts.failed, 1);
  assert.equal(primaryPartial.goalMedia.status, "skipped");
  assert.equal(goalCalls, 0);
  const goalFailure = await scheduledJob({ officialWorker: officialOk, goalWorker: async () => { throw new Error("mock goal failure"); }, goalEnabled: true, youtubeConfigured: true });
  assert.equal(goalFailure.result.counts.failed, 0);
  assert.equal(goalFailure.goalMedia.status, "failed");
  assert.match(goalFailure.goalMedia.error, /mock goal failure/);
  assert.equal((await isolated.query("select count(*)::int as count from goal_media_sync_run where mode = 'scheduled-job' and status = 'goal-failed'")).rows[0].count, 1);
  await assert.rejects(scheduledJob({ officialWorker: async () => { throw new Error("mock official failure"); }, goalWorker: goalStub, goalEnabled: true, youtubeConfigured: true }), /mock official failure/);
  assert.equal(goalCalls, 0);
  let officialArrived;
  let releaseOfficial;
  const officialReached = new Promise((resolve) => { officialArrived = resolve; });
  const officialRelease = new Promise((resolve) => { releaseOfficial = resolve; });
  const lockedJob = scheduledJob({ officialWorker: async () => { officialArrived(); await officialRelease; return officialOk(); }, goalWorker: goalStub, goalEnabled: true, youtubeConfigured: true });
  await officialReached;
  const overlap = await scheduledJob({ officialWorker: officialOk, goalWorker: goalStub, goalEnabled: true, youtubeConfigured: true });
  assert.equal(overlap.status, "already-running");
  assert.equal(goalCalls, 0);
  releaseOfficial();
  assert.equal((await lockedJob).goalMedia.status, "success");
  assert.equal(goalCalls, 1);
  assert.deepEqual(await isolatedCounts(), { moments: 1, reviews: 0 });

  let reachedListing;
  let releaseListing;
  const listingReached = new Promise((resolve) => { reachedListing = resolve; });
  const listingRelease = new Promise((resolve) => { releaseListing = resolve; });
  listingGate = { arrived: reachedListing, release: listingRelease };
  const firstRun = run({ dryRun: false, now: clock });
  await listingReached;
  await assert.rejects(run({ dryRun: false, now: clock }), /already in progress/);
  assert.equal(requests.listing, 1, "A concurrent run must not request the provider.");
  releaseListing();
  const first = await firstRun;
  listingGate = null;
  assert.equal(first.due, 1);
  assert.equal(first.discovery.totals.missingVideo, 1);
  assert.equal(first.goalsPublished, 0);
  let state = await row("goal_media_sync_state");
  assert.equal(state.attempts, 1);
  assert.equal(state.goalsCovered, 1); // Pre-existing manually verified goal.
  assert.equal(state.nextRetryAt.toISOString(), new Date(clock + 3 * 3_600_000).toISOString());
  assert.deepEqual(await isolatedCounts(), { moments: 1, reviews: 0 });
  const noSpam = { ...requests };
  clock += 30 * 60_000;
  const early = await run({ dryRun: false, now: clock });
  assert.equal(early.due, 0);
  assert.deepEqual(requests, noSpam);
  assert.equal((await row("goal_media_sync_state")).attempts, 1);

  phase = "available";
  clock += 2 * 3_600_000 + 31 * 60_000;
  const preview = await run({ dryRun: true, now: clock });
  assert.equal(preview.status, "preview");
  assert.equal(preview.discovery.totals.acceptedGoals, 2);
  assert.equal(preview.discovery.totals.reviewGoals, 1);
  assert.deepEqual(await isolatedCounts(), { moments: 1, reviews: 0 }, "Dry-run must not publish or queue anything.");
  assert.equal((await row("goal_media_sync_state")).attempts, 1);
  const { previewDailyGoalImport, applyDailyGoalImport } = await import("../src/lib/providers/dailygoal/import.ts");
  await isolated.query('update media_item set "isOfficial" = false where id = $1', [ids.media]);
  const unattached = await previewDailyGoalImport(sourceUrl, 1);
  assert.equal(unattached.mediaItem, null);
  assert.equal((await applyDailyGoalImport(sourceUrl, 1, unattached)).applied.queued, 0);
  assert.deepEqual(await isolatedCounts(), { moments: 1, reviews: 0 }, "Missing official film should retry, not create review work.");
  await isolated.query('update media_item set "isOfficial" = true where id = $1', [ids.media]);
  const legacyMissingVideoCandidate = randomUUID();
  await isolated.query('insert into goal_timestamp_candidate (id, "clipUrl", "sourceUrl", "videoId", "matchId", "matchEventId", scorer, minute, "sourceSecond", "startSecond", confidence, reasons, "updatedAt") values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())',
    [legacyMissingVideoCandidate, `${sourceUrl}?i=2`, sourceUrl, videoId, ids.match, ids.yamalGoal, "Lamine Yamal", 55, 50, 49, "needs review", JSON.stringify(["The official video is not attached to this canonical fixture."])]);
  let officialFinished = false;
  const scheduled = await scheduledJob({ officialWorker: async () => { officialFinished = true; return officialOk(); },
    goalWorker: async (input) => { assert.equal(officialFinished, true, "Goal sync must follow official media sync."); return run(input); },
    goalEnabled: true, youtubeConfigured: true });
  assert.equal(scheduled.status, "completed");
  const available = scheduled.goalMedia.result;
  assert.equal(available.discovery.totals.acceptedGoals, 2);
  assert.equal(available.discovery.totals.reviewGoals, 1);
  assert.equal(available.goalsPublished, 1);
  assert.equal(available.goalsQueued, 1);
  const { getAdminSyncData } = await import("../src/lib/admin/sync.ts");
  const admin = await getAdminSyncData();
  assert.equal(admin.goalMedia.lastScheduledJob.goalStatus, "success");
  assert.equal(admin.goalMedia.lastScheduledJob.officialFailed, 0);
  assert.equal(admin.goalMedia.lastRun.goalsPublished, 1);
  assert.deepEqual(await isolatedCounts(), { moments: 2, reviews: 1 });
  const reconciled = (await isolated.query('select status, "reviewNote" from goal_timestamp_candidate where id = $1', [legacyMissingVideoCandidate])).rows[0];
  assert.equal(reconciled.status, "approved");
  assert.match(reconciled.reviewNote, /Automatically resolved/);
  state = await row("goal_media_sync_state");
  assert.equal(state.attempts, 2);
  assert.equal(state.goalsCovered, 2);
  assert.equal(state.reviewPending, 1);
  assert.equal(state.nextRetryAt.toISOString(), new Date(clock + 6 * 3_600_000).toISOString());
  const moments = (await isolated.query('select "matchEventId", "startSecond", "verificationBasis" from media_moment')).rows;
  assert.equal(moments.find((moment) => moment.matchEventId === ids.raphinhaGoal).startSecond, 33);
  assert.equal(moments.find((moment) => moment.matchEventId === ids.raphinhaGoal).verificationBasis, "manual_visual");
  assert.equal(moments.find((moment) => moment.matchEventId === ids.yamalGoal).startSecond, 49);
  const playable = selectPlayableGoals([
    { id: ids.raphinhaGoal, type: "goal" }, { id: ids.yamalGoal, type: "goal" }, { id: ids.visitorGoal, type: "goal" },
  ], await getMatchMedia(ids.match));
  assert.equal(playable.get(ids.raphinhaGoal).startSecond, 33);
  assert.equal(playable.get(ids.yamalGoal).startSecond, 49);
  assert.equal(playable.has(ids.visitorGoal), false);

  const afterPublish = { ...requests };
  clock += 60_000;
  assert.equal((await run({ dryRun: false, now: clock })).due, 0);
  assert.deepEqual(requests, afterPublish);
  assert.deepEqual(await isolatedCounts(), { moments: 2, reviews: 1 });

  phase = "wrong-score";
  clock += 6 * 3_600_000;
  const wrong = await run({ dryRun: false, now: clock });
  assert.equal(wrong.discovery.totals.rejected, 1);
  assert.deepEqual(await isolatedCounts(), { moments: 2, reviews: 1 });
  assert.equal((await row("goal_media_sync_state")).attempts, 3);

  phase = "unavailable";
  clock += 12 * 3_600_000;
  const failed = await run({ dryRun: false, now: clock });
  assert.equal(failed.status, "partial");
  assert.equal((await row("goal_media_sync_state")).attempts, 4);
  assert.equal((await row("goal_media_sync_state")).nextRetryAt.toISOString(), new Date(clock + 24 * 3_600_000).toISOString());

  phase = "rate-limited";
  clock += 24 * 3_600_000;
  const scheduledLimit = await scheduledJob({ officialWorker: officialOk, goalWorker: run, goalEnabled: true, youtubeConfigured: true });
  assert.equal(scheduledLimit.result.counts.failed, 0);
  const limited = scheduledLimit.goalMedia.result;
  assert.equal(limited.status, "blocked");
  assert.match((await getAdminSyncData()).goalMedia.lastScheduledJob.error, /403\/429/);
  const atBlock = { ...requests };
  assert.equal((await run({ dryRun: false, now: clock + 60_000 })).status, "blocked");
  assert.deepEqual(requests, atBlock);
  assert.deepEqual(await isolatedCounts(), { moments: 2, reviews: 1 });

  clock += 25 * 3_600_000;
  phase = "forbidden";
  assert.equal((await run({ dryRun: false, now: clock })).status, "blocked");
  const atForbidden = { ...requests };
  assert.equal((await run({ dryRun: false, now: clock + 60_000 })).status, "blocked");
  assert.deepEqual(requests, atForbidden);

  clock += 25 * 3_600_000;
  phase = "available";
  const recovered = await run({ dryRun: false, now: clock });
  assert.equal(recovered.goalsPublished, 0);
  assert.equal(recovered.goalsQueued, 0, "An existing review is not newly queued.");
  assert.deepEqual(await isolatedCounts(), { moments: 2, reviews: 1 });
  assert.equal((await isolated.query('select "startSecond" from media_moment where id = $1', [ids.manualMoment])).rows[0].startSecond, 33);

  clock += 48 * 3_600_000;
  phase = "listing-unavailable";
  await assert.rejects(run({ dryRun: false, now: clock }), /503/);
  assert.equal((await isolated.query('select status from goal_media_sync_run order by "startedAt" desc limit 1')).rows[0].status, "failed");
  const atListingFailure = { ...requests };
  assert.equal((await run({ dryRun: false, now: clock + 60_000 })).status, "retry-wait");
  assert.deepEqual(requests, atListingFailure);
  phase = "available";
  clock += 16 * 60_000;
  const afterListingRecovery = await run({ dryRun: false, now: clock });
  assert.equal(afterListingRecovery.status, "success");
  assert.equal(afterListingRecovery.goalsQueued, 0);
  assert.deepEqual(await isolatedCounts(), { moments: 2, reviews: 1 });
  delete process.env.FOOTBALL_DATA_API_KEY;
  process.env.INTERNAL_JOB_SECRET = "qa-only-secret";
  clock = Date.parse(kickoff) + 15 * 86_400_000;
  const authorized = await authenticatedJob(new Request("http://localhost/api/internal/jobs/match-media", { method: "POST", headers: { authorization: "Bearer qa-only-secret" } }));
  assert.equal(authorized.status, 200, "An authenticated request should run the job without source requests when no fixtures are due.");
  console.log(JSON.stringify({ result: "passed", scenarios: ["authenticated route rejects missing/wrong secret and accepts valid secret", "production dev-sync routes reject requests", "persisted fixture cooldown and 429 recovery", "fixture, goal-event, official-media, DailyGoal ordering", "fixture and goal failure isolation", "scheduled-job overlap lock", "Admin Sync job status", "newly finished fixture", "concurrent goal-run lock", "missing video and persisted backoff", "missing official film does not create reviews", "legacy machine review auto-reconciles", "no-spam repeat", "read-only dry-run", "later video and goal matching", "automatic publish and review", "Match Flow playback", "manual override", "wrong score", "match-page 503", "429 and 403 cooldown", "listing 503 cooldown and recovery", "recovery without duplicates"], requests, isolated: await isolatedCounts(), realBefore }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
  Date.now = originalNow;
  process.env.DATABASE_URL = originalDbUrl;
  if (originalYoutubeKey === undefined) delete process.env.YOUTUBE_API_KEY;
  else process.env.YOUTUBE_API_KEY = originalYoutubeKey;
  if (originalFootballKey === undefined) delete process.env.FOOTBALL_DATA_API_KEY;
  else process.env.FOOTBALL_DATA_API_KEY = originalFootballKey;
  if (originalScheduleFlag === undefined) delete process.env.GOAL_MEDIA_SCHEDULE_ENABLED;
  else process.env.GOAL_MEDIA_SCHEDULE_ENABLED = originalScheduleFlag;
  if (originalInternalSecret === undefined) delete process.env.INTERNAL_JOB_SECRET;
  else process.env.INTERNAL_JOB_SECRET = originalInternalSecret;
  if (isolatedConnected) await isolated.end();
  if (created) await real.query(`drop database "${databaseName}" with (force)`);
  if (realConnected) {
    const realAfter = await counts(real);
    if (realBefore) assert.deepEqual(realAfter, realBefore, "Real media moments or reviews changed during isolated QA.");
    if (protectedBefore) assert.deepEqual(await protectedMediaSnapshot(real), protectedBefore, "Real goal timestamps, manual corrections, or review decisions changed during isolated QA.");
    await real.end();
  }
}

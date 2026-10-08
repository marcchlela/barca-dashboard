#!/usr/bin/env node
// Curated, idempotent repair for two fixtures missing provider goal events and
// two publisher-labelled, single-goal video leads. Preview by default.
import "dotenv/config";
import "temporal-polyfill/full/global";
import postgres from "@prisma/orm-postgres/runtime";
import contractJson from "../src/prisma/contract.json" with { type: "json" };

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const write = process.argv.includes("--write");
const db = postgres({ contractJson, url: process.env.DATABASE_URL, verifyMarker: false });
const orm = db.orm.public;
const barcaId = "6cf324e6-c9bc-40a1-8436-88a5fa789ca0";
const fixtures = [
  {
    matchId: "7076e62a-85e4-444f-bd02-49f0a4400364",
    home: "Valencia CF", away: "FC Barcelona", score: [0, 5],
    sourceUrl: "https://www.laliga.com/en-NL/match/temporada-2026-2027-laliga-ea-sports-valencia-cf-fc-barcelona-4",
    goals: [
      [6, "Lamine Yamal", "Fermín López", "away", "goal"],
      [22, "Fermín López", "Anthony Gordon", "away", "goal"],
      [50, "Raphinha", "Fermín López", "away", "goal"],
      [79, "Pedri", "Dani Olmo", "away", "goal"],
      [84, "Lamine Yamal", "Dani Olmo", "away", "goal"],
    ],
  },
  {
    matchId: "ba66e397-b5bf-4d00-b80e-efa20f57b095",
    home: "Levante UD", away: "FC Barcelona", score: [2, 4],
    sourceUrl: "https://www.laliga.com/en-NL/match/temporada-2026-2027-laliga-ea-sports-levante-ud-fc-barcelona-5",
    goals: [
      [5, "Xavi Espart", "Raphinha", "away", "goal"],
      [19, "Lamine Yamal", "Raphinha", "away", "goal"],
      [48, "Lamine Yamal", null, "away", "penalty_goal"],
      [79, "Iván Romero", null, "home", "goal"],
      [88, "Roger Brugué", null, "home", "goal"],
      [93, "Karim Adeyemi", "Marc Bernal", "away", "goal"],
    ],
  },
];
const clips = [
  {
    matchId: fixtures[0].matchId, minute: 22, scorer: "Fermín López",
    title: "Fermín López makes it 0–2 at Valencia",
    url: "https://as.com/futbol/videos/un-gol-para-sembrar-el-panico-en-todo-el-planeta-futbol-lo-del-0-2-del-barca-rodri-incluido-fue-demasiado-f202609-v/",
    note: "AS single-goal page with a LaLiga player embed; page identifies the 0–2 move and Fermín finish. Playback frames not independently checked.",
  },
  {
    matchId: "38a5737e-f3a4-4d9b-99a3-017fbb89e967", minute: 8, scorer: "João Cancelo",
    title: "João Cancelo opens the scoring against Racing",
    url: "https://as.com/futbol/videos/cancelo-marca-el-posiblemente-mejor-gol-hasta-la-fecha-en-laliga-que-barbaridad-f202609-v/",
    note: "AS single-goal page with a LaLiga player embed; page identifies Cancelo's 1–0 shot. Playback frames not independently checked.",
  },
];

const [matches, players, sources] = await Promise.all([
  orm.Match.all(), orm.Player.all(), orm.DataSource.all(),
]);
const matchById = new Map(matches.map((row) => [row.id, row]));
const playerByName = new Map(players.map((row) => [row.displayName, row]));
let laliga = sources.find((row) => row.code === "LALIGA_MATCH_REPORT");
let as = sources.find((row) => row.code === "AS_LALIGA_VIDEO");
const changes = { goalsCreated: 0, goalsExisting: 0, clipsCreated: 0, clipsExisting: 0, unverifiedLinksRemoved: 0 };

for (const fixture of fixtures) {
  const match = matchById.get(fixture.matchId);
  if (!match || match.status !== "finished" || match.homeScore !== fixture.score[0] || match.awayScore !== fixture.score[1]
    || fixture.away !== "FC Barcelona" || match.awayTeamId !== barcaId) {
    throw new Error(`Fixture identity or score mismatch: ${fixture.home} v ${fixture.away}`);
  }
  const existing = await orm.MatchEvent.where({ matchId: fixture.matchId }).all();
  const existingGoals = existing.filter((row) => ["goal", "own_goal", "penalty_goal"].includes(row.type));
  if (existingGoals.length > 0 && existingGoals.length !== fixture.goals.length) {
    throw new Error(`Partial goal set for ${fixture.home}: ${existingGoals.length}/${fixture.goals.length}. Review manually.`);
  }
  const known = new Set(existingGoals.map((row) => `${row.minute}:${row.teamId}:${row.primaryPlayerId ?? row.rawData?.scorerName}`));
  for (const [index, [minute, scorer, assist, side, type]] of fixture.goals.entries()) {
    const teamId = side === "away" ? match.awayTeamId : match.homeTeamId;
    const scorerId = playerByName.get(scorer)?.id ?? null;
    const key = `${minute}:${teamId}:${scorerId ?? scorer}`;
    if (known.has(key)) { changes.goalsExisting++; continue; }
    if (existingGoals.length) throw new Error(`Conflicting goal at ${minute}' for ${fixture.home}.`);
    if (side === "away" && !scorerId) throw new Error(`Unresolved Barça scorer: ${scorer}`);
    const values = {
      matchId: match.id, teamId, primaryPlayerId: scorerId,
      relatedPlayerId: assist ? playerByName.get(assist)?.id ?? null : null,
      dataSourceId: laliga?.id ?? null, type, period: minute > 45 ? 2 : 1,
      minute, eventOrder: index + 1, outcome: "goal",
      sequenceId: `laliga-report:${match.id}:${minute}:${side}`,
      confidence: "manual_verified",
      rawData: { scorerName: scorer, assistName: assist, sourceUrl: fixture.sourceUrl,
        displayMinute: minute === 93 ? "90+3" : String(minute) },
    };
    if (write) {
      if (!laliga) {
        laliga = await orm.DataSource.create({ code: "LALIGA_MATCH_REPORT", name: "LaLiga match report", baseUrl: "https://www.laliga.com", isOfficial: true,
          licenseNotes: "Factual goal events manually transcribed from public match reports; no video copied." });
      }
      await orm.MatchEvent.create({ ...values, dataSourceId: laliga.id });
    }
    changes.goalsCreated++;
  }
}

// GOAL API called this a normal goal, but both clubs and LaLiga identify it as
// Villalibre's own goal. Keep its canonical ID and provider mapping intact.
const racingOwnGoal = await orm.MatchEvent.where({ id: "816cf71d-32b8-40e5-adc1-ee6189ac87b0" }).first();
const racingScorer = players.find((row) => row.id === racingOwnGoal?.primaryPlayerId)?.displayName;
if (!racingOwnGoal || racingOwnGoal.matchId !== "38a5737e-f3a4-4d9b-99a3-017fbb89e967"
  || racingOwnGoal.minute !== 36 || racingScorer !== "Asier Villalibre") throw new Error("Racing own-goal identity mismatch.");
if (racingOwnGoal.type !== "own_goal") {
  if (racingOwnGoal.type !== "goal") throw new Error("Unexpected Racing own-goal type.");
  if (write) await orm.MatchEvent.where({ id: racingOwnGoal.id }).update({ type: "own_goal", confidence: "manual_verified",
    rawData: { ...(racingOwnGoal.rawData ?? {}), correctionSourceUrl: "https://www.laliga.com/en-US/match/temporada-2026-2027-laliga-ea-sports-fc-barcelona-r-racing-club-6" } });
  console.log("Racing own-goal attribution corrected.");
}

for (const clip of clips) {
  const match = matchById.get(clip.matchId);
  if (!match || match.status !== "finished") throw new Error(`Invalid clip match: ${clip.url}`);
  const events = await orm.MatchEvent.where({ matchId: clip.matchId }).all();
  const event = events.find((row) => row.minute === clip.minute && playerByName.get(clip.scorer)?.id === row.primaryPlayerId
    && ["goal", "penalty_goal"].includes(row.type));
  if (!event) {
    if (write) throw new Error(`Missing exact goal event for ${clip.title}`);
    console.log(`Preview link pending event write: ${clip.title}`);
  }
  let media = (await orm.MediaItem.where({ url: clip.url }).all())[0];
  if (media && media.matchId !== clip.matchId) throw new Error(`Clip URL already assigned to another fixture: ${clip.url}`);
  if (!media) {
    if (write) {
      if (!as) as = await orm.DataSource.create({ code: "AS_LALIGA_VIDEO", name: "AS / LaLiga goal video", baseUrl: "https://as.com", isOfficial: false,
        licenseNotes: "Link to AS page containing a LaLiga-hosted clip. Video remains with publisher; no download or proxy." });
      media = await orm.MediaItem.create({ type: "goal_clip", title: clip.title, description: clip.note,
        url: clip.url, isOfficial: false, seasonId: match.seasonId, matchId: match.id,
        playerId: playerByName.get(clip.scorer)?.id ?? null, dataSourceId: as.id });
    }
    changes.clipsCreated++;
  } else {
    changes.clipsExisting++;
    if (write && media.description !== clip.note) await orm.MediaItem.where({ id: media.id }).update({ description: clip.note });
  }
  if (media && event) {
    const existingLink = await orm.MediaMoment.where({ mediaItemId: media.id, matchEventId: event.id }).first();
    if (existingLink && existingLink.evidenceUrl === clip.url) {
      if (write) await orm.MediaMoment.where({ id: existingLink.id }).delete();
      changes.unverifiedLinksRemoved++;
    }
  }
}
console.log(JSON.stringify({ mode: write ? "write" : "preview", ...changes }, null, 2));

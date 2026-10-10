/** Selective, read-only local export. No output file is written unless --out is supplied. */
import "dotenv/config";
import pg from "pg";
import path from "node:path";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { BUNDLE_VERSION, MAX_BUNDLE_BYTES, digestPayload, validateTransferPayload } from "./bundle.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const args = process.argv.slice(2);
const matchIds = [];
let currentSeason = false;
let withMoments = false;
let outputName = null;
for (let index = 0; index < args.length; index++) {
  const argument = args[index];
  if (argument === "--match") {
    const id = args[++index];
    if (!UUID.test(id ?? "")) throw new Error("--match requires a canonical match UUID.");
    matchIds.push(id);
  } else if (argument === "--current-season") currentSeason = true;
  else if (argument === "--with-moments") withMoments = true;
  else if (argument === "--out") {
    outputName = args[++index];
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,100}\.json$/.test(outputName ?? "")) throw new Error("--out must be a simple .json filename, not a path.");
  } else throw new Error(`Unknown argument ${argument}.`);
}
if (!matchIds.length && !currentSeason && !withMoments) throw new Error("Select --match UUID, --current-season, or --with-moments.");
const connection = new URL(process.env.DATABASE_URL ?? "");
if (!["localhost", "127.0.0.1", "[::1]"].includes(connection.hostname)) throw new Error("Local export refuses a non-loopback PostgreSQL host.");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
let payload;
try {
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await client.query("SET LOCAL statement_timeout = '15s'");
  const rows = async (sql, params = []) => (await client.query(sql, params)).rows;
  const matches = await rows(`SELECT m.id, m."seasonId", m."competitionId", m."homeTeamId", m."awayTeamId",
      m.kickoff, m.status, m.matchday, m.stage, m.round, m.leg, m."homeScore", m."awayScore"
    FROM football_match m JOIN season s ON s.id = m."seasonId"
    JOIN team h ON h.id = m."homeTeamId" JOIN team a ON a.id = m."awayTeamId"
    WHERE m.status = 'finished' AND (h."isBarcelona" OR a."isBarcelona") AND (
      m.id = ANY($1::uuid[]) OR ($2::boolean AND s."isCurrent") OR
      ($3::boolean AND EXISTS (SELECT 1 FROM match_event e JOIN media_moment mm ON mm."matchEventId" = e.id WHERE e."matchId" = m.id)))
    ORDER BY m.kickoff, m.id`, [matchIds, currentSeason, withMoments]);
  if (matchIds.some((id) => !matches.some((match) => match.id === id))) throw new Error("A requested match is missing, unfinished, or not a Barça fixture.");
  if (!matches.length || matches.length > 50) throw new Error(`Expected 1–50 selected fixtures, got ${matches.length}.`);
  const ids = matches.map((match) => match.id);
  const events = await rows(`SELECT id, "matchId", "teamId", "primaryPlayerId", "relatedPlayerId", "dataSourceId",
      type, period, minute, second, "eventOrder", "sequenceId", confidence, "rawData", "createdAt", "updatedAt"
    FROM match_event WHERE "matchId" = ANY($1::uuid[]) AND type IN ('goal','penalty_goal','own_goal')
    ORDER BY "matchId", "eventOrder" NULLS LAST, minute, id`, [ids]);
  const lineups = await rows(`SELECT id, "matchId", "teamId", formation, "coachName", "isConfirmed"
    FROM lineup WHERE "matchId" = ANY($1::uuid[]) ORDER BY "matchId", "teamId"`, [ids]);
  const lineupPlayers = await rows(`SELECT lp.id, lp."lineupId", lp."playerId", lp.role, lp."shirtNumber", lp.position,
      lp."lineupOrdinal", lp."positionX", lp."positionY", lp."enteredMinute", lp."leftMinute"
    FROM lineup_player lp JOIN lineup l ON l.id = lp."lineupId"
    WHERE l."matchId" = ANY($1::uuid[]) ORDER BY lp."lineupId", lp."lineupOrdinal" NULLS LAST, lp.id`, [ids]);
  const mediaItems = await rows(`SELECT mi.id, mi.type, mi.title, mi.description, mi.url, mi."externalMediaId",
      mi."thumbnailUrl", mi."isOfficial", mi."publishedAt", mi."seasonId", mi."matchId",
      mi."playerId", mi."dataSourceId"
    FROM media_item mi WHERE mi."matchId" = ANY($1::uuid[]) AND (
      EXISTS (SELECT 1 FROM media_moment mm WHERE mm."mediaItemId" = mi.id) OR
      EXISTS (SELECT 1 FROM goal_timestamp_candidate g WHERE g."mediaItemId" = mi.id))
    ORDER BY mi."matchId", mi.id`, [ids]);
  const moments = await rows(`SELECT mm.id, mm."mediaItemId", mm."matchEventId", mm."startSecond",
      mm."endSecond", mm."evidenceUrl", mm."reviewNote", mm."verificationBasis", mm."verifiedAt", mm."createdAt"
    FROM media_moment mm JOIN match_event e ON e.id = mm."matchEventId"
    WHERE e."matchId" = ANY($1::uuid[]) ORDER BY e."matchId", mm.id`, [ids]);
  const goalReviews = await rows(`SELECT id, "clipUrl", "sourceUrl", "videoId", "matchId", "mediaItemId",
      "matchEventId", scorer, minute, "sourceSecond", "startSecond", confidence, reasons, status,
      "reviewedAt", "reviewNote", "createdAt" FROM goal_timestamp_candidate
    WHERE "matchId" = ANY($1::uuid[]) ORDER BY "matchId", id`, [ids]);
  const playerIds = [...new Set([...events.flatMap((event) => [event.primaryPlayerId, event.relatedPlayerId]),
    ...lineupPlayers.map((entry) => entry.playerId), ...mediaItems.map((media) => media.playerId)].filter(Boolean))];
  const players = await rows(`SELECT id, "firstName", "lastName", "displayName", "birthDate", nationality,
      "primaryPosition", "preferredFoot", "portraitUrl", "isActive" FROM player WHERE id = ANY($1::uuid[]) ORDER BY id`, [playerIds]);
  const seasonIds = [...new Set([...matches.map((match) => match.seasonId), ...mediaItems.map((media) => media.seasonId)].filter(Boolean))];
  const seasons = await rows(`SELECT id, label, "startYear", "endYear", "isCurrent" FROM season WHERE id = ANY($1::uuid[]) ORDER BY id`, [seasonIds]);
  const competitionIds = [...new Set(matches.map((match) => match.competitionId))];
  const competitions = await rows(`SELECT id, code, name, "shortName", country FROM competition WHERE id = ANY($1::uuid[]) ORDER BY id`, [competitionIds]);
  const teamIds = [...new Set(matches.flatMap((match) => [match.homeTeamId, match.awayTeamId]))];
  const teams = await rows(`SELECT id, code, name, "shortName", country, "isBarcelona" FROM team WHERE id = ANY($1::uuid[]) ORDER BY id`, [teamIds]);
  const entityIds = [...new Set([...seasonIds, ...competitionIds, ...teamIds, ...playerIds, ...ids,
    ...events.map((event) => event.id), ...mediaItems.map((media) => media.id)])];
  const mappings = await rows(`SELECT id, "dataSourceId", "entityType", "internalId", "providerId", metadata
    FROM provider_mapping WHERE "internalId" = ANY($1::uuid[])
    AND "entityType" IN ('season','competition','team','player','match','event','media')
    ORDER BY "entityType", "internalId", "dataSourceId", "providerId"`, [entityIds]);
  const sourceIds = [...new Set([...events.map((event) => event.dataSourceId), ...mediaItems.map((media) => media.dataSourceId),
    ...mappings.map((mapping) => mapping.dataSourceId)].filter(Boolean))];
  const dataSources = await rows(`SELECT id, code, name, "isOfficial", "baseUrl" FROM data_source WHERE id = ANY($1::uuid[]) ORDER BY id`, [sourceIds]);
  await client.query("COMMIT");
  payload = JSON.parse(JSON.stringify({ version: BUNDLE_VERSION, generatedAt: new Date().toISOString(),
    scope: { currentSeason, withMoments, requestedMatchIds: matchIds }, seasons, competitions, teams, players,
    dataSources, matches, events, lineups, lineupPlayers, mediaItems, moments, goalReviews, mappings }));
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end();
}
const report = validateTransferPayload(payload);
const envelope = { payload, sha256: digestPayload(payload) };
const serialized = `${JSON.stringify(envelope, null, 2)}\n`;
if (Buffer.byteLength(serialized) > MAX_BUNDLE_BYTES) report.errors.push("Bundle exceeds the 10 MiB safety limit.");
if (/postgres(?:ql)?:\/\/|GOAL_API_KEY|YOUTUBE_API_KEY|Authorization\s*:\s*Bearer/i.test(serialized)) report.errors.push("Possible credential text detected in export; file was not written.");
console.log(JSON.stringify({ mode: outputName ? "export" : "read-only-preview", selectedMatches: payload.matches.map((match) => match.id),
  counts: report.counts, details: report.details, warnings: report.warnings, errors: report.errors,
  bytes: Buffer.byteLength(serialized), sha256: envelope.sha256 }, null, 2));
if (report.errors.length) process.exitCode = 1;
else if (outputName) {
  const outputDir = path.resolve(process.cwd(), ".artifacts", "goal-transfer");
  await mkdir(outputDir, { recursive: true });
  const workspace = await realpath(process.cwd());
  const safeDir = await realpath(outputDir);
  if (!safeDir.startsWith(`${workspace}${path.sep}`)) throw new Error("The export directory resolves outside the workspace.");
  const outputPath = path.join(safeDir, outputName);
  await writeFile(outputPath, serialized, { flag: "wx", mode: 0o600 });
  console.log(`Private transfer bundle written to ${outputPath}`);
}

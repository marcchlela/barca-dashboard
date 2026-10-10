import { createHash } from "node:crypto";

export const BUNDLE_VERSION = 1;
export const MAX_BUNDLE_BYTES = 10 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GOALS = new Set(["goal", "penalty_goal", "own_goal"]);
const BASES = new Set(["manual_visual", "dailygoal_metadata", "dailygoal_admin_review"]);

export function digestPayload(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function indexed(rows, label, errors) {
  if (!Array.isArray(rows)) {
    errors.push(`${label} must be an array.`);
    return new Map();
  }
  const result = new Map();
  for (const row of rows) {
    if (!row || !UUID.test(row.id ?? "")) {
      errors.push(`${label} contains a row without a valid UUID.`);
      continue;
    }
    if (result.has(row.id)) errors.push(`${label} repeats local ID ${row.id}.`);
    result.set(row.id, row);
  }
  return result;
}

/** Offline structural and relationship check; never resolves target database identities. */
export function validateTransferPayload(payload) {
  const errors = [];
  const warnings = [];
  if (!payload || payload.version !== BUNDLE_VERSION) errors.push(`Expected bundle version ${BUNDLE_VERSION}.`);
  if (!payload || typeof payload !== "object") return { errors, warnings, counts: {} };
  const keys = ["seasons", "competitions", "teams", "players", "dataSources", "matches", "events",
    "lineups", "lineupPlayers", "mediaItems", "moments", "goalReviews", "mappings"];
  const maps = Object.fromEntries(keys.map((key) => [key, indexed(payload[key], key, errors)]));
  const counts = Object.fromEntries(keys.map((key) => [key, maps[key].size]));
  if (!maps.matches.size) errors.push("The bundle contains no selected fixtures.");

  for (const season of maps.seasons.values()) {
    if (!season.label || typeof season.label !== "string") errors.push(`Season ${season.id} has no label.`);
  }
  for (const competition of maps.competitions.values()) {
    if (!competition.code || typeof competition.code !== "string") errors.push(`Competition ${competition.id} has no code.`);
  }
  for (const team of maps.teams.values()) {
    if (!team.code || !team.name) errors.push(`Team ${team.id} has no code or name.`);
  }
  for (const source of maps.dataSources.values()) {
    if (!source.code) errors.push(`Data source ${source.id} has no code.`);
  }
  for (const match of maps.matches.values()) {
    const home = maps.teams.get(match.homeTeamId);
    const away = maps.teams.get(match.awayTeamId);
    if (!maps.seasons.has(match.seasonId) || !maps.competitions.has(match.competitionId)) errors.push(`Match ${match.id} lacks season or competition.`);
    if (!home || !away || home.id === away.id || ![home.isBarcelona, away.isBarcelona].includes(true)) errors.push(`Match ${match.id} has invalid Barça/team identity.`);
    if (match.status !== "finished" || !Number.isInteger(match.homeScore) || !Number.isInteger(match.awayScore)) errors.push(`Match ${match.id} is not a scored finished fixture.`);
    if (!Number.isFinite(Date.parse(match.kickoff ?? ""))) errors.push(`Match ${match.id} has invalid kickoff.`);
  }
  for (const event of maps.events.values()) {
    const match = maps.matches.get(event.matchId);
    if (!match || !GOALS.has(event.type) || (event.teamId && ![match.homeTeamId, match.awayTeamId].includes(event.teamId))) errors.push(`Goal event ${event.id} has invalid fixture, type, or team.`);
    if (event.primaryPlayerId && !maps.players.has(event.primaryPlayerId)) errors.push(`Goal event ${event.id} has a missing scorer player.`);
    if (event.relatedPlayerId && !maps.players.has(event.relatedPlayerId)) errors.push(`Goal event ${event.id} has a missing related player.`);
    if (event.dataSourceId && !maps.dataSources.has(event.dataSourceId)) errors.push(`Goal event ${event.id} has a missing data source.`);
    if (!Number.isInteger(event.minute) || event.minute < 0) warnings.push(`Goal event ${event.id} has no usable minute; target matching will need review.`);
    if (!event.primaryPlayerId) warnings.push(`Goal event ${event.id} has no canonical scorer player.`);
  }
  for (const lineup of maps.lineups.values()) {
    const match = maps.matches.get(lineup.matchId);
    if (!match || ![match.homeTeamId, match.awayTeamId].includes(lineup.teamId)) errors.push(`Lineup ${lineup.id} has invalid fixture/team linkage.`);
    const entries = [...maps.lineupPlayers.values()].filter((entry) => entry.lineupId === lineup.id);
    if (lineup.isConfirmed && entries.filter((entry) => entry.role === "starter").length !== 11) errors.push(`Confirmed lineup ${lineup.id} does not have 11 starters.`);
    if (new Set(entries.map((entry) => entry.playerId)).size !== entries.length) errors.push(`Lineup ${lineup.id} repeats a player.`);
  }
  for (const entry of maps.lineupPlayers.values()) {
    if (!maps.lineups.has(entry.lineupId) || !maps.players.has(entry.playerId) || !["starter", "substitute"].includes(entry.role)) errors.push(`Lineup player ${entry.id} has an invalid reference or role.`);
  }
  for (const media of maps.mediaItems.values()) {
    if (!maps.matches.has(media.matchId) || media.playerId && !maps.players.has(media.playerId) || media.dataSourceId && !maps.dataSources.has(media.dataSourceId)) errors.push(`Media item ${media.id} has an invalid fixture, player, or source.`);
    try { if (new URL(media.url).protocol !== "https:") throw new Error(); }
    catch { errors.push(`Media item ${media.id} lacks a valid HTTPS URL.`); }
  }
  const momentPairs = new Set();
  for (const moment of maps.moments.values()) {
    const media = maps.mediaItems.get(moment.mediaItemId);
    const event = maps.events.get(moment.matchEventId);
    if (!media || !event || media.matchId !== event.matchId) errors.push(`Moment ${moment.id} has missing or cross-fixture media/event references.`);
    if (!BASES.has(moment.verificationBasis) || !Number.isFinite(Date.parse(moment.verifiedAt ?? ""))) errors.push(`Moment ${moment.id} has invalid verification provenance.`);
    const start = moment.startSecond === null && media?.type === "goal_clip" ? 0 : moment.startSecond;
    if (!Number.isInteger(start) || start < 0 || moment.endSecond !== null && (!Number.isInteger(moment.endSecond) || moment.endSecond <= start)) errors.push(`Moment ${moment.id} has invalid playback bounds.`);
    const pair = `${moment.mediaItemId}:${moment.matchEventId}`;
    if (momentPairs.has(pair)) errors.push(`Duplicate media/goal pair ${pair}.`);
    momentPairs.add(pair);
  }
  const clipUrls = new Set();
  for (const review of maps.goalReviews.values()) {
    if (!maps.matches.has(review.matchId) || review.mediaItemId && !maps.mediaItems.has(review.mediaItemId) || review.matchEventId && !maps.events.has(review.matchEventId)) errors.push(`Goal review ${review.id} has an invalid reference.`);
    if (!["pending", "approved", "rejected"].includes(review.status)) errors.push(`Goal review ${review.id} has an invalid status.`);
    if (clipUrls.has(review.clipUrl)) errors.push(`Goal review clip URL is repeated: ${review.clipUrl}`);
    clipUrls.add(review.clipUrl);
  }
  const entityMaps = { season: maps.seasons, competition: maps.competitions, team: maps.teams,
    player: maps.players, match: maps.matches, event: maps.events, media: maps.mediaItems };
  const providerKeys = new Set();
  for (const mapping of maps.mappings.values()) {
    const entity = entityMaps[mapping.entityType];
    if (!entity?.has(mapping.internalId) || !maps.dataSources.has(mapping.dataSourceId) || !mapping.providerId) errors.push(`Provider mapping ${mapping.id} has an invalid source/entity reference.`);
    const key = `${mapping.dataSourceId}:${mapping.entityType}:${mapping.providerId}`;
    if (providerKeys.has(key)) errors.push(`Duplicate provider identity ${key}.`);
    providerKeys.add(key);
  }
  for (const player of maps.players.values()) {
    if (!player.displayName) errors.push(`Player ${player.id} has no name.`);
    if (![...maps.mappings.values()].some((mapping) => mapping.entityType === "player" && mapping.internalId === player.id)) warnings.push(`Player ${player.id} has no provider identity; target resolution must be manual.`);
  }
  const byValue = (rows, key) => Object.fromEntries([...new Set(rows.map((row) => String(row[key])))]
    .sort().map((value) => [value, rows.filter((row) => String(row[key]) === value).length]));
  return { errors, warnings, counts, details: {
    eventConfidence: byValue([...maps.events.values()], "confidence"),
    verificationBasis: byValue([...maps.moments.values()], "verificationBasis"),
    reviewStatus: byValue([...maps.goalReviews.values()], "status"),
    confirmedLineups: [...maps.lineups.values()].filter((row) => row.isConfirmed).length,
    sourcedManualEvents: [...maps.events.values()].filter((event) => event.confidence === "manual_verified" &&
      (event.rawData?.correctionSourceUrl || event.rawData?.sourceUrl))
      .map((event) => ({ matchId: event.matchId, minute: event.minute, type: event.type,
        scorer: maps.players.get(event.primaryPlayerId)?.displayName ?? null })),
  } };
}

export function validateTransferEnvelope(envelope) {
  const errors = [];
  if (!envelope || typeof envelope !== "object" || !envelope.payload || typeof envelope.sha256 !== "string") errors.push("Invalid transfer envelope.");
  if (!errors.length && digestPayload(envelope.payload) !== envelope.sha256) errors.push("Bundle SHA-256 does not match its payload.");
  const report = validateTransferPayload(envelope?.payload);
  return { ...report, errors: [...errors, ...report.errors] };
}

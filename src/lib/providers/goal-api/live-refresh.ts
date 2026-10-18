import "server-only";

import { Temporal } from "temporal-polyfill";
import { db } from "../../../prisma/db";
import { asArray, asObject, type JsonObject } from "../shared/json";
import { normalizeGoalStatistics, goalCandidate } from "./normalize";
import { GoalApiClient, GoalApiHttpError } from "./client";
import { goalFixtureListingPath } from "./fixture-search-path";
import { fetchHighlightlyLiveBundle } from "../highlightly/live";
import type { GoalTeamStatistic } from "./types";
import { liveEventSemanticKey, liveEventsLikelySame } from "../shared/live-event-identity";
import { matchTeamIdentity, type MatchIdentityInput } from "../shared/match-identity";
import {
  liveFixtureMatches,
  finishedCoverageIncomplete,
  liveRetryDelayMs,
  normalizeLiveEvents,
  normalizeLivePeriod,
  normalizeLiveSubstitutions,
  normalizeLiveStatus,
  postMatchPollDelayMs,
  shouldFetchLiveStatistics,
  liveStatisticsAreCoherent,
} from "./live-refresh-core";

const RUN_MODE = "live-match-sync";
const LOCK_KEY = "scheduled-live-match-sync";
const LEASE_MS = 2 * 60_000;
const MATCH_WINDOW_BEFORE_MS = 10 * 60_000;
const MATCH_WINDOW_AFTER_MS = 24 * 60 * 60_000;
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type TeamName = { id: string; name: string; isBarcelona: boolean };

function instant(value = Date.now()) {
  return Temporal.Instant.from(new Date(value).toISOString());
}

function personKey(value: string | null | undefined) {
  return value?.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() ?? "";
}

function rawName(value: unknown, field: string) {
  const data = asObject(value);
  return typeof data?.[field] === "string" ? data[field] as string : null;
}

function matchStatusForWrite(current: string, incoming: string | null) {
  if (!incoming) return null;
  if (current === "finished" && incoming !== "finished") return null;
  if (current === "cancelled" || current === "abandoned" || current === "postponed") return null;
  return incoming;
}

async function getGoalDataSource() {
  const existing = await db.orm.public.DataSource.where({ code: "goal-api" }).first();
  if (existing) return existing;
  return db.orm.public.DataSource.create({
    code: "goal-api",
    name: "GOAL API",
    baseUrl: "https://api.goal-api.com/v1",
    isOfficial: false,
    isEnabled: true,
    licenseNotes: "Licensed third-party football data; usage is subject to GOAL API terms.",
  });
}

async function getHighlightlyDataSource() {
  const existing = await db.orm.public.DataSource.where({ code: "highlightly" }).first();
  if (existing) return existing;
  return db.orm.public.DataSource.create({
    code: "highlightly",
    name: "Highlightly",
    baseUrl: "https://soccer.highlightly.net",
    isOfficial: false,
    isEnabled: true,
    licenseNotes: "Licensed third-party football data; usage is subject to Highlightly terms.",
  });
}

async function boundedCanonicalFixture(now: number) {
  const season = await db.orm.public.Season.where({ isCurrent: true }).first();
  if (!season) return { status: "no-current-season" as const, match: null };
  const matches = await db.orm.public.Match.where({ seasonId: season.id })
    .include("homeTeam").include("awayTeam").include("competition")
    .orderBy((match) => match.kickoff.asc()).all();
  const candidates = matches.filter((match) => {
    if (!match.homeTeam.isBarcelona && !match.awayTeam.isBarcelona) return false;
    if (!["scheduled", "live", "halftime", "extra_time", "penalties"].includes(match.status)) return false;
    const kickoff = Date.parse(match.kickoff.toString());
    return kickoff <= now + MATCH_WINDOW_BEFORE_MS && kickoff >= now - MATCH_WINDOW_AFTER_MS;
  });
  if (candidates.length > 1) return { status: "ambiguous-canonical-fixtures" as const, match: null };
  if (candidates.length) return { status: "candidate" as const, match: candidates[0] };

  // A delayed provider can publish goals and statistics after the canonical
  // fixture has already reached full time. Catch up only incomplete recent games.
  const recentFinished = matches.filter((match) => {
    if (match.status !== "finished" || (!match.homeTeam.isBarcelona && !match.awayTeam.isBarcelona)) return false;
    const age = now - Date.parse(match.kickoff.toString());
    return age >= 0 && age <= MATCH_WINDOW_AFTER_MS;
  });
  for (const match of recentFinished.reverse()) {
    const [events, statistics] = await Promise.all([
      db.orm.public.MatchEvent.where({ matchId: match.id }).all(),
      db.orm.public.MatchStatistic.where({ matchId: match.id }).all(),
    ]);
    const goals = events.filter((event) => ["goal", "penalty_goal", "own_goal"].includes(event.type)).length;
    if (finishedCoverageIncomplete({ kickoff: match.kickoff.toString(), now, homeScore: match.homeScore, awayScore: match.awayScore, goalCount: goals, statisticSides: statistics.length })) {
      return { status: "candidate" as const, match };
    }
  }
  return { status: "no-fixture-in-live-window" as const, match: null };
}

function makeIdentity(match: {
  kickoff: { toString(): string };
  homeTeam: TeamName;
  awayTeam: TeamName;
  competition: { name: string };
}, candidate: ReturnType<typeof goalCandidate>) {
  if (!candidate) return false;
  return liveFixtureMatches({
    canonical: {
      kickoff: match.kickoff.toString(),
      home: match.homeTeam.name,
      away: match.awayTeam.name,
      competition: match.competition.name,
    },
    provider: {
      kickoff: candidate.kickoff,
      home: candidate.homeTeam,
      away: candidate.awayTeam,
      competition: candidate.competition,
    },
  });
}

function makeMappedIdentity(match: Parameters<typeof makeIdentity>[0], candidate: ReturnType<typeof goalCandidate>) {
  if (!candidate) return false;
  return liveFixtureMatches({
    canonical: {
      kickoff: match.kickoff.toString(),
      home: match.homeTeam.name,
      away: match.awayTeam.name,
      competition: match.competition.name,
    },
    provider: {
      kickoff: candidate.kickoff,
      home: candidate.homeTeam,
      away: candidate.awayTeam,
      // Some GOAL detail responses omit the league even though the dated
      // listing and stored mapping identified it. Teams + kickoff remain hard
      // requirements; a conflicting supplied competition still fails.
      competition: candidate.competition ?? match.competition.name,
    },
  });
}

async function findLiveFixture(client: GoalApiClient, match: NonNullable<Awaited<ReturnType<typeof boundedCanonicalFixture>>["match"]>) {
  const source = await db.orm.public.DataSource.where({ code: "goal-api" }).first();
  const mapped = source ? await db.orm.public.ProviderMapping.where({ dataSourceId: source.id, entityType: "match", internalId: match.id }).first() : null;
  if (mapped) {
    try {
      const body = await client.get(`/fixtures/${encodeURIComponent(mapped.providerId)}`);
      const detail = asObject(body.data);
      const candidate = goalCandidate(detail);
      if (detail && makeMappedIdentity(match, candidate)) {
        return { providerId: mapped.providerId, body, detail };
      }
      // A provider can recycle or mutate an ID. Treat the mapping as stale and
      // safely resolve the fixture again from immutable facts below.
    } catch (error) {
      if (error instanceof GoalApiHttpError && [403, 429].includes(error.status)) throw error;
      // Missing or malformed mapped details are recoverable through the live
      // and dated listings below.
    }
  }
  const body = await client.get("/fixtures/live");
  const rows = asArray(body.data, "fixtures", "matches");
  const matches = rows.flatMap((value) => {
    const detail = asObject(value);
    const candidate = goalCandidate(detail);
    if (!detail || !candidate?.providerMatchId || !makeIdentity(match, candidate)) return [];
    return [{ providerId: candidate.providerMatchId, body: { data: detail }, detail }];
  });
  if (matches.length > 1) throw new Error("More than one live GOAL fixture matched the canonical Barça fixture; refusing to choose.");
  if (matches.length) return matches[0];

  // The dated listing may include the fixture even when /fixtures/live does not.
  const date = match.kickoff.toString().slice(0, 10);
  const listing = await client.get(goalFixtureListingPath(match.competition.name, date, 0));
  const listed = asArray(listing.data).flatMap((value) => {
    const detail = asObject(value);
    const candidate = goalCandidate(detail);
    return detail && candidate?.providerMatchId && makeIdentity(match, candidate)
      ? [{ providerId: candidate.providerMatchId }] : [];
  });
  if (listed.length > 1) throw new Error("More than one dated GOAL fixture matched the canonical Barça fixture.");
  if (!listed.length) return null;
  const detailBody = await client.get(`/fixtures/${encodeURIComponent(listed[0].providerId)}`);
  const detail = asObject(detailBody.data);
  if (!detail || !makeIdentity(match, goalCandidate(detail))) throw new Error("Dated GOAL fixture detail failed identity validation.");
  return { providerId: listed[0].providerId, body: detailBody, detail };
}

async function ensureMatchMapping(sourceId: string, matchId: string, providerId: string) {
  const providerMapping = await db.orm.public.ProviderMapping.where({ dataSourceId: sourceId, entityType: "match", providerId }).first();
  if (providerMapping) {
    if (providerMapping.internalId !== matchId) throw new Error("Provider match mapping collision; canonical match was not modified.");
    return;
  }
  const canonicalMapping = await db.orm.public.ProviderMapping.where({ dataSourceId: sourceId, entityType: "match", internalId: matchId }).first();
  if (canonicalMapping) {
    await db.orm.public.ProviderMapping.where({ id: canonicalMapping.id }).update({
      providerId,
      metadata: { ownership: ["live_status", "live_events", "live_team_statistics"], reboundAfterIdentityCheck: true },
    });
    return;
  }
  await db.orm.public.ProviderMapping.create({ dataSourceId: sourceId, entityType: "match", internalId: matchId, providerId, metadata: { ownership: ["live_status", "live_events", "live_team_statistics"] } });
}

async function resolveLineupPlayers(matchId: string) {
  const lineups = await db.orm.public.Lineup.where({ matchId }).all();
  const result: Array<{ teamId: string; playerId: string; name: string; entryId: string; role: string }> = [];
  for (const lineup of lineups) {
    const entries = await db.orm.public.LineupPlayer.where({ lineupId: lineup.id }).include("player").all();
    for (const entry of entries) result.push({
      teamId: lineup.teamId,
      playerId: entry.playerId,
      name: entry.player.displayName,
      entryId: entry.id,
      role: entry.role,
    });
  }
  return result;
}

function resolvePlayer(name: string | null, preferredTeamId: string, allPlayers: Array<{ teamId: string; playerId: string; name: string; entryId: string; role: string }>, allowOtherTeam = false) {
  if (!name) return null;
  const normalized = personKey(name);
  const candidates = allPlayers.filter((player) => personKey(player.name) === normalized && (allowOtherTeam || player.teamId === preferredTeamId));
  if (candidates.length === 1) return candidates[0];
  const parts = normalized.split(" ").filter(Boolean);
  if (parts.length < 2 || parts[0].length !== 1) return null;
  const abbreviated = allPlayers.filter((player) => {
    if (!allowOtherTeam && player.teamId !== preferredTeamId) return false;
    const candidate = personKey(player.name).split(" ").filter(Boolean);
    return candidate.length >= 2 && candidate[0].startsWith(parts[0]) && candidate.at(-1) === parts.at(-1);
  });
  return abbreviated.length === 1 ? abbreviated[0] : null;
}

function storedEventSemanticKey(event: {
  type: string;
  teamId: string | null;
  primaryPlayerId: string | null;
  relatedPlayerId: string | null;
  minute: number | null;
  rawData: unknown;
}) {
  const raw = asObject(event.rawData);
  return typeof raw?.semanticKey === "string" ? raw.semanticKey : liveEventSemanticKey({
    type: event.type,
    teamId: event.teamId,
    minute: event.minute,
    primaryPlayerId: event.primaryPlayerId,
    relatedPlayerId: event.relatedPlayerId,
    primaryName: rawName(event.rawData, event.type === "substitution" ? "offName" : "scorerName"),
    relatedName: rawName(event.rawData, event.type === "substitution" ? "onName" : "assistName"),
  });
}

async function persistSubstitutionMinutes(
  minute: number | null,
  off: { entryId: string } | null,
  on: { entryId: string } | null,
) {
  if (minute === null) return;
  if (off) await db.orm.public.LineupPlayer.where({ id: off.entryId }).update({ leftMinute: minute });
  if (on) await db.orm.public.LineupPlayer.where({ id: on.entryId }).update({ enteredMinute: minute });
}

async function upsertLiveEvent(input: {
  sourceId: string;
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  event: ReturnType<typeof normalizeLiveEvents>[number];
  players: Array<{ teamId: string; playerId: string; name: string; entryId: string; role: string }>;
  existingEvents: Array<{ id: string; matchId: string; type: string; teamId: string | null; primaryPlayerId: string | null; relatedPlayerId: string | null; minute: number | null; confidence: string; dataSourceId: string | null; rawData: unknown; outcome: string | null }>;
  sourceCode: string;
}) {
  const { event } = input;
  const teamId = event.side === "home" ? input.homeTeamId : input.awayTeamId;
  const scorer = resolvePlayer(event.scorerName, teamId, input.players, event.type === "own_goal");
  const assist = resolvePlayer(event.assistName, teamId, input.players);
  const mapping = await db.orm.public.ProviderMapping.where({ dataSourceId: input.sourceId, entityType: "event", providerId: event.providerId }).first();
  if (mapping && input.existingEvents.some((row) => row.id === mapping.internalId && row.matchId !== input.matchId)) {
    throw new Error(`GOAL event mapping collision for provider event ${event.providerId}.`);
  }
  const mappedEvent = mapping ? input.existingEvents.find((row) => row.id === mapping.internalId) : undefined;
  if (mapping && !mappedEvent) throw new Error(`GOAL event mapping ${event.providerId} points to a missing event.`);
  const goalTypes = new Set(["goal", "own_goal", "penalty_goal"]);
  const storedType: "goal" | "own_goal" | "penalty_goal" | "missed_penalty" | "yellow_card" | "red_card" | "substitution" | "other" =
    event.type === "penalty_awarded" || event.type === "var_overturned" ? "other" : event.type;
  const semanticKey = liveEventSemanticKey({
    type: event.type,
    teamId,
    minute: event.minute,
    primaryPlayerId: scorer?.playerId,
    relatedPlayerId: assist?.playerId,
    primaryName: event.scorerName,
    relatedName: event.assistName,
  });
  const semanticMatches = input.existingEvents.filter((row) => storedEventSemanticKey(row) === semanticKey);
  const correctedMatches = input.existingEvents.filter((row) => liveEventsLikelySame({
    type: event.type,
    teamId,
    minute: event.minute,
    primaryPlayerId: scorer?.playerId,
    relatedPlayerId: assist?.playerId,
    primaryName: event.scorerName,
    relatedName: event.assistName,
  }, {
    type: row.type,
    teamId: row.teamId,
    minute: row.minute,
    primaryPlayerId: row.primaryPlayerId,
    relatedPlayerId: row.relatedPlayerId,
    primaryName: rawName(row.rawData, row.type === "substitution" ? "offName" : "scorerName"),
    relatedName: rawName(row.rawData, row.type === "substitution" ? "onName" : "assistName"),
  }));
  const nearby = mappedEvent ? [mappedEvent] : semanticMatches.length ? semanticMatches : correctedMatches.length ? correctedMatches : input.existingEvents.filter((row) =>
    storedType !== "other" && row.teamId === teamId && row.minute === event.minute &&
    (row.type === storedType || (goalTypes.has(row.type) && goalTypes.has(storedType))) &&
    (event.type === "substitution"
      ? personKey(rawName(row.rawData, "offName")) === personKey(event.scorerName) &&
        personKey(rawName(row.rawData, "onName")) === personKey(event.assistName) &&
        Boolean(event.scorerName && event.assistName)
      : Boolean(scorer && row.primaryPlayerId === scorer.playerId)));
  if (nearby.length > 1) return "ambiguous" as const;
  const existing = nearby[0];
  if (existing && existing.matchId !== input.matchId) throw new Error("Matched event belongs to another fixture.");
  if (existing?.confidence === "manual_verified" || (existing && existing.dataSourceId !== input.sourceId)) {
    if (!mapping) await db.orm.public.ProviderMapping.create({ dataSourceId: input.sourceId, entityType: "event", internalId: existing.id, providerId: event.providerId, metadata: { liveImport: true } });
    if (event.type === "substitution") await persistSubstitutionMinutes(event.minute, scorer, assist);
    return "preserved" as const;
  }
  const data = {
    matchId: input.matchId,
    teamId,
    primaryPlayerId: scorer?.playerId ?? null,
    relatedPlayerId: assist?.playerId ?? null,
    dataSourceId: input.sourceId,
    type: storedType,
    period: event.period ?? (event.minute !== null && event.minute > 45 ? 2 : 1),
    minute: event.minute,
    second: null,
    eventOrder: event.order,
    xG: null,
    outcome: goalTypes.has(event.type) ? "goal" : event.type === "var_overturned" ? "goal_overturned" : null,
    sequenceId: `${input.sourceCode}-live:${event.providerId}`,
    coordinateSystem: null,
    confidence: "exact_provider" as const,
    rawData: {
      providerEventId: event.providerId,
      notificationType: event.type === "penalty_awarded" || event.type === "var_overturned" ? event.type : null,
      scorerName: event.type === "substitution" ? null : event.scorerName,
      assistName: event.type === "substitution" ? null : event.assistName,
      offName: event.type === "substitution" ? event.scorerName : null,
      onName: event.type === "substitution" ? event.assistName : null,
      providerPlayerId: event.providerPlayerId,
      semanticKey,
      liveImport: true,
      sourcePayload: JSON.parse(JSON.stringify(event.raw)) as JsonValue,
    } as JsonValue,
  };
  let storedId = existing?.id;
  let changed = false;
  if (existing) {
    changed = existing.type !== data.type || existing.teamId !== data.teamId ||
      existing.primaryPlayerId !== data.primaryPlayerId || existing.relatedPlayerId !== data.relatedPlayerId ||
      existing.minute !== data.minute || existing.outcome !== data.outcome ||
      personKey(rawName(existing.rawData, existing.type === "substitution" ? "offName" : "scorerName")) !==
        personKey(event.scorerName) ||
      personKey(rawName(existing.rawData, existing.type === "substitution" ? "onName" : "assistName")) !==
        personKey(event.assistName);
    if (changed) {
      await db.orm.public.MatchEvent.where({ id: existing.id }).update(data);
      Object.assign(existing, data);
    }
  }
  else {
    const created = await db.orm.public.MatchEvent.create(data);
    storedId = created.id;
    input.existingEvents.push({ id: created.id, type: storedType, teamId, primaryPlayerId: scorer?.playerId ?? null, relatedPlayerId: assist?.playerId ?? null, minute: event.minute, confidence: "exact_provider", dataSourceId: input.sourceId, rawData: data.rawData, matchId: input.matchId, outcome: data.outcome });
  }
  if (mapping) {
    if (mapping.internalId !== storedId) throw new Error("Provider event identity changed; preserving existing mapping.");
  } else {
    await db.orm.public.ProviderMapping.create({ dataSourceId: input.sourceId, entityType: "event", internalId: storedId!, providerId: event.providerId, metadata: { liveImport: true } });
  }
  if (event.type === "substitution") await persistSubstitutionMinutes(event.minute, scorer, assist);
  if (event.type === "var_overturned") {
    const candidates = input.existingEvents.filter((row) => goalTypes.has(row.type) && row.teamId === teamId && row.outcome !== "goal_overturned" &&
      row.minute !== null && event.minute !== null && row.minute <= event.minute && event.minute - row.minute <= 8)
      .sort((left, right) => (right.minute ?? -1) - (left.minute ?? -1));
    const target = candidates.find((row) => !event.scorerName || row.primaryPlayerId === scorer?.playerId ||
      personKey(rawName(row.rawData, "scorerName")) === personKey(event.scorerName)) ?? candidates[0];
    if (target) {
      const raw = { ...(asObject(target.rawData) ?? {}), overturned: true, overturnedByEventId: storedId } as JsonValue;
      await db.orm.public.MatchEvent.where({ id: target.id }).update({ outcome: "goal_overturned", rawData: raw });
      target.outcome = "goal_overturned";
      target.rawData = raw;
    }
  }
  return existing ? (changed ? "updated" as const : "preserved" as const) : "created" as const;
}

async function storeNormalizedStatistics(input: {
  sourceId: string;
  matchId: string;
  rows: Array<{ teamId: string; stats: GoalTeamStatistic }>;
}) {
  let saved = 0;
  let protectedRows = 0;
  let unchanged = 0;
  let rejected = 0;
  for (const { teamId, stats } of input.rows) {
    if (!liveStatisticsAreCoherent(stats)) {
      rejected += 1;
      continue;
    }
    const data = {
      possession: stats.possession,
      shots: stats.shots,
      shotsOnTarget: stats.shotsOnTarget,
      shotsOffTarget: stats.shotsOffTarget,
      blockedShots: stats.blockedShots,
      shotsInsideBox: stats.shotsInsideBox,
      shotsOutsideBox: stats.shotsOutsideBox,
      passes: stats.passes,
      completedPasses: stats.completedPasses,
      passAccuracy: stats.passAccuracy,
      corners: stats.corners,
      fouls: stats.fouls,
      offsides: stats.offsides,
      yellowCards: stats.yellowCards,
      redCards: stats.redCards,
      saves: stats.saves,
      attacks: stats.attacks,
      dangerousAttacks: stats.dangerousAttacks,
      freeKicks: stats.freeKicks,
      goalKicks: stats.goalKicks,
      throwIns: stats.throwIns,
      substitutions: stats.substitutions,
      rawData: stats.raw,
    };
    if (!Object.entries(data).some(([key, value]) => key !== "rawData" && value !== null)) continue;
    const existing = await db.orm.public.MatchStatistic.where({ matchId: input.matchId, teamId }).first();
    if (existing && existing.dataSourceId !== input.sourceId) {
      protectedRows += 1;
      continue;
    }
    if (!existing) await db.orm.public.MatchStatistic.create({ matchId: input.matchId, teamId, dataSourceId: input.sourceId, ...data });
    else {
      const update = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value === null ? existing[key as keyof typeof existing] : value]));
      const changed = Object.entries(update).some(([key, value]) => key !== "rawData" && existing[key as keyof typeof existing] !== value);
      if (!changed) {
        unchanged += 1;
        continue;
      }
      await db.orm.public.MatchStatistic.where({ id: existing.id }).update(update);
    }
    saved += 1;
  }
  return { saved, protectedRows, unchanged, rejected };
}

async function storeStatistics(input: { sourceId: string; matchId: string; homeTeamId: string; awayTeamId: string; body: JsonObject }) {
  const normalized = normalizeGoalStatistics(input.body);
  return storeNormalizedStatistics({
    sourceId: input.sourceId,
    matchId: input.matchId,
    rows: [
      { teamId: input.homeTeamId, stats: normalized.home },
      { teamId: input.awayTeamId, stats: normalized.away },
    ],
  });
}

function consecutiveFailures(result: unknown) {
  const data = asObject(result);
  const value = data?.consecutiveFailures;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function canonicalIdentity(match: {
  kickoff: { toString(): string };
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: TeamName;
  awayTeam: TeamName;
  competition: { name: string };
}, providerIds: Record<string, string>): MatchIdentityInput {
  return {
    kickoff: match.kickoff.toString(),
    competition: { name: match.competition.name },
    homeTeam: { name: match.homeTeam.name },
    awayTeam: { name: match.awayTeam.name },
    score: { home: match.homeScore, away: match.awayScore },
    providerIds,
  };
}

async function applyHighlightlyFallback(
  match: NonNullable<Awaited<ReturnType<typeof boundedCanonicalFixture>>["match"]>,
  now: number,
) {
  const source = await getHighlightlyDataSource();
  const mapping = await db.orm.public.ProviderMapping.where({
    dataSourceId: source.id,
    entityType: "match",
    internalId: match.id,
  }).first();
  const bundle = await fetchHighlightlyLiveBundle(
    canonicalIdentity(match, mapping ? { highlightly: mapping.providerId } : {}),
    mapping?.providerId,
  );
  await ensureMatchMapping(source.id, match.id, bundle.providerMatchId);
  const matchUpdate: Record<string, unknown> = {};
  const status = matchStatusForWrite(match.status, bundle.status);
  if (status && status !== match.status) matchUpdate.status = status;
  if (bundle.candidate.homeScore !== null && bundle.candidate.homeScore !== match.homeScore) matchUpdate.homeScore = bundle.candidate.homeScore;
  if (bundle.candidate.awayScore !== null && bundle.candidate.awayScore !== match.awayScore) matchUpdate.awayScore = bundle.candidate.awayScore;
  if (Object.keys(matchUpdate).length) await db.orm.public.Match.where({ id: match.id }).update(matchUpdate);

  const [players, existingEvents] = await Promise.all([
    resolveLineupPlayers(match.id),
    db.orm.public.MatchEvent.where({ matchId: match.id }).all(),
  ]);
  let created = 0, updated = 0, preserved = 0, ambiguous = 0;
  for (const event of bundle.events) {
    const stored = await upsertLiveEvent({
      sourceId: source.id,
      sourceCode: "highlightly",
      matchId: match.id,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      event,
      players,
      existingEvents,
    });
    if (stored === "created") created += 1;
    else if (stored === "updated") updated += 1;
    else if (stored === "preserved") preserved += 1;
    else ambiguous += 1;
  }
  const statisticRows = bundle.statisticRows.flatMap(({ teamName, stat }) => {
    if (!teamName) return [];
    if (matchTeamIdentity(teamName, match.homeTeam.name).matched) return [{ teamId: match.homeTeamId, stats: stat }];
    if (matchTeamIdentity(teamName, match.awayTeam.name).matched) return [{ teamId: match.awayTeamId, stats: stat }];
    return [];
  });
  const stats = await storeNormalizedStatistics({ sourceId: source.id, matchId: match.id, rows: statisticRows });
  return {
    fallbackProvider: "highlightly",
    providerStatus: bundle.status,
    providerPeriod: bundle.period,
    eventStatus: "success",
    statisticsStatus: stats.rejected ? "stale-protected" : "success",
    eventsCreated: created,
    eventsUpdated: updated,
    eventsPreserved: preserved,
    eventsAmbiguous: ambiguous,
    statsSaved: stats.saved,
    statsProtected: stats.protectedRows,
    statsRejected: stats.rejected,
    statsFetchedAt: new Date(now).toISOString(),
    requests: bundle.requestCount,
  };
}

export async function runLiveMatchRefresh(input: { now?: number; client?: GoalApiClient } = {}) {
  if (process.env.LIVE_MATCH_SYNC_ENABLED !== "true") return { status: "disabled" as const };
  if (!process.env.GOAL_API_KEY && !process.env.HIGHLIGHTLY_API_KEY && !input.client) {
    return { status: "unconfigured" as const, error: "GOAL_API_KEY or HIGHLIGHTLY_API_KEY must be configured." };
  }
  const now = input.now ?? Date.now();
  const selected = await boundedCanonicalFixture(now);
  if (!selected.match) return { status: selected.status, matchId: null };
  const match = selected.match;
  const latest = await db.orm.public.GoalMediaSyncRun.where({ mode: RUN_MODE }).orderBy((run) => run.startedAt.desc()).first();
  const latestResult = asObject(latest?.result);
  const sameMatch = latestResult?.matchId === match.id;
  const failures = sameMatch ? consecutiveFailures(latestResult) : 0;
  if (sameMatch && latest?.finishedAt) {
    const persistedRetryAt = typeof latestResult?.retryAt === "string" ? Date.parse(latestResult.retryAt) : NaN;
    if (Number.isFinite(persistedRetryAt) && now < persistedRetryAt) {
      return { status: "cooldown" as const, matchId: match.id, nextAt: new Date(persistedRetryAt).toISOString() };
    }
    const postMatchDelay = postMatchPollDelayMs(match.status, match.kickoff.toString(), now);
    if (postMatchDelay && now < Date.parse(latest.finishedAt.toString()) + postMatchDelay) {
      return { status: "cooldown" as const, matchId: match.id, nextAt: new Date(Date.parse(latest.finishedAt.toString()) + postMatchDelay).toISOString() };
    }
    const delay = liveRetryDelayMs({ status: latest.status, consecutiveFailures: failures, error: latest.error });
    if (delay && now < Date.parse(latest.finishedAt.toString()) + delay) {
      return { status: "cooldown" as const, matchId: match.id, nextAt: new Date(Date.parse(latest.finishedAt.toString()) + delay).toISOString() };
    }
    if (latestResult?.status === "no-provider-live-fixture") {
      const checks = typeof latestResult.notLiveChecks === "number" ? latestResult.notLiveChecks : 1;
      const noLiveDelay = Math.min(10, 2 ** Math.max(0, checks - 1)) * 60_000;
      if (now < Date.parse(latest.finishedAt.toString()) + noLiveDelay) {
        return { status: "cooldown" as const, matchId: match.id, nextAt: new Date(Date.parse(latest.finishedAt.toString()) + noLiveDelay).toISOString() };
      }
    }
  }
  const active = await db.orm.public.GoalMediaSyncRun.where({ lockKey: LOCK_KEY }).first();
  if (active && now - Date.parse(active.startedAt.toString()) < LEASE_MS) return { status: "already-running" as const, matchId: match.id };
  if (active) await db.orm.public.GoalMediaSyncRun.where({ id: active.id }).update({ lockKey: null, status: "interrupted", finishedAt: instant(now), error: "Live-match poll exceeded its two-minute lease." });
  let run;
  try {
    run = await db.orm.public.GoalMediaSyncRun.create({ lockKey: LOCK_KEY, mode: RUN_MODE, status: "running", startedAt: instant(now) });
  } catch {
    return { status: "already-running" as const, matchId: match.id };
  }
  const client = input.client ?? (process.env.GOAL_API_KEY ? new GoalApiClient() : null);
  const result: Record<string, unknown> = {
    matchId: match.id,
    eventStatus: "pending",
    statisticsStatus: "skipped",
    eventsCreated: 0,
    eventsUpdated: 0,
    eventsPreserved: 0,
    eventsAmbiguous: 0,
    statsSaved: 0,
    statsProtected: 0,
    statsRejected: 0,
    requests: 0,
    statsFetchedAt: sameMatch && typeof latestResult?.statsFetchedAt === "string" ? latestResult.statsFetchedAt : null,
    substitutionsFetchedAt: sameMatch && typeof latestResult?.substitutionsFetchedAt === "string" ? latestResult.substitutionsFetchedAt : null,
    notLiveChecks: sameMatch && typeof latestResult?.notLiveChecks === "number" ? latestResult.notLiveChecks : 0,
  };
  try {
    if (!client) throw new Error("GOAL_API_KEY is unavailable; using Highlightly live fallback.");
    const fixture = await findLiveFixture(client, match);
    if (!fixture) {
      const notLiveChecks = Number(result.notLiveChecks) + 1;
      await db.orm.public.GoalMediaSyncRun.where({ id: run.id }).update({ lockKey: null, status: "success", finishedAt: instant(), fixturesChecked: 1, result: { ...result, status: "no-provider-live-fixture", notLiveChecks, requests: client.requestCount } });
      return { status: "no-provider-live-fixture" as const, matchId: match.id };
    }
    const fixtureCandidate = goalCandidate(fixture.detail);
    if (!makeIdentity(match, fixtureCandidate)) throw new Error("Live fixture detail failed immutable identity validation.");
    const source = await getGoalDataSource();
    await ensureMatchMapping(source.id, match.id, fixture.providerId);
    const status = normalizeLiveStatus(fixture.detail);
    if (!status) {
      const notLiveChecks = Number(result.notLiveChecks) + 1;
      await db.orm.public.GoalMediaSyncRun.where({ id: run.id }).update({ lockKey: null, status: "success", finishedAt: instant(), fixturesChecked: 1, result: { ...result, status: "no-provider-live-fixture", notLiveChecks, requests: client.requestCount } });
      return { status: "no-provider-live-fixture" as const, matchId: match.id };
    }
    const newStatus = matchStatusForWrite(match.status, status);
    const homeScore = fixtureCandidate?.homeScore;
    const awayScore = fixtureCandidate?.awayScore;
    const matchUpdate: Record<string, unknown> = {};
    if (newStatus && newStatus !== match.status) matchUpdate.status = newStatus;
    if (homeScore !== null && homeScore !== undefined && homeScore !== match.homeScore) matchUpdate.homeScore = homeScore;
    if (awayScore !== null && awayScore !== undefined && awayScore !== match.awayScore) matchUpdate.awayScore = awayScore;
    if (Object.keys(matchUpdate).length) await db.orm.public.Match.where({ id: match.id }).update(matchUpdate);

    const eventBody = await client.get(`/fixtures/${encodeURIComponent(fixture.providerId)}/events`);
    const cardBody = await client.get(`/fixtures/${encodeURIComponent(fixture.providerId)}/cards`);
    const previousSubstitutionsAt = typeof result.substitutionsFetchedAt === "string" ? result.substitutionsFetchedAt : null;
    const substitutionBody = shouldFetchLiveStatistics(previousSubstitutionsAt, now)
      ? await client.get(`/fixtures/${encodeURIComponent(fixture.providerId)}/substitutions`)
      : null;
    if (substitutionBody) result.substitutionsFetchedAt = new Date(now).toISOString();
    const liveEvents = [...new Map([
      ...normalizeLiveEvents(eventBody, match.homeTeam.name, match.awayTeam.name),
      ...normalizeLiveEvents(cardBody, match.homeTeam.name, match.awayTeam.name),
      ...(substitutionBody ? normalizeLiveSubstitutions(substitutionBody) : []),
    ].map((event) => [event.providerId, event] as const)).values()];
    const [players, existingEvents] = await Promise.all([
      resolveLineupPlayers(match.id),
      db.orm.public.MatchEvent.where({ matchId: match.id }).all(),
    ]);
    let created = 0, updated = 0, preserved = 0, ambiguous = 0;
    for (const event of liveEvents) {
      const stored = await upsertLiveEvent({ sourceId: source.id, sourceCode: "goal-api", matchId: match.id, homeTeamId: match.homeTeamId, awayTeamId: match.awayTeamId, event, players, existingEvents });
      if (stored === "created") created += 1;
      else if (stored === "updated") updated += 1;
      else if (stored === "preserved") preserved += 1;
      else ambiguous += 1;
    }
    result.eventStatus = "success";
    result.eventsCreated = created;
    result.eventsUpdated = updated;
    result.eventsPreserved = preserved;
    result.eventsAmbiguous = ambiguous;
    result.providerStatus = status;
    result.providerPeriod = normalizeLivePeriod(fixture.detail);

    const previousStatsAt = typeof result.statsFetchedAt === "string" ? result.statsFetchedAt : null;
    if (shouldFetchLiveStatistics(previousStatsAt, now)) {
      const statisticsBody = await client.get(`/fixtures/${encodeURIComponent(fixture.providerId)}/statistics`);
      const stats = await storeStatistics({ sourceId: source.id, matchId: match.id, homeTeamId: match.homeTeamId, awayTeamId: match.awayTeamId, body: statisticsBody });
      result.statisticsStatus = "success";
      result.statsSaved = stats.saved;
      result.statsProtected = stats.protectedRows;
      result.statsRejected = stats.rejected;
      if (stats.rejected) result.statisticsStatus = "stale-protected";
      result.statsFetchedAt = new Date(now).toISOString();
    } else {
      result.statsFetchedAt = previousStatsAt;
    }
    result.requests = client.requestCount;
    const partial = ambiguous > 0 || result.eventStatus !== "success" || result.statisticsStatus === "failed";
    const finalResult = { ...result, consecutiveFailures: 0 };
    await db.orm.public.GoalMediaSyncRun.where({ id: run.id }).update({ lockKey: null, status: partial ? "partial" : "success", finishedAt: instant(), fixturesChecked: 1, result: finalResult });
    return { status: partial ? "partial" as const : "success" as const, ...finalResult };
  } catch (error) {
    let message = error instanceof Error ? error.message : String(error);
    if (process.env.HIGHLIGHTLY_API_KEY) {
      try {
        const fallback = await applyHighlightlyFallback(match, now);
        const finalResult = {
          ...result,
          ...fallback,
          matchId: match.id,
          primaryProviderError: message.slice(0, 500),
          consecutiveFailures: 0,
        };
        await db.orm.public.GoalMediaSyncRun.where({ id: run.id }).update({
          lockKey: null,
          status: "success",
          finishedAt: instant(),
          fixturesChecked: 1,
          result: finalResult,
          error: null,
        });
        return { status: "success" as const, ...finalResult };
      } catch (fallbackError) {
        message = `${message} | Highlightly fallback failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`;
      }
    }
    const blocked = /\b(?:403|429)\b/.test(message);
    const failedCount = failures + 1;
    const recommendedDelay = liveRetryDelayMs({ status: blocked ? "blocked" : "failed", consecutiveFailures: failedCount, error: message });
    const providerDelay = error instanceof GoalApiHttpError ? error.retryAfterMs : null;
    const finalResult = { ...result, requests: client?.requestCount ?? 0, consecutiveFailures: failedCount, retryAt: new Date(now + Math.max(recommendedDelay, providerDelay ?? 0)).toISOString() };
    await db.orm.public.GoalMediaSyncRun.where({ id: run.id }).update({ lockKey: null, status: blocked ? "blocked" : "failed", finishedAt: instant(), fixturesChecked: 1, result: finalResult, error: message.slice(0, 500) });
    return { status: blocked ? "blocked" as const : "failed" as const, matchId: match.id, error: message.slice(0, 500), retryAt: finalResult.retryAt };
  }
}

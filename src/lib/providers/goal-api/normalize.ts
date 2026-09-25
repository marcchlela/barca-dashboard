import {
  asArray,
  asObject,
  nestedScalar,
  numberValue,
  stringValue,
  type JsonObject,
} from "../shared/json";
import { normalizeFormation } from "../shared/formation-layout";
import { repairMojibake } from "../shared/normalization";

import type {
  GoalLineupPlayer,
  GoalLineupSide,
  GoalMatchBundle,
  GoalPlayerPosition,
  GoalScoringEvent,
  GoalTeamStatistic,
} from "./types";

function nestedName(value: unknown) {
  return stringValue(asObject(value), "name", "displayName", "display_name");
}

export function goalCandidate(value: unknown) {
  const row = asObject(value);
  if (!row) return null;
  const kickoff = stringValue(row, "kickoffUtc", "kickoff_utc");
  const home = asObject(row.homeTeam) ?? asObject(row.home);
  const away = asObject(row.awayTeam) ?? asObject(row.away);
  return {
    providerMatchId: stringValue(row, "id", "apiId"),
    kickoff,
    calendarDate: kickoff?.slice(0, 10) ?? stringValue(row, "matchDate", "date"),
    localTime: null,
    temporalPrecision: kickoff ? ("exact" as const) : ("date_only" as const),
    homeTeam:
      nestedName(home) ?? stringValue(row, "homeTeamName", "home_team_name") ?? "",
    awayTeam:
      nestedName(away) ?? stringValue(row, "awayTeamName", "away_team_name") ?? "",
    homeScore:
      numberValue(row, "homeTeamFtScore", "homeTeamScore", "home_score") ??
      numberValue(asObject(row.score), "home"),
    awayScore:
      numberValue(row, "awayTeamFtScore", "awayTeamScore", "away_score") ??
      numberValue(asObject(row.score), "away"),
    competition:
      nestedName(row.league) ??
      stringValue(row, "leagueName", "league_name", "competition"),
  };
}

function playerPosition(value: string | null): GoalPlayerPosition {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized.includes("goal")) return "goalkeeper";
  if (normalized.includes("def")) return "defender";
  if (normalized.includes("mid")) return "midfielder";
  if (normalized.includes("for") || normalized.includes("attack")) return "forward";
  return "unknown";
}

function lineupPlayer(value: unknown, role: GoalLineupPlayer["role"]): GoalLineupPlayer {
  const row = asObject(value);
  const providerId = stringValue(row, "playerId", "player_id", "id");
  const rawName = stringValue(row, "lineupPlayer", "playerName", "player_name", "name");
  const name = rawName ? repairMojibake(rawName) : null;
  if (!providerId || !name) {
    throw new Error(`GOAL ${role} is missing a stable player ID or name.`);
  }
  const broadPosition = stringValue(row, "playerPosition", "player_position");
  return {
    providerId,
    legacyEventKey: stringValue(row, "playerKey", "player_key"),
    name,
    shirtNumber: numberValue(row, "lineupNumber", "shirt_number", "number"),
    matchPosition:
      stringValue(row, "positionName", "position_name", "matchPosition") ??
      broadPosition,
    primaryPosition: playerPosition(broadPosition),
    lineupOrdinal: numberValue(row, "lineupPosition", "lineup_position", "ordinal"),
    role,
    imageUrl: stringValue(row, "playerImage", "player_image", "image", "image_url"),
  };
}

function teamIdentity(detail: JsonObject, side: "home" | "away") {
  const direct = asObject(detail[`${side}Team`]) ?? asObject(detail[side]);
  const providerTeamId = stringValue(direct, "id", "apiId", "teamId", "team_id");
  const rawTeamName = nestedName(direct) ?? stringValue(detail, `${side}TeamName`);
  const teamName = rawTeamName ? repairMojibake(rawTeamName) : null;
  if (!providerTeamId || !teamName) {
    throw new Error(`GOAL detail is missing ${side} team identity.`);
  }
  return { providerTeamId, teamName };
}

function coachName(value: unknown) {
  const first = asObject(asArray(value)[0]);
  const name = stringValue(first, "lineupPlayer", "name", "coachName", "coach_name");
  return name ? repairMojibake(name) : null;
}

function lineupSide(
  detail: JsonObject,
  data: JsonObject,
  side: "home" | "away",
): GoalLineupSide {
  const object = asObject(data[side]);
  const starters = asArray(object?.startingLineups).map((row) =>
    lineupPlayer(row, "starter"),
  );
  const substitutes = asArray(object?.substitutes).map((row) =>
    lineupPlayer(row, "substitute"),
  );
  if (starters.length !== 11) {
    throw new Error(`GOAL returned ${starters.length} ${side} starters; expected 11.`);
  }
  return {
    ...teamIdentity(detail, side),
    formation: normalizeFormation(stringValue(data, `${side}Formation`)),
    coachName: coachName(object?.coach),
    players: [...starters, ...substitutes],
  };
}

function normalizeEvent(value: unknown): GoalScoringEvent | null {
  const row = asObject(value);
  const providerId = stringValue(row, "id", "apiId", "eventId", "event_id");
  if (!row || !providerId) return null;
  const typeText = [
    stringValue(row, "type", "eventType", "event_type"),
    stringValue(row, "info", "description", "detail"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!typeText.includes("goal")) return null;
  const side =
    stringValue(row, "homeScorer", "home_scorer") ||
    stringValue(row, "homeScorerId", "home_scorer_id")
      ? "home"
      : "away";
  const prefix = side === "home" ? "home" : "away";
  const type = typeText.includes("own goal")
    ? "own_goal"
    : typeText.includes("penalt")
      ? "penalty_goal"
      : "goal";
  return {
    providerId,
    minute: numberValue(row, "timeNum", "minute", "elapsed", "time"),
    scorerProviderKey: stringValue(
      row,
      `${prefix}ScorerId`,
      `${prefix}_scorer_id`,
      "scorerId",
      "scorer_id",
    ),
    scorerName: (() => {
      const name = stringValue(row, `${prefix}Scorer`, `${prefix}_scorer`, "scorer");
      return name ? repairMojibake(name) : null;
    })(),
    assistProviderKey: stringValue(
      row,
      `${prefix}AssistId`,
      `${prefix}_assist_id`,
      "assistId",
      "assist_id",
    ),
    assistName: (() => {
      const name = stringValue(row, `${prefix}Assist`, `${prefix}_assist`, "assist");
      return name ? repairMojibake(name) : null;
    })(),
    side,
    type,
    homeScore: numberValue(row, "homeScore", "home_score"),
    awayScore: numberValue(row, "awayScore", "away_score"),
  };
}

function labelKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function statisticValue(row: JsonObject, side: "home" | "away") {
  const keys = [
    side,
    `${side}Value`,
    `${side}_value`,
    `${side}Team`,
    `${side}_team`,
  ];
  for (const key of keys) {
    const value = nestedScalar(row[key]);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.replace(/%/g, "").trim());
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function emptyTeamStatistic(
  raw: Record<string, { home: number | null; away: number | null }>,
): GoalTeamStatistic {
  return {
    possession: null,
    shots: null,
    shotsOnTarget: null,
    shotsOffTarget: null,
    blockedShots: null,
    shotsInsideBox: null,
    shotsOutsideBox: null,
    passes: null,
    completedPasses: null,
    passAccuracy: null,
    corners: null,
    fouls: null,
    offsides: null,
    yellowCards: null,
    redCards: null,
    saves: null,
    attacks: null,
    dangerousAttacks: null,
    freeKicks: null,
    goalKicks: null,
    throwIns: null,
    substitutions: null,
    raw,
  };
}

function normalizeStatistics(value: JsonObject) {
  const data = asObject(value.data);
  const match = asObject(data?.match);
  const rows = asArray(match?.fullTime)
    .map(asObject)
    .filter((row): row is JsonObject => row !== null);
  const raw: Record<string, { home: number | null; away: number | null }> = {};
  for (const row of rows) {
    const label = stringValue(row, "type", "name", "label", "statName", "statistic");
    if (!label) continue;
    raw[labelKey(label)] = {
      home: statisticValue(row, "home"),
      away: statisticValue(row, "away"),
    };
  }

  const home = emptyTeamStatistic(raw);
  const away = emptyTeamStatistic(raw);
  const aliases: Array<[keyof GoalTeamStatistic, string[]]> = [
    ["possession", ["ball possession", "possession"]],
    ["shots", ["shots total", "total shots"]],
    ["shotsOnTarget", ["on target", "shots on goal", "shots on target"]],
    ["shotsOffTarget", ["shots off goal", "shots off target", "off target"]],
    ["blockedShots", ["shots blocked", "blocked shots"]],
    ["shotsInsideBox", ["shots inside box"]],
    ["shotsOutsideBox", ["shots outside box"]],
    ["passes", ["passes total", "total passes"]],
    ["completedPasses", ["passes accurate", "accurate passes"]],
    ["corners", ["corners", "corner kicks"]],
    ["fouls", ["fouls"]],
    ["offsides", ["offsides"]],
    ["yellowCards", ["yellow cards"]],
    ["redCards", ["red cards"]],
    ["saves", ["saves"]],
    ["attacks", ["attacks"]],
    ["dangerousAttacks", ["dangerous attacks"]],
    ["freeKicks", ["free kick", "free kicks"]],
    ["goalKicks", ["goal kick", "goal kicks"]],
    ["throwIns", ["throw in", "throw ins"]],
    ["substitutions", ["substitution", "substitutions"]],
  ];
  for (const [field, names] of aliases) {
    const found = names.map((name) => raw[name]).find(Boolean);
    if (!found) continue;
    (home[field] as number | null) = found.home;
    (away[field] as number | null) = found.away;
  }
  if (home.possession !== null) home.possession /= 100;
  if (away.possession !== null) away.possession /= 100;
  if (home.passes && home.completedPasses !== null) {
    home.passAccuracy = home.completedPasses / home.passes;
  }
  if (away.passes && away.completedPasses !== null) {
    away.passAccuracy = away.completedPasses / away.passes;
  }
  return { home, away };
}

export function normalizeGoalBundle(input: {
  providerMatchId: string;
  detailBody: JsonObject;
  lineupBody: JsonObject;
  eventBody: JsonObject;
  statisticsBody: JsonObject;
  requestCount: number;
}): GoalMatchBundle {
  const detail = asObject(input.detailBody.data);
  if (!detail) throw new Error("GOAL detail response did not contain a match object.");
  const candidate = goalCandidate(detail);
  if (!candidate) throw new Error("GOAL detail could not be normalized.");
  const lineupData = asObject(input.lineupBody.data);
  if (!lineupData) throw new Error("GOAL lineup response did not contain lineup data.");
  const events = asArray(input.eventBody.data, "events", "items")
    .map(normalizeEvent)
    .filter((event): event is GoalScoringEvent => event !== null)
    .sort((left, right) => (left.minute ?? 999) - (right.minute ?? 999));

  return {
    requestCount: input.requestCount,
    providerMatchId: input.providerMatchId,
    candidate: {
      kickoff: candidate.kickoff,
      calendarDate: candidate.calendarDate,
      homeTeam: candidate.homeTeam,
      awayTeam: candidate.awayTeam,
      homeScore: candidate.homeScore,
      awayScore: candidate.awayScore,
      competition: candidate.competition,
    },
    home: lineupSide(detail, lineupData, "home"),
    away: lineupSide(detail, lineupData, "away"),
    events,
    statistics: normalizeStatistics(input.statisticsBody),
  };
}

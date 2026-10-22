import { asArray, asObject, numberValue, stringValue, type JsonObject } from "../shared/json";
import { normalizeFormation } from "../shared/formation-layout";
import { repairMojibake } from "../shared/normalization";
import type { MatchIdentityCandidate } from "../shared/match-identity";
import type { GoalLineupPlayer, GoalLineupSide, GoalPlayerPosition } from "../goal-api/types";
import type { GoalTeamStatistic } from "../goal-api/types";
import type { LiveEventCandidate, LiveMatchStatus } from "../goal-api/live-refresh-core";

export function highlightlyCandidate(value: unknown): MatchIdentityCandidate | null {
  const row = asObject(value);
  const home = asObject(row?.homeTeam);
  const away = asObject(row?.awayTeam);
  const league = asObject(row?.league);
  const state = asObject(row?.state);
  const score = asObject(state?.score);
  const providerMatchId = stringValue(row, "id");
  const kickoff = stringValue(row, "date");
  const homeTeam = stringValue(home, "name");
  const awayTeam = stringValue(away, "name");
  if (!providerMatchId || !kickoff || !homeTeam || !awayTeam) return null;
  const currentScore = stringValue(score, "current")?.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
  return {
    providerMatchId,
    kickoff,
    calendarDate: kickoff.slice(0, 10),
    localTime: null,
    temporalPrecision: "exact",
    homeTeam: repairMojibake(homeTeam),
    awayTeam: repairMojibake(awayTeam),
    homeScore: currentScore ? Number(currentScore[1]) : null,
    awayScore: currentScore ? Number(currentScore[2]) : null,
    competition: stringValue(league, "name"),
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

function lineupPlayer(
  value: unknown,
  role: GoalLineupPlayer["role"],
  lineupOrdinal: number | null,
): GoalLineupPlayer {
  const row = asObject(value);
  const providerId = stringValue(row, "id");
  const rawName = stringValue(row, "name");
  const position = stringValue(row, "position");
  if (!providerId || !rawName) {
    throw new Error(`Highlightly ${role} is missing a stable player ID or name.`);
  }
  return {
    providerId,
    legacyEventKey: null,
    name: repairMojibake(rawName),
    shirtNumber: numberValue(row, "number"),
    matchPosition: position,
    primaryPosition: playerPosition(position),
    lineupOrdinal,
    role,
    imageUrl: stringValue(row, "image", "imageUrl", "logo"),
  };
}

function substitutePlayer(value: unknown): GoalLineupPlayer | null {
  const row = asObject(value);
  // Highlightly occasionally includes an empty/placeholder substitute entry.
  // A malformed optional bench row must not discard two otherwise complete
  // confirmed starting XIs. Starters remain strict below.
  if (!stringValue(row, "id") || !stringValue(row, "name")) return null;
  return lineupPlayer(value, "substitute", null);
}

function lineupSide(value: unknown, side: "home" | "away"): GoalLineupSide {
  const row = asObject(value);
  const providerTeamId = stringValue(row, "id");
  const rawName = stringValue(row, "name");
  if (!providerTeamId || !rawName) {
    throw new Error(`Highlightly lineup response is missing ${side} team identity.`);
  }
  const starters = asArray(row?.initialLineup)
    .flatMap((line) => asArray(line))
    .map((player, index) => lineupPlayer(player, "starter", index + 1));
  const substitutes = asArray(row?.substitutes)
    .flatMap((player) => {
      const normalized = substitutePlayer(player);
      return normalized ? [normalized] : [];
    });
  if (starters.length !== 11) {
    throw new Error(`Highlightly returned ${starters.length} ${side} starters; expected 11.`);
  }
  const coach = asObject(row?.coach);
  return {
    providerTeamId,
    teamName: repairMojibake(rawName),
    formation: normalizeFormation(stringValue(row, "formation")),
    coachName: stringValue(coach, "name"),
    players: [...starters, ...substitutes],
  };
}

export function normalizeHighlightlyLineups(value: JsonObject) {
  return {
    home: lineupSide(value.homeTeam, "home"),
    away: lineupSide(value.awayTeam, "away"),
  };
}

function eventMinute(value: string | null) {
  if (!value) return null;
  const parts = value.match(/^(\d+)(?:\+(\d+))?$/);
  return parts ? Number(parts[1]) + Number(parts[2] ?? 0) : null;
}

export function normalizeHighlightlyLiveStatus(value: JsonObject): LiveMatchStatus | null {
  const state = asObject(value.state);
  const description = stringValue(state, "description")?.toLowerCase() ?? "";
  if (/finished|full.?time|after extra time|penalties/.test(description)) return "finished";
  if (/half.?time|interval/.test(description)) return "halftime";
  if (/extra time/.test(description)) return "extra_time";
  if (/penalt/.test(description)) return "penalties";
  if (/live|progress|first half|second half/.test(description)) return "live";
  return null;
}

export function normalizeHighlightlyLivePeriod(value: JsonObject): 1 | 2 | null {
  const description = stringValue(asObject(value.state), "description")?.toLowerCase() ?? "";
  if (/second half|2nd half/.test(description)) return 2;
  if (/first half|1st half/.test(description)) return 1;
  return null;
}

export function normalizeHighlightlyLiveEvents(
  value: JsonObject,
  homeName: string,
  awayName: string,
): LiveEventCandidate[] {
  return asArray(value.events).map(asObject).filter((row): row is JsonObject => Boolean(row)).flatMap((row, index) => {
    const team = asObject(row.team);
    const teamName = stringValue(team, "name");
    const teamToken = teamName?.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() ?? "";
    const homeToken = homeName.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/^fc\s+/, "").trim();
    const awayToken = awayName.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/^fc\s+/, "").trim();
    const matches = (left: string, right: string) => left === right || left.includes(right) || right.includes(left);
    const side = matches(teamToken, homeToken) ? "home" : matches(teamToken, awayToken) ? "away" : null;
    if (!side) return [];
    const rawType = stringValue(row, "type")?.toLowerCase() ?? "";
    let type: LiveEventCandidate["type"] | null = null;
    if (rawType.includes("var goal cancelled")) type = "var_overturned";
    else if (rawType.includes("var penalty") && !rawType.includes("cancelled")) type = "penalty_awarded";
    else if (rawType.includes("missed penalty")) type = "missed_penalty";
    else if (rawType.includes("own goal")) type = "own_goal";
    else if (rawType === "penalty") type = "penalty_goal";
    else if (rawType === "goal") type = "goal";
    else if (rawType.includes("red card")) type = "red_card";
    else if (rawType.includes("yellow card")) type = "yellow_card";
    else if (rawType.includes("substitution")) type = "substitution";
    if (!type) return [];
    const player = stringValue(row, "player");
    const substitute = stringValue(row, "substituted");
    const assist = stringValue(row, "assist");
    const time = stringValue(row, "time");
    const providerId = [
      "highlightly",
      stringValue(team, "id") ?? teamName,
      rawType,
      time,
      stringValue(row, "playerId") ?? player,
      stringValue(row, "assistingPlayerId") ?? assist ?? substitute,
    ].join(":");
    return [{
      providerId,
      order: index + 1,
      type,
      minute: eventMinute(time),
      period: eventMinute(time) !== null && eventMinute(time)! > 45 ? 2 : 1,
      side,
      scorerName: player ? repairMojibake(player) : null,
      assistName: type === "substitution"
        ? (substitute ? repairMojibake(substitute) : null)
        : (assist ? repairMojibake(assist) : null),
      providerPlayerId: stringValue(row, "playerId"),
      // Highlightly event rows do not expose a reliable cumulative score.
      // Keep goal identity strict for this feed rather than risking a false merge.
      score: null,
      raw: row,
    }];
  });
}

function emptyStatistic(raw: Record<string, { home: number | null; away: number | null }>): GoalTeamStatistic {
  return {
    possession: null, shots: null, shotsOnTarget: null, shotsOffTarget: null,
    blockedShots: null, shotsInsideBox: null, shotsOutsideBox: null,
    passes: null, completedPasses: null, passAccuracy: null, corners: null,
    fouls: null, offsides: null, yellowCards: null, redCards: null, saves: null,
    attacks: null, dangerousAttacks: null, freeKicks: null, goalKicks: null,
    throwIns: null, substitutions: null, raw,
  };
}

export function normalizeHighlightlyStatistics(value: JsonObject) {
  const sides = asArray(value.statistics).map(asObject).filter((row): row is JsonObject => Boolean(row));
  const normalized = sides.map((side) => {
    const entries = asArray(side.statistics).map(asObject).filter((row): row is JsonObject => Boolean(row));
    const values = Object.fromEntries(entries.map((row) => [
      stringValue(row, "displayName")?.toLowerCase() ?? "unknown",
      numberValue(row, "value"),
    ])) as Record<string, number | null>;
    const raw = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { home: value, away: null }]));
    const stat = emptyStatistic(raw);
    const aliases: Array<[keyof GoalTeamStatistic, string[]]> = [
      ["possession", ["ball possession", "possession"]], ["shots", ["total shots", "shots"]],
      ["shotsOnTarget", ["shots on target", "shots on goal"]], ["shotsOffTarget", ["shots off target", "shots off goal"]],
      ["blockedShots", ["blocked shots"]], ["shotsInsideBox", ["shots inside box"]],
      ["shotsOutsideBox", ["shots outside box"]], ["passes", ["total passes", "passes"]],
      ["completedPasses", ["accurate passes", "completed passes"]], ["corners", ["corner kicks", "corners"]],
      ["fouls", ["fouls"]], ["offsides", ["offsides"]], ["yellowCards", ["yellow cards"]],
      ["redCards", ["red cards"]], ["saves", ["goalkeeper saves", "saves"]], ["freeKicks", ["free kicks"]],
      ["goalKicks", ["goal kicks"]], ["throwIns", ["throw ins"]], ["substitutions", ["substitutions"]],
    ];
    for (const [field, names] of aliases) {
      const found = names.map((name) => values[name]).find((item) => typeof item === "number");
      if (typeof found === "number") (stat[field] as number | null) = found;
    }
    if (stat.possession !== null && stat.possession > 1) stat.possession /= 100;
    if (stat.passes && stat.completedPasses !== null) stat.passAccuracy = stat.completedPasses / stat.passes;
    return { teamName: stringValue(asObject(side.team), "name"), stat };
  });
  const home = normalized[0]?.stat ?? emptyStatistic({});
  const away = normalized[1]?.stat ?? emptyStatistic({});
  return { rows: normalized, home, away };
}

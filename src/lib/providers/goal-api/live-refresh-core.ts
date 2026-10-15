type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

function asArray(value: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  const object = asObject(value);
  for (const key of keys) if (Array.isArray(object?.[key])) return object[key] as unknown[];
  return [];
}

function stringValue(value: JsonObject | null, ...keys: string[]) {
  for (const key of keys) {
    const candidate = value?.[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (typeof candidate === "number" && Number.isFinite(candidate)) return String(candidate);
  }
  return null;
}

function numberValue(value: JsonObject | null, ...keys: string[]) {
  for (const key of keys) {
    const candidate = value?.[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
    if (typeof candidate === "string" && candidate.trim() && Number.isFinite(Number(candidate.replace(/%/g, "").trim()))) return Number(candidate.replace(/%/g, "").trim());
  }
  return null;
}

function normalizedTeam(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean).filter((part) => !["fc", "cf", "club", "de", "del", "futbol", "sad", "rc", "rcd"].includes(part)).join(" ");
}

function sameTeam(left: string, right: string) {
  const a = normalizedTeam(left);
  const b = normalizedTeam(right);
  const distinct = new Set(["b", "ii", "u17", "u18", "u19", "u20", "u21", "u23", "women", "woman", "w", "femeni", "femenino", "juvenil", "youth", "reserves"]);
  if (a.split(" ").some((token) => distinct.has(token)) || b.split(" ").some((token) => distinct.has(token))) return a === b;
  if (a === b) return true;
  const aliases = [
    ["barcelona", "fc barcelona", "barca", "barca fc"],
    ["sevilla", "sevilla fc"],
    ["atletico madrid", "club atletico de madrid", "atletico de madrid"],
    ["athletic bilbao", "athletic club", "athletic club bilbao"],
    ["real betis", "real betis balompie", "betis"],
    ["real sociedad", "real sociedad de futbol"],
    ["deportivo alaves", "alaves"],
    ["racing santander", "real racing santander", "real racing club de santander"],
    ["rayo vallecano", "rayo vallecano madrid", "rayo vallecano de madrid"],
    ["feyenoord", "feyenoord rotterdam"],
    ["levante", "levante ud"],
    ["galatasaray", "galatasaray sk"],
  ];
  return aliases.some((group) => {
    const normalized = group.map(normalizedTeam);
    return normalized.includes(a) && normalized.includes(b);
  });
}

export type LiveEventType = "goal" | "own_goal" | "penalty_goal" | "yellow_card" | "red_card" | "substitution";
export type LiveMatchStatus = "live" | "halftime" | "extra_time" | "penalties" | "finished";

export type LiveEventCandidate = {
  providerId: string;
  order: number;
  type: LiveEventType;
  minute: number | null;
  period: number | null;
  side: "home" | "away";
  scorerName: string | null;
  assistName: string | null;
  providerPlayerId: string | null;
  raw: JsonObject;
};

function cleanName(value: string | null) {
  return value?.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim() || null;
}

function eventMinute(row: JsonObject) {
  const time = asObject(row.time);
  const parsed = numberValue(row, "minute", "timeNum", "elapsed", "elapsedTime", "elapsed_time") ??
    numberValue(time, "elapsed", "minute", "elapsedTime");
  if (parsed !== null) return Math.max(0, Math.floor(parsed));
  const label = stringValue(row, "time", "minuteLabel", "minute_label");
  const match = label?.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function sideFrom(row: JsonObject, homeTeam: string, awayTeam: string): "home" | "away" | null {
  const team = asObject(row.team) ?? asObject(row.matchTeam) ?? asObject(row.match_team);
  const teamName = stringValue(team, "name", "teamName", "team_name") ??
    stringValue(row, "teamName", "team_name", "team");
  if (teamName) {
    if (teamName.toLowerCase() === "home") return "home";
    if (teamName.toLowerCase() === "away") return "away";
    const home = sameTeam(homeTeam, teamName);
    const away = sameTeam(awayTeam, teamName);
    if (home !== away) return home ? "home" : "away";
    return null;
  }
  const hasHomeScorer = Boolean(stringValue(row, "homeScorer", "home_scorer", "homeScorerId", "home_scorer_id"));
  const hasAwayScorer = Boolean(stringValue(row, "awayScorer", "away_scorer", "awayScorerId", "away_scorer_id"));
  if (hasHomeScorer !== hasAwayScorer) return hasHomeScorer ? "home" : "away";
  const hasHomeCard = Boolean(stringValue(row, "homeFault", "homePlayerId"));
  const hasAwayCard = Boolean(stringValue(row, "awayFault", "awayPlayerId"));
  if (hasHomeCard !== hasAwayCard) return hasHomeCard ? "home" : "away";
  const explicit = stringValue(row, "side", "teamSide", "team_side")?.toLowerCase();
  return explicit === "home" || explicit === "away" ? explicit : null;
}

export function normalizeLiveEvents(value: JsonObject, homeTeam: string, awayTeam: string): LiveEventCandidate[] {
  return asArray(value.data, "events", "items")
    .map(asObject)
    .filter((row): row is JsonObject => Boolean(row))
    .flatMap((row, index) => {
      const providerId = stringValue(row, "id", "apiId", "eventId", "event_id");
      if (!providerId) return [];
      const player = asObject(row.player) ?? asObject(row.scorer);
      const names = [
        stringValue(row, "type", "card", "eventType", "event_type", "info", "description", "detail"),
        stringValue(asObject(row.type), "name", "label"),
      ].filter(Boolean).join(" ").toLowerCase();
      let type: LiveEventType | null = null;
      if (names.includes("own goal") || names.includes("own_goal")) type = "own_goal";
      else if (names.includes("goal") && names.includes("penalt")) type = "penalty_goal";
      else if (names.includes("goal")) type = "goal";
      else if (names.includes("red card") || names.includes("red_card") || names.includes("second yellow")) type = "red_card";
      else if (names.includes("yellow card") || names.includes("yellow_card")) type = "yellow_card";
      if (!type) return [];
      const side = sideFrom(row, homeTeam, awayTeam);
      if (!side) return [];
      const prefix = side === "home" ? "home" : "away";
      const scorer = stringValue(row, `${prefix}Scorer`, `${prefix}_scorer`, `${prefix}Fault`, "scorerName", "scorer_name", "playerName", "player_name") ??
        stringValue(player, "name", "displayName", "display_name");
      const assistObject = asObject(row.assist) ?? asObject(row.assistedBy) ?? asObject(row.assisted_by);
      const assistValue = stringValue(row, `${prefix}Assist`, `${prefix}_assist`, "assistName", "assist_name", "assistedBy", "assisted_by", "assist") ??
        stringValue(assistObject, "name", "displayName", "display_name");
      const period = numberValue(row, "period", "half", "matchPeriod", "match_period");
      return [{
        providerId,
        order: numberValue(row, "eventOrder", "event_order", "order", "sequence") ?? index + 1,
        type,
        minute: eventMinute(row),
        period: period === null ? null : Math.floor(period),
        side,
        scorerName: scorer ? cleanName(scorer) : null,
        assistName: assistValue ? cleanName(assistValue) : null,
        providerPlayerId: stringValue(row, `${prefix}ScorerId`, `${prefix}_scorer_id`, `${prefix}PlayerId`, "playerId", "player_id") ?? stringValue(player, "id", "apiId"),
        raw: row,
      }];
    });
}

/** GOAL publishes substitutions separately as "player off | player on". */
export function normalizeLiveSubstitutions(value: JsonObject): LiveEventCandidate[] {
  return asArray(value.data, "substitutions", "items").map(asObject).filter((row): row is JsonObject => Boolean(row)).flatMap((row, index) => {
    const providerId = stringValue(row, "id", "apiId");
    const side = stringValue(row, "team", "side")?.toLowerCase();
    const names = stringValue(row, "substitution")?.split("|").map((name) => name.trim()) ?? [];
    const ids = stringValue(row, "substitutionPlayerId")?.split("|").map((id) => id.trim()) ?? [];
    const minute = eventMinute(row);
    if (!providerId || (side !== "home" && side !== "away") || names.length !== 2 || !names[0] || !names[1] || minute === null) return [];
    return [{ providerId, order: index + 1, type: "substitution" as const, minute, period: minute > 45 ? 2 : 1,
      side, scorerName: cleanName(names[0]), assistName: cleanName(names[1]), providerPlayerId: ids[0] || null, raw: row }];
  });
}

export function normalizeLiveStatus(value: JsonObject): LiveMatchStatus | null {
  const clock = asObject(value.clock);
  const statusValues = [
    stringValue(value, "status", "matchStatus", "match_status", "statusShort", "status_short", "state"),
    stringValue(asObject(value.status), "short", "code", "name", "description"),
    stringValue(value, "matchPeriod", "match_period"),
    stringValue(clock, "period"),
  ];
  for (const raw of statusValues) {
    const status = raw?.toLowerCase().replace(/[ _-]+/g, " ") ?? "";
    if (["ft", "aet", "finished", "full time", "fulltime", "ended", "complete", "completed"].includes(status)) return "finished";
    if (status === "finished" || status === "full time") return "finished";
    if (["ht", "halftime", "half time", "break", "interval"].includes(status)) return "halftime";
    if (["et", "extra time", "extra time 1st half", "extra time 2nd half"].includes(status)) return "extra_time";
    if (["pen", "penalties", "penalty shootout", "shootout"].includes(status)) return "penalties";
    if (["1h", "2h", "live", "inplay", "in play", "first half", "second half", "playing"].includes(status)) return "live";
  }
  return null;
}

export function liveFixtureMatches(input: {
  canonical: { kickoff: string; home: string; away: string; competition: string };
  provider: { kickoff: string | null; home: string; away: string; competition: string | null };
}) {
  if (!input.provider.kickoff || !input.provider.competition) return false;
  const kickoff = Date.parse(input.provider.kickoff);
  const expectedKickoff = Date.parse(input.canonical.kickoff);
  if (!Number.isFinite(kickoff) || Math.abs(kickoff - expectedKickoff) > 30 * 60_000) return false;
  if (!sameTeam(input.canonical.home, input.provider.home)) return false;
  if (!sameTeam(input.canonical.away, input.provider.away)) return false;
  const normalize = (name: string) => name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const competitionAliases = [
    ["la liga", "laliga", "primera division", "spanish la liga"],
    ["uefa champions league", "champions league", "ucl"],
  ];
  const canonical = normalize(input.canonical.competition);
  const provider = normalize(input.provider.competition);
  return canonical === provider || competitionAliases.some((group) => group.includes(canonical) && group.includes(provider));
}

export function liveRetryDelayMs(input: { status: string; consecutiveFailures: number; error: string | null }) {
  if (input.error && /\b403\b/.test(input.error)) return 24 * 60 * 60_000;
  if (input.error && /\b429\b/.test(input.error)) return 15 * 60_000;
  if (input.status === "failed" || input.status === "partial") {
    return Math.min(30, 2 ** Math.max(0, input.consecutiveFailures - 1)) * 60_000;
  }
  return 0;
}

/** Catch-up checks must not spend the free provider quota at live-match frequency. */
export function postMatchPollDelayMs(status: string, kickoff: string, now: number) {
  const age = now - Date.parse(kickoff);
  if (status === "finished") return 30 * 60_000;
  // Canonical status can lag behind a provider's full-time update.
  if (Number.isFinite(age) && age >= 4 * 60 * 60_000) return 30 * 60_000;
  return 0;
}

export function shouldFetchLiveStatistics(lastFetchedAt: string | null, now: number) {
  return !lastFetchedAt || now - Date.parse(lastFetchedAt) >= 5 * 60_000;
}

export function finishedCoverageIncomplete(input: {
  kickoff: string;
  now: number;
  homeScore: number | null;
  awayScore: number | null;
  goalCount: number;
  statisticSides: number;
}) {
  const age = input.now - Date.parse(input.kickoff);
  if (!Number.isFinite(age) || age < 0 || age > 24 * 60 * 60_000) return false;
  const expectedGoals = (input.homeScore ?? 0) + (input.awayScore ?? 0);
  // Cards and substitutions can arrive well after goals and team stats. Give
  // every recent fixture a bounded reconciliation window even when the score
  // already appears complete; post-match polls are spaced 30 minutes apart.
  return age <= 12 * 60 * 60_000 || input.goalCount < expectedGoals || input.statisticSides < 2;
}

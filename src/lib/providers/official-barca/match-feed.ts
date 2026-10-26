import "server-only";

import { asArray, asObject, numberValue, stringValue, type JsonObject } from "../shared/json";
import { resolveMatchIdentity, type MatchIdentityCandidate, type MatchIdentityInput } from "../shared/match-identity";
import type { GoalLineupPlayer, GoalLineupSide, GoalPlayerPosition } from "../goal-api/types";

const BASE = "https://api-fcb.pulselive.com/football/fixtures";
const BARCELONA_TEAM_ID = "49";

function position(value: string | null): GoalPlayerPosition {
  if (value === "G") return "goalkeeper";
  if (value === "D") return "defender";
  if (value === "M") return "midfielder";
  if (value === "F") return "forward";
  return "unknown";
}

function candidate(value: unknown): MatchIdentityCandidate | null {
  const row = asObject(value);
  const teams = asArray(row?.teams).map((entry) => asObject(entry));
  const home = asObject(teams[0]?.team);
  const away = asObject(teams[1]?.team);
  const kickoff = asObject(row?.kickoff);
  const gameweek = asObject(row?.gameweek);
  const season = asObject(gameweek?.compSeason);
  const competition = asObject(season?.competition);
  const millis = numberValue(kickoff, "millis");
  if (!stringValue(row, "id") || !home || !away || millis === null || !stringValue(home, "name") || !stringValue(away, "name")) return null;
  return {
    providerMatchId: stringValue(row, "id"), kickoff: new Date(millis).toISOString(),
    calendarDate: new Date(millis).toISOString().slice(0, 10), localTime: null, temporalPrecision: "exact",
    homeTeam: stringValue(home, "name")!, awayTeam: stringValue(away, "name")!,
    homeScore: numberValue(teams[0], "score"), awayScore: numberValue(teams[1], "score"),
    competition: stringValue(competition, "description"),
  };
}

function player(value: unknown, role: GoalLineupPlayer["role"], index: number): GoalLineupPlayer | null {
  const row = asObject(value);
  const name = asObject(row?.name);
  const id = stringValue(row, "id");
  const displayName = stringValue(name, "display");
  if (!id || !displayName) return null;
  const matchPosition = stringValue(row, "matchPosition");
  return {
    providerId: id, legacyEventKey: null, name: displayName,
    shirtNumber: numberValue(row, "matchShirtNumber"), matchPosition,
    primaryPosition: position(matchPosition), lineupOrdinal: role === "starter" ? index + 1 : null,
    role, imageUrl: null,
  };
}

export function normalizeOfficialTeamLists(value: JsonObject) {
  const fixtureTeams = asArray(value.teams).map((entry) => asObject(asObject(entry)?.team));
  const listed = asArray(value.teamLists).map((entry) => asObject(entry));
  const side = (index: 0 | 1): GoalLineupSide | null => {
    const team = fixtureTeams[index];
    const teamId = stringValue(team, "id");
    const teamName = stringValue(team, "name");
    const rows = listed.filter((entry) => stringValue(entry, "teamId") === teamId);
    if (!teamId || !teamName || rows.length !== 1) return null;
    const starters = asArray(rows[0]?.lineup).map((entry, ordinal) => player(entry, "starter", ordinal));
    if (starters.length !== 11 || starters.some((entry) => !entry) || new Set(starters.map((entry) => entry!.providerId)).size !== 11) return null;
    const bench = asArray(rows[0]?.substitutes).map((entry, ordinal) => player(entry, "substitute", ordinal)).filter((entry) => entry !== null);
    return { providerTeamId: teamId, teamName, formation: null, coachName: null, players: [...starters as GoalLineupPlayer[], ...bench] };
  };
  return { home: side(0), away: side(1) };
}

/** Uses the same public fixture feed that powers FC Barcelona's match page. */
export async function fetchOfficialMatchLineups(internal: MatchIdentityInput) {
  const kickoff = Date.parse(internal.kickoff);
  const params = new URLSearchParams({
    page: "0", pageSize: "20", teams: BARCELONA_TEAM_ID, detail: "2",
    startDate: new Date(kickoff - 86_400_000).toISOString().slice(0, 10),
    endDate: new Date(kickoff + 86_400_000).toISOString().slice(0, 10),
  });
  const listResponse = await fetch(`${BASE}?${params}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!listResponse.ok) throw new Error(`Official fixture list returned HTTP ${listResponse.status}.`);
  const listBody = await listResponse.json() as JsonObject;
  const matches = asArray(listBody.content).map(candidate).filter((item) => item && resolveMatchIdentity(internal, item).matched);
  if (matches.length !== 1 || !matches[0]?.providerMatchId) return null;
  const providerMatchId = matches[0].providerMatchId;
  const detailResponse = await fetch(`${BASE}/${encodeURIComponent(providerMatchId)}?detail=3`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!detailResponse.ok) throw new Error(`Official match detail returned HTTP ${detailResponse.status}.`);
  const detail = await detailResponse.json() as JsonObject;
  if (stringValue(detail, "id") !== providerMatchId || !candidate(detail) || !resolveMatchIdentity(internal, candidate(detail)!).matched) return null;
  return { providerMatchId, requestCount: 2, ...normalizeOfficialTeamLists(detail) };
}

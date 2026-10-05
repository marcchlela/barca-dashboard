import type { FootballDataStandingsResponse } from "../providers/football-data/types";

export function validateHistoricalTable(
  response: FootballDataStandingsResponse,
  expected: { seasonStart: number; matchday: number; teamIds: Set<number> },
) {
  if (response.competition.code !== "PD" ||
      Number(response.season.startDate.slice(0, 4)) !== expected.seasonStart ||
      Number(response.filters.matchday) !== expected.matchday ||
      Number(response.filters.season) !== expected.seasonStart) {
    throw new Error(`Standings response does not match La Liga ${expected.seasonStart}, round ${expected.matchday}.`);
  }
  const table = response.standings.find((item) => item.type === "TOTAL")?.table;
  if (!table || table.length !== 20) {
    throw new Error(`Round ${expected.matchday} did not contain a 20-team TOTAL table.`);
  }
  const positions = new Set(table.map((row) => row.position));
  const teams = new Set(table.map((row) => row.team.id));
  if (positions.size !== 20 || teams.size !== 20 ||
      table.some((row) => row.position < 1 || row.position > 20 ||
        !expected.teamIds.has(row.team.id) ||
        row.playedGames !== row.won + row.draw + row.lost ||
        row.goalDifference !== row.goalsFor - row.goalsAgainst)) {
    throw new Error(`Round ${expected.matchday} failed position, team mapping, or result validation.`);
  }
  return table;
}

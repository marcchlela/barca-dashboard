import "server-only";

import { db } from "../../prisma/db";
import { getLaLigaStandings } from "../providers/football-data/client";
import { validateHistoricalTable } from "./standings-validation";
import { missingHistoricalRounds } from "./standings-plan";

const MAX_ROUNDS_PER_RUN = 8;
const REQUEST_SPACING_MS = 6400;
let nextRequestAt = 0;

async function pacedStandings(options?: { season: number; matchday: number }) {
  const now = Date.now();
  const wait = Math.max(0, nextRequestAt - now);
  nextRequestAt = now + wait + REQUEST_SPACING_MS;
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  return getLaLigaStandings(options);
}

export async function syncStandingsHistory(dryRun: boolean) {
  const [season, competition, source] = await Promise.all([
    db.orm.public.Season.where({ isCurrent: true }).first(),
    db.orm.public.Competition.where({ code: "PD" }).first(),
    db.orm.public.DataSource.where({ code: "football-data-org" }).first(),
  ]);
  if (!season || !competition || !source) throw new Error("Sync the current La Liga fixture spine first.");

  const current = await pacedStandings();
  const currentTable = current.standings.find((item) => item.type === "TOTAL")?.table;
  if (!currentTable || currentTable.length !== 20 ||
      Number(current.season.startDate.slice(0, 4)) !== season.startYear ||
      current.competition.code !== "PD") {
    throw new Error("The provider's current La Liga season/table does not match the canonical season.");
  }
  const mappings = await db.orm.public.ProviderMapping.where({
    dataSourceId: source.id, entityType: "team",
  }).all();
  const teamByProviderId = new Map(mappings.map((mapping) => [Number(mapping.providerId), mapping.internalId]));
  const expectedIds = new Set(currentTable.map((row) => row.team.id));
  const currentPositions = new Set(currentTable.map((row) => row.position));
  if (expectedIds.size !== 20 || currentPositions.size !== 20 ||
      currentTable.some((row) => row.position < 1 || row.position > 20) ||
      [...expectedIds].some((id) => !teamByProviderId.has(id))) {
    throw new Error("The 20 current La Liga teams must have canonical provider mappings before history sync.");
  }

  const latestOfficialRound = current.season.currentMatchday ?? Math.max(...currentTable.map((row) => row.playedGames));
  const existing = await db.orm.public.StandingSnapshot.where({
    seasonId: season.id, competitionId: competition.id,
  }).all();
  let officialRowsWritten = 0;
  if (!dryRun) {
    for (const row of currentTable) {
      const teamId = teamByProviderId.get(row.team.id)!;
      const previous = existing.find((item) => item.matchday === latestOfficialRound && item.teamId === teamId);
      const values = {
        position: row.position, played: row.playedGames, won: row.won,
        drawn: row.draw, lost: row.lost, goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst, goalDifference: row.goalDifference,
        points: row.points, dataSourceId: source.id, basis: "official_current",
      };
      if (previous && Object.entries(values).every(([key, value]) => previous[key as keyof typeof previous] === value)) continue;
      if (previous) {
        await db.orm.public.StandingSnapshot.where({ id: previous.id }).update(values);
      } else {
        await db.orm.public.StandingSnapshot.create({
          seasonId: season.id, competitionId: competition.id, teamId,
          matchday: latestOfficialRound, ...values,
        });
      }
      officialRowsWritten++;
    }
  }
  const counts = new Map<number, number>();
  for (const row of existing) counts.set(row.matchday, (counts.get(row.matchday) ?? 0) + 1);
  // Never overwrite the provider's unfiltered official current table with a compiled table.
  const missing = missingHistoricalRounds(latestOfficialRound, counts);
  const selected = missing.slice(0, MAX_ROUNDS_PER_RUN);
  const results: { matchday: number; status: string; rows: number }[] = [];
  for (const matchday of selected) {
    const response = await pacedStandings({ season: season.startYear, matchday });
    const table = validateHistoricalTable(response, {
      seasonStart: season.startYear, matchday, teamIds: expectedIds,
    });
    if (!dryRun) {
      for (const row of table) {
        const teamId = teamByProviderId.get(row.team.id)!;
        const previous = existing.find((item) => item.matchday === matchday && item.teamId === teamId);
        const values = {
          position: row.position, played: row.playedGames, won: row.won,
          drawn: row.draw, lost: row.lost, goalsFor: row.goalsFor,
          goalsAgainst: row.goalsAgainst, goalDifference: row.goalDifference,
          points: row.points, dataSourceId: source.id, basis: "results_compiled",
        };
        if (previous?.basis === "official_current") continue;
        if (previous) {
          await db.orm.public.StandingSnapshot.where({ id: previous.id }).update(values);
        } else {
          await db.orm.public.StandingSnapshot.create({
            seasonId: season.id, competitionId: competition.id, teamId,
            matchday, ...values,
          });
        }
      }
    }
    results.push({ matchday, status: dryRun ? "validated_preview" : "written", rows: table.length });
  }
  return {
    dryRun, season: season.label, latestOfficialRound,
    missingRounds: missing.length, remainingAfterRun: missing.length - selected.length,
    requestCount: selected.length + 1, maxRoundsPerRun: MAX_ROUNDS_PER_RUN,
    officialRowsWritten,
    results,
    note: "Historical season+matchday standings are results-compiled and may exclude point deductions. The unfiltered current table remains official.",
  };
}

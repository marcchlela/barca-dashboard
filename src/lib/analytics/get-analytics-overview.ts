import "server-only";

import { db } from "../../prisma/db";
import { buildPlayerHeatmapProfile } from "../squad/player-heatmap";
import { average, displayPercent, observed, sum } from "./analytics-math";

export async function getAnalyticsOverview() {
  const [season, barcelona, competitions] = await Promise.all([
    db.orm.public.Season.where({ isCurrent: true }).first(),
    db.orm.public.Team.where({ isBarcelona: true }).first(),
    db.orm.public.Competition.all(),
  ]);
  if (!season || !barcelona) throw new Error("The current season and FC Barcelona must exist.");
  const barcelonaId = barcelona.id;
  const league = competitions.find((c) => c.code === "PD");
  const champions = competitions.find((c) => c.code === "CL");
  const [matches, teamStats, playerStats, memberships, standings, championStandings, fixtureSnapshots] = await Promise.all([
    db.orm.public.Match.where({ seasonId: season.id }).include("homeTeam").include("awayTeam").include("competition").all(),
    db.orm.public.MatchStatistic.where({ teamId: barcelonaId }).all(),
    db.orm.public.PlayerMatchStatistic.where({ teamId: barcelonaId }).all(),
    db.orm.public.SquadMembership.where({ seasonId: season.id, teamId: barcelonaId }).include("player").all(),
    league ? db.orm.public.StandingSnapshot.where({ seasonId: season.id, competitionId: league.id }).include("team").all() : Promise.resolve([]),
    champions ? db.orm.public.StandingSnapshot.where({ seasonId: season.id, competitionId: champions.id }).include("team").all() : Promise.resolve([]),
    db.orm.public.CompetitionFixtureSnapshot.where({ seasonId: season.id }).all(),
  ]);
  const finished = matches.filter((match) => match.status === "finished" &&
    (match.homeTeamId === barcelonaId || match.awayTeamId === barcelonaId) &&
    match.homeScore !== null && match.awayScore !== null)
    .sort((a, b) => a.kickoff.toString().localeCompare(b.kickoff.toString()));
  const currentPlayers = memberships.filter((membership) => membership.leftAt === null);
  function makeView(code: string) {
    const chosen = finished.filter((match) => code === "ALL" || match.competition.code === code);
    const matchIds = new Set(chosen.map((match) => match.id));
    const statsByMatch = new Map(teamStats.filter((stat) => matchIds.has(stat.matchId)).map((stat) => [stat.matchId, stat]));
    const trend = chosen.map((match, index) => {
      const home = match.homeTeamId === barcelonaId;
      const goalsFor = home ? match.homeScore! : match.awayScore!;
      const goalsAgainst = home ? match.awayScore! : match.homeScore!;
      const stats = statsByMatch.get(match.id);
      return {
        id: match.id, index: index + 1, date: match.kickoff.toString().slice(0, 10),
        competitionCode: match.competition.code, competition: match.competition.shortName ?? match.competition.name,
        opponent: home ? match.awayTeam.shortName ?? match.awayTeam.name : match.homeTeam.shortName ?? match.homeTeam.name,
        home, goalsFor, goalsAgainst, points: goalsFor > goalsAgainst ? 3 : goalsFor === goalsAgainst ? 1 : 0,
        possession: displayPercent(stats?.possession ?? null), passes: stats?.passes ?? null,
        passAccuracy: displayPercent(stats?.passAccuracy ?? null), shots: stats?.shots ?? null,
        shotsOnTarget: stats?.shotsOnTarget ?? null,
      };
    });
    const splitGroups = [...new Set(trend.map((match) => match.competitionCode))].map((itemCode) => ({
      label: competitions.find((c) => c.code === itemCode)?.shortName ?? itemCode,
      competitionCode: itemCode, logoUrl: competitions.find((c) => c.code === itemCode)?.logoUrl ?? null,
      venue: null as "home" | "away" | null,
      items: trend.filter((match) => match.competitionCode === itemCode),
    }));
    splitGroups.push({ label: "Home", competitionCode: "", logoUrl: null, venue: "home", items: trend.filter((match) => match.home) });
    splitGroups.push({ label: "Away", competitionCode: "", logoUrl: null, venue: "away", items: trend.filter((match) => !match.home) });
    const splits = splitGroups.map(({ label, competitionCode, logoUrl, venue, items }) => ({
      label, competitionCode, logoUrl, venue, matches: items.length,
      wins: items.filter((item) => item.points === 3).length,
      draws: items.filter((item) => item.points === 1).length,
      losses: items.filter((item) => item.points === 0).length,
      goalsFor: sum(items.map((item) => item.goalsFor)), goalsAgainst: sum(items.map((item) => item.goalsAgainst)),
      possession: average(items.map((item) => item.possession)), shots: average(items.map((item) => item.shots)),
    }));
    const players = currentPlayers.map((membership) => {
      const stats = playerStats.filter((stat) => stat.playerId === membership.playerId && matchIds.has(stat.matchId));
      return {
        id: membership.playerId, name: membership.player.displayName, portraitUrl: membership.player.portraitUrl,
        position: membership.position, shirt: membership.shirtNumber,
        appearances: stats.length, minutes: observed(stats.map((stat) => stat.minutes)),
        goals: observed(stats.map((stat) => stat.goals)), assists: observed(stats.map((stat) => stat.assists)),
        shots: observed(stats.map((stat) => stat.shots)), keyPasses: observed(stats.map((stat) => stat.keyPasses)),
        tackles: observed(stats.map((stat) => stat.tackles)), saves: observed(stats.map((stat) => stat.saves)),
        rating: average(stats.map((stat) => stat.rating)), heatmap: buildPlayerHeatmapProfile(stats).average,
      };
    }).sort((a, b) => (b.minutes.value ?? 0) - (a.minutes.value ?? 0) || a.name.localeCompare(b.name));
    return { trend, splits, players, coverage: {
      finishedMatches: trend.length, teamStatMatches: statsByMatch.size,
      playerStatMatches: new Set(playerStats.filter((stat) => matchIds.has(stat.matchId)).map((stat) => stat.matchId)).size,
    } };
  }
  const codes = ["ALL", "PD", "CL", "CDR", "SSC"];
  const availableCompetitions = codes.filter((code) => code === "ALL" ||
    fixtureSnapshots.some((row) => competitions.find((c) => c.id === row.competitionId)?.code === code) ||
    matches.some((match) => match.competition.code === code));
  const views = Object.fromEntries(availableCompetitions.map((code) => [code, makeView(code)]));
  const roundsMap = new Map<number, typeof standings>();
  for (const row of standings) {
    const rows = roundsMap.get(row.matchday) ?? [];
    rows.push(row);
    roundsMap.set(row.matchday, rows);
  }
  const rounds = [...roundsMap].sort(([a], [b]) => a - b).map(([matchday, rows]) => ({
    matchday, complete: rows.length === 20 && new Set(rows.map((row) => row.position)).size === 20,
    basis: rows.some((row) => row.basis === "official_current") ? "official_current" :
      rows.every((row) => row.basis === "results_compiled") ? "results_compiled" : "unverified_legacy",
    table: rows.sort((a, b) => a.position - b.position).map((row) => ({
      teamId: row.teamId, name: row.team.shortName ?? row.team.name, crestUrl: row.team.crestUrl,
      barcelona: row.teamId === barcelonaId, position: row.position, played: row.played,
      won: row.won, drawn: row.drawn, lost: row.lost, goalDifference: row.goalDifference, points: row.points,
    })),
  }));
  const latestChampionsRound = Math.max(-1, ...championStandings.map((row) => row.matchday));
  const championTable = championStandings.filter((row) => row.matchday === latestChampionsRound)
    .sort((a, b) => a.position - b.position).map((row) => ({
      teamId: row.teamId, name: row.team.shortName ?? row.team.name, crestUrl: row.team.crestUrl,
      barcelona: row.teamId === barcelonaId, position: row.position, played: row.played,
      won: row.won, drawn: row.drawn, lost: row.lost, goalDifference: row.goalDifference, points: row.points,
    }));
  const fixtures = fixtureSnapshots.map((row) => ({
    id: row.id, competitionCode: competitions.find((c) => c.id === row.competitionId)?.code ?? "",
    stage: row.stage, round: row.round, matchday: row.matchday, leg: row.leg,
    kickoff: row.kickoff?.toString() ?? null, status: row.status,
    homeProviderId: row.homeProviderId, awayProviderId: row.awayProviderId,
    homeName: row.homeName, awayName: row.awayName, homeCrestUrl: row.homeCrestUrl, awayCrestUrl: row.awayCrestUrl,
    homeScore: row.homeScore, awayScore: row.awayScore,
    homePenaltyScore: row.homePenaltyScore, awayPenaltyScore: row.awayPenaltyScore,
  }));
  const all = makeView("ALL");
  return {
    season: { label: season.label, startYear: season.startYear },
    competitionOptions: availableCompetitions.map((code) => ({ code,
      label: code === "ALL" ? "All" : competitions.find((c) => c.code === code)?.shortName ?? code,
      logoUrl: competitions.find((c) => c.code === code)?.logoUrl ?? null })),
    views, rounds, championTable, fixtures,
    ...all, coverage: { ...all.coverage, standingsRounds: rounds.filter((round) => round.complete).length },
  };
}

export type AnalyticsData = Awaited<ReturnType<typeof getAnalyticsOverview>>;

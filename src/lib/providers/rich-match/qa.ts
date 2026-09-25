import "server-only";

import { db } from "../../../prisma/db";
import { RICH_MATCH_TARGET } from "./constants";

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export async function richMatchQa(matchId: string) {
  if (matchId !== RICH_MATCH_TARGET.id) {
    throw new Error(`Only approved target match ${RICH_MATCH_TARGET.id} may be inspected.`);
  }
  const match = await db.orm.public.Match
    .where({ id: matchId })
    .include("homeTeam")
    .include("awayTeam")
    .include("competition")
    .first();
  if (!match) throw new Error(`Target match ${matchId} was not found.`);

  const lineups = await db.orm.public.Lineup.where({ matchId }).all();
  const lineupReport = [];
  for (const lineup of lineups) {
    const team = await db.orm.public.Team.where({ id: lineup.teamId }).first();
    const entries = await db.orm.public.LineupPlayer
      .where({ lineupId: lineup.id })
      .include("player")
      .all();
    lineupReport.push({
      teamId: lineup.teamId,
      teamName: team?.name ?? null,
      formation: lineup.formation,
      coachName: lineup.coachName,
      isConfirmed: lineup.isConfirmed,
      starters: entries
        .filter((entry) => entry.role === "starter")
        .map((entry) => ({
          playerId: entry.playerId,
          name: entry.player.displayName,
          shirtNumber: entry.shirtNumber,
          position: entry.position,
          lineupOrdinal: entry.lineupOrdinal,
          positionX: entry.positionX,
          positionY: entry.positionY,
        })),
      bench: entries
        .filter((entry) => entry.role === "substitute")
        .map((entry) => ({
          playerId: entry.playerId,
          name: entry.player.displayName,
          shirtNumber: entry.shirtNumber,
          position: entry.position,
          lineupOrdinal: entry.lineupOrdinal,
          positionX: entry.positionX,
          positionY: entry.positionY,
        })),
    });
  }

  const events = await db.orm.public.MatchEvent
    .where({ matchId })
    .include("team")
    .include("primaryPlayer")
    .include("relatedPlayer")
    .include("dataSource")
    .orderBy((event) => event.eventOrder.asc())
    .all();
  const teamStatistics = await db.orm.public.MatchStatistic
    .where({ matchId })
    .include("team")
    .include("dataSource")
    .all();
  const playerStatistics = await db.orm.public.PlayerMatchStatistic
    .where({ matchId })
    .include("player")
    .include("team")
    .include("dataSource")
    .all();
  const mappings = await db.orm.public.ProviderMapping
    .where({ internalId: matchId, entityType: "match" })
    .include("dataSource")
    .all();
  const bigBallsMatchMapping = mappings.find(
    (mapping) => mapping.dataSource.code === "big-balls-data",
  );
  const bigBallsMetadata = asObject(bigBallsMatchMapping?.metadata);
  const unresolved = Array.isArray(bigBallsMetadata?.unresolvedPlayerIdentities)
    ? bigBallsMetadata.unresolvedPlayerIdentities
    : [];
  const barcelonaId = match.homeTeam.isBarcelona
    ? match.homeTeamId
    : match.awayTeamId;
  const homeLineup = lineupReport.find((lineup) => lineup.teamId === match.homeTeamId);
  const awayLineup = lineupReport.find((lineup) => lineup.teamId === match.awayTeamId);
  const invariants = [
    {
      name: "target_immutable_facts",
      passed:
        match.kickoff.toString() === RICH_MATCH_TARGET.kickoff &&
        match.homeTeam.name === RICH_MATCH_TARGET.homeTeam &&
        match.awayTeam.name === RICH_MATCH_TARGET.awayTeam &&
        match.homeScore === RICH_MATCH_TARGET.homeScore &&
        match.awayScore === RICH_MATCH_TARGET.awayScore,
    },
    { name: "two_lineups", passed: lineups.length === 2 },
    { name: "home_starting_xi", passed: homeLineup?.starters.length === 11 },
    { name: "away_starting_xi", passed: awayLineup?.starters.length === 11 },
    {
      name: "approved_formations",
      passed:
        homeLineup?.formation === "4-2-3-1" && awayLineup?.formation === "4-3-3",
    },
    {
      name: "classified_benches",
      passed: homeLineup?.bench.length === 12 && awayLineup?.bench.length === 12,
    },
    {
      name: "lineup_ordinals_preserved",
      passed: lineupReport.every((lineup) =>
        [...lineup.starters, ...lineup.bench].every(
          (player) => player.lineupOrdinal !== null,
        ),
      ),
    },
    {
      name: "starter_ui_coordinates",
      passed: lineupReport.every((lineup) =>
        lineup.starters.every(
          (player) => player.positionX !== null && player.positionY !== null,
        ),
      ),
    },
    {
      name: "substitute_coordinates_absent",
      passed: lineupReport.every((lineup) =>
        lineup.bench.every(
          (player) => player.positionX === null && player.positionY === null,
        ),
      ),
    },
    { name: "goal_count_matches_score", passed: events.length === 4 },
    {
      name: "scoring_timeline_matches_provider_evidence",
      passed:
        events.map((event) => event.minute).join(",") === "19,22,52,69" &&
        events.filter((event) => event.teamId === match.awayTeamId).length === 3 &&
        events.filter((event) => event.teamId === match.homeTeamId).length === 1,
    },
    {
      name: "goal_source_ownership",
      passed: events.every((event) => event.dataSource?.code === "goal-api"),
    },
    {
      name: "team_stat_source_ownership",
      passed:
        teamStatistics.length === 2 &&
        teamStatistics.every((statistic) => statistic.dataSource?.code === "goal-api"),
    },
    {
      name: "core_team_statistics_match_provider_evidence",
      passed: (() => {
        const home = teamStatistics.find((statistic) => statistic.teamId === match.homeTeamId);
        const away = teamStatistics.find((statistic) => statistic.teamId === match.awayTeamId);
        return Boolean(
          home &&
            away &&
            home.possession === 0.31 &&
            away.possession === 0.69 &&
            home.shots === 7 &&
            away.shots === 24 &&
            home.shotsOnTarget === 3 &&
            away.shotsOnTarget === 7 &&
            home.shotsOffTarget === 4 &&
            away.shotsOffTarget === 12 &&
            home.blockedShots === 0 &&
            away.blockedShots === 5 &&
            home.passes === 278 &&
            away.passes === 643 &&
            home.completedPasses === 203 &&
            away.completedPasses === 582,
        );
      })(),
    },
    {
      name: "player_stat_source_ownership",
      passed:
        playerStatistics.length > 0 &&
        playerStatistics.every(
          (statistic) => statistic.dataSource?.code === "big-balls-data",
        ),
    },
    {
      name: "safe_player_stat_resolution",
      passed:
        playerStatistics.length === 22 &&
        playerStatistics.filter((statistic) => statistic.teamId === barcelonaId).length === 11,
    },
    {
      name: "xg_xa_remain_missing",
      passed:
        teamStatistics.every((statistic) => statistic.xG === null) &&
        playerStatistics.every(
          (statistic) => statistic.xG === null && statistic.xA === null,
        ),
    },
  ];

  return {
    match: {
      id: match.id,
      kickoff: match.kickoff.toString(),
      competition: match.competition.name,
      home: { id: match.homeTeamId, name: match.homeTeam.name, score: match.homeScore },
      away: { id: match.awayTeamId, name: match.awayTeam.name, score: match.awayScore },
    },
    lineups: lineupReport,
    events: events.map((event) => ({
      id: event.id,
      type: event.type,
      minute: event.minute,
      order: event.eventOrder,
      team: event.team?.name ?? null,
      scorer: event.primaryPlayer?.displayName ?? null,
      assist: event.relatedPlayer?.displayName ?? null,
      source: event.dataSource?.code ?? null,
      xG: event.xG,
      coordinates: event.startX === null && event.startY === null
        ? null
        : { x: event.startX, y: event.startY },
    })),
    teamStatistics: teamStatistics.map((statistic) => ({
      team: statistic.team.name,
      source: statistic.dataSource?.code ?? null,
      possession: statistic.possession,
      shots: statistic.shots,
      shotsOnTarget: statistic.shotsOnTarget,
      shotsOffTarget: statistic.shotsOffTarget,
      blockedShots: statistic.blockedShots,
      shotsInsideBox: statistic.shotsInsideBox,
      shotsOutsideBox: statistic.shotsOutsideBox,
      passes: statistic.passes,
      completedPasses: statistic.completedPasses,
      passAccuracy: statistic.passAccuracy,
      corners: statistic.corners,
      fouls: statistic.fouls,
      offsides: statistic.offsides,
      saves: statistic.saves,
      attacks: statistic.attacks,
      dangerousAttacks: statistic.dangerousAttacks,
      xG: statistic.xG,
    })),
    barcelonaPlayerStatistics: playerStatistics
      .filter((statistic) => statistic.teamId === barcelonaId)
      .map((statistic) => ({
        playerId: statistic.playerId,
        name: statistic.player.displayName,
        source: statistic.dataSource?.code ?? null,
        minutes: statistic.minutes,
        goals: statistic.goals,
        assists: statistic.assists,
        shots: statistic.shots,
        shotsOnTarget: statistic.shotsOnTarget,
        passes: statistic.passes,
        completedPasses: statistic.completedPasses,
        passAccuracy: statistic.passAccuracy,
        keyPasses: statistic.keyPasses,
        tackles: statistic.tackles,
        blocks: statistic.blocks,
        interceptions: statistic.interceptions,
        duelsWon: statistic.duelsWon,
        duelsTotal: statistic.duelsTotal,
        dribblesAttempted: statistic.dribblesAttempted,
        successfulDribbles: statistic.successfulDribbles,
        fouls: statistic.fouls,
        saves: statistic.saves,
        rating: statistic.rating,
        xG: statistic.xG,
        xA: statistic.xA,
      })),
    sourceOwnership: {
      fixturesResults: "football-data-org",
      lineupBenchFormation: "goal-api",
      scoringEvents: "goal-api",
      teamStatistics: "goal-api",
      playerStatisticsRatings: "big-balls-data",
      futurePlayerStatFallback: "statshawk",
    },
    unresolvedIdentityCount: unresolved.length,
    unresolvedIdentities: unresolved,
    explicitGaps: [
      "expected goals (xG)",
      "expected assists (xA)",
      "shot coordinates",
      "complete card timeline",
      "complete substitution timeline",
      "tracking-derived positions",
    ],
    invariants,
    allPassed: invariants.every((invariant) => invariant.passed),
  };
}

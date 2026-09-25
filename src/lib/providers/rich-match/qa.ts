import "server-only";

import { db } from "../../../prisma/db";

function asObject(
  value: unknown,
): Record<
  string,
  unknown
> | null {
  return (
    value !== null &&
    typeof value ===
      "object" &&
    !Array.isArray(value)
      ? (value as Record<
          string,
          unknown
        >)
      : null
  );
}

export async function richMatchQa(
  matchId: string,
) {
  const match =
    await db.orm.public.Match
      .where({
        id: matchId,
      })
      .include("homeTeam")
      .include("awayTeam")
      .include("competition")
      .first();

  if (!match) {
    throw new Error(
      `Match ${matchId} was not found.`,
    );
  }

  if (
    !match.homeTeam
      .isBarcelona &&
    !match.awayTeam
      .isBarcelona
  ) {
    throw new Error(
      `Match ${matchId} is not an FC Barcelona fixture.`,
    );
  }

  if (
    match.status !==
    "finished"
  ) {
    throw new Error(
      `Rich-match QA currently accepts finished matches only.`,
    );
  }

  if (
    match.homeScore ===
      null ||
    match.awayScore ===
      null
  ) {
    throw new Error(
      `Finished match ${matchId} does not have a final score.`,
    );
  }

  const lineups =
    await db.orm.public.Lineup
      .where({
        matchId,
      })
      .all();

  const lineupReport = [];

  for (
    const lineup of lineups
  ) {
    const team =
      await db.orm.public.Team
        .where({
          id:
            lineup.teamId,
        })
        .first();

    const entries =
      await db.orm.public.LineupPlayer
        .where({
          lineupId:
            lineup.id,
        })
        .include(
          "player",
        )
        .all();

    lineupReport.push({
      teamId:
        lineup.teamId,

      teamName:
        team?.name ??
        null,

      formation:
        lineup.formation,

      coachName:
        lineup.coachName,

      isConfirmed:
        lineup.isConfirmed,

      starters:
        entries
          .filter(
            (entry) =>
              entry.role ===
              "starter",
          )
          .map(
            (entry) => ({
              playerId:
                entry.playerId,

              name:
                entry.player
                  .displayName,

              shirtNumber:
                entry.shirtNumber,

              position:
                entry.position,

              lineupOrdinal:
                entry.lineupOrdinal,

              positionX:
                entry.positionX,

              positionY:
                entry.positionY,
            }),
          ),

      bench:
        entries
          .filter(
            (entry) =>
              entry.role ===
              "substitute",
          )
          .map(
            (entry) => ({
              playerId:
                entry.playerId,

              name:
                entry.player
                  .displayName,

              shirtNumber:
                entry.shirtNumber,

              position:
                entry.position,

              lineupOrdinal:
                entry.lineupOrdinal,

              positionX:
                entry.positionX,

              positionY:
                entry.positionY,
            }),
          ),
    });
  }

  const events =
    await db.orm.public.MatchEvent
      .where({
        matchId,
      })
      .include("team")
      .include(
        "primaryPlayer",
      )
      .include(
        "relatedPlayer",
      )
      .include(
        "dataSource",
      )
      .orderBy(
        (event) =>
          event.eventOrder.asc(),
      )
      .all();

  const teamStatistics =
    await db.orm.public.MatchStatistic
      .where({
        matchId,
      })
      .include("team")
      .include(
        "dataSource",
      )
      .all();

  const playerStatistics =
    await db.orm.public.PlayerMatchStatistic
      .where({
        matchId,
      })
      .include(
        "player",
      )
      .include("team")
      .include(
        "dataSource",
      )
      .all();

  const mappings =
    await db.orm.public.ProviderMapping
      .where({
        internalId:
          matchId,

        entityType:
          "match",
      })
      .include(
        "dataSource",
      )
      .all();

  const bigBallsMatchMapping =
    mappings.find(
      (mapping) =>
        mapping.dataSource
          .code ===
        "big-balls-data",
    );

  const bigBallsMetadata =
    asObject(
      bigBallsMatchMapping
        ?.metadata,
    );

  const unresolved =
    Array.isArray(
      bigBallsMetadata
        ?.unresolvedPlayerIdentities,
    )
      ? bigBallsMetadata!
          .unresolvedPlayerIdentities
      : [];

  const barcelonaId =
    match.homeTeam
      .isBarcelona
      ? match.homeTeamId
      : match.awayTeamId;

  const homeLineup =
    lineupReport.find(
      (lineup) =>
        lineup.teamId ===
        match.homeTeamId,
    );

  const awayLineup =
    lineupReport.find(
      (lineup) =>
        lineup.teamId ===
        match.awayTeamId,
    );

  const expectedGoals =
    match.homeScore +
    match.awayScore;

  const homeGoalEvents =
    events.filter(
      (event) =>
        event.teamId ===
        match.homeTeamId,
    ).length;

  const awayGoalEvents =
    events.filter(
      (event) =>
        event.teamId ===
        match.awayTeamId,
    ).length;

  const playerStatIds =
    playerStatistics.map(
      (statistic) =>
        statistic.playerId,
    );

  const uniquePlayerStatIds =
    new Set(
      playerStatIds,
    );

  const lineupHasUniquePlayers =
    lineupReport.every(
      (lineup) => {
        const ids = [
          ...lineup.starters,
          ...lineup.bench,
        ].map(
          (player) =>
            player.playerId,
        );

        return (
          new Set(ids)
            .size ===
          ids.length
        );
      },
    );

  const starterCoordinatesValid =
    lineupReport.every(
      (lineup) => {
        /*
         * Formation coordinates are UI-derived.
         *
         * If the provider supplies no formation,
         * we intentionally do not fabricate coordinates.
         */
        if (
          !lineup.formation
        ) {
          return true;
        }

        return lineup.starters.every(
          (player) =>
            player.positionX !==
              null &&
            player.positionY !==
              null,
        );
      },
    );

  const substitutesHaveNoCoordinates =
    lineupReport.every(
      (lineup) =>
        lineup.bench.every(
          (player) =>
            player.positionX ===
              null &&
            player.positionY ===
              null,
        ),
    );

  const bothTeamsHaveStatistics =
    teamStatistics.length ===
      2 &&
    teamStatistics.some(
      (statistic) =>
        statistic.teamId ===
        match.homeTeamId,
    ) &&
    teamStatistics.some(
      (statistic) =>
        statistic.teamId ===
        match.awayTeamId,
    );

  const validMatchTeamIds =
    new Set([
      match.homeTeamId,
      match.awayTeamId,
    ]);

  const invariants = [
    {
      name:
        "finished_barcelona_fixture",

      passed:
        match.status ===
          "finished" &&
        (match.homeTeam
          .isBarcelona ||
          match.awayTeam
            .isBarcelona),
    },

    {
      name:
        "final_score_present",

      passed:
        match.homeScore !==
          null &&
        match.awayScore !==
          null,
    },

    {
      name:
        "two_lineups",

      passed:
        lineups.length ===
        2,
    },

    {
      name:
        "home_starting_xi",

      passed:
        homeLineup
          ?.starters
          .length === 11,
    },

    {
      name:
        "away_starting_xi",

      passed:
        awayLineup
          ?.starters
          .length === 11,
    },

    {
      name:
        "lineups_confirmed",

      passed:
        lineupReport.length ===
          2 &&
        lineupReport.every(
          (lineup) =>
            lineup.isConfirmed,
        ),
    },

    {
      name:
        "lineup_players_unique",

      passed:
        lineupHasUniquePlayers,
    },

    {
      name:
        "lineup_ordinals_preserved",

      passed:
        lineupReport.every(
          (lineup) =>
            [
              ...lineup.starters,
              ...lineup.bench,
            ].every(
              (player) =>
                player.lineupOrdinal !==
                null,
            ),
        ),
    },

    {
      name:
        "starter_ui_coordinates_when_formation_known",

      passed:
        starterCoordinatesValid,
    },

    {
      name:
        "substitute_coordinates_absent",

      passed:
        substitutesHaveNoCoordinates,
    },

    {
      name:
        "goal_count_matches_final_score",

      passed:
        events.length ===
        expectedGoals,
    },

    {
      name:
        "goal_team_counts_match_final_score",

      passed:
        homeGoalEvents ===
          match.homeScore &&
        awayGoalEvents ===
          match.awayScore,
    },

    {
      name:
        "goal_source_ownership",

      passed:
        events.length ===
          expectedGoals &&
        events.every(
          (event) =>
            event.dataSource
              ?.code ===
            "goal-api",
        ),
    },

    {
      name:
        "goal_players_resolved",

      passed:
        events.every(
          (event) =>
            event.primaryPlayerId !==
            null,
        ),
    },

    {
      name:
        "two_team_stat_rows",

      passed:
        bothTeamsHaveStatistics,
    },

    {
      name:
        "team_stat_source_ownership",

      passed:
        teamStatistics.length ===
          2 &&
        teamStatistics.every(
          (statistic) =>
            statistic.dataSource
              ?.code ===
            "goal-api",
        ),
    },

    {
      name:
        "player_statistics_present",

      passed:
        playerStatistics.length >
        0,
    },

    {
      name:
        "player_statistics_unique",

      passed:
        uniquePlayerStatIds.size ===
        playerStatIds.length,
    },

    {
      name:
        "player_statistics_belong_to_fixture_teams",

      passed:
        playerStatistics.every(
          (statistic) =>
            validMatchTeamIds.has(
              statistic.teamId,
            ),
        ),
    },

    {
      name:
        "player_stat_source_ownership",

      passed:
        playerStatistics.length >
          0 &&
        playerStatistics.every(
          (statistic) =>
            statistic.dataSource
              ?.code ===
            "big-balls-data",
        ),
    },

    {
      name:
        "barcelona_player_statistics_present",

      passed:
        playerStatistics.some(
          (statistic) =>
            statistic.teamId ===
            barcelonaId,
        ),
    },

    {
      name:
        "xg_xa_remain_missing",

      passed:
        teamStatistics.every(
          (statistic) =>
            statistic.xG ===
            null,
        ) &&
        playerStatistics.every(
          (statistic) =>
            statistic.xG ===
              null &&
            statistic.xA ===
              null,
        ),
    },

    {
      name:
        "goal_match_mapping_present",

      passed:
        mappings.some(
          (mapping) =>
            mapping.dataSource
              .code ===
            "goal-api",
        ),
    },

    {
      name:
        "big_balls_match_mapping_present",

      passed:
        mappings.some(
          (mapping) =>
            mapping.dataSource
              .code ===
            "big-balls-data",
        ),
    },
  ];

  return {
    match: {
      id:
        match.id,

      kickoff:
        match.kickoff.toString(),

      status:
        match.status,

      competition:
        match.competition
          .name,

      home: {
        id:
          match.homeTeamId,

        name:
          match.homeTeam
            .name,

        score:
          match.homeScore,
      },

      away: {
        id:
          match.awayTeamId,

        name:
          match.awayTeam
            .name,

        score:
          match.awayScore,
      },
    },

    coverage: {
      homeFormation:
        homeLineup
          ?.formation ??
        null,

      awayFormation:
        awayLineup
          ?.formation ??
        null,

      homeStarters:
        homeLineup
          ?.starters
          .length ?? 0,

      awayStarters:
        awayLineup
          ?.starters
          .length ?? 0,

      homeBench:
        homeLineup
          ?.bench.length ??
        0,

      awayBench:
        awayLineup
          ?.bench.length ??
        0,

      scoringEvents:
        events.length,

      teamStatisticRows:
        teamStatistics.length,

      playerStatisticRows:
        playerStatistics.length,

      barcelonaPlayerStatisticRows:
        playerStatistics.filter(
          (statistic) =>
            statistic.teamId ===
            barcelonaId,
        ).length,

      unresolvedIdentities:
        unresolved.length,
    },

    lineups:
      lineupReport,

    events:
      events.map(
        (event) => ({
          id:
            event.id,

          type:
            event.type,

          minute:
            event.minute,

          order:
            event.eventOrder,

          team:
            event.team
              ?.name ??
            null,

          scorer:
            event.primaryPlayer
              ?.displayName ??
            null,

          assist:
            event.relatedPlayer
              ?.displayName ??
            null,

          source:
            event.dataSource
              ?.code ??
            null,

          xG:
            event.xG,

          coordinates:
            event.startX ===
                null &&
              event.startY ===
                null
              ? null
              : {
                  x:
                    event.startX,

                  y:
                    event.startY,
                },
        }),
      ),

    teamStatistics:
      teamStatistics.map(
        (statistic) => ({
          team:
            statistic.team
              .name,

          source:
            statistic.dataSource
              ?.code ??
            null,

          possession:
            statistic.possession,

          shots:
            statistic.shots,

          shotsOnTarget:
            statistic.shotsOnTarget,

          shotsOffTarget:
            statistic.shotsOffTarget,

          blockedShots:
            statistic.blockedShots,

          shotsInsideBox:
            statistic.shotsInsideBox,

          shotsOutsideBox:
            statistic.shotsOutsideBox,

          passes:
            statistic.passes,

          completedPasses:
            statistic.completedPasses,

          passAccuracy:
            statistic.passAccuracy,

          corners:
            statistic.corners,

          fouls:
            statistic.fouls,

          offsides:
            statistic.offsides,

          saves:
            statistic.saves,

          attacks:
            statistic.attacks,

          dangerousAttacks:
            statistic.dangerousAttacks,

          xG:
            statistic.xG,
        }),
      ),

    barcelonaPlayerStatistics:
      playerStatistics
        .filter(
          (statistic) =>
            statistic.teamId ===
            barcelonaId,
        )
        .map(
          (statistic) => ({
            playerId:
              statistic.playerId,

            name:
              statistic.player
                .displayName,

            source:
              statistic.dataSource
                ?.code ??
              null,

            minutes:
              statistic.minutes,

            goals:
              statistic.goals,

            assists:
              statistic.assists,

            shots:
              statistic.shots,

            shotsOnTarget:
              statistic.shotsOnTarget,

            passes:
              statistic.passes,

            completedPasses:
              statistic.completedPasses,

            passAccuracy:
              statistic.passAccuracy,

            keyPasses:
              statistic.keyPasses,

            tackles:
              statistic.tackles,

            blocks:
              statistic.blocks,

            interceptions:
              statistic.interceptions,

            duelsWon:
              statistic.duelsWon,

            duelsTotal:
              statistic.duelsTotal,

            dribblesAttempted:
              statistic.dribblesAttempted,

            successfulDribbles:
              statistic.successfulDribbles,

            fouls:
              statistic.fouls,

            saves:
              statistic.saves,

            rating:
              statistic.rating,

            xG:
              statistic.xG,

            xA:
              statistic.xA,
          }),
        ),

    sourceOwnership: {
      fixturesResults:
        "football-data-org",

      lineupBenchFormation:
        "goal-api",

      scoringEvents:
        "goal-api",

      teamStatistics:
        "goal-api",

      playerStatisticsRatings:
        "big-balls-data",

      futurePlayerStatFallback:
        "statshawk",
    },

    unresolvedIdentityCount:
      unresolved.length,

    unresolvedIdentities:
      unresolved,

    explicitGaps: [
      "expected goals (xG)",
      "expected assists (xA)",
      "shot coordinates",
      "complete card timeline",
      "complete substitution timeline",
      "tracking-derived positions",
    ],

    invariants,

    allPassed:
      invariants.every(
        (invariant) =>
          invariant.passed,
      ),
  };
}
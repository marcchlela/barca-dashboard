import "server-only";

import { db } from "../../../prisma/db";

function asObject(
  value: unknown,
): Record<string, unknown> | null {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  )
    ? (value as Record<
        string,
        unknown
      >)
    : null;
}

function stringValue(
  object:
    | Record<string, unknown>
    | null,
  key: string,
) {
  const value =
    object?.[key];

  return typeof value === "string"
    ? value
    : null;
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
    !match.homeTeam.isBarcelona &&
    !match.awayTeam.isBarcelona
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
      "Rich-match QA currently accepts finished matches only.",
    );
  }

  if (
    match.homeScore === null ||
    match.awayScore === null
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
    const lineup
    of lineups
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
        .include("player")
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
      .include("player")
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

  const goalMapping =
    mappings.find(
      (mapping) =>
        mapping.dataSource
          .code ===
        "goal-api",
    );

  const bigBallsMapping =
    mappings.find(
      (mapping) =>
        mapping.dataSource
          .code ===
        "big-balls-data",
    );

  const bigBallsMetadata =
    asObject(
      bigBallsMapping
        ?.metadata,
    );

  const fallbackMode =
    stringValue(
      bigBallsMetadata,
      "fallbackMode",
    );

  const hasGoalCoverage =
    Boolean(
      goalMapping,
    );

  const isBigBallsFallback =
    !hasGoalCoverage &&
    fallbackMode ===
      "big-balls-only";

  const coverageMode =
    hasGoalCoverage
      ? "full-rich"
      : isBigBallsFallback
        ? "partial-big-balls"
        : "unknown";

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

  const validMatchTeamIds =
    new Set([
      match.homeTeamId,
      match.awayTeamId,
    ]);

  const allowedPlayerSources =
    new Set([
      "big-balls-data",
      "statshawk",
    ]);

  const allowedTeamSources =
    new Set([
      "goal-api",
      "big-balls-data",
    ]);

  const playerSourceCounts =
    playerStatistics.reduce<
      Record<string, number>
    >(
      (
        counts,
        statistic,
      ) => {
        const code =
          statistic.dataSource
            ?.code ??
          "unknown";

        counts[code] =
          (
            counts[code] ??
            0
          ) + 1;

        return counts;
      },
      {},
    );

  const teamSourceCounts =
    teamStatistics.reduce<
      Record<string, number>
    >(
      (
        counts,
        statistic,
      ) => {
        const code =
          statistic.dataSource
            ?.code ??
          "unknown";

        counts[code] =
          (
            counts[code] ??
            0
          ) + 1;

        return counts;
      },
      {},
    );

  const barcelonaPlayerStatistics =
    playerStatistics.filter(
      (statistic) =>
        statistic.teamId ===
        barcelonaId,
    );

  const canonicalMergeRows =
    barcelonaPlayerStatistics.filter(
      (statistic) => {
        const raw =
          asObject(
            statistic.rawData,
          );

        return Boolean(
          asObject(
            raw?.canonicalMerge,
          ),
        );
      },
    );

  const fieldSourceCounts:
    Record<
      string,
      number
    > = {};

  let canonicalConflictCount =
    0;

  for (
    const statistic
    of canonicalMergeRows
  ) {
    const raw =
      asObject(
        statistic.rawData,
      );

    const canonical =
      asObject(
        raw?.canonicalMerge,
      );

    const fieldSources =
      asObject(
        canonical?.fieldSources,
      );

    for (
      const value
      of Object.values(
        fieldSources ??
        {},
      )
    ) {
      if (
        typeof value !==
        "string"
      ) {
        continue;
      }

      fieldSourceCounts[value] =
        (
          fieldSourceCounts[
            value
          ] ??
          0
        ) + 1;
    }

    const conflicts =
      canonical?.conflicts;

    if (
      Array.isArray(
        conflicts,
      )
    ) {
      canonicalConflictCount +=
        conflicts.length;
    }
  }

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

  const invariants = [
    {
      name:
        "finished_barcelona_fixture",

      passed:
        match.status ===
          "finished" &&
        (
          match.homeTeam
            .isBarcelona ||
          match.awayTeam
            .isBarcelona
        ),
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
        "coverage_mode_known",

      passed:
        coverageMode !==
        "unknown",
    },

    /*
     * GOAL-dependent checks are required only when GOAL
     * actually has verified coverage for the fixture.
     */
    {
      name:
        "lineup_shape_valid_for_coverage",

      passed:
        hasGoalCoverage
          ? (
              lineups.length ===
                2 &&
              homeLineup
                ?.starters
                .length ===
                11 &&
              awayLineup
                ?.starters
                .length ===
                11
            )
          : lineups.length ===
            0,
    },

    {
      name:
        "lineup_confirmation_valid_for_coverage",

      passed:
        hasGoalCoverage
          ? (
              lineupReport
                .length ===
                2 &&
              lineupReport.every(
                (lineup) =>
                  lineup.isConfirmed,
              )
            )
          : true,
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
        "goal_events_valid_for_coverage",

      passed:
        hasGoalCoverage
          ? (
              events.length ===
                expectedGoals &&
              homeGoalEvents ===
                match.homeScore &&
              awayGoalEvents ===
                match.awayScore
            )
          : events.length ===
            0,
    },

    {
      name:
        "goal_source_ownership",

      passed:
        hasGoalCoverage
          ? (
              events.length ===
                expectedGoals &&
              events.every(
                (event) =>
                  event.dataSource
                    ?.code ===
                  "goal-api",
              )
            )
          : true,
    },

    {
      name:
        "goal_players_resolved",

      passed:
        hasGoalCoverage
          ? events.every(
              (event) =>
                event.primaryPlayerId !==
                null,
            )
          : true,
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
            allowedTeamSources.has(
              statistic.dataSource
                ?.code ??
                "",
            ),
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
        uniquePlayerStatIds
          .size ===
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
            allowedPlayerSources.has(
              statistic.dataSource
                ?.code ??
                "",
            ),
        ),
    },

    {
      name:
        "barcelona_player_statistics_present",

      passed:
        barcelonaPlayerStatistics
          .length > 0,
    },

    {
      name:
        "canonical_merge_provenance_present",

      passed:
        canonicalMergeRows
          .length ===
        barcelonaPlayerStatistics
          .length,
    },

    {
      name:
        "canonical_merge_has_no_conflicts",

      passed:
        canonicalConflictCount ===
        0,
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
        "big_balls_match_mapping_present",

      passed:
        Boolean(
          bigBallsMapping,
        ),
    },

    {
      name:
        "goal_mapping_matches_coverage",

      passed:
        hasGoalCoverage
          ? Boolean(
              goalMapping,
            )
          : true,
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

      coverageMode,

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
      goalAvailable:
        hasGoalCoverage,

      bigBallsFallback:
        isBigBallsFallback,

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

      scoringEvents:
        events.length,

      teamStatisticRows:
        teamStatistics.length,

      playerStatisticRows:
        playerStatistics.length,

      barcelonaPlayerStatisticRows:
        barcelonaPlayerStatistics.length,

      canonicalPlayerRows:
        canonicalMergeRows.length,

      unresolvedBigBallsIdentities:
        unresolved.length,
    },

    provenance: {
      playerRowSources:
        playerSourceCounts,

      teamRowSources:
        teamSourceCounts,

      fieldSources:
        fieldSourceCounts,

      canonicalConflicts:
        canonicalConflictCount,
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

          xG:
            statistic.xG,
        }),
      ),

    barcelonaPlayerStatistics:
      barcelonaPlayerStatistics.map(
        (statistic) => {
          const raw =
            asObject(
              statistic.rawData,
            );

          const canonical =
            asObject(
              raw?.canonicalMerge,
            );

          return {
            playerId:
              statistic.playerId,

            name:
              statistic.player
                .displayName,

            primarySource:
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

            saves:
              statistic.saves,

            goalsConceded:
              statistic.goalsConceded,

            cleanSheet:
              statistic.cleanSheet,

            rating:
              statistic.rating,

            xG:
              statistic.xG,

            xA:
              statistic.xA,

            fieldSources:
              asObject(
                canonical
                  ?.fieldSources,
              ),

            identities:
              asObject(
                canonical
                  ?.identities,
              ),
          };
        },
      ),

    sourcePolicy: {
      fixturesResults:
        "football-data-org",

      lineupBenchFormation:
        "goal-api when available",

      scoringEvents:
        "goal-api when available",

      teamStatistics:
        "goal-api primary; big-balls-data fallback",

      playerStatistics:
        "big-balls-data primary; statshawk field fallback",

      ratings:
        "big-balls-data",

      xGxA:
        "NO_FREE_RELIABLE_SOURCE",
    },

    unresolvedIdentityCount:
      unresolved.length,

    unresolvedIdentities:
      unresolved,

    invariants,

    allPassed:
      invariants.every(
        (invariant) =>
          invariant.passed,
      ),
  };
}
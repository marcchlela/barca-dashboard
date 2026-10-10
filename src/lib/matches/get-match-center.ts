import "server-only";

import {
  db,
} from "../../prisma/db";

function sortLineupPlayers<
  T extends {
    lineupOrdinal:
      number | null;

    shirtNumber:
      number | null;
  },
>(
  players:
    T[],
) {
  return [...players].sort(
    (
      left,
      right,
    ) => {
      const leftOrder =
        left.lineupOrdinal ??
        Number.MAX_SAFE_INTEGER;

      const rightOrder =
        right.lineupOrdinal ??
        Number.MAX_SAFE_INTEGER;

      if (
        leftOrder !==
        rightOrder
      ) {
        return (
          leftOrder -
          rightOrder
        );
      }

      return (
        (
          left.shirtNumber ??
          Number.MAX_SAFE_INTEGER
        ) -
        (
          right.shirtNumber ??
          Number.MAX_SAFE_INTEGER
        )
      );
    },
  );
}

function serializePlayerStatistic(
  statistic: {
    minutes:
      number | null;

    goals:
      number | null;

    assists:
      number | null;

    shots:
      number | null;

    shotsOnTarget:
      number | null;

    xG:
      number | null;

    xA:
      number | null;

    touches:
      number | null;

    passes:
      number | null;

    completedPasses:
      number | null;

    passAccuracy:
      number | null;

    keyPasses:
      number | null;

    progressivePasses:
      number | null;

    carries:
      number | null;

    progressiveCarries:
      number | null;

    tackles:
      number | null;

    blocks:
      number | null;

    interceptions:
      number | null;

    recoveries:
      number | null;

    duelsWon:
      number | null;

    duelsTotal:
      number | null;

    dribblesAttempted:
      number | null;

    successfulDribbles:
      number | null;

    fouls:
      number | null;

    yellowCards:
      number | null;

    redCards:
      number | null;

    saves:
      number | null;

    goalsConceded:
      number | null;

    cleanSheet:
      boolean | null;

    rating:
      number | null;
  },
) {
  return {
    minutes:
      statistic.minutes,

    goals:
      statistic.goals,

    assists:
      statistic.assists,

    shooting: {
      shots:
        statistic.shots,

      shotsOnTarget:
        statistic
          .shotsOnTarget,

      xG:
        statistic.xG,
    },

    passing: {
      passes:
        statistic.passes,

      completed:
        statistic
          .completedPasses,

      accuracy:
        statistic
          .passAccuracy,

      keyPasses:
        statistic
          .keyPasses,

      progressivePasses:
        statistic
          .progressivePasses,
    },

    carrying: {
      carries:
        statistic.carries,

      progressiveCarries:
        statistic
          .progressiveCarries,

      dribblesAttempted:
        statistic
          .dribblesAttempted,

      successfulDribbles:
        statistic
          .successfulDribbles,
    },

    defending: {
      tackles:
        statistic.tackles,

      blocks:
        statistic.blocks,

      interceptions:
        statistic
          .interceptions,

      recoveries:
        statistic
          .recoveries,

      duelsWon:
        statistic.duelsWon,

      duelsTotal:
        statistic.duelsTotal,
    },

    discipline: {
      fouls:
        statistic.fouls,

      yellowCards:
        statistic
          .yellowCards,

      redCards:
        statistic.redCards,
    },

    goalkeeping: {
      saves:
        statistic.saves,

      goalsConceded:
        statistic
          .goalsConceded,

      cleanSheet:
        statistic.cleanSheet,
    },

    xA:
      statistic.xA,

    rating:
      statistic.rating,
  };
}

function serializeTeamStatistic(
  statistic: {
    possession:
      number | null;

    shots:
      number | null;

    shotsOnTarget:
      number | null;

    shotsOffTarget:
      number | null;

    blockedShots:
      number | null;

    shotsInsideBox:
      number | null;

    shotsOutsideBox:
      number | null;

    xG:
      number | null;

    passes:
      number | null;

    completedPasses:
      number | null;

    passAccuracy:
      number | null;

    corners:
      number | null;

    fouls:
      number | null;

    offsides:
      number | null;

    yellowCards:
      number | null;

    redCards:
      number | null;

    tackles:
      number | null;

    interceptions:
      number | null;

    clearances:
      number | null;

    saves:
      number | null;

    attacks:
      number | null;

    dangerousAttacks:
      number | null;

    freeKicks:
      number | null;

    goalKicks:
      number | null;

    throwIns:
      number | null;

    substitutions:
      number | null;
  },
) {
  return {
    possession:
      statistic.possession,

    shooting: {
      shots:
        statistic.shots,

      onTarget:
        statistic
          .shotsOnTarget,

      offTarget:
        statistic
          .shotsOffTarget,

      blocked:
        statistic
          .blockedShots,

      insideBox:
        statistic
          .shotsInsideBox,

      outsideBox:
        statistic
          .shotsOutsideBox,

      xG:
        statistic.xG,
    },

    passing: {
      passes:
        statistic.passes,

      completed:
        statistic
          .completedPasses,

      accuracy:
        statistic
          .passAccuracy,
    },

    corners:
      statistic.corners,

    fouls:
      statistic.fouls,

    offsides:
      statistic.offsides,

    cards: {
      yellow:
        statistic
          .yellowCards,

      red:
        statistic.redCards,
    },

    defending: {
      tackles:
        statistic.tackles,

      interceptions:
        statistic
          .interceptions,

      clearances:
        statistic
          .clearances,
    },

    saves:
      statistic.saves,

    attacks:
      statistic.attacks,

    dangerousAttacks:
      statistic
        .dangerousAttacks,

    restarts: {
      freeKicks:
        statistic.freeKicks,

      goalKicks:
        statistic.goalKicks,

      throwIns:
        statistic.throwIns,
    },

    substitutions:
      statistic
        .substitutions,
  };
}

export async function getMatchCenter(
  matchId:
    string,
  userId: string | null = null,
) {
  /*
  |--------------------------------------------------------------------------
  | Base match
  |--------------------------------------------------------------------------
  */

  const match =
    await db.orm.public.Match
      .where({
        id:
          matchId,
      })
      .include(
        "homeTeam",
      )
      .include(
        "awayTeam",
      )
      .include(
        "competition",
      )
      .include(
        "season",
      )
      .first();

  if (!match) {
    return null;
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

  const barcelonaTeamId =
    match.homeTeam
      .isBarcelona
      ? match.homeTeamId
      : match.awayTeamId;

  const barcelonaSide =
    match.homeTeam
      .isBarcelona
      ? "home"
      : "away";

  /*
  |--------------------------------------------------------------------------
  | Rich data
  |--------------------------------------------------------------------------
  */

  const [
    lineupRows,
    eventRows,
    teamStatisticRows,
    playerStatisticRows,
    mediaRows,
    diary,
  ] =
    await Promise.all([
      db.orm.public.Lineup
        .where({
          matchId,
        })
        .all(),

      db.orm.public.MatchEvent
        .where({
          matchId,
        })
        .include(
          "team",
        )
        .include(
          "primaryPlayer",
        )
        .include(
          "relatedPlayer",
        )
        .orderBy(
          (event) =>
            event.eventOrder
              .asc(),
        )
        .all(),

      db.orm.public.MatchStatistic
        .where({
          matchId,
        })
        .include(
          "team",
        )
        .all(),

      db.orm.public.PlayerMatchStatistic
        .where({
          matchId,
        })
        .include(
          "player",
        )
        .include(
          "team",
        )
        .all(),

      db.orm.public.MediaItem
        .where({
          matchId,
        })
        .all(),

      userId ? db.orm.public.MatchDiaryEntry.where({ userId, matchId }).first() : Promise.resolve(null),
    ]);

  /*
  |--------------------------------------------------------------------------
  | Player-stat lookup
  |--------------------------------------------------------------------------
  */

  const playerStatistics =
    new Map(
      playerStatisticRows.map(
        (
          statistic,
        ) => [
          statistic.playerId,
          statistic,
        ],
      ),
    );

  /*
  |--------------------------------------------------------------------------
  | Lineups
  |--------------------------------------------------------------------------
  */

  const serializedLineups =
    [];

  for (
    const lineup
    of lineupRows
  ) {
    const team =
      lineup.teamId ===
      match.homeTeamId
        ? match.homeTeam
        : match.awayTeam;

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

    const serializeEntry =
      (
        entry:
          (typeof entries)[number],
      ) => {
        const statistic =
          playerStatistics.get(
            entry.playerId,
          );

        return {
          id:
            entry.id,

          player: {
            id:
              entry.playerId,

            name:
              entry.player
                .displayName,

            firstName:
              entry.player
                .firstName,

            lastName:
              entry.player
                .lastName,

            portraitUrl:
              entry.player
                .portraitUrl,

            primaryPosition:
              entry.player
                .primaryPosition,

            nationality:
              entry.player
                .nationality,
          },

          role:
            entry.role,

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

          enteredMinute:
            entry.enteredMinute,

          leftMinute:
            entry.leftMinute,

          statistics:
            statistic
              ? serializePlayerStatistic(
                  statistic,
                )
              : null,
        };
      };

    const starters =
      sortLineupPlayers(
        entries
          .filter(
            (entry) =>
              entry.role ===
              "starter",
          )
          .map(
            serializeEntry,
          ),
      );

    const bench =
      sortLineupPlayers(
        entries
          .filter(
            (entry) =>
              entry.role ===
              "substitute",
          )
          .map(
            serializeEntry,
          ),
      );

    serializedLineups.push({
      id:
        lineup.id,

      team: {
        id:
          team.id,

        name:
          team.name,

        shortName:
          team.shortName,

        code:
          team.code,

        crestUrl:
          team.crestUrl,

        isBarcelona:
          team.isBarcelona,
      },

      formation:
        lineup.formation,

      coachName:
        lineup.coachName,

      /*
       * GOAL did not expose a confirmed-vs-predicted flag
       * during our provider audit.
       *
       * false must therefore mean UNKNOWN, not "predicted".
       */
      confirmationStatus:
        lineup.isConfirmed
          ? "confirmed"
          : "unknown",

      starters,

      bench,
    });
  }

  const homeLineup =
    serializedLineups.find(
      (lineup) =>
        lineup.team.id ===
        match.homeTeamId,
    ) ?? null;

  const awayLineup =
    serializedLineups.find(
      (lineup) =>
        lineup.team.id ===
        match.awayTeamId,
    ) ?? null;

  /*
  |--------------------------------------------------------------------------
  | Events
  |--------------------------------------------------------------------------
  */

  const events =
    eventRows.map(
      (event) => ({
        id:
          event.id,

        order:
          event.eventOrder,

        type:
          event.type,

        period:
          event.period,

        minute:
          event.minute,

        second:
          event.second,

        team:
          event.team
            ? {
                id:
                  event.team.id,

                name:
                  event.team.name,

                shortName:
                  event.team
                    .shortName,

                code:
                  event.team.code,

                crestUrl:
                  event.team
                    .crestUrl,

                isBarcelona:
                  event.team
                    .isBarcelona,
              }
            : null,

        primaryPlayer:
          event.primaryPlayer
            ? {
                id:
                  event
                    .primaryPlayer
                    .id,

                name:
                  event
                    .primaryPlayer
                    .displayName,

                portraitUrl:
                  event
                    .primaryPlayer
                    .portraitUrl,
              }
            : null,

        relatedPlayer:
          event.relatedPlayer
            ? {
                id:
                  event
                    .relatedPlayer
                    .id,

                name:
                  event
                    .relatedPlayer
                    .displayName,

                portraitUrl:
                  event
                    .relatedPlayer
                    .portraitUrl,
              }
            : null,

        xG:
          event.xG,

        outcome:
          event.outcome,

        bodyPart:
          event.bodyPart,

        playPattern:
          event.playPattern,

        coordinates:
          event.startX !==
              null &&
            event.startY !==
              null
            ? {
                start: {
                  x:
                    event.startX,

                  y:
                    event.startY,
                },

                end:
                  event.endX !==
                      null &&
                    event.endY !==
                      null
                    ? {
                        x:
                          event.endX,

                        y:
                          event.endY,
                      }
                    : null,
              }
            : null,
      }),
    );

  /*
  |--------------------------------------------------------------------------
  | Team statistics
  |--------------------------------------------------------------------------
  */

  const teamStats =
    teamStatisticRows.map(
      (row) => ({
        team: {
          id:
            row.team.id,

          name:
            row.team.name,

          shortName:
            row.team
              .shortName,

          code:
            row.team.code,

          crestUrl:
            row.team
              .crestUrl,

          isBarcelona:
            row.team
              .isBarcelona,
        },

        statistics:
          serializeTeamStatistic(
            row,
          ),
      }),
    );

  const homeTeamStatistics =
    teamStats.find(
      (row) =>
        row.team.id ===
        match.homeTeamId,
    ) ?? null;

  const awayTeamStatistics =
    teamStats.find(
      (row) =>
        row.team.id ===
        match.awayTeamId,
    ) ?? null;

  /*
  |--------------------------------------------------------------------------
  | Player performances
  |--------------------------------------------------------------------------
  */

  const performances =
    playerStatisticRows
      .map(
        (row) => ({
          player: {
            id:
              row.player.id,

            name:
              row.player
                .displayName,

            firstName:
              row.player
                .firstName,

            lastName:
              row.player
                .lastName,

            portraitUrl:
              row.player
                .portraitUrl,

            primaryPosition:
              row.player
                .primaryPosition,

            nationality:
              row.player
                .nationality,
          },

          team: {
            id:
              row.team.id,

            name:
              row.team.name,

            shortName:
              row.team
                .shortName,

            code:
              row.team.code,

            crestUrl:
              row.team
                .crestUrl,

            isBarcelona:
              row.team
                .isBarcelona,
          },

          statistics:
            serializePlayerStatistic(
              row,
            ),
        }),
      )
      .sort(
        (
          left,
          right,
        ) => {
          const leftMinutes =
            left.statistics
              .minutes ?? 0;

          const rightMinutes =
            right.statistics
              .minutes ?? 0;

          if (
            rightMinutes !==
            leftMinutes
          ) {
            return (
              rightMinutes -
              leftMinutes
            );
          }

          return left.player.name
            .localeCompare(
              right.player.name,
            );
        },
      );

  const barcelonaPerformances =
    performances.filter(
      (performance) =>
        performance.team.id ===
        barcelonaTeamId,
    );

  const opponentPerformances =
    performances.filter(
      (performance) =>
        performance.team.id !==
        barcelonaTeamId,
    );

  /*
  |--------------------------------------------------------------------------
  | Media
  |--------------------------------------------------------------------------
  */

  const media =
    mediaRows
      .map(
        (item) => ({
          id:
            item.id,

          type:
            item.type,

          title:
            item.title,

          description:
            item.description,

          url:
            item.url,

          externalMediaId:
            item.externalMediaId,

          thumbnailUrl:
            item.thumbnailUrl,

          isOfficial:
            item.isOfficial,

          publishedAt:
            item.publishedAt
              ?.toString() ??
            null,
        }),
      )
      .sort(
        (
          left,
          right,
        ) =>
          (
            new Date(
              right.publishedAt ??
                0,
            ).getTime()
          ) -
          (
            new Date(
              left.publishedAt ??
                0,
            ).getTime()
          ),
      );

  /*
  |--------------------------------------------------------------------------
  | Coverage
  |--------------------------------------------------------------------------
  */

  const completeHomeXI =
    homeLineup
      ?.starters.length ===
    11;

  const completeAwayXI =
    awayLineup
      ?.starters.length ===
    11;

  const completeLineups =
    completeHomeXI &&
    completeAwayXI;

  const completeTeamStatistics =
    Boolean(
      homeTeamStatistics &&
      awayTeamStatistics,
    );

  const hasBarcelonaPlayerStatistics =
    barcelonaPerformances.length >
    0;

  const hasAnyRichData =
    Boolean(
      homeLineup ||
      awayLineup ||
      homeTeamStatistics ||
      awayTeamStatistics ||
      events.length ||
      performances.length,
    );

  const richness =
    completeLineups &&
    completeTeamStatistics &&
    hasBarcelonaPlayerStatistics
      ? "rich"
      : hasAnyRichData
        ? "partial"
        : "basic";

  /*
  |--------------------------------------------------------------------------
  | Result
  |--------------------------------------------------------------------------
  */

  return {
    match: {
      id:
        match.id,

      kickoff:
        match.kickoff
          .toString(),

      status:
        match.status,

      matchday:
        match.matchday,

      stage:
        match.stage,

      round:
        match.round,

      leg:
        match.leg,

      venue:
        match.venue,

      neutralVenue:
        match.neutralVenue,

      attendance:
        match.attendance,

      season: {
        id:
          match.season.id,

        label:
          match.season.label,
      },

      competition: {
        id:
          match.competition
            .id,

        name:
          match.competition
            .name,

        shortName:
          match.competition
            .shortName,

        code:
          match.competition
            .code,

        logoUrl:
          match.competition
            .logoUrl,

        type:
          match.competition
            .type,
      },

      homeTeam: {
        id:
          match.homeTeam.id,

        name:
          match.homeTeam.name,

        shortName:
          match.homeTeam
            .shortName,

        code:
          match.homeTeam.code,

        crestUrl:
          match.homeTeam
            .crestUrl,

        isBarcelona:
          match.homeTeam
            .isBarcelona,
      },

      awayTeam: {
        id:
          match.awayTeam.id,

        name:
          match.awayTeam.name,

        shortName:
          match.awayTeam
            .shortName,

        code:
          match.awayTeam.code,

        crestUrl:
          match.awayTeam
            .crestUrl,

        isBarcelona:
          match.awayTeam
            .isBarcelona,
      },

      score: {
        home:
          match.homeScore,

        away:
          match.awayScore,

        extraTime: {
          home:
            match
              .homeExtraTimeScore,

          away:
            match
              .awayExtraTimeScore,
        },

        penalties: {
          home:
            match
              .homePenaltyScore,

          away:
            match
              .awayPenaltyScore,
        },
      },

      barcelona: {
        teamId:
          barcelonaTeamId,

        side:
          barcelonaSide,
      },
    },

    lineups: {
      home:
        homeLineup,

      away:
        awayLineup,
    },

    events,

    teamStatistics: {
      home:
        homeTeamStatistics,

      away:
        awayTeamStatistics,
    },

    performances: {
      barcelona:
        barcelonaPerformances,

      opponent:
        opponentPerformances,
    },

    media,

    diary:
      diary
        ? {
            id:
              diary.id,

            watched:
              diary.watched,

            watchType:
              diary.watchType,

            watchedAt:
              diary.watchedAt
                ?.toString() ??
              null,

            rating:
              diary.rating,

            favouritePlayerId:
              diary
                .favouritePlayerId,

            favouriteGoalEventId:
              diary
                .favouriteGoalEventId,

            notes:
              diary.notes,
          }
        : null,

    coverage: {
      richness,

      lineups: {
        home:
          Boolean(
            homeLineup,
          ),

        away:
          Boolean(
            awayLineup,
          ),

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
            ?.bench.length ?? 0,

        awayBench:
          awayLineup
            ?.bench.length ?? 0,

        complete:
          completeLineups,
      },

      formations: {
        home:
          homeLineup
            ?.formation ??
          null,

        away:
          awayLineup
            ?.formation ??
          null,
      },

      events: {
        count:
          events.length,

        scoringEvents:
          events.filter(
            (event) =>
              event.type ===
                "goal" ||
              event.type ===
                "penalty_goal" ||
              event.type ===
                "own_goal",
          ).length,
      },

      teamStatistics: {
        home:
          Boolean(
            homeTeamStatistics,
          ),

        away:
          Boolean(
            awayTeamStatistics,
          ),

        complete:
          completeTeamStatistics,
      },

      playerStatistics: {
        barcelona:
          barcelonaPerformances
            .length,

        opponent:
          opponentPerformances
            .length,

        ratings:
          performances.filter(
            (performance) =>
              performance
                .statistics
                .rating !==
              null,
          ).length,
      },

      media:
        media.length,
    },
  };
}

export type MatchCenterData =
  NonNullable<
    Awaited<
      ReturnType<
        typeof getMatchCenter
      >
    >
  >;

import "server-only";

import {
  db,
} from "../../prisma/db";

import {
  repairMojibake,
} from "../providers/shared/normalization";

import {
  buildAverageFromMatchHeatmaps,
  buildPlayerHeatmapProfile,
} from "./player-heatmap";

export type SquadPosition =
  | "goalkeeper"
  | "defender"
  | "midfielder"
  | "forward"
  | "unknown";

export type SquadAvailability =
  | "available"
  | "unavailable";

export async function getSquadOverview() {
  const generatedAt =
    new Date().toISOString();

  const season =
    await db.orm.public.Season
      .where({
        isCurrent:
          true,
      })
      .first();

  if (!season) {
    throw new Error(
      "No current season exists.",
    );
  }

  const barcelona =
    await db.orm.public.Team
      .where({
        isBarcelona:
          true,
      })
      .first();

  if (!barcelona) {
    throw new Error(
      "FC Barcelona does not exist in the database.",
    );
  }

  const [
    memberships,
    seasonMatches,
    playerStats,
    favourites,
    activeAbsences,
    seasonPlayerEvents,
  ] =
    await Promise.all([
      db.orm.public.SquadMembership
        .where({
          seasonId:
            season.id,

          teamId:
            barcelona.id,
        })
        .include(
          "player",
        )
        .all(),

      db.orm.public.Match
        .where({
          seasonId:
            season.id,
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
        .all(),

      db.orm.public.PlayerMatchStatistic
        .where({
          teamId:
            barcelona.id,
        })
        .all(),

      db.orm.public.FavouritePlayer
        .all(),

      db.orm.public.PlayerAbsence
        .where({
          seasonId:
            season.id,

          status:
            "active",
        })
        .all(),

      db.orm.public.MatchEvent
        .where({
          teamId:
            barcelona.id,
        })
        .all(),
    ]);

  /*
  |--------------------------------------------------------------------------
  | Barça match universe
  |--------------------------------------------------------------------------
  */

  const barcelonaMatches =
    seasonMatches.filter(
      (
        match,
      ) =>
        match.homeTeamId ===
          barcelona.id ||
        match.awayTeamId ===
          barcelona.id,
    );

  const barcelonaMatchIds =
    new Set(
      barcelonaMatches.map(
        (
          match,
        ) =>
          match.id,
      ),
    );

  const matchById =
    new Map(
      barcelonaMatches.map(
        (
          match,
        ) => [
          match.id,
          match,
        ],
      ),
    );

  /*
  |--------------------------------------------------------------------------
  | Stats by player
  |--------------------------------------------------------------------------
  */

  type PlayerStat =
    typeof playerStats[number];

  const statsByPlayer =
    new Map<
      string,
      PlayerStat[]
    >();

  for (
    const stat
    of playerStats
  ) {
    if (
      !barcelonaMatchIds.has(
        stat.matchId,
      )
    ) {
      continue;
    }

    const current =
      statsByPlayer.get(
        stat.playerId,
      ) ??
      [];

    current.push(
      stat,
    );

    statsByPlayer.set(
      stat.playerId,
      current,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Canonical spatial fallback
  |--------------------------------------------------------------------------
  */

  type SpatialEvent =
    typeof seasonPlayerEvents[number];

  const spatialEventsByPlayer =
    new Map<
      string,
      SpatialEvent[]
    >();

  for (
    const event
    of seasonPlayerEvents
  ) {
    if (
      !barcelonaMatchIds.has(
        event.matchId,
      )
    ) {
      continue;
    }

    if (
      !event.primaryPlayerId
    ) {
      continue;
    }

    if (
      typeof event.startX !==
        "number" ||
      typeof event.startY !==
        "number"
    ) {
      continue;
    }

    const current =
      spatialEventsByPlayer.get(
        event.primaryPlayerId,
      ) ??
      [];

    current.push(
      event,
    );

    spatialEventsByPlayer.set(
      event.primaryPlayerId,
      current,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Favourites
  |--------------------------------------------------------------------------
  */

  const favouriteByPlayer =
    new Map(
      favourites.map(
        (
          favourite,
        ) => [
          favourite.playerId,
          favourite,
        ],
      ),
    );

  /*
  |--------------------------------------------------------------------------
  | Absences
  |--------------------------------------------------------------------------
  */

  const absenceByPlayer =
    new Map<
      string,
      typeof activeAbsences[number]
    >();

  for (
    const absence
    of activeAbsences
  ) {
    const existing =
      absenceByPlayer.get(
        absence.playerId,
      );

    if (!existing) {
      absenceByPlayer.set(
        absence.playerId,
        absence,
      );

      continue;
    }

    const existingTime =
      existing.startDate
        ? new Date(
            existing.startDate.toString(),
          ).getTime()
        : 0;

    const candidateTime =
      absence.startDate
        ? new Date(
            absence.startDate.toString(),
          ).getTime()
        : 0;

    if (
      candidateTime >
      existingTime
    ) {
      absenceByPlayer.set(
        absence.playerId,
        absence,
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Current roster
  |--------------------------------------------------------------------------
  */

  const now =
    new Date(
      generatedAt,
    ).getTime();

  const players =
    memberships
      .filter(
        (
          membership,
        ) => {
          if (
            !membership.player ||
            !membership.player
              .isActive
          ) {
            return false;
          }

          if (
            !membership.leftAt
          ) {
            return true;
          }

          return (
            new Date(
              membership.leftAt.toString(),
            ).getTime() >
            now
          );
        },
      )
      .map(
        (
          membership,
        ) => {
          const player =
            membership.player;

          const allStats =
            statsByPlayer.get(
              player.id,
            ) ??
            [];

          const appearanceStats =
            allStats.filter(
              isActualAppearance,
            );

          const ratings =
            numericValues(
              appearanceStats,
              (
                stat,
              ) =>
                stat.rating,
            );

          const absence =
            absenceByPlayer.get(
              player.id,
            ) ??
            null;

          const position =
            resolvePosition(
              membership.position,
              player.primaryPosition,
            );

          /*
          |--------------------------------------------------------------------------
          | Season output
          |--------------------------------------------------------------------------
          */

          const minutes =
            sumDefaultZero(
              appearanceStats,
              (
                stat,
              ) =>
                stat.minutes,
            );

          const goals =
            sumDefaultZero(
              appearanceStats,
              (
                stat,
              ) =>
                stat.goals,
            );

          const assists =
            sumDefaultZero(
              appearanceStats,
              (
                stat,
              ) =>
                stat.assists,
            );

          const goalContributions =
            goals +
            assists;

          /*
          |--------------------------------------------------------------------------
          | Advanced metrics
          |--------------------------------------------------------------------------
          */

          const totalXg =
            sumNullable(
              appearanceStats,
              (
                stat,
              ) =>
                stat.xG,
            );

          const totalXa =
            sumNullable(
              appearanceStats,
              (
                stat,
              ) =>
                stat.xA,
            );

          const shots =
            sumNullable(
              appearanceStats,
              (
                stat,
              ) =>
                stat.shots,
            );

          const shotsOnTarget =
            sumNullable(
              appearanceStats,
              (
                stat,
              ) =>
                stat.shotsOnTarget,
            );

          const keyPasses =
            sumNullable(
              appearanceStats,
              (
                stat,
              ) =>
                stat.keyPasses,
            );

          const progressivePasses =
            sumNullable(
              appearanceStats,
              (
                stat,
              ) =>
                stat.progressivePasses,
            );

          const progressiveCarries =
            sumNullable(
              appearanceStats,
              (
                stat,
              ) =>
                stat.progressiveCarries,
            );

          const tackles =
            sumNullable(
              appearanceStats,
              (
                stat,
              ) =>
                stat.tackles,
            );

          const interceptions =
            sumNullable(
              appearanceStats,
              (
                stat,
              ) =>
                stat.interceptions,
            );

          const recoveries =
            sumNullable(
              appearanceStats,
              (
                stat,
              ) =>
                stat.recoveries,
            );

          const passes =
            sumNullable(
              appearanceStats,
              (
                stat,
              ) =>
                stat.passes,
            );

          const completedPasses =
            sumNullable(
              appearanceStats,
              (
                stat,
              ) =>
                stat.completedPasses,
            );

          const duelsWon =
            sumNullable(
              appearanceStats,
              (
                stat,
              ) =>
                stat.duelsWon,
            );

          const duelsTotal =
            sumNullable(
              appearanceStats,
              (
                stat,
              ) =>
                stat.duelsTotal,
            );

          const dribblesAttempted =
            sumNullable(
              appearanceStats,
              (
                stat,
              ) =>
                stat.dribblesAttempted,
            );

          const successfulDribbles =
            sumNullable(
              appearanceStats,
              (
                stat,
              ) =>
                stat.successfulDribbles,
            );

          const passAccuracy =
            passes !==
                null &&
              completedPasses !==
                null &&
              passes >
                0
              ? round(
                  (
                    completedPasses /
                    passes
                  ) *
                    100,
                  1,
                )
              : averageNullable(
                  appearanceStats,
                  (
                    stat,
                  ) =>
                    stat.passAccuracy,
                  1,
                );

          const duelWinRate =
            duelsWon !==
                null &&
              duelsTotal !==
                null &&
              duelsTotal >
                0
              ? round(
                  (
                    duelsWon /
                    duelsTotal
                  ) *
                    100,
                  1,
                )
              : null;

          const dribbleSuccessRate =
            successfulDribbles !==
                null &&
              dribblesAttempted !==
                null &&
              dribblesAttempted >
                0
              ? round(
                  (
                    successfulDribbles /
                    dribblesAttempted
                  ) *
                    100,
                  1,
                )
              : null;

          const contributionsPer90 =
            minutes >
            0
              ? round(
                  (
                    goalContributions *
                    90
                  ) /
                    minutes,
                  2,
                )
              : null;

          const minutesPerAppearance =
            appearanceStats.length >
            0
              ? round(
                  minutes /
                    appearanceStats.length,
                  0,
                )
              : null;

          /*
          |--------------------------------------------------------------------------
          | Appearance timeline
          |--------------------------------------------------------------------------
          */

          const appearanceTimeline =
            appearanceStats
              .map(
                (
                  stat,
                ) => {
                  const match =
                    matchById.get(
                      stat.matchId,
                    );

                  if (!match) {
                    return null;
                  }

                  const barcaHome =
                    match.homeTeamId ===
                    barcelona.id;

                  const opponent =
                    barcaHome
                      ? match.awayTeam
                      : match.homeTeam;

                  const barcaScore =
                    barcaHome
                      ? match.homeScore
                      : match.awayScore;

                  const opponentScore =
                    barcaHome
                      ? match.awayScore
                      : match.homeScore;

                  let result:
                    | "W"
                    | "D"
                    | "L"
                    | null =
                    null;

                  if (
                    barcaScore !==
                      null &&
                    opponentScore !==
                      null
                  ) {
                    result =
                      barcaScore >
                      opponentScore
                        ? "W"
                        : barcaScore <
                            opponentScore
                          ? "L"
                          : "D";
                  }

                  return {
                    matchId:
                      match.id,

                    kickoff:
                      match.kickoff.toString(),

                    competition:
                      match.competition
                        .shortName ??
                      match.competition
                        .name,

                    competitionCanonicalName:
                      match.competition
                        .name,

                    competitionLogoUrl:
                      match.competition
                        .logoUrl,

                    opponent: {
                      id:
                        opponent.id,

                      name:
                        repairMojibake(
                          opponent.shortName ??
                            opponent.name,
                        ),

                      crestUrl:
                        opponent.crestUrl,
                    },

                    venue:
                      barcaHome
                        ? (
                            "home" as const
                          )
                        : (
                            "away" as const
                          ),

                    score:
                      barcaScore !==
                          null &&
                        opponentScore !==
                          null
                        ? `${barcaScore}-${opponentScore}`
                        : null,

                    result,

                    minutes:
                      stat.minutes ??
                      0,

                    goals:
                      stat.goals ??
                      0,

                    assists:
                      stat.assists ??
                      0,

                    rating:
                      stat.rating !==
                      null
                        ? round(
                            stat.rating,
                            2,
                          )
                        : null,
                  };
                },
              )
              .filter(
                (
                  item,
                ): item is NonNullable<
                  typeof item
                > =>
                  item !==
                  null,
              )
              .sort(
                (
                  left,
                  right,
                ) =>
                  new Date(
                    left.kickoff,
                  ).getTime() -
                  new Date(
                    right.kickoff,
                  ).getTime(),
              );

          /*
          |--------------------------------------------------------------------------
          | Recent form
          |--------------------------------------------------------------------------
          */

          const recentMatches =
            appearanceTimeline
              .slice(
                -5,
              )
              .reverse();

          /*
          |--------------------------------------------------------------------------
          | Rating history
          |--------------------------------------------------------------------------
          */

          const ratingHistory =
            appearanceTimeline
              .filter(
                (
                  match,
                ) =>
                  match.rating !==
                  null,
              )
              .slice(
                -12,
              )
              .map(
                (
                  match,
                ) => ({
                  matchId:
                    match.matchId,

                  kickoff:
                    match.kickoff,

                  competition:
                    match.competition,

                  opponent:
                    match.opponent,

                  result:
                    match.result,

                  score:
                    match.score,

                  rating:
                    match.rating as number,
                }),
              );

          /*
          |--------------------------------------------------------------------------
          | Stored PitchAPI heatmaps
          |--------------------------------------------------------------------------
          */

          const storedHeatmaps =
            buildPlayerHeatmapProfile(
              appearanceStats,
            );

          const appearanceByMatchId =
            new Map(
              appearanceTimeline.map(
                (
                  appearance,
                ) => [
                  appearance.matchId,
                  appearance,
                ],
              ),
            );

          const matchHeatmaps =
            storedHeatmaps.matches
              .map(
                (
                  matchHeatmap,
                ) => {
                  const appearance =
                    appearanceByMatchId.get(
                      matchHeatmap.matchId,
                    );

                  return {
                    ...matchHeatmap,

                    kickoff:
                      appearance
                        ?.kickoff ??
                      null,

                    competition:
                      appearance
                        ?.competition ??
                      null,

                    competitionCanonicalName:
                      appearance
                        ?.competitionCanonicalName ??
                      null,

                    competitionLogoUrl:
                      appearance
                        ?.competitionLogoUrl ??
                      null,

                    opponent:
                      appearance
                        ?.opponent ??
                      null,

                    result:
                      appearance
                        ?.result ??
                      null,

                    score:
                      appearance
                        ?.score ??
                      null,
                  };
                },
              )
              .sort(
                (
                  left,
                  right,
                ) => {
                  if (
                    !left.kickoff ||
                    !right.kickoff
                  ) {
                    return 0;
                  }

                  return (
                    new Date(
                      right.kickoff,
                    ).getTime() -
                    new Date(
                      left.kickoff,
                    ).getTime()
                  );
                },
              );

          /*
          |--------------------------------------------------------------------------
          | Competition averages
          |--------------------------------------------------------------------------
          */

          const competitionAverageDefinitions = [
            {
              key:
                "la-liga",

              label:
                "La Liga",
            },

            {
              key:
                "ucl",

              label:
                "Champions League",
            },
          ] as const;

          const competitionAverages =
            competitionAverageDefinitions
              .map(
                (
                  definition,
                ) => {
                  const matches =
                    matchHeatmaps.filter(
                      (
                        match,
                      ) =>
                        competitionAverageKey(
                          match.competitionCanonicalName ??
                            match.competition,
                        ) ===
                        definition.key,
                    );

                  if (
                    matches.length ===
                    0
                  ) {
                    return null;
                  }

                  const average =
                    buildAverageFromMatchHeatmaps(
                      matches,
                    );

                  if (
                    average.matchesIncluded ===
                    0
                  ) {
                    return null;
                  }

                  const logoUrl =
                    matches.find(
                      (
                        match,
                      ) =>
                        Boolean(
                          match.competitionLogoUrl,
                        ),
                    )?.competitionLogoUrl ??
                    null;

                  return {
                    key:
                      definition.key,

                    label:
                      definition.label,

                    logoUrl,

                    ...average,
                  };
                },
              )
              .filter(
                (
                  item,
                ): item is NonNullable<
                  typeof item
                > =>
                  item !==
                  null,
              );

          /*
          |--------------------------------------------------------------------------
          | Canonical-coordinate fallback
          |--------------------------------------------------------------------------
          */

          const canonicalEventHeatmap =
            buildCanonicalEventHeatmap(
              spatialEventsByPlayer.get(
                player.id,
              ) ??
                [],
            );

          const heatmap =
            storedHeatmaps.average
              .matchesIncluded >
            0
              ? {
                  ...storedHeatmaps.average,

                  competitionAverages,

                  matches:
                    matchHeatmaps,
                }
              : {
                  ...canonicalEventHeatmap,

                  source:
                    "canonical-events" as const,

                  matchesIncluded:
                    0,

                  competitionAverages:
                    [],

                  matches:
                    [],
                };

          return {
            id:
              player.id,

            displayName:
              repairMojibake(
                player.displayName,
              ),

            firstName:
              player.firstName
                ? repairMojibake(
                    player.firstName,
                  )
                : null,

            lastName:
              player.lastName
                ? repairMojibake(
                    player.lastName,
                  )
                : null,

            birthDate:
              player.birthDate
                ? player.birthDate.toString()
                : null,

            age:
              player.birthDate
                ? calculateAge(
                    player.birthDate.toString(),
                    generatedAt,
                  )
                : null,

            nationality:
              player.nationality,

            preferredFoot:
              meaningfulString(
                player.preferredFoot,
              ),

            portraitUrl:
              player.portraitUrl,

            shirtNumber:
              membership.shirtNumber,

            position,

            isCaptain:
              membership.isCaptain,

            joinedAt:
              membership.joinedAt
                ? membership.joinedAt.toString()
                : null,

            isFavourite:
              favouriteByPlayer.has(
                player.id,
              ),

            favouriteSortOrder:
              favouriteByPlayer.get(
                player.id,
              )?.sortOrder ??
              null,

            availability:
              absence
                ? (
                    "unavailable" as const
                  )
                : (
                    "available" as const
                  ),

            absence:
              absence
                ? {
                    type:
                      absence.type,

                    reason:
                      absence.reason,

                    startDate:
                      absence.startDate
                        ? absence.startDate.toString()
                        : null,

                    endDate:
                      absence.endDate
                        ? absence.endDate.toString()
                        : null,
                  }
                : null,

            stats: {
              appearances:
                appearanceStats.length,

              trackedMatches:
                appearanceStats.length,

              minutes,

              goals,

              assists,

              goalContributions,

              contributionsPer90,

              minutesPerAppearance,

              averageRating:
                ratings.length >
                0
                  ? round(
                      ratings.reduce(
                        (
                          total,
                          rating,
                        ) =>
                          total +
                          rating,
                        0,
                      ) /
                        ratings.length,
                      2,
                    )
                  : null,

              advanced: {
                xG:
                  roundNullable(
                    totalXg,
                    2,
                  ),

                xA:
                  roundNullable(
                    totalXa,
                    2,
                  ),

                shots,

                shotsOnTarget,

                keyPasses,

                progressivePasses,

                progressiveCarries,

                tackles,

                interceptions,

                recoveries,

                passAccuracy,

                duelWinRate,

                dribbleSuccessRate,
              },
            },

            recentMatches,

            ratingHistory,

            heatmap,
          };
        },
      )
      .sort(
        (
          left,
          right,
        ) => {
          const positionDifference =
            positionRank(
              left.position,
            ) -
            positionRank(
              right.position,
            );

          if (
            positionDifference !==
            0
          ) {
            return positionDifference;
          }

          const leftNumber =
            left.shirtNumber ??
            999;

          const rightNumber =
            right.shirtNumber ??
            999;

          if (
            leftNumber !==
            rightNumber
          ) {
            return (
              leftNumber -
              rightNumber
            );
          }

          return left.displayName.localeCompare(
            right.displayName,
          );
        },
      );

  const unavailable =
    players.filter(
      (
        player,
      ) =>
        player.availability ===
        "unavailable",
    ).length;

  const favouritesCount =
    players.filter(
      (
        player,
      ) =>
        player.isFavourite,
    ).length;

  return {
    generatedAt,

    season: {
      id:
        season.id,

      label:
        season.label,
    },

    team: {
      id:
        barcelona.id,

      name:
        barcelona.name,

      shortName:
        barcelona.shortName,

      crestUrl:
        barcelona.crestUrl,
    },

    summary: {
      players:
        players.length,

      available:
        players.length -
        unavailable,

      unavailable,

      favourites:
        favouritesCount,

      goalkeepers:
        players.filter(
          (
            player,
          ) =>
            player.position ===
            "goalkeeper",
        ).length,

      defenders:
        players.filter(
          (
            player,
          ) =>
            player.position ===
            "defender",
        ).length,

      midfielders:
        players.filter(
          (
            player,
          ) =>
            player.position ===
            "midfielder",
        ).length,

      forwards:
        players.filter(
          (
            player,
          ) =>
            player.position ===
            "forward",
        ).length,
    },

    players,
  };
}

/*
|--------------------------------------------------------------------------
| Appearance detection
|--------------------------------------------------------------------------
*/

function isActualAppearance(
  statistic: {
    minutes:
      number | null;

    rating:
      number | null;

    goals:
      number | null;

    assists:
      number | null;
  },
) {
  return (
    (
      statistic.minutes ??
      0
    ) >
      0 ||
    statistic.rating !==
      null ||
    (
      statistic.goals ??
      0
    ) >
      0 ||
    (
      statistic.assists ??
      0
    ) >
      0
  );
}

/*
|--------------------------------------------------------------------------
| Competition heatmap groups
|--------------------------------------------------------------------------
*/

function competitionAverageKey(
  value:
    string | null,
):
  | "la-liga"
  | "ucl"
  | null {
  if (!value) {
    return null;
  }

  const normalized =
    value
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        " ",
      )
      .trim();

  if (
    normalized.includes(
      "primera division",
    ) ||
    normalized.includes(
      "la liga",
    ) ||
    normalized.includes(
      "laliga",
    )
  ) {
    return "la-liga";
  }

  if (
    normalized.includes(
      "champions league",
    ) ||
    normalized.includes(
      "uefa champions",
    )
  ) {
    return "ucl";
  }

  return null;
}

/*
|--------------------------------------------------------------------------
| Canonical-event fallback heatmap
|--------------------------------------------------------------------------
*/

type CanonicalSpatialEvent = {
  startX:
    number | null;

  startY:
    number | null;

  coordinateSystem:
    string | null;
};

function buildCanonicalEventHeatmap(
  events:
    CanonicalSpatialEvent[],
) {
  const columns =
    12;

  const rows =
    8;

  const grid =
    Array.from(
      {
        length:
          rows,
      },
      () =>
        Array.from(
          {
            length:
              columns,
          },
          () =>
            0,
        ),
    );

  let sampleSize =
    0;

  for (
    const event
    of events
  ) {
    if (
      typeof event.startX !==
        "number" ||
      typeof event.startY !==
        "number"
    ) {
      continue;
    }

    const point =
      normalizePitchCoordinate(
        event.startX,
        event.startY,
        event.coordinateSystem,
      );

    if (!point) {
      continue;
    }

    const column =
      Math.min(
        columns -
          1,
        Math.max(
          0,
          Math.floor(
            (
              point.x /
              100
            ) *
              columns,
          ),
        ),
      );

    const row =
      Math.min(
        rows -
          1,
        Math.max(
          0,
          Math.floor(
            (
              point.y /
              100
            ) *
              rows,
          ),
        ),
      );

    grid[
      row
    ][
      column
    ] +=
      1;

    sampleSize +=
      1;
  }

  let maxCellCount =
    0;

  for (
    const row
    of grid
  ) {
    for (
      const count
      of row
    ) {
      maxCellCount =
        Math.max(
          maxCellCount,
          count,
        );
    }
  }

  const cells:
    Array<{
      column:
        number;

      row:
        number;

      count:
        number;

      intensity:
        number;
    }> = [];

  for (
    let row =
      0;
    row <
    rows;
    row +=
      1
  ) {
    for (
      let column =
        0;
      column <
      columns;
      column +=
        1
    ) {
      const count =
        grid[
          row
        ][
          column
        ];

      if (
        count <=
        0
      ) {
        continue;
      }

      cells.push({
        column,

        row,

        count,

        intensity:
          maxCellCount >
          0
            ? round(
                count /
                  maxCellCount,
                4,
              )
            : 0,
      });
    }
  }

  return {
    sampleSize,

    columns,

    rows,

    maxCellCount,

    cells,
  };
}

function normalizePitchCoordinate(
  rawX:
    number,

  rawY:
    number,

  coordinateSystem:
    string | null,
) {
  if (
    !Number.isFinite(
      rawX,
    ) ||
    !Number.isFinite(
      rawY,
    )
  ) {
    return null;
  }

  const system =
    (
      coordinateSystem ??
      ""
    )
      .trim()
      .toLowerCase();

  if (
    rawX >=
      0 &&
    rawX <=
      1 &&
    rawY >=
      0 &&
    rawY <=
      1
  ) {
    return {
      x:
        rawX *
        100,

      y:
        rawY *
        100,
    };
  }

  if (
    system.includes(
      "120",
    ) ||
    system.includes(
      "statsbomb",
    )
  ) {
    return {
      x:
        clampPercent(
          (
            rawX /
            120
          ) *
            100,
        ),

      y:
        clampPercent(
          (
            rawY /
            80
          ) *
            100,
        ),
    };
  }

  if (
    system.includes(
      "105",
    ) ||
    system.includes(
      "metric",
    )
  ) {
    return {
      x:
        clampPercent(
          (
            rawX /
            105
          ) *
            100,
        ),

      y:
        clampPercent(
          (
            rawY /
            68
          ) *
            100,
        ),
    };
  }

  if (
    rawX >=
      0 &&
    rawX <=
      100 &&
    rawY >=
      0 &&
    rawY <=
      100
  ) {
    return {
      x:
        rawX,

      y:
        rawY,
    };
  }

  if (
    rawX >=
      0 &&
    rawX <=
      120 &&
    rawY >=
      0 &&
    rawY <=
      80
  ) {
    return {
      x:
        clampPercent(
          (
            rawX /
            120
          ) *
            100,
        ),

      y:
        clampPercent(
          (
            rawY /
            80
          ) *
            100,
        ),
    };
  }

  return null;
}

function clampPercent(
  value:
    number,
) {
  return Math.max(
    0,
    Math.min(
      100,
      value,
    ),
  );
}

/*
|--------------------------------------------------------------------------
| General helpers
|--------------------------------------------------------------------------
*/

function resolvePosition(
  membership:
    SquadPosition,

  player:
    SquadPosition,
): SquadPosition {
  if (
    membership !==
    "unknown"
  ) {
    return membership;
  }

  return player;
}

function positionRank(
  position:
    SquadPosition,
) {
  switch (
    position
  ) {
    case "goalkeeper":
      return 0;

    case "defender":
      return 1;

    case "midfielder":
      return 2;

    case "forward":
      return 3;

    default:
      return 4;
  }
}

function calculateAge(
  birthDate:
    string,

  referenceDate:
    string,
) {
  const birth =
    new Date(
      birthDate,
    );

  const reference =
    new Date(
      referenceDate,
    );

  let age =
    reference.getUTCFullYear() -
    birth.getUTCFullYear();

  const monthDifference =
    reference.getUTCMonth() -
    birth.getUTCMonth();

  if (
    monthDifference <
      0 ||
    (
      monthDifference ===
        0 &&
      reference.getUTCDate() <
        birth.getUTCDate()
    )
  ) {
    age -=
      1;
  }

  return age;
}

function numericValues<T>(
  rows:
    T[],

  getter:
    (
      row:
        T,
    ) =>
      number | null |
      undefined,
) {
  return rows
    .map(
      getter,
    )
    .filter(
      (
        value,
      ): value is number =>
        typeof value ===
          "number" &&
        Number.isFinite(
          value,
        ),
    );
}

function sumDefaultZero<T>(
  rows:
    T[],

  getter:
    (
      row:
        T,
    ) =>
      number | null |
      undefined,
) {
  return numericValues(
    rows,
    getter,
  ).reduce(
    (
      total,
      value,
    ) =>
      total +
      value,
    0,
  );
}

function sumNullable<T>(
  rows:
    T[],

  getter:
    (
      row:
        T,
    ) =>
      number | null |
      undefined,
) {
  const values =
    numericValues(
      rows,
      getter,
    );

  if (
    values.length ===
    0
  ) {
    return null;
  }

  return values.reduce(
    (
      total,
      value,
    ) =>
      total +
      value,
    0,
  );
}

function averageNullable<T>(
  rows:
    T[],

  getter:
    (
      row:
        T,
    ) =>
      number | null |
      undefined,

  decimals:
    number,
) {
  const values =
    numericValues(
      rows,
      getter,
    );

  if (
    values.length ===
    0
  ) {
    return null;
  }

  return round(
    values.reduce(
      (
        total,
        value,
      ) =>
        total +
        value,
      0,
    ) /
      values.length,
    decimals,
  );
}

function roundNullable(
  value:
    number | null,

  decimals:
    number,
) {
  return value ===
    null
    ? null
    : round(
        value,
        decimals,
      );
}

function round(
  value:
    number,

  decimals:
    number,
) {
  const factor =
    10 **
    decimals;

  return (
    Math.round(
      value *
        factor,
    ) /
    factor
  );
}

function meaningfulString(
  value:
    string | null |
    undefined,
) {
  if (
    !value ||
    !value.trim()
  ) {
    return null;
  }

  const normalized =
    value
      .trim()
      .toLowerCase();

  if (
    normalized ===
      "unknown" ||
    normalized ===
      "n/a" ||
    normalized ===
      "null"
  ) {
    return null;
  }

  return value.trim();
}

export type SquadOverviewData =
  Awaited<
    ReturnType<
      typeof getSquadOverview
    >
  >;
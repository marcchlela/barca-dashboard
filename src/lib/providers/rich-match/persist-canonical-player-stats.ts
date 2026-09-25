import "server-only";

import { db } from "../../../prisma/db";

import {
  previewCanonicalPlayerStatistics,
} from "./canonical-player-stats";

import {
  RICH_DATA_SOURCES,
} from "./constants";

import {
  emptySyncCounts,
  type ChangeCount,
  type RichSyncCounts,
} from "./types";

import {
  jsonEqual,
} from "../shared/normalization";

type Orm =
  typeof db.orm;

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | {
      [key: string]:
        JsonValue;
    };

type CanonicalPreview =
  Awaited<
    ReturnType<
      typeof previewCanonicalPlayerStatistics
    >
  >;

type CanonicalPlayer =
  CanonicalPreview["players"][number];

type ProviderCode =
  | "big-balls-data"
  | "statshawk";

function changed(
  count: ChangeCount,
  kind:
    | "created"
    | "updated"
    | "unchanged",
) {
  count[kind] += 1;
}

function asObject(
  value: unknown,
):
  | Record<
      string,
      unknown
    >
  | null {
  return (
    value !== null &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value,
    )
  )
    ? (
        value as Record<
          string,
          unknown
        >
      )
    : null;
}

function recordMatches(
  existing:
    Record<
      string,
      unknown
    >,
  data:
    Record<
      string,
      unknown
    >,
) {
  return Object
    .entries(data)
    .every(
      ([
        key,
        value,
      ]) =>
        jsonEqual(
          existing[key],
          value,
        ),
    );
}

async function ensureDataSource(
  orm: Orm,
  counts: RichSyncCounts,
  definition:
    (typeof RICH_DATA_SOURCES)[
      | "bigBalls"
      | "statsHawk"
    ],
) {
  const existing =
    await orm.public.DataSource
      .where({
        code:
          definition.code,
      })
      .first();

  const data = {
    name:
      definition.name,

    baseUrl:
      definition.baseUrl,

    isOfficial:
      definition.isOfficial,

    isEnabled:
      definition.isEnabled,

    licenseNotes:
      definition.licenseNotes,
  };

  if (!existing) {
    changed(
      counts.dataSources,
      "created",
    );

    return orm.public.DataSource.create({
      code:
        definition.code,

      ...data,
    });
  }

  if (
    recordMatches(
      existing,
      data,
    )
  ) {
    changed(
      counts.dataSources,
      "unchanged",
    );

    return existing;
  }

  changed(
    counts.dataSources,
    "updated",
  );

  const updated =
    await orm.public.DataSource
      .where({
        id:
          existing.id,
      })
      .update(
        data,
      );

  if (!updated) {
    throw new Error(
      `Data source ${definition.code} disappeared during canonical player-stat persistence.`,
    );
  }

  return updated;
}

async function ensurePlayerMapping(
  orm: Orm,
  counts: RichSyncCounts,
  input: {
    dataSourceId: string;
    playerId: string;
    providerId: string;
    metadata: JsonValue;
  },
) {
  const existing =
    await orm.public.ProviderMapping
      .where({
        dataSourceId:
          input.dataSourceId,

        entityType:
          "player",

        providerId:
          input.providerId,
      })
      .first();

  if (!existing) {
    changed(
      counts.providerMappings,
      "created",
    );

    return orm.public.ProviderMapping.create({
      dataSourceId:
        input.dataSourceId,

      entityType:
        "player",

      internalId:
        input.playerId,

      providerId:
        input.providerId,

      metadata:
        input.metadata,
    });
  }

  if (
    existing.internalId !==
    input.playerId
  ) {
    throw new Error(
      `Provider identity collision for player ${input.providerId}: ${existing.internalId} != ${input.playerId}.`,
    );
  }

  if (
    jsonEqual(
      existing.metadata,
      input.metadata,
    )
  ) {
    changed(
      counts.providerMappings,
      "unchanged",
    );

    return existing;
  }

  changed(
    counts.providerMappings,
    "updated",
  );

  const updated =
    await orm.public.ProviderMapping
      .where({
        id:
          existing.id,
      })
      .update({
        metadata:
          input.metadata,
      });

  if (!updated) {
    throw new Error(
      `Player provider mapping ${input.providerId} disappeared during canonical persistence.`,
    );
  }

  return updated;
}

function primaryProvider(
  player: CanonicalPlayer,
): ProviderCode {
  const sources =
    Object.values(
      player.fieldSources,
    );

  if (
    sources.includes(
      "big-balls-data",
    )
  ) {
    return "big-balls-data";
  }

  if (
    sources.includes(
      "statshawk",
    )
  ) {
    return "statshawk";
  }

  /*
   * A merged participant with no sourced values would not
   * be useful as a PlayerMatchStatistic row.
   */
  throw new Error(
    `Canonical player ${player.playerName} has no sourced statistic fields.`,
  );
}

function canonicalRawData(
  existingRawData:
    unknown,
  player:
    CanonicalPlayer,
  preview:
    CanonicalPreview,
) {
  const previous =
    asObject(
      existingRawData,
    ) ?? {};

  const conflicts =
    preview.merge
      .conflictDetails
      .filter(
        (conflict) =>
          conflict.playerId ===
          player.playerId,
      );

  /*
   * Preserve any provider evidence already stored by the
   * earlier rich-match pipeline.
   *
   * canonicalMerge is deterministic, so repeated syncs
   * remain idempotent.
   */
  return {
    ...previous,

    canonicalMerge: {
      version:
        1,

      policy: {
        primary:
          "big-balls-data",

        fallback:
          "statshawk",

        rule:
          "Fallback fills only null/missing Big Balls fields. Zero is real data.",
      },

      fieldSources:
        player.fieldSources,

      identities:
        player.identities,

      conflicts,
    },
  };
}

function statisticData(
  input: {
    player:
      CanonicalPlayer;

    teamId:
      string;

    dataSourceId:
      string;

    existingRawData:
      unknown;

    preview:
      CanonicalPreview;
  },
) {
  const stats =
    input.player.statistics;

  return {
    teamId:
      input.teamId,

    dataSourceId:
      input.dataSourceId,

    minutes:
      stats.minutes,

    goals:
      stats.goals,

    assists:
      stats.assists,

    shots:
      stats.shots,

    shotsOnTarget:
      stats.shotsOnTarget,

    xG:
      stats.xG,

    xA:
      stats.xA,

    passes:
      stats.passes,

    completedPasses:
      stats.completedPasses,

    passAccuracy:
      stats.passAccuracy,

    keyPasses:
      stats.keyPasses,

    tackles:
      stats.tackles,

    blocks:
      stats.blocks,

    interceptions:
      stats.interceptions,

    duelsWon:
      stats.duelsWon,

    duelsTotal:
      stats.duelsTotal,

    dribblesAttempted:
      stats.dribblesAttempted,

    successfulDribbles:
      stats.successfulDribbles,

    fouls:
      stats.fouls,

    yellowCards:
      stats.yellowCards,

    redCards:
      stats.redCards,

    saves:
      stats.saves,

    goalsConceded:
      stats.goalsConceded,

    cleanSheet:
      stats.cleanSheet,

    rating:
      stats.rating,

    rawData:
      canonicalRawData(
        input.existingRawData,
        input.player,
        input.preview,
      ),
  };
}

async function previewWritePlan(
  matchId: string,
  teamId: string,
  preview:
    CanonicalPreview,
) {
  let created =
    0;

  let updated =
    0;

  let unchanged =
    0;

  let bigBallsOwned =
    0;

  let statsHawkOwned =
    0;

  for (
    const player
    of preview.players
  ) {
    const provider =
      primaryProvider(
        player,
      );

    if (
      provider ===
      "big-balls-data"
    ) {
      bigBallsOwned +=
        1;
    } else {
      statsHawkOwned +=
        1;
    }

    const existing =
      await db.orm.public.PlayerMatchStatistic
        .where({
          matchId,

          playerId:
            player.playerId,
        })
        .first();

    /*
     * During dry-run we don't know the final DataSource UUID
     * if it hasn't been created yet, so compare the actual
     * statistical payload separately from ownership.
     */
    const stats =
      player.statistics;

    const comparable = {
      teamId,

      minutes:
        stats.minutes,

      goals:
        stats.goals,

      assists:
        stats.assists,

      shots:
        stats.shots,

      shotsOnTarget:
        stats.shotsOnTarget,

      xG:
        stats.xG,

      xA:
        stats.xA,

      passes:
        stats.passes,

      completedPasses:
        stats.completedPasses,

      passAccuracy:
        stats.passAccuracy,

      keyPasses:
        stats.keyPasses,

      tackles:
        stats.tackles,

      blocks:
        stats.blocks,

      interceptions:
        stats.interceptions,

      duelsWon:
        stats.duelsWon,

      duelsTotal:
        stats.duelsTotal,

      dribblesAttempted:
        stats.dribblesAttempted,

      successfulDribbles:
        stats.successfulDribbles,

      fouls:
        stats.fouls,

      yellowCards:
        stats.yellowCards,

      redCards:
        stats.redCards,

      saves:
        stats.saves,

      goalsConceded:
        stats.goalsConceded,

      cleanSheet:
        stats.cleanSheet,

      rating:
        stats.rating,
    };

    if (!existing) {
      created +=
        1;

      continue;
    }

    if (
      recordMatches(
        existing,
        comparable,
      )
    ) {
      unchanged +=
        1;
    } else {
      updated +=
        1;
    }
  }

  return {
    created,
    updated,
    unchanged,

    ownership: {
      bigBalls:
        bigBallsOwned,

      statsHawk:
        statsHawkOwned,
    },
  };
}

export async function persistCanonicalPlayerStatistics(
  input: {
    matchId: string;
    dryRun: boolean;
  },
) {
  const match =
    await db.orm.public.Match
      .where({
        id:
          input.matchId,
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
      .first();

  if (!match) {
    throw new Error(
      `Match ${input.matchId} was not found.`,
    );
  }

  if (
    !match.homeTeam
      .isBarcelona &&
    !match.awayTeam
      .isBarcelona
  ) {
    throw new Error(
      "Canonical player-stat persistence only supports FC Barcelona fixtures.",
    );
  }

  if (
    match.status !==
    "finished"
  ) {
    throw new Error(
      "Canonical player-stat persistence accepts finished matches only.",
    );
  }

  const barcelonaTeamId =
    match.homeTeam
      .isBarcelona
      ? match.homeTeamId
      : match.awayTeamId;

  /*
   * This performs provider reads and canonical identity/field
   * merging, but no writes.
   */
  const preview =
    await previewCanonicalPlayerStatistics(
      match.id,
    );

  if (
    preview.players.length ===
    0
  ) {
    throw new Error(
      `Canonical player-stat merge produced zero Barcelona participants for match ${match.id}.`,
    );
  }

  const plan =
    await previewWritePlan(
      match.id,
      barcelonaTeamId,
      preview,
    );

  if (
    input.dryRun
  ) {
    return {
      dryRun:
        true,

      match: {
        id:
          match.id,

        competition:
          match.competition
            .name,

        home:
          match.homeTeam
            .name,

        away:
          match.awayTeam
            .name,

        score: {
          home:
            match.homeScore,

          away:
            match.awayScore,
        },
      },

      providers:
        preview.providers,

      identity:
        preview.identity,

      merge:
        preview.merge,

      writePlan:
        plan,

      persisted:
        false,
    };
  }

  const result =
    await db.transaction(
      async (tx) => {
        const orm =
          tx.orm;

        const counts =
          emptySyncCounts();

        const bigBallsSource =
          await ensureDataSource(
            orm,
            counts,
            RICH_DATA_SOURCES.bigBalls,
          );

        const statsHawkSource =
          await ensureDataSource(
            orm,
            counts,
            RICH_DATA_SOURCES.statsHawk,
          );

        for (
          const player
          of preview.players
        ) {
          const provider =
            primaryProvider(
              player,
            );

          const primarySource =
            provider ===
              "big-balls-data"
              ? bigBallsSource
              : statsHawkSource;

          /*
           * Persist safe provider identities discovered by the
           * canonical merge. These make later matches easier to
           * resolve without loosening identity rules.
           */
          if (
            player.identities
              .bigBalls
          ) {
            await ensurePlayerMapping(
              orm,
              counts,
              {
                dataSourceId:
                  bigBallsSource.id,

                playerId:
                  player.playerId,

                providerId:
                  player.identities
                    .bigBalls
                    .providerId,

                metadata: {
                  identityMethod:
                    player.identities
                      .bigBalls
                      .method,

                  canonicalMerge:
                    true,
                },
              },
            );
          }

          if (
            player.identities
              .statsHawk
          ) {
            await ensurePlayerMapping(
              orm,
              counts,
              {
                dataSourceId:
                  statsHawkSource.id,

                playerId:
                  player.playerId,

                providerId:
                  player.identities
                    .statsHawk
                    .providerId,

                metadata: {
                  identityMethod:
                    player.identities
                      .statsHawk
                      .method,

                  canonicalMerge:
                    true,
                },
              },
            );
          }

          const existing =
            await orm.public.PlayerMatchStatistic
              .where({
                matchId:
                  match.id,

                playerId:
                  player.playerId,
              })
              .first();

          const data =
            statisticData({
              player,

              teamId:
                barcelonaTeamId,

              dataSourceId:
                primarySource.id,

              existingRawData:
                existing?.rawData,

              preview,
            });

          if (!existing) {
            changed(
              counts.playerStatistics,
              "created",
            );

            await orm.public.PlayerMatchStatistic
              .create({
                matchId:
                  match.id,

                playerId:
                  player.playerId,

                ...data,
              });

            continue;
          }

          if (
            recordMatches(
              existing,
              data,
            )
          ) {
            changed(
              counts.playerStatistics,
              "unchanged",
            );

            continue;
          }

          changed(
            counts.playerStatistics,
            "updated",
          );

          const updated =
            await orm.public.PlayerMatchStatistic
              .where({
                id:
                  existing.id,
              })
              .update(
                data,
              );

          if (!updated) {
            throw new Error(
              `PlayerMatchStatistic ${existing.id} disappeared during canonical persistence.`,
            );
          }
        }

        return {
          counts,
        };
      },
    );

  return {
    dryRun:
      false,

    match: {
      id:
        match.id,

      competition:
        match.competition
          .name,

      home:
        match.homeTeam
          .name,

      away:
        match.awayTeam
          .name,

      score: {
        home:
          match.homeScore,

        away:
          match.awayScore,
      },
    },

    providers:
      preview.providers,

    identity:
      preview.identity,

    merge:
      preview.merge,

    writePlan:
      plan,

    persisted:
      true,

    counts:
      result.counts,
  };
}
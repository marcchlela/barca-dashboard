import "server-only";

import { db } from "../../../prisma/db";
import type {
  BigBallsPlayerStatistic,
} from "../big-balls/types";
import type {
  MatchIdentityInput,
} from "../shared/match-identity";
import {
  jsonEqual,
  normalizedPersonName,
} from "../shared/normalization";
import { RICH_DATA_SOURCES } from "./constants";
import { bigBallsPlayerStatisticsProvider } from "./player-stat-provider";
import {
  emptySyncCounts,
  type ChangeCount,
  type RichSyncCounts,
  type UnresolvedIdentity,
} from "./types";

type Orm = typeof db.orm;

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

function recordMatches(
  existing: Record<string, unknown>,
  data: Record<string, unknown>,
) {
  return Object.entries(data).every(
    ([key, value]) =>
      jsonEqual(
        existing[key],
        value,
      ),
  );
}

function changed(
  count: ChangeCount,
  kind:
    | "created"
    | "updated"
    | "unchanged",
) {
  count[kind] += 1;
}

async function ensureSimpleRow<
  T extends Record<string, unknown>,
>(
  count: ChangeCount,
  existing: T | null,
  data: Record<string, unknown>,
  create: () => Promise<T | null>,
  update: () => Promise<T | null>,
): Promise<T> {
  if (!existing) {
    changed(
      count,
      "created",
    );

    const created =
      await create();

    if (!created) {
      throw new Error(
        "Created row could not be read back.",
      );
    }

    return created;
  }

  if (
    recordMatches(
      existing,
      data,
    )
  ) {
    changed(
      count,
      "unchanged",
    );

    return existing;
  }

  changed(
    count,
    "updated",
  );

  const updated =
    await update();

  if (!updated) {
    throw new Error(
      "Updated row disappeared during sync.",
    );
  }

  return updated;
}

async function ensureDataSource(
  orm: Orm,
  counts: RichSyncCounts,
) {
  const definition =
    RICH_DATA_SOURCES.bigBalls;

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
      .update(data);

  if (!updated) {
    throw new Error(
      "Big Balls data source disappeared during fallback sync.",
    );
  }

  return updated;
}

async function ensureMapping(
  orm: Orm,
  counts: RichSyncCounts,
  input: {
    dataSourceId: string;
    entityType:
      | "team"
      | "player"
      | "match";
    internalId: string;
    providerId: string;
    metadata?: JsonValue;
  },
) {
  const existing =
    await orm.public.ProviderMapping
      .where({
        dataSourceId:
          input.dataSourceId,

        entityType:
          input.entityType,

        providerId:
          input.providerId,
      })
      .first();

  const metadata =
    input.metadata ?? null;

  if (!existing) {
    changed(
      counts.providerMappings,
      "created",
    );

    return orm.public.ProviderMapping.create({
      ...input,
      metadata,
    });
  }

  if (
    existing.internalId !==
    input.internalId
  ) {
    throw new Error(
      `Provider identity collision for ${input.entityType} ${input.providerId}.`,
    );
  }

  if (
    jsonEqual(
      existing.metadata,
      metadata,
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
        metadata,
      });

  if (!updated) {
    throw new Error(
      "Provider mapping disappeared during fallback sync.",
    );
  }

  return updated;
}

async function loadMatchContext(
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
      `Match ${matchId} is not a Barcelona fixture.`,
    );
  }

  if (
    match.status !== "finished"
  ) {
    throw new Error(
      `Big Balls fallback only accepts finished fixtures.`,
    );
  }

  if (
    match.competition.code !== "PD"
  ) {
    throw new Error(
      `Big Balls fallback currently supports La Liga (PD) only.`,
    );
  }

  if (
    match.homeScore === null ||
    match.awayScore === null
  ) {
    throw new Error(
      `Finished match ${matchId} has no final score.`,
    );
  }

  const mappings =
    await db.orm.public.ProviderMapping
      .where({
        internalId:
          match.id,

        entityType:
          "match",
      })
      .include("dataSource")
      .all();

  const internal: MatchIdentityInput = {
    kickoff:
      match.kickoff.toString(),

    competition: {
      name:
        match.competition.name,
    },

    homeTeam: {
      name:
        match.homeTeam.name,
    },

    awayTeam: {
      name:
        match.awayTeam.name,
    },

    score: {
      home:
        match.homeScore,

      away:
        match.awayScore,
    },

    providerIds:
      Object.fromEntries(
        mappings.map(
          (mapping) => [
            mapping.dataSource.code,
            mapping.providerId,
          ],
        ),
      ),
  };

  return {
    match,
    internal,
  };
}

function nameTokens(
  value: string,
) {
  return normalizedPersonName(
    value,
  )
    .split(" ")
    .filter(
      (token) =>
        token.length >= 4,
    );
}

function namesShareUsefulToken(
  left: string,
  right: string,
) {
  const leftTokens =
    new Set(
      nameTokens(left),
    );

  const rightTokens =
    new Set(
      nameTokens(right),
    );

  return [
    ...leftTokens,
  ].some(
    (token) =>
      rightTokens.has(
        token,
      ),
  );
}

async function resolveFallbackPlayer(
  orm: Orm,
  input: {
    dataSourceId: string;
    statistic: BigBallsPlayerStatistic;
    teamId: string;
    seasonId: string;
    barcelonaTeamId: string;
  },
) {
  const mapping =
    await orm.public.ProviderMapping
      .where({
        dataSourceId:
          input.dataSourceId,

        entityType:
          "player",

        providerId:
          input.statistic.providerId,
      })
      .first();

  if (mapping) {
    const player =
      await orm.public.Player
        .where({
          id:
            mapping.internalId,
        })
        .first();

    if (!player) {
      throw new Error(
        `Big Balls player mapping ${input.statistic.providerId} points to a missing Player.`,
      );
    }

    return {
      playerId:
        player.id,

      method:
        "provider_mapping",
    };
  }

  /*
   * Without GOAL lineup evidence we only perform new
   * identity resolution for Barcelona players already
   * present in our current-season squad.
   *
   * We deliberately do not create opponent identities
   * from abbreviated Big Balls names alone.
   */
  if (
    input.teamId !==
    input.barcelonaTeamId
  ) {
    return null;
  }

  const memberships =
    await orm.public.SquadMembership
      .where({
        seasonId:
          input.seasonId,

        teamId:
          input.barcelonaTeamId,
      })
      .include("player")
      .all();

  const normalized =
    normalizedPersonName(
      input.statistic.name,
    );

  const exact =
    memberships.filter(
      (membership) =>
        normalizedPersonName(
          membership.player.displayName,
        ) === normalized,
    );

  if (
    exact.length === 1
  ) {
    return {
      playerId:
        exact[0].playerId,

      method:
        "exact_barca_squad_name",
    };
  }

  if (
    input.statistic.shirtNumber ===
    null
  ) {
    return null;
  }

  const shirtCandidates =
    memberships.filter(
      (membership) =>
        membership.shirtNumber ===
        input.statistic.shirtNumber &&
        namesShareUsefulToken(
          input.statistic.name,
          membership.player.displayName,
        ),
    );

  if (
    shirtCandidates.length ===
    1
  ) {
    return {
      playerId:
        shirtCandidates[0].playerId,

      method:
        "unique_barca_squad_shirt_name_token",
    };
  }

  return null;
}

function intStat(
  stats: Record<
    string,
    number | null
  >,
  key: string,
) {
  const value =
    stats[key];

  return typeof value ===
      "number" &&
    Number.isFinite(value)
    ? Math.round(value)
    : null;
}

function ratioStat(
  value:
    | number
    | null,
) {
  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  const ratio =
    value > 1
      ? value / 100
      : value;

  return ratio >= 0 &&
    ratio <= 1
    ? ratio
    : null;
}

function normalizeTeamStatistic(
  stats: Record<
    string,
    number | null
  >,
  dataSourceId: string,
) {
  const passes =
    intStat(
      stats,
      "total_passes",
    );

  const completedPasses =
    intStat(
      stats,
      "accurate_passes",
    );

  const passAccuracy =
    passes &&
    passes > 0 &&
    completedPasses !==
      null
      ? completedPasses /
        passes
      : ratioStat(
          stats.pass_percentage ??
            null,
        );

  return {
    dataSourceId,

    possession:
      ratioStat(
        stats.ball_possession ??
          null,
      ),

    shots:
      intStat(
        stats,
        "total_shots",
      ),

    shotsOnTarget:
      intStat(
        stats,
        "shots_on_target",
      ),

    shotsOffTarget:
      intStat(
        stats,
        "shots_off_target",
      ),

    blockedShots:
      intStat(
        stats,
        "blocked_shots",
      ),

    shotsInsideBox:
      intStat(
        stats,
        "shots_inside_box",
      ),

    shotsOutsideBox:
      intStat(
        stats,
        "shots_outside_box",
      ),

    xG:
      null,

    passes,

    completedPasses,

    passAccuracy,

    corners:
      intStat(
        stats,
        "corner_kicks",
      ),

    fouls:
      intStat(
        stats,
        "fouls",
      ),

    offsides:
      intStat(
        stats,
        "offsides",
      ),

    yellowCards:
      intStat(
        stats,
        "yellow_cards",
      ),

    redCards:
      intStat(
        stats,
        "red_cards",
      ),

    tackles:
      null,

    interceptions:
      null,

    clearances:
      null,

    saves:
      intStat(
        stats,
        "goalkeeper_saves",
      ),

    attacks:
      null,

    dangerousAttacks:
      null,

    freeKicks:
      null,

    goalKicks:
      null,

    throwIns:
      null,

    substitutions:
      null,

    rawData: {
      provider:
        "big-balls-data",

      fallback:
        true,

      teamStatistics:
        stats,
    },
  };
}

export async function syncBigBallsFallbackMatch(
  input: {
    matchId: string;
    dryRun: boolean;
    goalFailureReason?: string;
  },
) {
  const {
    match,
    internal,
  } =
    await loadMatchContext(
      input.matchId,
    );

  const bundle =
    await bigBallsPlayerStatisticsProvider.fetchMatch(
      internal,
    );

  const teamMap =
    new Map([
      [
        bundle.homeTeamProviderId,
        match.homeTeamId,
      ],

      [
        bundle.awayTeamProviderId,
        match.awayTeamId,
      ],
    ]);

  const barcelonaTeamId =
    match.homeTeam.isBarcelona
      ? match.homeTeamId
      : match.awayTeamId;

  const existingSource =
    await db.orm.public.DataSource
      .where({
        code:
          "big-balls-data",
      })
      .first();

  let resolved = 0;

  const unresolved: UnresolvedIdentity[] =
    [];

  /*
   * Dry-run identity preview uses only existing DB mappings /
   * existing Barça squad data. It never writes.
   */
  for (
    const statistic
    of bundle.players
  ) {
    const teamId =
      teamMap.get(
        statistic.teamProviderId,
      );

    if (!teamId) {
      unresolved.push({
        providerId:
          statistic.providerId,

        name:
          statistic.name,

        teamProviderId:
          statistic.teamProviderId,

        shirtNumber:
          statistic.shirtNumber,

        position:
          statistic.position,

        reason:
          "team_identity_not_resolved",
      });

      continue;
    }

    const identity =
      existingSource
        ? await resolveFallbackPlayer(
            db.orm,
            {
              dataSourceId:
                existingSource.id,

              statistic,

              teamId,

              seasonId:
                match.seasonId,

              barcelonaTeamId,
            },
          )
        : null;

    if (identity) {
      resolved += 1;
    } else {
      unresolved.push({
        providerId:
          statistic.providerId,

        name:
          statistic.name,

        teamProviderId:
          statistic.teamProviderId,

        shirtNumber:
          statistic.shirtNumber,

        position:
          statistic.position,

        reason:
          teamId ===
          barcelonaTeamId
            ? "no_safe_existing_barca_identity"
            : "no_existing_provider_mapping",
      });
    }
  }

  if (
    input.dryRun
  ) {
    return {
      dryRun:
        true,

      matchId:
        match.id,

      mode:
        "big-balls-fallback",

      providerAvailability: {
        goal: {
          available:
            false,

          reason:
            input.goalFailureReason ??
            "GOAL unavailable",
        },

        bigBalls: {
          available:
            true,

          matchId:
            bundle.providerMatchId,

          requests:
            bundle.requestCount,
        },
      },

      coverage: {
        lineup:
          false,

        formation:
          false,

        bench:
          false,

        scoringEvents:
          false,

        teamStatistics:
          true,

        playerStatistics:
          true,

        ratings:
          true,
      },

      preview: {
        participants:
          bundle.players.length,

        resolved,
        unresolved:
          unresolved.length,

        unresolvedIdentities:
          unresolved,
      },

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

        const source =
          await ensureDataSource(
            orm,
            counts,
          );

        await ensureMapping(
          orm,
          counts,
          {
            dataSourceId:
              source.id,

            entityType:
              "match",

            internalId:
              match.id,

            providerId:
              bundle.providerMatchId,

            metadata: {
              ownership: [
                "player_match_statistics",
                "ratings",
                "team_statistics_fallback",
              ],

              fallbackMode:
                "big-balls-only",

              goalUnavailable:
                true,

              goalFailureReason:
                input.goalFailureReason ??
                null,
            },
          },
        );

        await ensureMapping(
          orm,
          counts,
          {
            dataSourceId:
              source.id,

            entityType:
              "team",

            internalId:
              match.homeTeamId,

            providerId:
              bundle.homeTeamProviderId,
          },
        );

        await ensureMapping(
          orm,
          counts,
          {
            dataSourceId:
              source.id,

            entityType:
              "team",

            internalId:
              match.awayTeamId,

            providerId:
              bundle.awayTeamProviderId,
          },
        );

        /*
         * Team-stat fallback.
         *
         * Never overwrite GOAL-owned team statistics.
         */
        for (
          const [
            teamId,
            stats,
          ]
          of [
            [
              match.homeTeamId,
              bundle.teamStatistics.home,
            ],

            [
              match.awayTeamId,
              bundle.teamStatistics.away,
            ],
          ] as const
        ) {
          const existing =
            await orm.public.MatchStatistic
              .where({
                matchId:
                  match.id,

                teamId,
              })
              .first();

          if (
            existing?.dataSourceId &&
            existing.dataSourceId !==
              source.id
          ) {
            throw new Error(
              `MatchStatistic for ${teamId} is already owned by another provider.`,
            );
          }

          const data =
            normalizeTeamStatistic(
              stats,
              source.id,
            );

          await ensureSimpleRow(
            counts.teamStatistics,
            existing,
            data,

            () =>
              orm.public.MatchStatistic.create({
                matchId:
                  match.id,

                teamId,

                ...data,
              }),

            () =>
              orm.public.MatchStatistic
                .where({
                  id:
                    existing!.id,
                })
                .update(data),
          );
        }

        const persistedUnresolved: UnresolvedIdentity[] =
          [];

        for (
          const statistic
          of bundle.players
        ) {
          const teamId =
            teamMap.get(
              statistic.teamProviderId,
            );

          if (!teamId) {
            persistedUnresolved.push({
              providerId:
                statistic.providerId,

              name:
                statistic.name,

              teamProviderId:
                statistic.teamProviderId,

              shirtNumber:
                statistic.shirtNumber,

              position:
                statistic.position,

              reason:
                "team_identity_not_resolved",
            });

            continue;
          }

          const identity =
            await resolveFallbackPlayer(
              orm,
              {
                dataSourceId:
                  source.id,

                statistic,

                teamId,

                seasonId:
                  match.seasonId,

                barcelonaTeamId,
              },
            );

          if (!identity) {
            persistedUnresolved.push({
              providerId:
                statistic.providerId,

              name:
                statistic.name,

              teamProviderId:
                statistic.teamProviderId,

              shirtNumber:
                statistic.shirtNumber,

              position:
                statistic.position,

              reason:
                teamId ===
                barcelonaTeamId
                  ? "no_safe_existing_barca_identity"
                  : "no_existing_provider_mapping",
            });

            continue;
          }

          await ensureMapping(
            orm,
            counts,
            {
              dataSourceId:
                source.id,

              entityType:
                "player",

              internalId:
                identity.playerId,

              providerId:
                statistic.providerId,

              metadata: {
                identityMethod:
                  identity.method,

                fallback:
                  true,
              },
            },
          );

          const existing =
            await orm.public.PlayerMatchStatistic
              .where({
                matchId:
                  match.id,

                playerId:
                  identity.playerId,
              })
              .first();

          if (
            existing?.dataSourceId &&
            existing.dataSourceId !==
              source.id
          ) {
            throw new Error(
              `Player statistic ownership conflict for ${identity.playerId}.`,
            );
          }

          const data = {
            teamId,

            dataSourceId:
              source.id,

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

            xG:
              null,

            xA:
              null,

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

            yellowCards:
              statistic.yellowCards,

            redCards:
              statistic.redCards,

            saves:
              statistic.saves,

            goalsConceded:
              null,

            cleanSheet:
              null,

            rating:
              statistic.rating,

            rawData: {
              provider:
                "big-balls-data",

              fallback:
                true,

              identityMethod:
                identity.method,

              providerPlayerId:
                statistic.providerId,

              rawStatistics:
                statistic.raw,
            },
          };

          await ensureSimpleRow(
            counts.playerStatistics,
            existing,
            data,

            () =>
              orm.public.PlayerMatchStatistic.create({
                matchId:
                  match.id,

                playerId:
                  identity.playerId,

                ...data,
              }),

            () =>
              orm.public.PlayerMatchStatistic
                .where({
                  id:
                    existing!.id,
                })
                .update(data),
          );
        }

        persistedUnresolved.sort(
          (
            left,
            right,
          ) =>
            left.providerId.localeCompare(
              right.providerId,
            ),
        );

        /*
         * Re-write match metadata with final unresolved list.
         */
        await ensureMapping(
          orm,
          counts,
          {
            dataSourceId:
              source.id,

            entityType:
              "match",

            internalId:
              match.id,

            providerId:
              bundle.providerMatchId,

            metadata: {
              ownership: [
                "player_match_statistics",
                "ratings",
                "team_statistics_fallback",
              ],

              fallbackMode:
                "big-balls-only",

              goalUnavailable:
                true,

              goalFailureReason:
                input.goalFailureReason ??
                null,

              unresolvedPlayerIdentities:
                persistedUnresolved,
            },
          },
        );

        return {
          counts,
          unresolved:
            persistedUnresolved,
        };
      },
    );

  return {
    dryRun:
      false,

    matchId:
      match.id,

    mode:
      "big-balls-fallback",

    providerAvailability: {
      goal: {
        available:
          false,

        reason:
          input.goalFailureReason ??
          "GOAL unavailable",
      },

      bigBalls: {
        available:
          true,

        matchId:
          bundle.providerMatchId,

        requests:
          bundle.requestCount,
      },
    },

    coverage: {
      lineup:
        false,

      formation:
        false,

      bench:
        false,

      scoringEvents:
        false,

      teamStatistics:
        true,

      playerStatistics:
        true,

      ratings:
        true,
    },

    persisted:
      true,

    counts:
      result.counts,

    unresolvedIdentities:
      result.unresolved,
  };
}
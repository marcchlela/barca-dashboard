import "server-only";

import { db } from "../../../prisma/db";

import { fetchBigBallsMatchBundle } from "../big-balls/fetch";
import type { BigBallsPlayerStatistic } from "../big-balls/types";

import { fetchStatsHawkMatchBundle } from "../statshawk/fetch";
import type {
  StatsHawkPlayerStatistic,
  StatsHawkRosterPlayer,
} from "../statshawk/types";

import type { MatchIdentityInput } from "../shared/match-identity";

import {
  normalizedPersonName,
} from "../shared/normalization";

type ProviderCode =
  | "big-balls-data"
  | "statshawk";

type CanonicalSquadPlayer = {
  playerId: string;
  displayName: string;
  birthDate: unknown;
  primaryPosition: string;
  shirtNumber: number | null;
};

type ResolvedBigBalls = {
  canonical: CanonicalSquadPlayer;
  statistic: BigBallsPlayerStatistic;
  method: string;
};

type ResolvedStatsHawk = {
  canonical: CanonicalSquadPlayer;
  statistic: StatsHawkPlayerStatistic;
  roster:
    | StatsHawkRosterPlayer
    | null;
  method: string;
};

type Conflict = {
  playerId: string;
  playerName: string;
  field: string;
  bigBalls: number | boolean;
  statsHawk: number | boolean;
};

type StoredProviderIdentity = {
  internalId: string;

  identityMethod:
    | string
    | null;
};

function errorMessage(
  error: unknown,
) {
  return error instanceof Error
    ? error.message
    : String(error);
}

function dateKey(
  value: unknown,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const text =
    String(value);

  const parsed =
    new Date(text);

  if (
    Number.isFinite(
      parsed.getTime(),
    )
  ) {
    return parsed
      .toISOString()
      .slice(0, 10);
  }

  return text.length >= 10
    ? text.slice(0, 10)
    : null;
}

function normalizedPosition(
  value: string,
) {
  const normalized =
    value.toLowerCase();

  if (
    normalized.includes("goal")
  ) {
    return "goalkeeper";
  }

  if (
    normalized.includes("def")
  ) {
    return "defender";
  }

  if (
    normalized.includes("mid")
  ) {
    return "midfielder";
  }

  if (
    normalized.includes("for") ||
    normalized.includes("attack")
  ) {
    return "forward";
  }

  return normalized === "unknown"
    ? "unknown"
    : normalized;
}

function compatiblePosition(
  left: string,
  right: string,
) {
  const a =
    normalizedPosition(left);

  const b =
    normalizedPosition(right);

  return (
    a === "unknown" ||
    b === "unknown" ||
    a === b
  );
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
        token.length >= 3,
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

  return nameTokens(
    right,
  ).some(
    (token) =>
      leftTokens.has(token),
  );
}

function storedIdentityMethod(
  metadata: unknown,
) {
  if (
    metadata === null ||
    typeof metadata !==
      "object" ||
    Array.isArray(
      metadata,
    )
  ) {
    return null;
  }

  const value =
    (
      metadata as Record<
        string,
        unknown
      >
    ).identityMethod;

  return (
    typeof value ===
      "string" &&
    value.trim()
  )
    ? value
    : null;
}

function resolveMappedPlayer(
  mappings:
    Map<
      string,
      StoredProviderIdentity
    >,
  providerId: string,
  squadById:
    Map<
      string,
      CanonicalSquadPlayer
    >,
) {
  const mapping =
    mappings.get(
      providerId,
    );

  if (!mapping) {
    return null;
  }

  const canonical =
    squadById.get(
      mapping.internalId,
    );

  if (!canonical) {
    return null;
  }

  return {
    canonical,

    /*
     * Preserve the original evidence that established this
     * identity. Merely using an existing mapping on a later
     * run must not rewrite provenance to "provider_mapping".
     */
    method:
      mapping.identityMethod ??
      "provider_mapping",
  };
}

function resolveBigBallsPlayer(
  statistic: BigBallsPlayerStatistic,
  squad: CanonicalSquadPlayer[],
  squadById:
    Map<
      string,
      CanonicalSquadPlayer
    >,
  mappings:
    Map<string, StoredProviderIdentity>,
): {
  canonical:
    CanonicalSquadPlayer | null;
  method: string | null;
} {
  const mapped =
    resolveMappedPlayer(
      mappings,
      statistic.providerId,
      squadById,
    );

  if (mapped) {
    return mapped;
  }

  const normalized =
    normalizedPersonName(
      statistic.name,
    );

  const exact =
    squad.filter(
      (player) =>
        normalizedPersonName(
          player.displayName,
        ) === normalized,
    );

  if (
    exact.length === 1
  ) {
    return {
      canonical:
        exact[0],

      method:
        "exact_squad_name",
    };
  }

  if (
    statistic.shirtNumber !==
    null
  ) {
    const shirtName =
      squad.filter(
        (player) =>
          player.shirtNumber ===
            statistic.shirtNumber &&
          namesShareUsefulToken(
            statistic.name,
            player.displayName,
          ),
      );

    if (
      shirtName.length ===
      1
    ) {
      return {
        canonical:
          shirtName[0],

        method:
          "unique_shirt_name_token",
      };
    }
  }

  return {
    canonical:
      null,

    method:
      null,
  };
}

function resolveStatsHawkPlayer(
  statistic: StatsHawkPlayerStatistic,
  roster:
    StatsHawkRosterPlayer | null,
  squad: CanonicalSquadPlayer[],
  squadById:
    Map<
      string,
      CanonicalSquadPlayer
    >,
  mappings:
    Map<string, StoredProviderIdentity>,
): {
  canonical:
    CanonicalSquadPlayer | null;
  method: string | null;
} {
  const mapped =
    resolveMappedPlayer(
      mappings,
      statistic.personId,
      squadById,
    );

  if (mapped) {
    return mapped;
  }

  const identityName =
    roster?.displayName ??
    statistic.name;

  const normalized =
    normalizedPersonName(
      identityName,
    );

  const exact =
    squad.filter(
      (player) =>
        normalizedPersonName(
          player.displayName,
        ) === normalized &&
        compatiblePosition(
          roster?.position ??
            statistic.position,
          player.primaryPosition,
        ),
    );

  if (
    exact.length === 1
  ) {
    const providerDob =
      dateKey(
        roster?.birthDate,
      );

    const canonicalDob =
      dateKey(
        exact[0].birthDate,
      );

    /*
     * An explicit date conflict invalidates an otherwise
     * tempting exact-name match.
     */
    if (
      providerDob &&
      canonicalDob &&
      providerDob !==
        canonicalDob
    ) {
      return {
        canonical:
          null,

        method:
          null,
      };
    }

    return {
      canonical:
        exact[0],

      method:
        providerDob &&
        canonicalDob
          ? "exact_name_dob_position"
          : "exact_name_position",
    };
  }

  /*
   * A weaker name form is allowed only with exact DOB
   * and compatible broad position.
   */
  const providerDob =
    dateKey(
      roster?.birthDate,
    );

  if (!providerDob) {
    return {
      canonical:
        null,

      method:
        null,
    };
  }

  const dobTokenMatches =
    squad.filter(
      (player) =>
        dateKey(
          player.birthDate,
        ) ===
          providerDob &&
        compatiblePosition(
          roster?.position ??
            statistic.position,
          player.primaryPosition,
        ) &&
        namesShareUsefulToken(
          identityName,
          player.displayName,
        ),
    );

  if (
    dobTokenMatches.length ===
    1
  ) {
    return {
      canonical:
        dobTokenMatches[0],

      method:
        "exact_dob_position_name_token",
    };
  }

  return {
    canonical:
      null,

    method:
      null,
  };
}

function fieldEqual(
  field: string,
  left: number | boolean,
  right: number | boolean,
) {
  if (
    typeof left ===
      "boolean" ||
    typeof right ===
      "boolean"
  ) {
    return left === right;
  }

  if (
    field ===
    "passAccuracy"
  ) {
    return (
      Math.abs(
        left - right,
      ) <= 0.02
    );
  }

  return left === right;
}

export async function previewCanonicalPlayerStatistics(
  matchId: string,
) {
  const match =
    await db.orm.public.Match
      .where({
        id:
          matchId,
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
      "Match is not an FC Barcelona fixture.",
    );
  }

  if (
    match.status !==
    "finished"
  ) {
    throw new Error(
      "Canonical player-stat preview accepts finished matches only.",
    );
  }

  const matchMappings =
    await db.orm.public.ProviderMapping
      .where({
        internalId:
          match.id,

        entityType:
          "match",
      })
      .include(
        "dataSource",
      )
      .all();

  const internal:
    MatchIdentityInput = {
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
          matchMappings.map(
            (mapping) => [
              mapping.dataSource
                .code,

              mapping.providerId,
            ],
          ),
        ),
    };

  const barcelonaTeamId =
    match.homeTeam.isBarcelona
      ? match.homeTeamId
      : match.awayTeamId;

  const memberships =
    await db.orm.public.SquadMembership
      .where({
        seasonId:
          match.seasonId,

        teamId:
          barcelonaTeamId,
      })
      .include("player")
      .all();

  const squad:
    CanonicalSquadPlayer[] =
    memberships.map(
      (membership) => ({
        playerId:
          membership.playerId,

        displayName:
          membership.player
            .displayName,

        birthDate:
          membership.player
            .birthDate,

        primaryPosition:
          String(
            membership.player
              .primaryPosition,
          ),

        shirtNumber:
          membership.shirtNumber,
      }),
    );

  const squadById =
    new Map(
      squad.map(
        (player) => [
          player.playerId,
          player,
        ],
      ),
    );

  const [
    bigBallsResult,
    statsHawkResult,
  ] =
    await Promise.allSettled([
      fetchBigBallsMatchBundle(
        internal,
      ),

      fetchStatsHawkMatchBundle(
        internal,
        {
          includeBarcelonaRoster:
            true,
        },
      ),
    ]);

  const bigBallsSource =
    await db.orm.public.DataSource
      .where({
        code:
          "big-balls-data",
      })
      .first();

  const statsHawkSource =
    await db.orm.public.DataSource
      .where({
        code:
          "statshawk",
      })
      .first();

  const bigBallsMappings =
    bigBallsSource
      ? await db.orm.public.ProviderMapping
          .where({
            dataSourceId:
              bigBallsSource.id,

            entityType:
              "player",
          })
          .all()
      : [];

  const statsHawkMappings =
    statsHawkSource
      ? await db.orm.public.ProviderMapping
          .where({
            dataSourceId:
              statsHawkSource.id,

            entityType:
              "player",
          })
          .all()
      : [];

const bigMappingMap =
  new Map<
    string,
    StoredProviderIdentity
  >(
    bigBallsMappings.map(
      (mapping) => [
        mapping.providerId,
        {
          internalId:
            mapping.internalId,

          identityMethod:
            storedIdentityMethod(
              mapping.metadata,
            ),
        },
      ],
    ),
  );

const statsHawkMappingMap =
  new Map<
    string,
    StoredProviderIdentity
  >(
    statsHawkMappings.map(
      (mapping) => [
        mapping.providerId,
        {
          internalId:
            mapping.internalId,

          identityMethod:
            storedIdentityMethod(
              mapping.metadata,
            ),
        },
      ],
    ),
  );

  const resolvedBigBalls =
    new Map<
      string,
      ResolvedBigBalls
    >();

  const resolvedStatsHawk =
    new Map<
      string,
      ResolvedStatsHawk
    >();

  const unresolvedBigBalls:
    Array<{
      providerId: string;
      name: string;
      reason: string;
    }> = [];

  const unresolvedStatsHawk:
    Array<{
      providerId: string;
      name: string;
      reason: string;
    }> = [];

  if (
    bigBallsResult.status ===
    "fulfilled"
  ) {
    const bundle =
      bigBallsResult.value;

    const barcelonaProviderTeamId =
      match.homeTeam.isBarcelona
        ? bundle.homeTeamProviderId
        : bundle.awayTeamProviderId;

    for (
      const statistic
      of bundle.players.filter(
        (player) =>
          player.teamProviderId ===
          barcelonaProviderTeamId,
      )
    ) {
      const identity =
        resolveBigBallsPlayer(
          statistic,
          squad,
          squadById,
          bigMappingMap,
        );

      if (
        !identity.canonical ||
        !identity.method
      ) {
        unresolvedBigBalls.push({
          providerId:
            statistic.providerId,

          name:
            statistic.name,

          reason:
            "no_unique_safe_canonical_identity",
        });

        continue;
      }

      resolvedBigBalls.set(
        identity.canonical
          .playerId,
        {
          canonical:
            identity.canonical,

          statistic,

          method:
            identity.method,
        },
      );
    }
  }

  if (
    statsHawkResult.status ===
    "fulfilled"
  ) {
    const bundle =
      statsHawkResult.value;

    const rosterByPersonId =
      new Map(
        bundle.barcelonaRoster.map(
          (player) => [
            player.personId,
            player,
          ],
        ),
      );

    const barcelonaProviderTeamId =
      match.homeTeam.isBarcelona
        ? bundle.homeTeamProviderId
        : bundle.awayTeamProviderId;

    for (
      const statistic
      of bundle.playerStatistics.filter(
        (player) =>
          player.teamProviderId ===
          barcelonaProviderTeamId,
      )
    ) {
      const roster =
        rosterByPersonId.get(
          statistic.personId,
        ) ?? null;

      const identity =
        resolveStatsHawkPlayer(
          statistic,
          roster,
          squad,
          squadById,
          statsHawkMappingMap,
        );

      if (
        !identity.canonical ||
        !identity.method
      ) {
        unresolvedStatsHawk.push({
          providerId:
            statistic.personId,

          name:
            statistic.name,

          reason:
            "no_unique_safe_canonical_identity",
        });

        continue;
      }

      resolvedStatsHawk.set(
        identity.canonical
          .playerId,
        {
          canonical:
            identity.canonical,

          statistic,

          roster,

          method:
            identity.method,
        },
      );
    }
  }

  const playerIds =
    new Set([
      ...resolvedBigBalls.keys(),
      ...resolvedStatsHawk.keys(),
    ]);

  const conflicts:
    Conflict[] =
    [];

  let fieldsFilledByStatsHawk =
    0;

  const merged =
    [...playerIds]
      .map(
        (playerId) => {
          const big =
            resolvedBigBalls.get(
              playerId,
            );

          const hawk =
            resolvedStatsHawk.get(
              playerId,
            );

          const canonical =
            big?.canonical ??
            hawk?.canonical;

            if (!canonical) {
            return null;
            }

            /*
            * Keep the narrowed value in a dedicated constant.
            *
            * TypeScript does not preserve the `canonical !== undefined`
            * narrowing reliably inside the nested choose() function.
            */
            const canonicalPlayer =
            canonical;

            const fieldSources:
            Record<
                string,
                ProviderCode
            > = {};

          function choose<
            T extends
              number |
              boolean
          >(
            field: string,
            primary:
              | T
              | null
              | undefined,
            fallback:
              | T
              | null
              | undefined,
          ):
            | T
            | null {
            if (
              primary !==
                null &&
              primary !==
                undefined
            ) {
              fieldSources[field] =
                "big-balls-data";

              if (
                fallback !==
                  null &&
                fallback !==
                  undefined &&
                !fieldEqual(
                  field,
                  primary,
                  fallback,
                )
              ) {
                conflicts.push({
                  playerId,
                  playerName:
                    canonicalPlayer.displayName,

                  field,

                  bigBalls:
                    primary,

                  statsHawk:
                    fallback,
                });
              }

              return primary;
            }

            if (
              fallback !==
                null &&
              fallback !==
                undefined
            ) {
              fieldSources[field] =
                "statshawk";

              fieldsFilledByStatsHawk +=
                1;

              return fallback;
            }

            return null;
          }

          /*
           * Big Balls remains primary.
           *
           * StatsHawk is used ONLY when the Big Balls field
           * is actually null/missing. Zero is real data and
           * is never treated as missing.
           */
          const statistics = {
            minutes:
              choose(
                "minutes",
                big?.statistic
                  .minutes,
                hawk?.statistic
                  .minutes,
              ),

            goals:
              choose(
                "goals",
                big?.statistic
                  .goals,
                hawk?.statistic
                  .goals,
              ),

            assists:
              choose(
                "assists",
                big?.statistic
                  .assists,
                hawk?.statistic
                  .assists,
              ),

            shots:
              choose(
                "shots",
                big?.statistic
                  .shots,
                hawk?.statistic
                  .shots,
              ),

            shotsOnTarget:
              choose(
                "shotsOnTarget",
                big?.statistic
                  .shotsOnTarget,
                hawk?.statistic
                  .shotsOnTarget,
              ),

            passes:
              choose(
                "passes",
                big?.statistic
                  .passes,
                hawk?.statistic
                  .passes,
              ),

            completedPasses:
              choose(
                "completedPasses",
                big?.statistic
                  .completedPasses,
                hawk?.statistic
                  .completedPasses,
              ),

            passAccuracy:
              choose(
                "passAccuracy",
                big?.statistic
                  .passAccuracy,
                hawk?.statistic
                  .passAccuracy,
              ),

            keyPasses:
              choose(
                "keyPasses",
                big?.statistic
                  .keyPasses,
                null,
              ),

            tackles:
              choose(
                "tackles",
                big?.statistic
                  .tackles,
                hawk?.statistic
                  .tackles,
              ),

            blocks:
              choose(
                "blocks",
                big?.statistic
                  .blocks,
                null,
              ),

            interceptions:
              choose(
                "interceptions",
                big?.statistic
                  .interceptions,
                hawk?.statistic
                  .interceptions,
              ),

            duelsWon:
              choose(
                "duelsWon",
                big?.statistic
                  .duelsWon,
                null,
              ),

            duelsTotal:
              choose(
                "duelsTotal",
                big?.statistic
                  .duelsTotal,
                null,
              ),

            dribblesAttempted:
              choose(
                "dribblesAttempted",
                big?.statistic
                  .dribblesAttempted,
                null,
              ),

            successfulDribbles:
              choose(
                "successfulDribbles",
                big?.statistic
                  .successfulDribbles,
                null,
              ),

            fouls:
              choose(
                "fouls",
                big?.statistic
                  .fouls,
                hawk?.statistic
                  .fouls,
              ),

            yellowCards:
              choose(
                "yellowCards",
                big?.statistic
                  .yellowCards,
                hawk?.statistic
                  .yellowCards,
              ),

            redCards:
              choose(
                "redCards",
                big?.statistic
                  .redCards,
                hawk?.statistic
                  .redCards,
              ),

            saves:
              choose(
                "saves",
                big?.statistic
                  .saves,
                hawk?.statistic
                  .saves,
              ),

            goalsConceded:
              choose(
                "goalsConceded",
                null,
                hawk?.statistic
                  .goalsConceded,
              ),

            cleanSheet:
              choose(
                "cleanSheet",
                null,
                hawk?.statistic
                  .cleanSheet,
              ),

            rating:
              choose(
                "rating",
                big?.statistic
                  .rating,
                null,
              ),

            /*
             * Neither verified source supplies actual xG/xA
             * for these current matches.
             */
            xG:
              null,

            xA:
              null,
          };

          return {
            playerId,

            playerName:
              canonicalPlayer.displayName,

            identities: {
              bigBalls:
                big
                  ? {
                      providerId:
                        big.statistic
                          .providerId,

                      name:
                        big.statistic
                          .name,

                      method:
                        big.method,
                    }
                  : null,

              statsHawk:
                hawk
                  ? {
                      providerId:
                        hawk.statistic
                          .personId,

                      name:
                        hawk.statistic
                          .name,

                      method:
                        hawk.method,
                    }
                  : null,
            },

            statistics,

            fieldSources,
          };
        },
      )
      .filter(
        (
          value,
        ): value is NonNullable<
          typeof value
        > =>
          value !== null,
      )
      .sort(
        (left, right) =>
          (
            right.statistics
              .minutes ??
            0
          ) -
          (
            left.statistics
              .minutes ??
            0
          ),
      );

  const bigBallsAvailable =
    bigBallsResult.status ===
    "fulfilled";

  const statsHawkAvailable =
    statsHawkResult.status ===
    "fulfilled";

  return {
    match: {
      id:
        match.id,

      competition:
        match.competition
          .name,

      home:
        match.homeTeam.name,

      away:
        match.awayTeam.name,

      score: {
        home:
          match.homeScore,

        away:
          match.awayScore,
      },
    },

    providers: {
      bigBalls: {
        available:
          bigBallsAvailable,

        error:
          bigBallsAvailable
            ? null
            : errorMessage(
                bigBallsResult.reason,
              ),

        requestCount:
          bigBallsAvailable
            ? bigBallsResult
                .value
                .requestCount
            : 0,
      },

      statsHawk: {
        available:
          statsHawkAvailable,

        error:
          statsHawkAvailable
            ? null
            : errorMessage(
                statsHawkResult.reason,
              ),

        usage:
          statsHawkAvailable
            ? statsHawkResult
                .value
                .usage
            : null,
      },
    },

    identity: {
      canonicalSquadPlayers:
        squad.length,

      bigBallsResolved:
        resolvedBigBalls.size,

      bigBallsUnresolved:
        unresolvedBigBalls,

      statsHawkResolved:
        resolvedStatsHawk.size,

      statsHawkUnresolved:
        unresolvedStatsHawk,
    },

    merge: {
      players:
        merged.length,

      fieldsFilledByStatsHawk,

      conflicts:
        conflicts.length,

      conflictDetails:
        conflicts,

      policy: {
        primary:
          "big-balls-data",

        fallback:
          "statshawk",

        rule:
          "Fallback fills only null/missing primary fields. Zero is preserved as real data.",
      },
    },

    players:
      merged,

    database: {
      writes:
        0,
    },
  };
}
import "server-only";

import { db } from "../../../prisma/db";

import {
  fetchBigBallsMatchBundle,
} from "../big-balls/fetch";

import type {
  BigBallsPlayerStatistic,
} from "../big-balls/types";

import {
  fetchStatsHawkMatchBundle,
} from "../statshawk/fetch";

import type {
  StatsHawkPlayerStatistic,
  StatsHawkRosterPlayer,
} from "../statshawk/types";

import type {
  MatchIdentityInput,
} from "../shared/match-identity";

import {
  normalizedPersonName,
} from "../shared/normalization";

type ProviderCode =
  | "big-balls-data"
  | "statshawk";

type FieldSource =
  | ProviderCode
  | "derived";

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

  statistic:
    StatsHawkPlayerStatistic;

  roster:
    | StatsHawkRosterPlayer
    | null;

  method: string;
};

type ComparisonValue =
  | number
  | boolean;

type BlockingConflict = {
  playerId: string;
  playerName: string;
  field: string;

  bigBalls:
    ComparisonValue;

  statsHawk:
    ComparisonValue;
};

type MinorDiscrepancy = {
  playerId: string;
  playerName: string;
  field: string;

  bigBalls: number;
  statsHawk: number;
  delta: number;

  reason:
    | "small_pass_count_difference"
    | "small_minutes_difference";
};

type ReviewDiscrepancy = {
  playerId: string;
  playerName: string;
  field: string;

  bigBalls:
    ComparisonValue;

  statsHawk:
    ComparisonValue;

  delta:
    number | null;

  reason:
    "provider_methodology_difference";
};

type StoredProviderIdentity = {
  internalId: string;

  identityMethod:
    | string
    | null;
};

type DifferenceKind =
  | "equal"
  | "minor"
  | "review"
  | "blocking";

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
      .slice(
        0,
        10,
      );
  }

  return text.length >= 10
    ? text.slice(
        0,
        10,
      )
    : null;
}

function normalizedPosition(
  value: string,
) {
  const normalized =
    value
      .toLowerCase()
      .trim();

  if (
    normalized.includes(
      "goal",
    ) ||
    normalized.includes(
      "keeper",
    )
  ) {
    return "goalkeeper";
  }

  if (
    normalized.includes(
      "def",
    )
  ) {
    return "defender";
  }

  if (
    normalized.includes(
      "mid",
    )
  ) {
    return "midfielder";
  }

  if (
    normalized.includes(
      "for",
    ) ||
    normalized.includes(
      "attack",
    )
  ) {
    return "forward";
  }

  return normalized ===
    "unknown"
    ? "unknown"
    : normalized;
}

function compatiblePosition(
  left: string,
  right: string,
) {
  const a =
    normalizedPosition(
      left,
    );

  const b =
    normalizedPosition(
      right,
    );

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
      nameTokens(
        left,
      ),
    );

  return nameTokens(
    right,
  ).some(
    (token) =>
      leftTokens.has(
        token,
      ),
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

  providerId:
    string,

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

    method:
      mapping.identityMethod ??
      "provider_mapping",
  };
}

function resolveBigBallsPlayer(
  statistic:
    BigBallsPlayerStatistic,

  squad:
    CanonicalSquadPlayer[],

  squadById:
    Map<
      string,
      CanonicalSquadPlayer
    >,

  mappings:
    Map<
      string,
      StoredProviderIdentity
    >,
): {
  canonical:
    CanonicalSquadPlayer | null;

  method:
    string | null;
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
        ) ===
        normalized,
    );

  if (
    exact.length ===
    1
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
    const shirtMatches =
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
      shirtMatches.length ===
      1
    ) {
      return {
        canonical:
          shirtMatches[0],

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
  statistic:
    StatsHawkPlayerStatistic,

  roster:
    | StatsHawkRosterPlayer
    | null,

  squad:
    CanonicalSquadPlayer[],

  squadById:
    Map<
      string,
      CanonicalSquadPlayer
    >,

  mappings:
    Map<
      string,
      StoredProviderIdentity
    >,
): {
  canonical:
    CanonicalSquadPlayer | null;

  method:
    string | null;
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
        ) ===
          normalized &&
        compatiblePosition(
          roster?.position ??
            statistic.position,

          player.primaryPosition,
        ),
    );

  if (
    exact.length ===
    1
  ) {
    const providerDob =
      dateKey(
        roster?.birthDate,
      );

    const canonicalDob =
      dateKey(
        exact[0]
          .birthDate,
      );

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

function classifyDifference(
  field: string,

  left:
    ComparisonValue,

  right:
    ComparisonValue,
): DifferenceKind {
  if (
    typeof left ===
      "boolean" ||
    typeof right ===
      "boolean"
  ) {
    return left === right
      ? "equal"
      : "blocking";
  }

  if (
    left === right
  ) {
    return "equal";
  }

  const delta =
    Math.abs(
      left -
      right,
    );

  /*
   * Small passing differences are treated as provider
   * counting noise, but still preserved in provenance.
   */
  if (
    (
      field ===
        "passes" ||
      field ===
        "completedPasses"
    ) &&
    delta <= 2
  ) {
    return "minor";
  }

  /*
   * Small substitute-minute differences are normally caused
   * by provider timing / added-time conventions.
   */
  if (
    field ===
      "minutes" &&
    delta <= 5
  ) {
    return "minor";
  }

  /*
   * These are hard match facts.
   *
   * A disagreement here is unsafe enough to block automatic
   * ingestion until manually investigated.
   */
  if (
    field ===
      "goals" ||
    field ===
      "assists" ||
    field ===
      "yellowCards" ||
    field ===
      "redCards"
  ) {
    return "blocking";
  }

  /*
   * A large minutes discrepancy can mean wrong player
   * identity or wrong appearance matching.
   */
  if (
    field ===
      "minutes" &&
    delta > 10
  ) {
    return "blocking";
  }

  /*
   * Shots, tackles, interceptions, fouls and similar event
   * counts can legitimately differ by provider methodology.
   *
   * Big Balls stays canonical, while the disagreement is
   * retained for QA.
   */
  return "review";
}

function derivePassAccuracy(
  passes:
    | number
    | null,

  completedPasses:
    | number
    | null,
) {
  if (
    passes === null ||
    passes <= 0 ||
    completedPasses ===
      null ||
    completedPasses < 0 ||
    completedPasses >
      passes
  ) {
    return null;
  }

  return (
    completedPasses /
    passes
  );
}

export async function previewCanonicalPlayerStatistics(
  matchId:
    string,
) {
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
        match.kickoff
          .toString(),

      competition: {
        name:
          match.competition
            .name,
      },

      homeTeam: {
        name:
          match.homeTeam
            .name,
      },

      awayTeam: {
        name:
          match.awayTeam
            .name,
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
    match.homeTeam
      .isBarcelona
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
      .include(
        "player",
      )
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
      providerId:
        string;

      name:
        string;

      reason:
        string;
    }> = [];

  const unresolvedStatsHawk:
    Array<{
      providerId:
        string;

      name:
        string;

      reason:
        string;
    }> = [];

  if (
    bigBallsResult.status ===
    "fulfilled"
  ) {
    const bundle =
      bigBallsResult.value;

    const barcelonaProviderTeamId =
      match.homeTeam
        .isBarcelona
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
      match.homeTeam
        .isBarcelona
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
      ...resolvedBigBalls
        .keys(),

      ...resolvedStatsHawk
        .keys(),
    ]);

  const conflicts:
    BlockingConflict[] =
    [];

  const minorDiscrepancies:
    MinorDiscrepancy[] =
    [];

  const reviewDiscrepancies:
    ReviewDiscrepancy[] =
    [];

  let fieldsFilledByStatsHawk =
    0;

  const merged =
    [
      ...playerIds,
    ]
      .map(
        (
          playerId,
        ) => {
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

          const canonicalPlayer =
            canonical;

          const fieldSources:
            Record<
              string,
              FieldSource
            > = {};

          function choose<
            T extends
              ComparisonValue
          >(
            field:
              string,

            primary:
              | T
              | null
              | undefined,

            fallback:
              | T
              | null
              | undefined,

            compareProviders =
              true,
          ):
            | T
            | null {
            if (
              primary !== null &&
              primary !== undefined
            ) {
              fieldSources[field] =
                "big-balls-data";

              if (
                compareProviders &&
                fallback !==
                  null &&
                fallback !==
                  undefined
              ) {
                const kind =
                  classifyDifference(
                    field,
                    primary,
                    fallback,
                  );

                if (
                  kind ===
                    "minor" &&
                  typeof primary ===
                    "number" &&
                  typeof fallback ===
                    "number"
                ) {
                  const delta =
                    Math.abs(
                      primary -
                      fallback,
                    );

                  minorDiscrepancies.push({
                    playerId,

                    playerName:
                      canonicalPlayer
                        .displayName,

                    field,

                    bigBalls:
                      primary,

                    statsHawk:
                      fallback,

                    delta,

                    reason:
                      field ===
                        "minutes"
                        ? "small_minutes_difference"
                        : "small_pass_count_difference",
                  });
                }

                if (
                  kind ===
                  "review"
                ) {
                  reviewDiscrepancies.push({
                    playerId,

                    playerName:
                      canonicalPlayer
                        .displayName,

                    field,

                    bigBalls:
                      primary,

                    statsHawk:
                      fallback,

                    delta:
                      typeof primary ===
                        "number" &&
                      typeof fallback ===
                        "number"
                        ? Math.abs(
                            primary -
                            fallback,
                          )
                        : null,

                    reason:
                      "provider_methodology_difference",
                  });
                }

                if (
                  kind ===
                  "blocking"
                ) {
                  conflicts.push({
                    playerId,

                    playerName:
                      canonicalPlayer
                        .displayName,

                    field,

                    bigBalls:
                      primary,

                    statsHawk:
                      fallback,
                  });
                }
              }

              return primary;
            }

            if (
              fallback !== null &&
              fallback !== undefined
            ) {
              fieldSources[field] =
                "statshawk";

              fieldsFilledByStatsHawk +=
                1;

              return fallback;
            }

            return null;
          }

          const minutes =
            choose(
              "minutes",

              big?.statistic
                .minutes,

              hawk?.statistic
                .minutes,
            );

          const goals =
            choose(
              "goals",

              big?.statistic
                .goals,

              hawk?.statistic
                .goals,
            );

          const assists =
            choose(
              "assists",

              big?.statistic
                .assists,

              hawk?.statistic
                .assists,
            );

          const shots =
            choose(
              "shots",

              big?.statistic
                .shots,

              hawk?.statistic
                .shots,
            );

          const shotsOnTarget =
            choose(
              "shotsOnTarget",

              big?.statistic
                .shotsOnTarget,

              hawk?.statistic
                .shotsOnTarget,
            );

          const passes =
            choose(
              "passes",

              big?.statistic
                .passes,

              hawk?.statistic
                .passes,
            );

          const completedPasses =
            choose(
              "completedPasses",

              big?.statistic
                .completedPasses,

              hawk?.statistic
                .completedPasses,
            );

          const derivedPassAccuracy =
            derivePassAccuracy(
              passes,
              completedPasses,
            );

          const passAccuracy =
            derivedPassAccuracy !==
            null
              ? derivedPassAccuracy
              : choose(
                  "passAccuracy",

                  big?.statistic
                    .passAccuracy,

                  hawk?.statistic
                    .passAccuracy,

                  false,
                );

          if (
            derivedPassAccuracy !==
            null
          ) {
            fieldSources.passAccuracy =
              "derived";
          }

          const keyPasses =
            choose(
              "keyPasses",

              big?.statistic
                .keyPasses,

              null,
            );

          const tackles =
            choose(
              "tackles",

              big?.statistic
                .tackles,

              hawk?.statistic
                .tackles,
            );

          const blocks =
            choose(
              "blocks",

              big?.statistic
                .blocks,

              null,
            );

          const interceptions =
            choose(
              "interceptions",

              big?.statistic
                .interceptions,

              hawk?.statistic
                .interceptions,
            );

          const duelsWon =
            choose(
              "duelsWon",

              big?.statistic
                .duelsWon,

              null,
            );

          const duelsTotal =
            choose(
              "duelsTotal",

              big?.statistic
                .duelsTotal,

              null,
            );

          const dribblesAttempted =
            choose(
              "dribblesAttempted",

              big?.statistic
                .dribblesAttempted,

              null,
            );

          const successfulDribbles =
            choose(
              "successfulDribbles",

              big?.statistic
                .successfulDribbles,

              null,
            );

          const fouls =
            choose(
              "fouls",

              big?.statistic
                .fouls,

              hawk?.statistic
                .fouls,
            );

          const yellowCards =
            choose(
              "yellowCards",

              big?.statistic
                .yellowCards,

              hawk?.statistic
                .yellowCards,
            );

          const redCards =
            choose(
              "redCards",

              big?.statistic
                .redCards,

              hawk?.statistic
                .redCards,
            );

          const saves =
            choose(
              "saves",

              big?.statistic
                .saves,

              hawk?.statistic
                .saves,
            );

          const goalsConceded =
            choose(
              "goalsConceded",

              null,

              hawk?.statistic
                .goalsConceded,
            );

          const cleanSheet =
            choose(
              "cleanSheet",

              null,

              hawk?.statistic
                .cleanSheet,
            );

          const rating =
            choose(
              "rating",

              big?.statistic
                .rating,

              null,
            );

          const statistics = {
            minutes,

            goals,

            assists,

            shots,

            shotsOnTarget,

            passes,

            completedPasses,

            passAccuracy,

            keyPasses,

            tackles,

            blocks,

            interceptions,

            duelsWon,

            duelsTotal,

            dribblesAttempted,

            successfulDribbles,

            fouls,

            yellowCards,

            redCards,

            saves,

            goalsConceded,

            cleanSheet,

            rating,

            xG:
              null,

            xA:
              null,
          };

          return {
            playerId,

            playerName:
              canonicalPlayer
                .displayName,

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
        (
          left,
          right,
        ) =>
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

      minorDiscrepancies:
        minorDiscrepancies.length,

      minorDiscrepancyDetails:
        minorDiscrepancies,

      reviewDiscrepancies:
        reviewDiscrepancies.length,

      reviewDiscrepancyDetails:
        reviewDiscrepancies,

      policy: {
        primary:
          "big-balls-data",

        fallback:
          "statshawk",

        rule:
          "StatsHawk fills only null/missing Big Balls fields. Zero is preserved as real data.",

        passAccuracy:
          "Derived from canonical completedPasses / passes whenever both counts are available.",

        minorRules: {
          passing:
            "Passes or completed passes differing by at most 2 are recorded as minor provider-counting differences.",

          minutes:
            "Minutes differing by at most 5 are recorded as minor timing differences.",
        },

        reviewRule:
          "Non-hard-fact provider disagreements are retained for QA but do not block ingestion; Big Balls remains canonical.",

        blockingRule:
          "Goals, assists, yellow cards, red cards, boolean hard facts, or a minutes difference greater than 10 block ingestion.",
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
import "server-only";

import {
  Temporal,
} from "temporal-polyfill";

import {
  db,
} from "../../prisma/db";

import {
  getBarcelonaTeam,
} from "../providers/football-data/client";

import type {
  FootballDataPerson,
} from "../providers/football-data/types";

import {
  fetchStatsHawkMatchBundle,
} from "../providers/statshawk/fetch";

import type {
  StatsHawkRosterPlayer,
} from "../providers/statshawk/types";

import {
  RICH_DATA_SOURCES,
} from "../providers/rich-match/constants";

import {
  normalizedPersonName,
  repairMojibake,
} from "../providers/shared/normalization";

import type {
  MatchIdentityInput,
} from "../providers/shared/match-identity";

import {
  normalizeNationalityName,
} from "../countries";

import {
  fetchWikidataPlayerMetadata,
} from "./wikidata-player-metadata";

/*
|--------------------------------------------------------------------------
| Provider definitions
|--------------------------------------------------------------------------
*/

const FOOTBALL_DATA_SOURCE = {
  code:
    "football-data-org",

  name:
    "football-data.org",

  baseUrl:
    "https://api.football-data.org/v4",

  isOfficial:
    false,

  isEnabled:
    true,

  licenseNotes:
    "Free-tier football data provider. Respect API terms and rate limits.",
} as const;

type CanonicalPlayerPosition =
  | "goalkeeper"
  | "defender"
  | "midfielder"
  | "forward"
  | "unknown";

/*
|--------------------------------------------------------------------------
| Main sync
|--------------------------------------------------------------------------
*/

export async function syncCurrentBarcelonaSquadMetadata() {
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
      "FC Barcelona was not found.",
    );
  }

  const memberships =
    await loadCurrentMemberships(
      season.id,
      barcelona.id,
    );

  if (
    memberships.length ===
    0
  ) {
    throw new Error(
      "The current Barça squad is empty.",
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Provider sources
  |--------------------------------------------------------------------------
  */

  const statsHawkSource =
    await ensureDataSource(
      RICH_DATA_SOURCES
        .statsHawk,
    );

  const footballDataSource =
    await ensureDataSource(
      FOOTBALL_DATA_SOURCE,
    );

  /*
  |--------------------------------------------------------------------------
  | Existing mappings
  |--------------------------------------------------------------------------
  */

  const [
    statsHawkMappings,
    footballDataMappings,
  ] =
    await Promise.all([
      db.orm.public.ProviderMapping
        .where({
          dataSourceId:
            statsHawkSource.id,

          entityType:
            "player",
        })
        .all(),

      db.orm.public.ProviderMapping
        .where({
          dataSourceId:
            footballDataSource.id,

          entityType:
            "player",
        })
        .all(),
    ]);

  const statsHawkMappingMap =
    new Map(
      statsHawkMappings.map(
        (
          mapping,
        ) => [
          mapping.providerId,
          mapping,
        ],
      ),
    );

  const footballDataMappingMap =
    new Map(
      footballDataMappings.map(
        (
          mapping,
        ) => [
          mapping.providerId,
          mapping,
        ],
      ),
    );

  const membershipByPlayerId =
    new Map(
      memberships.map(
        (
          membership,
        ) => [
          membership.playerId,
          membership,
        ],
      ),
    );

  /*
  |--------------------------------------------------------------------------
  | Metadata accumulator
  |--------------------------------------------------------------------------
  */

  type CandidateMetadata = {
    birthDate:
        string | null;

    nationality:
        string | null;

    preferredFoot:
        string | null;

    portraitUrl:
        string | null;

    position:
        CanonicalPlayerPosition | null;

    sources:
        string[];
    };

  const metadata =
    new Map<
      string,
      CandidateMetadata
    >();

  function candidateFor(
    playerId:
      string,
  ) {
    let existing =
      metadata.get(
        playerId,
      );

    if (!existing) {
      existing = {
        birthDate:
          null,

        nationality:
          null,

        preferredFoot:
          null,

        portraitUrl:
          null,

        position:
          null,

        sources:
          [],
      };

      metadata.set(
        playerId,
        existing,
      );
    }

    return existing;
  }

  /*
  |--------------------------------------------------------------------------
  | StatsHawk roster
  |--------------------------------------------------------------------------
  */

  const targetMatch =
    await findStatsHawkTargetMatch(
      season.id,
    );

  let statsHawkRoster:
    StatsHawkRosterPlayer[] =
    [];

  let statsHawkRequestCount =
    0;

  let statsHawkExpectedUnits =
    0;

  let statsHawkQuotaRemaining:
    number | null =
    null;

  const statsHawkUnresolved:
    Array<{
      personId:
        string;

      providerName:
        string;

      reason:
        string;
    }> = [];

  let statsHawkMappingsCreated =
    0;

  if (targetMatch) {
    const matchMappings =
      await db.orm.public.ProviderMapping
        .where({
          internalId:
            targetMatch.id,

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
          targetMatch.kickoff
            .toString(),

        competition: {
          name:
            targetMatch
              .competition
              .name,
        },

        homeTeam: {
          name:
            targetMatch
              .homeTeam
              .name,
        },

        awayTeam: {
          name:
            targetMatch
              .awayTeam
              .name,
        },

        score: {
          home:
            targetMatch
              .homeScore,

          away:
            targetMatch
              .awayScore,
        },

        providerIds:
          Object.fromEntries(
            matchMappings.map(
              (
                mapping,
              ) => [
                mapping
                  .dataSource
                  .code,

                mapping
                  .providerId,
              ],
            ),
          ),
      };

    const bundle =
      await fetchStatsHawkMatchBundle(
        internal,
        {
          includeBarcelonaRoster:
            true,
        },
      );

    statsHawkRoster =
      bundle.barcelonaRoster;

    statsHawkRequestCount =
      bundle.usage
        .requestCount;

    statsHawkExpectedUnits =
      bundle.usage
        .expectedUnits;

    statsHawkQuotaRemaining =
      bundle.usage
        .quotaRemaining;

    for (
      const rosterPlayer
      of statsHawkRoster
    ) {
      const resolution =
        resolveStatsHawkPlayer(
          rosterPlayer,
          memberships,
          membershipByPlayerId,
          statsHawkMappingMap,
        );

      if (
        !resolution.membership
      ) {
        statsHawkUnresolved.push({
          personId:
            rosterPlayer.personId,

          providerName:
            repairMojibake(
              rosterPlayer.displayName,
            ),

          reason:
            resolution.reason,
        });

        continue;
      }

      const membership =
        resolution.membership;

      const candidate =
        candidateFor(
          membership.playerId,
        );

      candidate.birthDate ??=
        rosterPlayer.birthDate;

      candidate.nationality ??=
        normalizeNationalityName(
          rosterPlayer.nationality,
        );

      candidate.preferredFoot ??=
        normalizePreferredFoot(
          rosterPlayer.preferredFoot,
        );

      candidate.portraitUrl ??=
        normalizePortraitUrl(
          rosterPlayer.portraitUrl,
        );

      candidate.position ??=
        rosterPlayer.position !==
          "unknown"
          ? rosterPlayer.position
          : null;

      if (
        !candidate.sources.includes(
          "statshawk",
        )
      ) {
        candidate.sources.push(
          "statshawk",
        );
      }

      if (
        !statsHawkMappingMap.has(
          rosterPlayer.personId,
        )
      ) {
        const mapping =
          await db.orm.public.ProviderMapping
            .create({
              dataSourceId:
                statsHawkSource.id,

              entityType:
                "player",

              internalId:
                membership.playerId,

              providerId:
                rosterPlayer.personId,

              metadata: {
                identityMethod:
                  resolution.method,

                identityKey:
                  "squad_metadata_sync",
              },
            });

        statsHawkMappingMap.set(
          rosterPlayer.personId,
          mapping,
        );

        statsHawkMappingsCreated +=
          1;
      }
    }
  }

  /*
  |--------------------------------------------------------------------------
  | football-data.org squad
  |--------------------------------------------------------------------------
  */

  const footballDataTeam =
    await getBarcelonaTeam();

  const footballDataSquad =
    footballDataTeam.squad ??
    [];

  const footballDataUnresolved:
    Array<{
      providerId:
        string;

      providerName:
        string;

      reason:
        string;
    }> = [];

  let footballDataMappingsCreated =
    0;

  for (
    const providerPlayer
    of footballDataSquad
  ) {
    const resolution =
      resolveFootballDataPlayer(
        providerPlayer,
        memberships,
        membershipByPlayerId,
        footballDataMappingMap,
      );

    if (
      !resolution.membership
    ) {
      footballDataUnresolved.push({
        providerId:
          String(
            providerPlayer.id,
          ),

        providerName:
          providerPlayer.name,

        reason:
          resolution.reason,
      });

      continue;
    }

    const membership =
      resolution.membership;

    const candidate =
      candidateFor(
        membership.playerId,
      );

    candidate.birthDate ??=
      providerPlayer.dateOfBirth;

    candidate.nationality ??=
      normalizeNationalityName(
        providerPlayer.nationality,
      );

    candidate.position ??=
      mapFootballDataPosition(
        providerPlayer.position,
      );

    if (
      !candidate.sources.includes(
        "football-data-org",
      )
    ) {
      candidate.sources.push(
        "football-data-org",
      );
    }

    const providerId =
      String(
        providerPlayer.id,
      );

    if (
      !footballDataMappingMap.has(
        providerId,
      )
    ) {
      const mapping =
        await db.orm.public.ProviderMapping
          .create({
            dataSourceId:
              footballDataSource.id,

            entityType:
              "player",

            internalId:
              membership.playerId,

            providerId,

            metadata: {
              identityMethod:
                resolution.method,

              identityKey:
                "squad_metadata_sync",
            },
          });

      footballDataMappingMap.set(
        providerId,
        mapping,
      );

      footballDataMappingsCreated +=
        1;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Wikidata fallback
  |--------------------------------------------------------------------------
  |
  | Only used for canonical players still missing preferred foot and/or
  | nationality. DOB is mandatory and is used as the hard identity check.
  |--------------------------------------------------------------------------
  */

  let wikidataResolved =
    0;

  let wikidataFootFilled =
    0;

  let wikidataNationalityFilled =
    0;

  for (
    const membership
    of memberships
  ) {
    const player =
      membership.player;

    const candidate =
      candidateFor(
        player.id,
      );

    const birthDate =
      dateKey(
        player.birthDate
          ?.toString() ??
        candidate.birthDate,
      );

    const needsNationality =
      !meaningfulString(
        player.nationality,
      ) &&
      !meaningfulString(
        candidate.nationality,
      );

    const needsFoot =
      !meaningfulString(
        player.preferredFoot,
      ) &&
      !meaningfulString(
        candidate.preferredFoot,
      );

    if (
      !birthDate ||
      (
        !needsNationality &&
        !needsFoot
      )
    ) {
      continue;
    }

    const wiki =
      await fetchWikidataPlayerMetadata({
        name:
          player.displayName,

        birthDate,
      });

    if (!wiki) {
      continue;
    }

    wikidataResolved +=
      1;

    if (
      needsNationality &&
      wiki.nationality
    ) {
      candidate.nationality =
        normalizeNationalityName(
          wiki.nationality,
        );

      wikidataNationalityFilled +=
        1;
    }

    if (
      needsFoot &&
      wiki.preferredFoot
    ) {
      candidate.preferredFoot =
        wiki.preferredFoot;

      wikidataFootFilled +=
        1;
    }

    if (
      !candidate.sources.includes(
        "wikidata",
      )
    ) {
      candidate.sources.push(
        "wikidata",
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Persist canonical metadata
  |--------------------------------------------------------------------------
  */

  let playersUpdated =
    0;

  let playersUnchanged =
    0;

  let portraitsReplaced =
    0;

  const fieldsFilled = {
    birthDate:
      0,

    nationality:
      0,

    preferredFoot:
      0,

    portrait:
      0,

    position:
      0,
  };

  for (
    const membership
    of memberships
  ) {
    const player =
      membership.player;

    const candidate =
      metadata.get(
        player.id,
      );

    if (!candidate) {
      playersUnchanged +=
        1;

      continue;
    }

    const providerBirthDate =
      candidate.birthDate
        ? dateOnlyInstant(
            candidate.birthDate,
          )
        : null;

    const existingNationality =
      meaningfulString(
        player.nationality,
      );

    const existingFoot =
      meaningfulString(
        player.preferredFoot,
      );

    const providerNationality =
      meaningfulString(
        candidate.nationality,
      );

    const providerFoot =
      meaningfulString(
        candidate.preferredFoot,
      );

    const providerPortrait =
      normalizePortraitUrl(
        candidate.portraitUrl,
      );

    const nextBirthDate =
      player.birthDate ??
      providerBirthDate;

    const nextNationality =
      existingNationality ??
      providerNationality;

    const nextPreferredFoot =
      existingFoot ??
      providerFoot;

    /*
     * Only replace the existing GOAL image if a provider actually gives
     * us a different portrait.
     */
    const nextPortraitUrl =
      providerPortrait ??
      player.portraitUrl;

    const nextPosition =
      player.primaryPosition !==
        "unknown"
        ? player.primaryPosition
        : candidate.position &&
            candidate.position !==
              "unknown"
          ? candidate.position
          : player.primaryPosition;

    let changed =
      false;

    if (
      !player.birthDate &&
      nextBirthDate
    ) {
      fieldsFilled.birthDate +=
        1;

      changed =
        true;
    }

    if (
      !existingNationality &&
      nextNationality
    ) {
      fieldsFilled.nationality +=
        1;

      changed =
        true;
    }

    if (
      !existingFoot &&
      nextPreferredFoot
    ) {
      fieldsFilled.preferredFoot +=
        1;

      changed =
        true;
    }

    if (
      providerPortrait &&
      providerPortrait !==
        player.portraitUrl
    ) {
      fieldsFilled.portrait +=
        1;

      portraitsReplaced +=
        1;

      changed =
        true;
    }

    if (
      player.primaryPosition ===
        "unknown" &&
      nextPosition !==
        "unknown"
    ) {
      fieldsFilled.position +=
        1;

      changed =
        true;
    }

    if (!changed) {
      playersUnchanged +=
        1;

      continue;
    }

    await db.orm.public.Player
      .where({
        id:
          player.id,
      })
      .update({
        birthDate:
          nextBirthDate,

        nationality:
          nextNationality,

        preferredFoot:
          nextPreferredFoot,

        portraitUrl:
          nextPortraitUrl,

        primaryPosition:
          nextPosition,
      });

    playersUpdated +=
      1;
  }

  return {
    season:
      season.label,

    providers: {
      statsHawk: {
        targetMatch:
          targetMatch
            ? {
                id:
                  targetMatch.id,

                competition:
                  targetMatch
                    .competition
                    .name,

                home:
                  targetMatch
                    .homeTeam
                    .name,

                away:
                  targetMatch
                    .awayTeam
                    .name,

                kickoff:
                  targetMatch
                    .kickoff
                    .toString(),
              }
            : null,

        rosterPlayers:
          statsHawkRoster
            .length,

        requestCount:
          statsHawkRequestCount,

        expectedUnits:
          statsHawkExpectedUnits,

        quotaRemaining:
          statsHawkQuotaRemaining,

        mappingsCreated:
          statsHawkMappingsCreated,

        unresolved:
          statsHawkUnresolved,
      },

      footballData: {
        rosterPlayers:
          footballDataSquad
            .length,

        mappingsCreated:
          footballDataMappingsCreated,

        unresolved:
          footballDataUnresolved,
      },

      wikidata: {
        resolved:
          wikidataResolved,

        preferredFootFilled:
          wikidataFootFilled,

        nationalityFilled:
          wikidataNationalityFilled,
      },
    },

    canonical: {
      currentSquad:
        memberships.length,

      candidates:
        metadata.size,

      playersUpdated,

      playersUnchanged,

      portraitsReplaced,

      fieldsFilled,
    },
  };
}

/*
|--------------------------------------------------------------------------
| Current squad
|--------------------------------------------------------------------------
*/

async function loadCurrentMemberships(
  seasonId:
    string,

  teamId:
    string,
) {
  const memberships =
    await db.orm.public.SquadMembership
      .where({
        seasonId,
        teamId,
      })
      .include(
        "player",
      )
      .all();

  const now =
    Date.now();

  return memberships.filter(
    (
      membership,
    ) => {
      if (
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
          membership.leftAt
            .toString(),
        ).getTime() >
        now
      );
    },
  );
}

type CurrentMembership =
  Awaited<
    ReturnType<
      typeof loadCurrentMemberships
    >
  >[number];

/*
|--------------------------------------------------------------------------
| StatsHawk target
|--------------------------------------------------------------------------
*/

async function findStatsHawkTargetMatch(
  seasonId:
    string,
) {
  const matches =
    await db.orm.public.Match
      .where({
        seasonId,
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
      .all();

  return (
    matches
      .filter(
        (
          match,
        ) =>
          match.status ===
            "finished" &&
          (
            match.homeTeam
              .isBarcelona ||
            match.awayTeam
              .isBarcelona
          ) &&
          statsHawkSupportsCompetition(
            match.competition
              .name,
          ),
      )
      .sort(
        (
          left,
          right,
        ) =>
          new Date(
            right.kickoff
              .toString(),
          ).getTime() -
          new Date(
            left.kickoff
              .toString(),
          ).getTime(),
      )[0] ??
    null
  );
}

/*
|--------------------------------------------------------------------------
| StatsHawk identity
|--------------------------------------------------------------------------
*/

function resolveStatsHawkPlayer(
  rosterPlayer:
    StatsHawkRosterPlayer,

  memberships:
    CurrentMembership[],

  membershipByPlayerId:
    Map<
      string,
      CurrentMembership
    >,

  mappingMap:
    Map<
      string,
      {
        internalId:
          string;
      }
    >,
): {
  membership:
    CurrentMembership | null;

  method:
    string;

  reason:
    string;
} {
  const mapped =
    mappingMap.get(
      rosterPlayer.personId,
    );

  if (mapped) {
    const membership =
      membershipByPlayerId.get(
        mapped.internalId,
      );

    if (membership) {
      return {
        membership,

        method:
          "existing_provider_mapping",

        reason:
          "",
      };
    }
  }

  /*
  |--------------------------------------------------------------------------
  | DOB + position
  |--------------------------------------------------------------------------
  |
  | This fixes nickname/accent/provider-name differences such as:
  | Ronald Araújo / Araujo and similar cases.
  |--------------------------------------------------------------------------
  */

  const providerDob =
    dateKey(
      rosterPlayer.birthDate,
    );

  if (providerDob) {
    const dobMatches =
      memberships.filter(
        (
          membership,
        ) =>
          dateKey(
            membership.player
              .birthDate
              ?.toString(),
          ) ===
            providerDob &&
          positionsCompatible(
            effectivePosition(
              membership,
            ),
            rosterPlayer.position,
          ),
      );

    if (
      dobMatches.length ===
      1
    ) {
      return {
        membership:
          dobMatches[0],

        method:
          "unique_dob_position",

        reason:
          "",
      };
    }
  }

  return resolveByName(
    repairMojibake(
      rosterPlayer.displayName,
    ),
    rosterPlayer.position,
    memberships,
  );
}

/*
|--------------------------------------------------------------------------
| football-data identity
|--------------------------------------------------------------------------
*/

function resolveFootballDataPlayer(
  providerPlayer:
    FootballDataPerson,

  memberships:
    CurrentMembership[],

  membershipByPlayerId:
    Map<
      string,
      CurrentMembership
    >,

  mappingMap:
    Map<
      string,
      {
        internalId:
          string;
      }
    >,
): {
  membership:
    CurrentMembership | null;

  method:
    string;

  reason:
    string;
} {
  const providerId =
    String(
      providerPlayer.id,
    );

  const mapped =
    mappingMap.get(
      providerId,
    );

  if (mapped) {
    const membership =
      membershipByPlayerId.get(
        mapped.internalId,
      );

    if (membership) {
      return {
        membership,

        method:
          "existing_provider_mapping",

        reason:
          "",
      };
    }
  }

  const providerDob =
    dateKey(
      providerPlayer.dateOfBirth,
    );

  const providerPosition =
    mapFootballDataPosition(
      providerPlayer.position,
    );

  if (providerDob) {
    const dobMatches =
      memberships.filter(
        (
          membership,
        ) =>
          dateKey(
            membership.player
              .birthDate
              ?.toString(),
          ) ===
            providerDob &&
          positionsCompatible(
            effectivePosition(
              membership,
            ),
            providerPosition,
          ),
      );

    if (
      dobMatches.length ===
      1
    ) {
      return {
        membership:
          dobMatches[0],

        method:
          "unique_dob_position",

        reason:
          "",
      };
    }
  }

  return resolveByName(
    providerPlayer.name,
    providerPosition,
    memberships,
  );
}

/*
|--------------------------------------------------------------------------
| Shared name resolver
|--------------------------------------------------------------------------
*/

function resolveByName(
  providerName:
    string,

  providerPosition:
    string,

  memberships:
    CurrentMembership[],
): {
  membership:
    CurrentMembership | null;

  method:
    string;

  reason:
    string;
} {
  const normalized =
    normalizedPersonName(
      providerName,
    );

  const exact =
    memberships.filter(
      (
        membership,
      ) =>
        normalizedPersonName(
          membership.player
            .displayName,
        ) ===
          normalized &&
        positionsCompatible(
          effectivePosition(
            membership,
          ),
          providerPosition,
        ),
    );

  if (
    exact.length ===
    1
  ) {
    return {
      membership:
        exact[0],

      method:
        "exact_name_position",

      reason:
        "",
    };
  }

  const providerTokens =
    usefulTokens(
      providerName,
    );

  const tokenMatches =
    memberships.filter(
      (
        membership,
      ) => {
        if (
          !positionsCompatible(
            effectivePosition(
              membership,
            ),
            providerPosition,
          )
        ) {
          return false;
        }

        const canonicalTokens =
          usefulTokens(
            membership.player
              .displayName,
          );

        return providerTokens.some(
          (
            token,
          ) =>
            canonicalTokens.includes(
              token,
            ),
        );
      },
    );

  if (
    tokenMatches.length ===
    1
  ) {
    return {
      membership:
        tokenMatches[0],

      method:
        "unique_name_token_position",

      reason:
        "",
    };
  }

  return {
    membership:
      null,

    method:
      "",

    reason:
      exact.length >
      1
        ? "ambiguous_exact_name"
        : tokenMatches.length >
            1
          ? "ambiguous_name_token"
          : "no_unique_safe_identity",
  };
}

/*
|--------------------------------------------------------------------------
| Provider rows
|--------------------------------------------------------------------------
*/

async function ensureDataSource(
  definition: {
    code:
      string;

    name:
      string;

    baseUrl:
      string;

    isOfficial:
      boolean;

    isEnabled:
      boolean;

    licenseNotes:
      string;
  },
) {
  const existing =
    await db.orm.public.DataSource
      .where({
        code:
          definition.code,
      })
      .first();

  if (existing) {
    return existing;
  }

  return db.orm.public.DataSource
    .create({
      code:
        definition.code,

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
    });
}

/*
|--------------------------------------------------------------------------
| Normalization
|--------------------------------------------------------------------------
*/

function effectivePosition(
  membership:
    CurrentMembership,
) {
  return membership.position !==
    "unknown"
    ? membership.position
    : membership.player
        .primaryPosition;
}

function mapFootballDataPosition(
  value:
    string | null,
): CanonicalPlayerPosition {
  const normalized =
    value
      ?.toLowerCase()
      .trim() ??
    "";

  if (
    normalized.includes(
      "goal",
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
      "off",
    ) ||
    normalized.includes(
      "for",
    ) ||
    normalized.includes(
      "attack",
    )
  ) {
    return "forward";
  }

  return "unknown";
}

function positionsCompatible(
  canonical:
    string,

  provider:
    string,
) {
  return (
    canonical ===
      "unknown" ||
    provider ===
      "unknown" ||
    canonical ===
      provider
  );
}

function usefulTokens(
  value:
    string,
) {
  return normalizedPersonName(
    repairMojibake(
      value,
    ),
  )
    .split(
      /\s+/,
    )
    .filter(
      (
        token,
      ) =>
        token.length >=
        3,
    );
}

function dateOnlyInstant(
  value:
    string,
) {
  const date =
    dateKey(
      value,
    );

  if (!date) {
    return null;
  }

  try {
    return Temporal.Instant.from(
      `${date}T00:00:00Z`,
    );
  } catch {
    return null;
  }
}

function dateKey(
  value:
    string | null | undefined,
) {
  if (!value) {
    return null;
  }

  const match =
    value.match(
      /(\d{4})-(\d{2})-(\d{2})/,
    );

  if (!match) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function meaningfulString(
  value:
    string | null | undefined,
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

function normalizePreferredFoot(
  value:
    string | null,
) {
  const meaningful =
    meaningfulString(
      value,
    );

  if (!meaningful) {
    return null;
  }

  const normalized =
    meaningful
      .toLowerCase();

  if (
    normalized.includes(
      "left",
    )
  ) {
    return "left";
  }

  if (
    normalized.includes(
      "right",
    )
  ) {
    return "right";
  }

  if (
    normalized.includes(
      "both",
    ) ||
    normalized.includes(
      "two",
    )
  ) {
    return "both";
  }

  return normalized;
}

function normalizePortraitUrl(
  value:
    string | null,
) {
  const meaningful =
    meaningfulString(
      value,
    );

  if (!meaningful) {
    return null;
  }

  if (
    meaningful.startsWith(
      "//",
    )
  ) {
    return `https:${meaningful}`;
  }

  if (
    /^https?:\/\//i.test(
      meaningful,
    )
  ) {
    return meaningful;
  }

  return null;
}

function statsHawkSupportsCompetition(
  value:
    string,
) {
  const normalized =
    value.toLowerCase();

  return (
    normalized.includes(
      "champions",
    ) ||
    normalized.includes(
      "la liga",
    ) ||
    normalized.includes(
      "laliga",
    ) ||
    normalized.includes(
      "primera",
    )
  );
}
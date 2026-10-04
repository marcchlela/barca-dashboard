import "server-only";

import {
  db,
} from "../../prisma/db";

import {
  asObject,
} from "../providers/shared/json";

import {
  normalizedPersonName,
  repairMojibake,
} from "../providers/shared/normalization";

import {
  fetchPitchApiDate,
  fetchPitchApiHeatmaps,
  type PitchApiMatch,
  type PitchHeatmapPlayer,
} from "../providers/pitch-api/client";

const SOURCE = {
  code:
    "pitchapi-spatial",

  name:
    "PitchAPI Spatial",

  baseUrl:
    "https://api.pitchapi.dev/v1",

  isOfficial:
    false,

  isEnabled:
    true,

  licenseNotes:
    "Supplemental spatial source for cached player heatmaps.",
};

type SyncOptions = {
  matchId?:
    string;

  force?:
    boolean;
};

export async function syncCurrentBarcelonaPlayerHeatmaps(
  options:
    SyncOptions = {},
) {
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

  const source =
    await ensureDataSource();

  /*
  |--------------------------------------------------------------------------
  | Current squad shirt numbers
  |--------------------------------------------------------------------------
  */

  const memberships =
    await db.orm.public.SquadMembership
      .where({
        seasonId:
          season.id,

        teamId:
          barcelona.id,
      })
      .all();

  const shirtNumberByPlayer =
    new Map(
      memberships.map(
        (
          membership,
        ) => [
          membership.playerId,
          membership.shirtNumber,
        ],
      ),
    );

  /*
  |--------------------------------------------------------------------------
  | Finished Barça matches
  |--------------------------------------------------------------------------
  */

  const seasonMatches =
    await db.orm.public.Match
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
      .all();

  const targetMatches =
    seasonMatches.filter(
      (
        match,
      ) => {
        if (
          options.matchId &&
          match.id !==
            options.matchId
        ) {
          return false;
        }

        if (
          match.status !==
          "finished"
        ) {
          return false;
        }

        return (
          match.homeTeamId ===
            barcelona.id ||
          match.awayTeamId ===
            barcelona.id
        );
      },
    );

  /*
  |--------------------------------------------------------------------------
  | Result counters
  |--------------------------------------------------------------------------
  */

  let totalWritten =
    0;

  let totalExisting =
    0;

  let totalUnavailable =
    0;

  let totalUnresolved =
    0;

  const matchResults:
    Array<
      Record<
        string,
        unknown
      >
    > = [];

  /*
  |--------------------------------------------------------------------------
  | Sync each match
  |--------------------------------------------------------------------------
  */

  for (
    const match
    of targetMatches
  ) {
    try {
      const statistics =
        await db.orm.public.PlayerMatchStatistic
          .where({
            matchId:
              match.id,

            teamId:
              barcelona.id,
          })
          .include(
            "player",
          )
          .all();

      const appearances =
        statistics.filter(
          isActualAppearance,
        );

      if (
        appearances.length ===
        0
      ) {
        matchResults.push({
          matchId:
            match.id,

          status:
            "no_player_statistics",
        });

        continue;
      }

      /*
      |--------------------------------------------------------------------------
      | Resolve PitchAPI match
      |--------------------------------------------------------------------------
      */

      const providerMatch =
        await resolvePitchApiMatch(
          source.id,
          match,
        );

      if (!providerMatch) {
        matchResults.push({
          matchId:
            match.id,

          status:
            "match_not_resolved",
        });

        continue;
      }

      /*
      |--------------------------------------------------------------------------
      | Fetch all heatmaps in ONE request
      |--------------------------------------------------------------------------
      */

      const response =
        await fetchPitchApiHeatmaps(
          providerMatch.id,
        );

      const heatmapData =
        response.data;

      const barcelonaSide:
        "home" | "away" =
        match.homeTeamId ===
        barcelona.id
          ? "home"
          : "away";

      const providerBarcelona =
        barcelonaSide ===
        "home"
          ? providerMatch.home_team
          : providerMatch.away_team;

      const providerPlayers =
        (
          heatmapData.players ??
          []
        ).filter(
          (
            player,
          ) =>
            player.side ===
              barcelonaSide &&
            (
              player.team.id ===
                providerBarcelona.id ||
              teamKey(
                player.team.name,
              ) ===
                teamKey(
                  providerBarcelona.name,
                )
            ),
        );

      /*
      |--------------------------------------------------------------------------
      | Persist each Barça player's match heatmap
      |--------------------------------------------------------------------------
      */

      let written =
        0;

      let existing =
        0;

      let unavailable =
        0;

      const unresolvedPlayers:
        string[] =
        [];

      for (
        const statistic
        of appearances
      ) {
        const currentRawData =
          asObject(
            statistic.rawData,
          ) ??
          {};

        const existingSpatial =
          asObject(
            currentRawData
              .spatialHeatmap,
          );

        /*
         * Skip already-cached PitchAPI
         * heatmaps unless force=true.
         */

        if (
          !options.force &&
          existingSpatial &&
          existingSpatial.provider ===
            SOURCE.code &&
          Array.isArray(
            existingSpatial.cells,
          ) &&
          existingSpatial.cells
            .length >
            0
        ) {
          existing +=
            1;

          continue;
        }

        const shirtNumber =
          shirtNumberByPlayer.get(
            statistic.playerId,
          ) ??
          null;

        const providerPlayer =
          await resolveProviderPlayer(
            source.id,
            statistic.player,
            shirtNumber,
            providerPlayers,
          );

        if (!providerPlayer) {
          unresolvedPlayers.push(
            repairMojibake(
              statistic.player
                .displayName,
            ),
          );

          continue;
        }

        const cells =
          normalizeCells(
            providerPlayer.cells,
          );

        if (
          cells.length ===
          0
        ) {
          unavailable +=
            1;

          continue;
        }

        /*
        |--------------------------------------------------------------------------
        | Preserve the real per-match grid
        |--------------------------------------------------------------------------
        */

        await db.orm.public.PlayerMatchStatistic
          .where({
            id:
              statistic.id,
          })
          .update({
            rawData: {
              ...currentRawData,

              spatialHeatmap: {
                version:
                  2,

                provider:
                  SOURCE.code,

                providerMatchId:
                  providerMatch.id,

                providerPlayerId:
                  providerPlayer
                    .player.id,

                providerPlayerName:
                  repairMojibake(
                    providerPlayer
                      .player.name,
                  ),

                frame:
                  heatmapData.grid
                    .frame,

                grid: {
                  length:
                    heatmapData.grid
                      .length,

                  width:
                    heatmapData.grid
                      .width,

                  cellLengthM:
                    heatmapData.grid
                      .cell_length_m ??
                    null,

                  cellWidthM:
                    heatmapData.grid
                      .cell_width_m ??
                    null,
                },

                actions:
                  providerPlayer
                    .actions,

                cells,

                fetchedAt:
                  new Date()
                    .toISOString(),
              },
            },
          });

        written +=
          1;
      }

      totalWritten +=
        written;

      totalExisting +=
        existing;

      totalUnavailable +=
        unavailable;

      totalUnresolved +=
        unresolvedPlayers.length;

      matchResults.push({
        matchId:
          match.id,

        fixture:
          `${repairMojibake(
            match.homeTeam
              .shortName ??
              match.homeTeam
                .name,
          )} vs ${repairMojibake(
            match.awayTeam
              .shortName ??
              match.awayTeam
                .name,
          )}`,

        competition:
          match.competition
            .name,

        providerMatchId:
          providerMatch.id,

        providerPlayerHeatmaps:
          providerPlayers.length,

        canonicalAppearances:
          appearances.length,

        written,

        existing,

        unavailable,

        unresolvedPlayers,

        status:
          "completed",
      });
    } catch (
      error
    ) {
      matchResults.push({
        matchId:
          match.id,

        status:
          "failed",

        error:
          error instanceof Error
            ? error.message
            : String(
                error,
              ),
      });
    }

    /*
     * Keep full-season sync polite.
     */
    await sleep(
      175,
    );
  }

  return {
    season:
      season.label,

    source:
      SOURCE.code,

    matchesTargeted:
      targetMatches.length,

    summary: {
      written:
        totalWritten,

      existing:
        totalExisting,

      unavailable:
        totalUnavailable,

      unresolvedPlayers:
        totalUnresolved,
    },

    matches:
      matchResults,
  };
}

/*
|--------------------------------------------------------------------------
| Data source
|--------------------------------------------------------------------------
*/

async function ensureDataSource() {
  const existing =
    await db.orm.public.DataSource
      .where({
        code:
          SOURCE.code,
      })
      .first();

  if (existing) {
    return existing;
  }

  return db.orm.public.DataSource
    .create({
      ...SOURCE,
    });
}

/*
|--------------------------------------------------------------------------
| Match resolution
|--------------------------------------------------------------------------
*/

async function resolvePitchApiMatch(
  dataSourceId:
    string,

  match: {
    id:
      string;

    kickoff: {
      toString():
        string;
    };

    homeScore:
      number | null;

    awayScore:
      number | null;

    homeTeam: {
      name:
        string;

      shortName:
        string | null;
    };

    awayTeam: {
      name:
        string;

      shortName:
        string | null;
    };
  },
) {
  /*
   * Use cached mapping first.
   */

  const existing =
    await db.orm.public.ProviderMapping
      .where({
        dataSourceId,

        entityType:
          "match",

        internalId:
          match.id,
      })
      .first();

  if (existing) {
    return {
      id:
        existing.providerId,

      home_team: {
        id:
          "",

        name:
          repairMojibake(
            match.homeTeam
              .name,
          ),
      },

      away_team: {
        id:
          "",

        name:
          repairMojibake(
            match.awayTeam
              .name,
          ),
      },

      date:
        new Date(
          match.kickoff.toString(),
        )
          .toISOString()
          .slice(
            0,
            10,
          ),

      time_utc:
        match.kickoff.toString(),

      status:
        "finished",

      score_home:
        match.homeScore,

      score_away:
        match.awayScore,
    } satisfies PitchApiMatch;
  }

  const kickoff =
    new Date(
      match.kickoff.toString(),
    );

  const date =
    kickoff
      .toISOString()
      .slice(
        0,
        10,
      );

  const response =
    await fetchPitchApiDate(
      date,
    );

  const candidates =
    (
      response.data
        ?.matches ??
      []
    ).filter(
      (
        candidate,
      ) =>
        matchIdentityMatches(
          match,
          candidate,
        ),
    );

  if (
    candidates.length !==
    1
  ) {
    return null;
  }

  const providerMatch =
    candidates[0];

  await ensureMapping({
    dataSourceId,

    entityType:
      "match",

    internalId:
      match.id,

    providerId:
      providerMatch.id,

    metadata: {
      purpose:
        "player_heatmap",

      home:
        providerMatch
          .home_team.name,

      away:
        providerMatch
          .away_team.name,

      kickoff:
        providerMatch
          .time_utc,
    },
  });

  return providerMatch;
}

/*
|--------------------------------------------------------------------------
| Player resolution
|--------------------------------------------------------------------------
*/

async function resolveProviderPlayer(
  dataSourceId:
    string,

  player: {
    id:
      string;

    displayName:
      string;

    firstName:
      string | null;

    lastName:
      string | null;
  },

  shirtNumber:
    number | null,

  providerPlayers:
    PitchHeatmapPlayer[],
) {
  /*
  |--------------------------------------------------------------------------
  | Existing provider mapping
  |--------------------------------------------------------------------------
  */

  const existing =
    await db.orm.public.ProviderMapping
      .where({
        dataSourceId,

        entityType:
          "player",

        internalId:
          player.id,
      })
      .first();

  if (existing) {
    const mapped =
      providerPlayers.find(
        (
          candidate,
        ) =>
          candidate.player.id ===
          existing.providerId,
      );

    if (mapped) {
      return mapped;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Exact normalized names
  |--------------------------------------------------------------------------
  */

  const canonicalNames =
    new Set<string>();

  addName(
    canonicalNames,
    player.displayName,
  );

  if (
    player.firstName &&
    player.lastName
  ) {
    addName(
      canonicalNames,
      `${player.firstName} ${player.lastName}`,
    );
  }

  const nameMatches =
    providerPlayers.filter(
      (
        candidate,
      ) => {
        const providerName =
          normalizedPersonName(
            repairMojibake(
              candidate.player
                .name,
            ),
          );

        return canonicalNames.has(
          providerName,
        );
      },
    );

  if (
    nameMatches.length ===
    1
  ) {
    await ensurePlayerMapping(
      dataSourceId,
      player.id,
      nameMatches[0],
    );

    return nameMatches[0];
  }

  /*
  |--------------------------------------------------------------------------
  | Shirt-number fallback
  |--------------------------------------------------------------------------
  |
  | Only safe because providerPlayers has
  | already been restricted to Barcelona.
  |--------------------------------------------------------------------------
  */

  if (
    shirtNumber !==
    null
  ) {
    const shirtMatches =
      providerPlayers.filter(
        (
          candidate,
        ) =>
          Number(
            candidate.player
              .shirt_number,
          ) ===
          shirtNumber,
      );

    if (
      shirtMatches.length ===
      1
    ) {
      await ensurePlayerMapping(
        dataSourceId,
        player.id,
        shirtMatches[0],
      );

      return shirtMatches[0];
    }
  }

  return null;
}

async function ensurePlayerMapping(
  dataSourceId:
    string,

  playerId:
    string,

  providerPlayer:
    PitchHeatmapPlayer,
) {
  await ensureMapping({
    dataSourceId,

    entityType:
      "player",

    internalId:
      playerId,

    providerId:
      providerPlayer
        .player.id,

    metadata: {
      purpose:
        "player_heatmap",

      providerName:
        repairMojibake(
          providerPlayer
            .player.name,
        ),

      shirtNumber:
        providerPlayer
          .player
          .shirt_number ??
        null,
    },
  });
}

/*
|--------------------------------------------------------------------------
| Mapping helper
|--------------------------------------------------------------------------
*/

async function ensureMapping({
  dataSourceId,
  entityType,
  internalId,
  providerId,
  metadata,
}: {
  dataSourceId:
    string;

  entityType:
    "match"
    | "player";

  internalId:
    string;

  providerId:
    string;

  metadata:
    Record<
      string,
      string
      | number
      | boolean
      | null
    >;
}) {
  const byInternal =
    await db.orm.public.ProviderMapping
      .where({
        dataSourceId,

        entityType,

        internalId,
      })
      .first();

  if (byInternal) {
    return byInternal;
  }

  const byProvider =
    await db.orm.public.ProviderMapping
      .where({
        dataSourceId,

        entityType,

        providerId,
      })
      .first();

  if (byProvider) {
    return byProvider;
  }

  return db.orm.public.ProviderMapping
    .create({
      dataSourceId,

      entityType,

      internalId,

      providerId,

      metadata,
    });
}

/*
|--------------------------------------------------------------------------
| Match identity
|--------------------------------------------------------------------------
*/

function matchIdentityMatches(
  canonical: {
    kickoff: {
      toString():
        string;
    };

    homeScore:
      number | null;

    awayScore:
      number | null;

    homeTeam: {
      name:
        string;

      shortName:
        string | null;
    };

    awayTeam: {
      name:
        string;

      shortName:
        string | null;
    };
  },

  provider:
    PitchApiMatch,
) {
  const homeMatches =
    teamMatches(
      [
        canonical.homeTeam
          .name,

        canonical.homeTeam
          .shortName,
      ],

      provider.home_team
        .name,
    );

  const awayMatches =
    teamMatches(
      [
        canonical.awayTeam
          .name,

        canonical.awayTeam
          .shortName,
      ],

      provider.away_team
        .name,
    );

  if (
    !homeMatches ||
    !awayMatches
  ) {
    return false;
  }

  /*
   * Finished-score safety check.
   */

  if (
    canonical.homeScore !==
      null &&
    canonical.awayScore !==
      null &&
    provider.score_home !==
      null &&
    provider.score_away !==
      null
  ) {
    if (
      canonical.homeScore !==
        provider.score_home ||
      canonical.awayScore !==
        provider.score_away
    ) {
      return false;
    }
  }

  /*
   * Keep kickoff close enough that we
   * don't accidentally map another match.
   */

  const canonicalTime =
    new Date(
      canonical.kickoff.toString(),
    ).getTime();

  const providerTime =
    new Date(
      provider.time_utc,
    ).getTime();

  if (
    Number.isFinite(
      canonicalTime,
    ) &&
    Number.isFinite(
      providerTime,
    )
  ) {
    const difference =
      Math.abs(
        canonicalTime -
        providerTime,
      );

    if (
      difference >
      3 *
        60 *
        60 *
        1000
    ) {
      return false;
    }
  }

  return true;
}

/*
|--------------------------------------------------------------------------
| Team identity
|--------------------------------------------------------------------------
|
| Provider naming is not always identical to canonical naming:
|
|   Santander
|   Racing Santander
|   Real Racing Club de Santander
|
| should all resolve to the same football club.
|
| Keep aliases deliberately conservative. We don't want fuzzy matching to
| accidentally map two genuinely different teams.
|--------------------------------------------------------------------------
*/

function teamMatches(
  canonicalNames:
    Array<
      string | null
    >,

  providerName:
    string,
) {
  const providerKey =
    teamKey(
      providerName,
    );

  return canonicalNames
    .filter(
      (
        value,
      ): value is string =>
        Boolean(
          value,
        ),
    )
    .some(
      (
        value,
      ) =>
        teamKey(
          value,
        ) ===
        providerKey,
    );
}

const TEAM_ALIASES:
  Record<
    string,
    string
  > = {
    /*
    |--------------------------------------------------------------------------
    | Barcelona
    |--------------------------------------------------------------------------
    */

    barca:
      "barcelona",

    barcelona:
      "barcelona",

    /*
    |--------------------------------------------------------------------------
    | Racing Santander
    |--------------------------------------------------------------------------
    */

    santander:
      "racing santander",

    "racing santander":
      "racing santander",

    "real racing santander":
      "racing santander",

    "real racing de santander":
      "racing santander",

    /*
    |--------------------------------------------------------------------------
    | Athletic Club
    |--------------------------------------------------------------------------
    */

    athletic:
      "athletic",

    "athletic bilbao":
      "athletic",

    /*
    |--------------------------------------------------------------------------
    | Rayo Vallecano
    |--------------------------------------------------------------------------
    */

    "rayo vallecano":
      "rayo vallecano",

    "rayo vallecano madrid":
      "rayo vallecano",
  };

function teamKey(
  value:
    string,
) {
  const normalized =
    normalizedPersonName(
      repairMojibake(
        value,
      ),
    )
      .replace(
        /\b(fc|cf|club|football|futbol)\b/g,
        " ",
      )
      .replace(
        /\s+/g,
        " ",
      )
      .trim();

  return (
    TEAM_ALIASES[
      normalized
    ] ??
    normalized
  );
}

/*
|--------------------------------------------------------------------------
| Cell validation
|--------------------------------------------------------------------------
*/

function normalizeCells(
  cells:
    [
      number,
      number,
      number,
    ][],
) {
  return cells
    .filter(
      (
        cell,
      ) =>
        Array.isArray(
          cell,
        ) &&
        cell.length >=
          3 &&
        Number.isFinite(
          cell[0],
        ) &&
        Number.isFinite(
          cell[1],
        ) &&
        Number.isFinite(
          cell[2],
        ) &&
        cell[2] >
          0,
    )
    .map(
      (
        cell,
      ) =>
        [
          Math.round(
            cell[0],
          ),

          Math.round(
            cell[1],
          ),

          cell[2],
        ] as [
          number,
          number,
          number,
        ],
    );
}

/*
|--------------------------------------------------------------------------
| Helpers
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

function addName(
  set:
    Set<string>,

  value:
    string | null |
    undefined,
) {
  if (!value) {
    return;
  }

  set.add(
    normalizedPersonName(
      repairMojibake(
        value,
      ),
    ),
  );
}

function sleep(
  milliseconds:
    number,
) {
  return new Promise<void>(
    (
      resolve,
    ) => {
      setTimeout(
        resolve,
        milliseconds,
      );
    },
  );
}
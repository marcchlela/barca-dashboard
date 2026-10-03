import "server-only";

import {
  db,
} from "../../prisma/db";

export async function getAdminOverview() {
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

  /*
  |--------------------------------------------------------------------------
  | Canonical data
  |--------------------------------------------------------------------------
  */

  const [
    matches,
    players,
    media,
    playerStatistics,
    teamStatistics,
    lineups,
    diaryEntries,
    dataSources,
    mappings,
    manualOverrides,
  ] =
    await Promise.all([
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
        .orderBy(
          (
            match,
          ) =>
            match.kickoff.asc(),
        )
        .all(),

      db.orm.public.Player
        .all(),

      db.orm.public.MediaItem
        .all(),

      db.orm.public.PlayerMatchStatistic
        .all(),

      db.orm.public.MatchStatistic
        .all(),

      db.orm.public.Lineup
        .all(),

      db.orm.public.MatchDiaryEntry
        .all(),

      db.orm.public.DataSource
        .orderBy(
          (
            source,
          ) =>
            source.name.asc(),
        )
        .all(),

      db.orm.public.ProviderMapping
        .all(),

      db.orm.public.ManualOverride
        .all(),
    ]);

  /*
  |--------------------------------------------------------------------------
  | Barça fixtures
  |--------------------------------------------------------------------------
  */

  const barcelonaMatches =
    matches.filter(
      (
        match,
      ) =>
        match.homeTeamId ===
          barcelona.id ||
        match.awayTeamId ===
          barcelona.id,
    );

  const matchIds =
    new Set(
      barcelonaMatches.map(
        (
          match,
        ) =>
          match.id,
      ),
    );

  const finishedMatches =
    barcelonaMatches.filter(
      (
        match,
      ) =>
        match.status ===
        "finished",
    );

  const finishedMatchIds =
    new Set(
      finishedMatches.map(
        (
          match,
        ) =>
          match.id,
      ),
    );

  /*
  |--------------------------------------------------------------------------
  | Current-season media
  |--------------------------------------------------------------------------
  */

  const seasonMedia =
    media.filter(
      (
        item,
      ) =>
        item.matchId !==
          null &&
        matchIds.has(
          item.matchId,
        ),
    );

  const officialMedia =
    seasonMedia.filter(
      (
        item,
      ) =>
        item.isOfficial,
    );

  const officialHighlights =
    officialMedia.filter(
      (
        item,
      ) =>
        item.type ===
        "match_highlight",
    );

  const matchesWithHighlight =
    new Set(
      officialHighlights
        .map(
          (
            item,
          ) =>
            item.matchId,
        )
        .filter(
          (
            value,
          ): value is string =>
            value !==
            null,
        ),
    );

  /*
  |--------------------------------------------------------------------------
  | Statistics coverage
  |--------------------------------------------------------------------------
  */

  const currentPlayerStats =
    playerStatistics.filter(
      (
        row,
      ) =>
        finishedMatchIds.has(
          row.matchId,
        ),
    );

  const matchesWithPlayerStats =
    new Set(
      currentPlayerStats.map(
        (
          row,
        ) =>
          row.matchId,
      ),
    );

  const currentTeamStats =
    teamStatistics.filter(
      (
        row,
      ) =>
        finishedMatchIds.has(
          row.matchId,
        ),
    );

  const teamStatCountByMatch =
    countByMatch(
      currentTeamStats,
    );

  const matchesWithTeamStats =
    new Set(
      Array.from(
        teamStatCountByMatch
          .entries(),
      )
        .filter(
          (
            [
              ,
              count,
            ],
          ) =>
            count >=
            2,
        )
        .map(
          (
            [
              matchId,
            ],
          ) =>
            matchId,
        ),
    );

  /*
  |--------------------------------------------------------------------------
  | Confirmed lineup coverage
  |--------------------------------------------------------------------------
  */

  const currentLineups =
    lineups.filter(
      (
        lineup,
      ) =>
        finishedMatchIds.has(
          lineup.matchId,
        ),
    );

  const confirmedLineupCount =
    new Map<
      string,
      number
    >();

  for (
    const lineup
    of currentLineups
  ) {
    if (
      !lineup.isConfirmed
    ) {
      continue;
    }

    confirmedLineupCount.set(
      lineup.matchId,
      (
        confirmedLineupCount.get(
          lineup.matchId,
        ) ??
        0
      ) +
        1,
    );
  }

  const matchesWithConfirmedLineups =
    new Set(
      Array.from(
        confirmedLineupCount
          .entries(),
      )
        .filter(
          (
            [
              ,
              count,
            ],
          ) =>
            count >=
            2,
        )
        .map(
          (
            [
              matchId,
            ],
          ) =>
            matchId,
        ),
    );

  /*
  |--------------------------------------------------------------------------
  | Issues
  |--------------------------------------------------------------------------
  */

  const missingHighlight =
    finishedMatches.filter(
      (
        match,
      ) =>
        !matchesWithHighlight.has(
          match.id,
        ),
    );

  const missingPlayerStats =
    finishedMatches.filter(
      (
        match,
      ) =>
        !matchesWithPlayerStats.has(
          match.id,
        ),
    );

  const missingTeamStats =
    finishedMatches.filter(
      (
        match,
      ) =>
        !matchesWithTeamStats.has(
          match.id,
        ),
    );

  const missingConfirmedLineups =
    finishedMatches.filter(
      (
        match,
      ) =>
        !matchesWithConfirmedLineups.has(
          match.id,
        ),
    );

  /*
  |--------------------------------------------------------------------------
  | Data sources
  |--------------------------------------------------------------------------
  */

  const sourceRows =
    dataSources.map(
      (
        source,
      ) => ({
        id:
          source.id,

        code:
          source.code,

        name:
          source.name,

        isOfficial:
          source.isOfficial,

        isEnabled:
          source.isEnabled,

        mappingCount:
          mappings.filter(
            (
              mapping,
            ) =>
              mapping.dataSourceId ===
              source.id,
          ).length,
      }),
    );

  /*
  |--------------------------------------------------------------------------
  | Provider configuration
  |--------------------------------------------------------------------------
  |
  | This deliberately checks CONFIGURATION ONLY.
  |
  | We do not hit external providers every time somebody opens /admin.
  | Provider health checks belong in the Providers module.
  |--------------------------------------------------------------------------
  */

  const providers = [
    {
      id:
        "football-data",

      label:
        "football-data.org",

      role:
        "Fixtures & standings",

      configured:
        Boolean(
          process.env
            .FOOTBALL_DATA_API_KEY,
        ),
    },

    {
      id:
        "goal-api",

      label:
        "GOAL API",

      role:
        "Lineups, goals & team data",

      configured:
        Boolean(
          process.env
            .GOAL_API_KEY,
        ),
    },

    {
      id:
        "big-balls",

      label:
        "Big Balls Data",

      role:
        "Primary player statistics",

      configured:
        Boolean(
          process.env
            .BBS_API_KEY,
        ),
    },

    {
      id:
        "statshawk",

      label:
        "StatsHawk",

      role:
        "Player-stat fallback",

      configured:
        Boolean(
          process.env
            .STATSHAWK_API_KEY,
        ),
    },

    {
      id:
        "youtube",

      label:
        "FC Barcelona YouTube",

      role:
        "Official match media",

      configured:
        Boolean(
          process.env
            .YOUTUBE_API_KEY,
        ),
    },
  ];

  /*
  |--------------------------------------------------------------------------
  | Recent media
  |--------------------------------------------------------------------------
  */

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

  const recentMedia =
    [...seasonMedia]
      .sort(
        (
          left,
          right,
        ) =>
          instantMilliseconds(
            right.createdAt,
          ) -
          instantMilliseconds(
            left.createdAt,
          ),
      )
      .slice(
        0,
        5,
      )
      .map(
        (
          item,
        ) => {
          const match =
            item.matchId
              ? matchById.get(
                  item.matchId,
                )
              : null;

          return {
            id:
              item.id,

            type:
              item.type,

            title:
              item.title,

            externalMediaId:
              item.externalMediaId,

            isOfficial:
              item.isOfficial,

            match:
              match
                ? {
                    id:
                      match.id,

                    label:
                      `${match.homeTeam.shortName ?? match.homeTeam.name} vs ${match.awayTeam.shortName ?? match.awayTeam.name}`,

                    score:
                      match.homeScore !==
                          null &&
                        match.awayScore !==
                          null
                        ? `${match.homeScore}-${match.awayScore}`
                        : null,
                  }
                : null,
          };
        },
      );

  return {
    generatedAt:
      new Date()
        .toISOString(),

    season: {
      id:
        season.id,

      label:
        season.label,

      startYear:
        season.startYear,

      endYear:
        season.endYear,
    },

    barcelona: {
      id:
        barcelona.id,

      name:
        barcelona.name,
    },

    counts: {
      matches:
        barcelonaMatches.length,

      finishedMatches:
        finishedMatches.length,

      upcomingMatches:
        barcelonaMatches.filter(
          (
            match,
          ) =>
            match.status ===
            "scheduled",
        ).length,

      players:
        players.length,

      activePlayers:
        players.filter(
          (
            player,
          ) =>
            player.isActive,
        ).length,

      media:
        seasonMedia.length,

      officialMedia:
        officialMedia.length,

      highlights:
        officialHighlights.length,

      diaryEntries:
        diaryEntries.length,

      mappings:
        mappings.length,

      dataSources:
        dataSources.length,

      manualOverrides:
        manualOverrides.length,
    },

    coverage: {
      finishedMatches:
        finishedMatches.length,

      highlightReady:
        matchesWithHighlight
          .size,

      playerStatsReady:
        matchesWithPlayerStats
          .size,

      teamStatsReady:
        matchesWithTeamStats
          .size,

      confirmedLineupsReady:
        matchesWithConfirmedLineups
          .size,
    },

    issues: {
      total:
        missingHighlight.length +
        missingPlayerStats.length +
        missingTeamStats.length +
        missingConfirmedLineups.length,

      missingHighlight:
        missingHighlight.length,

      missingPlayerStats:
        missingPlayerStats.length,

      missingTeamStats:
        missingTeamStats.length,

      missingConfirmedLineups:
        missingConfirmedLineups.length,
    },

    automation: {
      internalJobConfigured:
        Boolean(
          process.env
            .INTERNAL_JOB_SECRET,
        ),

      mediaWorker:
        "incremental",

      mediaWindowHours:
        96,

      missingHighlightLookbackDays:
        14,
    },

    providers,

    dataSources:
      sourceRows,

    recentMedia,
  };
}

function countByMatch(
  rows:
    Array<{
      matchId:
        string;
    }>,
) {
  const counts =
    new Map<
      string,
      number
    >();

  for (
    const row
    of rows
  ) {
    counts.set(
      row.matchId,
      (
        counts.get(
          row.matchId,
        ) ??
        0
      ) +
        1,
    );
  }

  return counts;
}

function instantMilliseconds(
  value: {
    toString():
      string;
  },
) {
  return new Date(
    value.toString(),
  ).getTime();
}

export type AdminOverviewData =
  Awaited<
    ReturnType<
      typeof getAdminOverview
    >
  >;
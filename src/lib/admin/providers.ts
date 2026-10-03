import "server-only";

import {
  db,
} from "../../prisma/db";

type ProviderMode =
  | "primary"
  | "active"
  | "automatic"
  | "standby";

type ProviderStatus =
  | "active"
  | "ready"
  | "standby"
  | "warning"
  | "disabled";

type ProviderDefinition = {
  code:
    string;

  name:
    string;

  category:
    string;

  description:
    string;

  mode:
    ProviderMode;

  envKey:
    string;

  capabilities:
    string[];

  priorityLabel:
    string;

  notes:
    string;
};

const PROVIDERS:
  ProviderDefinition[] = [
  {
    code:
      "football-data-org",

    name:
      "football-data.org",

    category:
      "Fixtures & Competition Data",

    description:
      "Primary source for Barça fixtures, results, competition structure and league standings.",

    mode:
      "primary",

    envKey:
      "FOOTBALL_DATA_API_KEY",

    capabilities: [
      "Fixtures",
      "Results",
      "Teams",
      "Competitions",
      "Standings",
    ],

    priorityLabel:
      "Primary",

    notes:
      "Free-tier provider. Canonical identities are connected through provider mappings.",
  },

  {
    code:
      "goal-api",

    name:
      "GOAL API",

    category:
      "Rich Match Data",

    description:
      "Primary rich-match source for match identity, lineups and scoring-event reconstruction.",

    mode:
      "active",

    envKey:
      "GOAL_API_KEY",

    capabilities: [
      "Match Identity",
      "Lineups",
      "Scoring Events",
      "Players",
    ],

    priorityLabel:
      "Rich Match · Core",

    notes:
      "Used by the rich-match ingestion pipeline together with Big Balls data.",
  },

  {
    code:
      "big-balls-data",

    name:
      "Big Balls Sports Data",

    category:
      "Player Match Statistics",

    description:
      "Rich player-match statistics provider used alongside GOAL data for completed Barça matches.",

    mode:
      "active",

    envKey:
      "BBS_API_KEY",

    capabilities: [
      "Player Stats",
      "Ratings",
      "Player Identity",
      "Match Statistics",
    ],

    priorityLabel:
      "Rich Match · Core",

    notes:
      "Current player-statistics provider for the rich-match pipeline.",
  },

  {
    code:
      "statshawk",

    name:
      "StatsHawk",

    category:
      "Player Statistics Fallback",

    description:
      "Implemented statistics provider kept as a fallback path for richer player-match data.",

    mode:
      "standby",

    envKey:
      "STATSHAWK_API_KEY",

    capabilities: [
      "Player Stats",
      "Match Statistics",
      "Fallback Coverage",
    ],

    priorityLabel:
      "Standby",

    notes:
      "The fetch/normalization layer exists, but it is not currently selected by the main rich-match player-stat provider.",
  },

  {
    code:
      "youtube-fcbarcelona-official",

    name:
      "FC Barcelona Official YouTube",

    category:
      "Official Match Media",

    description:
      "Official Barça media source for highlights, match features, previews and other match-linked videos.",

    mode:
      "automatic",

    envKey:
      "YOUTUBE_API_KEY",

    capabilities: [
      "Highlights",
      "Match Features",
      "Match Previews",
      "Review Queue",
      "Automatic Worker",
    ],

    priorityLabel:
      "Automatic · 3h Worker",

    notes:
      "Official source. Automatic matching is conservative and ambiguous videos are routed to the Review Queue.",
  },
];

export async function getAdminProvidersData() {
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
    sources,
    mappings,
    matches,
    events,
    teamStats,
    playerStats,
    mediaItems,
    moments,
    absences,
    reviewCandidates,
  ] =
    await Promise.all([
      db.orm.public.DataSource
        .all(),

      db.orm.public.ProviderMapping
        .all(),

      db.orm.public.Match
        .where({
          seasonId:
            season.id,
        })
        .all(),

      db.orm.public.MatchEvent
        .all(),

      db.orm.public.MatchStatistic
        .all(),

      db.orm.public.PlayerMatchStatistic
        .all(),

      db.orm.public.MediaItem
        .all(),

      db.orm.public.SeasonMoment
        .all(),

      db.orm.public.PlayerAbsence
        .all(),

      db.orm.public.MediaReviewCandidate
        .all(),
    ]);

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

  const sourceByCode =
    new Map(
      sources.map(
        (
          source,
        ) => [
          source.code,
          source,
        ],
      ),
    );

  const providers =
    PROVIDERS.map(
      (
        definition,
      ) => {
        const source =
          sourceByCode.get(
            definition.code,
          ) ??
          null;

        const configured =
          Boolean(
            process.env[
              definition.envKey
            ],
          );

        const sourceId =
          source?.id ??
          null;

        const sourceMappings =
          sourceId
            ? mappings.filter(
                (
                  item,
                ) =>
                  item.dataSourceId ===
                  sourceId,
              )
            : [];

        const sourceEvents =
          sourceId
            ? events.filter(
                (
                  item,
                ) =>
                  item.dataSourceId ===
                  sourceId,
              )
            : [];

        const sourceTeamStats =
          sourceId
            ? teamStats.filter(
                (
                  item,
                ) =>
                  item.dataSourceId ===
                  sourceId,
              )
            : [];

        const sourcePlayerStats =
          sourceId
            ? playerStats.filter(
                (
                  item,
                ) =>
                  item.dataSourceId ===
                  sourceId,
              )
            : [];

        const sourceMedia =
          sourceId
            ? mediaItems.filter(
                (
                  item,
                ) =>
                  item.dataSourceId ===
                  sourceId,
              )
            : [];

        const sourceMoments =
          sourceId
            ? moments.filter(
                (
                  item,
                ) =>
                  item.dataSourceId ===
                  sourceId,
              )
            : [];

        const sourceAbsences =
          sourceId
            ? absences.filter(
                (
                  item,
                ) =>
                  item.dataSourceId ===
                  sourceId,
              )
            : [];

        const sourceReviews =
          sourceId
            ? reviewCandidates.filter(
                (
                  item,
                ) =>
                  item.dataSourceId ===
                  sourceId,
              )
            : [];

        const pendingReviews =
          sourceReviews.filter(
            (
              item,
            ) =>
              item.status ===
              "pending",
          );

        /*
        |--------------------------------------------------------------------------
        | Finished-match coverage
        |--------------------------------------------------------------------------
        */

        const coveredMatchIds =
          new Set<string>();

        for (
          const mapping
          of sourceMappings
        ) {
          if (
            mapping.entityType ===
              "match" &&
            finishedMatchIds.has(
              mapping.internalId,
            )
          ) {
            coveredMatchIds.add(
              mapping.internalId,
            );
          }
        }

        for (
          const event
          of sourceEvents
        ) {
          if (
            finishedMatchIds.has(
              event.matchId,
            )
          ) {
            coveredMatchIds.add(
              event.matchId,
            );
          }
        }

        for (
          const statistic
          of sourceTeamStats
        ) {
          if (
            finishedMatchIds.has(
              statistic.matchId,
            )
          ) {
            coveredMatchIds.add(
              statistic.matchId,
            );
          }
        }

        for (
          const statistic
          of sourcePlayerStats
        ) {
          if (
            finishedMatchIds.has(
              statistic.matchId,
            )
          ) {
            coveredMatchIds.add(
              statistic.matchId,
            );
          }
        }

        for (
          const media
          of sourceMedia
        ) {
          if (
            media.matchId &&
            finishedMatchIds.has(
              media.matchId,
            )
          ) {
            coveredMatchIds.add(
              media.matchId,
            );
          }
        }

        /*
        |--------------------------------------------------------------------------
        | Record totals
        |--------------------------------------------------------------------------
        */

        const recordCount =
          sourceMappings.length +
          sourceEvents.length +
          sourceTeamStats.length +
          sourcePlayerStats.length +
          sourceMedia.length +
          sourceMoments.length +
          sourceAbsences.length;

        const status =
          resolveStatus({
            configured,

            registered:
              Boolean(
                source,
              ),

            enabled:
              source
                ?.isEnabled ??
              true,

            recordCount,

            mode:
              definition.mode,
          });

        const activityDates = [
          source
            ?.updatedAt ??
            null,

          ...sourceMappings.map(
            (
              item,
            ) =>
              item.updatedAt,
          ),

          ...sourceEvents.map(
            (
              item,
            ) =>
              item.updatedAt,
          ),

          ...sourceTeamStats.map(
            (
              item,
            ) =>
              item.updatedAt,
          ),

          ...sourcePlayerStats.map(
            (
              item,
            ) =>
              item.updatedAt,
          ),

          ...sourceMedia.map(
            (
              item,
            ) =>
              item.updatedAt,
          ),

          ...sourceReviews.map(
            (
              item,
            ) =>
              item.updatedAt,
          ),
        ];

        return {
          code:
            definition.code,

          name:
            source?.name ??
            definition.name,

          category:
            definition.category,

          description:
            definition.description,

          mode:
            definition.mode,

          priorityLabel:
            definition.priorityLabel,

          capabilities:
            definition.capabilities,

          notes:
            definition.notes,

          status,

          configured,

          registered:
            Boolean(
              source,
            ),

          enabled:
            source
              ?.isEnabled ??
            true,

          official:
            source
              ?.isOfficial ??
            (
              definition.code ===
              "youtube-fcbarcelona-official"
            ),

          baseUrl:
            source?.baseUrl ??
            null,

          licenseNotes:
            source
              ?.licenseNotes ??
            null,

          lastActivity:
            latestDate(
              activityDates,
            ),

          coverage: {
            covered:
              coveredMatchIds.size,

            total:
              finishedMatches.length,
          },

          counts: {
            records:
              recordCount,

            mappings:
              sourceMappings.length,

            events:
              sourceEvents.length,

            teamStats:
              sourceTeamStats.length,

            playerStats:
              sourcePlayerStats.length,

            media:
              sourceMedia.length,

            moments:
              sourceMoments.length,

            absences:
              sourceAbsences.length,

            reviewPending:
              pendingReviews.length,

            reviewTotal:
              sourceReviews.length,
          },
        };
      },
    );

  const summary = {
    total:
      providers.length,

    active:
      providers.filter(
        (
          provider,
        ) =>
          provider.status ===
          "active",
      ).length,

    ready:
      providers.filter(
        (
          provider,
        ) =>
          provider.status ===
          "ready",
      ).length,

    standby:
      providers.filter(
        (
          provider,
        ) =>
          provider.status ===
          "standby",
      ).length,

    warnings:
      providers.filter(
        (
          provider,
        ) =>
          provider.status ===
          "warning",
      ).length,

    disabled:
      providers.filter(
        (
          provider,
        ) =>
          provider.status ===
          "disabled",
      ).length,

    latestActivity:
      latestDate(
        providers.map(
          (
            provider,
          ) =>
            provider.lastActivity,
        ),
      ),
  };

  /*
  |--------------------------------------------------------------------------
  | Rich-match pipeline coverage
  |--------------------------------------------------------------------------
  |
  | A finished fixture counts as rich-data covered if we have any canonical
  | events, team statistics or player statistics associated with it.
  |--------------------------------------------------------------------------
  */

  const richCoveredMatchIds =
    new Set<string>();

  for (
    const event
    of events
  ) {
    if (
      finishedMatchIds.has(
        event.matchId,
      )
    ) {
      richCoveredMatchIds.add(
        event.matchId,
      );
    }
  }

  for (
    const statistic
    of teamStats
  ) {
    if (
      finishedMatchIds.has(
        statistic.matchId,
      )
    ) {
      richCoveredMatchIds.add(
        statistic.matchId,
      );
    }
  }

  for (
    const statistic
    of playerStats
  ) {
    if (
      finishedMatchIds.has(
        statistic.matchId,
      )
    ) {
      richCoveredMatchIds.add(
        statistic.matchId,
      );
    }
  }

  return {
    season: {
      id:
        season.id,

      label:
        season.label,
    },

    summary,

    matchContext: {
      barcelonaMatches:
        barcelonaMatches.length,

      finishedMatches:
        finishedMatches.length,

      richCoveredMatches:
        richCoveredMatchIds.size,
    },

    providers,
  };
}

function resolveStatus(
  input: {
    configured:
      boolean;

    registered:
      boolean;

    enabled:
      boolean;

    recordCount:
      number;

    mode:
      ProviderMode;
  },
): ProviderStatus {
  if (
    !input.enabled
  ) {
    return "disabled";
  }

  if (
    input.mode ===
      "standby" &&
    input.configured
  ) {
    return "standby";
  }

  if (
    !input.configured
  ) {
    return "warning";
  }

  if (
    input.registered &&
    input.recordCount >
      0
  ) {
    return "active";
  }

  return "ready";
}

function latestDate(
  values:
    Array<
      | {
          toString():
            string;
        }
      | string
      | null
      | undefined
    >,
) {
  let latest:
    string | null =
    null;

  let latestTime =
    -Infinity;

  for (
    const value
    of values
  ) {
    if (!value) {
      continue;
    }

    const iso =
      typeof value ===
      "string"
        ? value
        : value.toString();

    const time =
      new Date(
        iso,
      ).getTime();

    if (
      Number.isFinite(
        time,
      ) &&
      time >
        latestTime
    ) {
      latestTime =
        time;

      latest =
        iso;
    }
  }

  return latest;
}

export type AdminProvidersData =
  Awaited<
    ReturnType<
      typeof getAdminProvidersData
    >
  >;

export type AdminProvider =
  AdminProvidersData[
    "providers"
  ][number];
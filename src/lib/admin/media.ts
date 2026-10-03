import "server-only";

import {
  db,
} from "../../prisma/db";

export type AdminMediaType =
  | "match_highlight"
  | "match_feature"
  | "match_preview"
  | "goal_clip"
  | "interview"
  | "press_conference"
  | "training"
  | "historical"
  | "other";

export const ADMIN_MEDIA_TYPES:
  AdminMediaType[] = [
  "match_highlight",
  "match_feature",
  "match_preview",
  "goal_clip",
  "interview",
  "press_conference",
  "training",
  "historical",
  "other",
];
export async function getAdminMediaData() {
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
    matches,
    media,
    dataSources,
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
            match.kickoff.desc(),
        )
        .all(),

      db.orm.public.MediaItem
        .where({
          seasonId:
            season.id,
        })
        .all(),

      db.orm.public.DataSource
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

  const finishedMatches =
    barcelonaMatches.filter(
      (
        match,
      ) =>
        match.status ===
        "finished",
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

  /*
  |--------------------------------------------------------------------------
  | Lookup maps
  |--------------------------------------------------------------------------
  */

  const sourceById =
    new Map(
      dataSources.map(
        (
          source,
        ) => [
          source.id,
          source,
        ],
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
  | Canonical media
  |--------------------------------------------------------------------------
  */

  const items =
    media
      .filter(
        (
          item,
        ) =>
          item.matchId ===
            null ||
          matchIds.has(
            item.matchId,
          ),
      )
      .sort(
        (
          left,
          right,
        ) =>
          mediaTimestamp(
            right,
          ) -
          mediaTimestamp(
            left,
          ),
      )
      .map(
        (
          item,
        ) => {
          const match =
            item.matchId
              ? matchById.get(
                  item.matchId,
                ) ??
                null
              : null;

          const source =
            item.dataSourceId
              ? sourceById.get(
                  item.dataSourceId,
                ) ??
                null
              : null;

          return {
            id:
              item.id,

            type:
              item.type as
                AdminMediaType,

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

            createdAt:
              item.createdAt
                .toString(),

            updatedAt:
              item.updatedAt
                .toString(),

            seasonId:
              item.seasonId,

            matchId:
              item.matchId,

            source:
              source
                ? {
                    id:
                      source.id,

                    code:
                      source.code,

                    name:
                      source.name,

                    isOfficial:
                      source.isOfficial,
                  }
                : null,

            match:
              match
                ? serializeMatch(
                    match,
                  )
                : null,
          };
        },
      );

  /*
  |--------------------------------------------------------------------------
  | Highlight coverage
  |--------------------------------------------------------------------------
  */

  const matchesWithHighlight =
    new Set(
      items
        .filter(
          (
            item,
          ) =>
            item.type ===
              "match_highlight" &&
            item.matchId !==
              null,
        )
        .map(
          (
            item,
          ) =>
            item.matchId as
              string,
        ),
    );

  const serializedMatches =
    barcelonaMatches.map(
      (
        match,
      ) =>
        serializeMatch(
          match,
        ),
    );

  return {
    season: {
      id:
        season.id,

      label:
        season.label,
    },

    counts: {
      total:
        items.length,

      highlights:
        items.filter(
          (
            item,
          ) =>
            item.type ===
            "match_highlight",
        ).length,

      secondary:
        items.filter(
          (
            item,
          ) =>
            item.type !==
            "match_highlight",
        ).length,

      official:
        items.filter(
          (
            item,
          ) =>
            item.isOfficial,
        ).length,

      unlinked:
        items.filter(
          (
            item,
          ) =>
            item.matchId ===
            null,
        ).length,

      finishedMatches:
        finishedMatches.length,

      coverageReady:
        finishedMatches.filter(
          (
            match,
          ) =>
            matchesWithHighlight.has(
              match.id,
            ),
        ).length,
    },

    mediaTypes:
      ADMIN_MEDIA_TYPES,

    matches:
      serializedMatches,

    items,
  };
}

function serializeMatch(
  match: {
    id:
      string;

    seasonId:
      string;

    status:
      string;

    kickoff: {
      toString():
        string;
    };

    matchday:
      number | null;

    stage:
      string | null;

    round:
      string | null;

    homeScore:
      number | null;

    awayScore:
      number | null;

    homeTeam: {
      name:
        string;

      shortName:
        string | null;

      crestUrl:
        string | null;

      isBarcelona:
        boolean;
    };

    awayTeam: {
      name:
        string;

      shortName:
        string | null;

      crestUrl:
        string | null;

      isBarcelona:
        boolean;
    };

    competition: {
      code:
        string;

      name:
        string;

      shortName:
        string | null;
    };
  },
) {
  return {
    id:
      match.id,

    seasonId:
      match.seasonId,

    status:
      match.status,

    kickoff:
      match.kickoff
        .toString(),

    matchday:
      match.matchday,

    stage:
      match.stage,

    round:
      match.round,

    home:
      match.homeTeam
        .name,

    homeShort:
      match.homeTeam
        .shortName ??
      match.homeTeam.name,

    homeCrestUrl:
      match.homeTeam
        .crestUrl,

    homeIsBarcelona:
      match.homeTeam
        .isBarcelona,

    away:
      match.awayTeam
        .name,

    awayShort:
      match.awayTeam
        .shortName ??
      match.awayTeam.name,

    awayCrestUrl:
      match.awayTeam
        .crestUrl,

    awayIsBarcelona:
      match.awayTeam
        .isBarcelona,

    score:
      match.homeScore !==
          null &&
        match.awayScore !==
          null
        ? `${match.homeScore}-${match.awayScore}`
        : null,

    competition: {
      code:
        match.competition
          .code,

      name:
        match.competition
          .name,

      shortName:
        match.competition
          .shortName,
    },
  };
}

function mediaTimestamp(
  item: {
    publishedAt: {
      toString():
        string;
    } | null;

    createdAt: {
      toString():
        string;
    };
  },
) {
  return new Date(
    (
      item.publishedAt ??
      item.createdAt
    ).toString(),
  ).getTime();
}

export type AdminMediaData =
  Awaited<
    ReturnType<
      typeof getAdminMediaData
    >
  >;

export type AdminMediaItem =
  AdminMediaData[
    "items"
  ][number];

export type AdminMediaMatch =
  AdminMediaData[
    "matches"
  ][number];
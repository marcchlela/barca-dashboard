import "server-only";

import {
  db,
} from "../../prisma/db";

import {
  getAdminMediaData,
} from "./media";

export async function getAdminMediaReviewData() {
  const media =
    await getAdminMediaData();

  const [
    candidates,
    dataSources,
  ] =
    await Promise.all([
      db.orm.public.MediaReviewCandidate
        .where({
          seasonId:
            media.season.id,

          status:
            "pending",
        })
        .orderBy(
          (
            candidate,
          ) =>
            candidate.score.desc(),
        )
        .all(),

      db.orm.public.DataSource
        .all(),
    ]);

  const matchById =
    new Map(
      media.matches.map(
        (
          match,
        ) => [
          match.id,
          match,
        ],
      ),
    );

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

  return {
    season:
      media.season,

    matches:
      media.matches,

    mediaTypes:
      media.mediaTypes,

    candidates:
      candidates.map(
        (
          candidate,
        ) => {
          const match =
            matchById.get(
              candidate.matchId,
            ) ??
            null;

          const source =
            sourceById.get(
              candidate.dataSourceId,
            ) ??
            null;

          return {
            id:
              candidate.id,

            matchId:
              candidate.matchId,

            seasonId:
              candidate.seasonId,

            dataSourceId:
              candidate.dataSourceId,

            externalMediaId:
              candidate.externalMediaId,

            type:
              candidate.type,

            title:
              candidate.title,

            url:
              candidate.url,

            thumbnailUrl:
              candidate.thumbnailUrl,

            publishedAt:
              candidate.publishedAt
                ?.toString() ??
              null,

            durationSeconds:
              candidate.durationSeconds,

            score:
              candidate.score,

            reasons:
              jsonStringArray(
                candidate.reasons,
              ),

            lastSeenAt:
              candidate.lastSeenAt
                .toString(),

            match,

            source:
              source
                ? {
                    id:
                      source.id,

                    name:
                      source.name,

                    code:
                      source.code,
                  }
                : null,
          };
        },
      ),
  };
}

export async function getPendingMediaReviewCount() {
  const candidates =
    await db.orm.public.MediaReviewCandidate
      .where({
        status:
          "pending",
      })
      .all();

  return candidates.length;
}

function jsonStringArray(
  value:
    unknown,
) {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }

  return value.filter(
    (
      item,
    ): item is string =>
      typeof item ===
      "string",
  );
}

export type AdminMediaReviewData =
  Awaited<
    ReturnType<
      typeof getAdminMediaReviewData
    >
  >;

export type AdminMediaReviewCandidate =
  AdminMediaReviewData[
    "candidates"
  ][number];
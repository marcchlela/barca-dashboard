import {
  NextResponse,
} from "next/server";
import { guardAdminRequest } from "../../../../../lib/admin/access";

import {
  Temporal,
} from "temporal-polyfill";

import {
  db,
} from "../../../../../prisma/db";

import {
  ADMIN_MEDIA_TYPES,
  type AdminMediaType,
} from "../../../../../lib/admin/media";

type Body = {
  candidateId?:
    unknown;

  action?:
    unknown;

  type?:
    unknown;

  matchId?:
    unknown;
};

export async function PATCH(
  request:
    Request,
) {
  const denied = await guardAdminRequest(request);
  if (denied) return denied;
  try {
    const body =
      (
        await request.json()
      ) as Body;

    if (
      typeof body.candidateId !==
        "string"
    ) {
      return badRequest(
        "candidateId is required.",
      );
    }

    const candidate =
      await db.orm.public.MediaReviewCandidate
        .where({
          id:
            body.candidateId,
        })
        .first();

    if (!candidate) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Review candidate was not found.",
        },
        {
          status:
            404,
        },
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Reject
    |--------------------------------------------------------------------------
    */

    if (
      body.action ===
      "reject"
    ) {
      const updated =
        await db.orm.public.MediaReviewCandidate
          .where({
            id:
              candidate.id,
          })
          .update({
            status:
              "rejected",

            reviewedAt:
              Temporal.Now.instant(),

            reviewNote:
              "Rejected in Admin Media Review",
          });

      return NextResponse.json({
        ok:
          true,

        result: {
          action:
            "rejected",

          candidateId:
            updated?.id ??
            candidate.id,
        },
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Approve
    |--------------------------------------------------------------------------
    */

    if (
      body.action !==
      "approve"
    ) {
      return badRequest(
        'action must be "approve" or "reject".',
      );
    }

    const selectedType =
      typeof body.type ===
        "string" &&
      isMediaType(
        body.type,
      )
        ? body.type
        : candidate.type;

    const targetMatchId =
      typeof body.matchId ===
        "string"
        ? body.matchId
        : candidate.matchId;

    const match =
      await db.orm.public.Match
        .where({
          id:
            targetMatchId,
        })
        .include(
          "homeTeam",
        )
        .include(
          "awayTeam",
        )
        .first();

    if (!match) {
      return badRequest(
        "Target match was not found.",
      );
    }

    if (
      !match.homeTeam
        .isBarcelona &&
      !match.awayTeam
        .isBarcelona
    ) {
      return badRequest(
        "Target match is not an FC Barcelona fixture.",
      );
    }

    const existing =
      await db.orm.public.MediaItem
        .where({
          dataSourceId:
            candidate.dataSourceId,

          externalMediaId:
            candidate.externalMediaId,
        })
        .first();

    if (
      existing?.matchId &&
      existing.matchId !==
        targetMatchId
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "This video is already attached to another match.",
        },
        {
          status:
            409,
        },
      );
    }

    const mediaData = {
      type:
        selectedType,

      title:
        candidate.title,

      description:
        null,

      url:
        candidate.url,

      externalMediaId:
        candidate.externalMediaId,

      thumbnailUrl:
        candidate.thumbnailUrl,

      isOfficial:
        true,

      publishedAt:
        candidate.publishedAt,

      seasonId:
        match.seasonId,

      matchId:
        match.id,

      playerId:
        null,

      dataSourceId:
        candidate.dataSourceId,
    };

    const media =
      existing
        ? await db.orm.public.MediaItem
            .where({
              id:
                existing.id,
            })
            .update(
              mediaData,
            )
        : await db.orm.public.MediaItem
            .create(
              mediaData,
            );

    if (!media) {
      throw new Error(
        "Approved media could not be persisted.",
      );
    }

    await db.orm.public.MediaReviewCandidate
      .where({
        id:
          candidate.id,
      })
      .update({
        status:
          "approved",

        reviewedAt:
          Temporal.Now.instant(),

        reviewNote:
          targetMatchId ===
          candidate.matchId
            ? "Approved in Admin Media Review"
            : `Approved and reassigned to match ${targetMatchId}`,
      });

    await db.orm.public.ManualOverride
      .create({
        entityType:
          "media_review_candidate",

        entityId:
          candidate.id,

        fieldName:
          "review_status",

        payload: {
          action:
            "approve",

          mediaItemId:
            media.id,

          matchId:
            targetMatchId,

          type:
            selectedType,

          score:
            candidate.score,
        },

        reason:
          "Admin Media Review",
      });

    return NextResponse.json({
      ok:
        true,

      result: {
        action:
          "approved",

        candidateId:
          candidate.id,

        mediaItemId:
          media.id,
      },
    });
  } catch (
    error
  ) {
    console.error(
      "ADMIN MEDIA REVIEW FAILED:",
      error,
    );

    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : String(
                error,
              ),
      },
      {
        status:
          500,
      },
    );
  }
}

function isMediaType(
  value:
    string,
): value is AdminMediaType {
  return (
    ADMIN_MEDIA_TYPES as
      string[]
  ).includes(
    value,
  );
}

function badRequest(
  error:
    string,
) {
  return NextResponse.json(
    {
      ok:
        false,

      error,
    },
    {
      status:
        400,
    },
  );
}

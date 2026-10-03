import {
  NextResponse,
} from "next/server";

import {
  db,
} from "../../../../prisma/db";

import {
  ADMIN_MEDIA_TYPES,
  type AdminMediaType,
} from "../../../../lib/admin/media";

import {
  syncOfficialMatchMedia,
} from "../../../../lib/providers/youtube-fcbarcelona/match-media";

type PatchBody = {
  mediaId?:
    unknown;

  type?:
    unknown;

  matchId?:
    unknown;
};

type DeleteBody = {
  mediaId?:
    unknown;

  mode?:
    unknown;
};

type PostBody = {
  action?:
    unknown;

  matchId?:
    unknown;
};

/*
|--------------------------------------------------------------------------
| PATCH
|--------------------------------------------------------------------------
|
| Edit the canonical MediaItem:
| - media type
| - attached match
|--------------------------------------------------------------------------
*/

export async function PATCH(
  request:
    Request,
) {
  try {
    const body =
      (
        await request.json()
      ) as PatchBody;

    if (
      typeof body.mediaId !==
        "string" ||
      !isUuid(
        body.mediaId,
      )
    ) {
      return badRequest(
        "A valid mediaId is required.",
      );
    }

    const media =
      await db.orm.public.MediaItem
        .where({
          id:
            body.mediaId,
        })
        .first();

    if (!media) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Media item was not found.",
        },
        {
          status:
            404,
        },
      );
    }

    let nextType:
      AdminMediaType =
      media.type as
        AdminMediaType;

    if (
      body.type !==
      undefined
    ) {
      if (
        typeof body.type !==
          "string" ||
        !isMediaType(
          body.type,
        )
      ) {
        return badRequest(
          "Invalid media type.",
        );
      }

      nextType =
        body.type;
    }

    let nextMatchId =
      media.matchId;

    let nextSeasonId =
      media.seasonId;

    if (
      body.matchId !==
      undefined
    ) {
      if (
        body.matchId !==
          null &&
        (
          typeof body.matchId !==
            "string" ||
          !isUuid(
            body.matchId,
          )
        )
      ) {
        return badRequest(
          "matchId must be a valid UUID or null.",
        );
      }

      if (
        body.matchId ===
        null
      ) {
        nextMatchId =
          null;
      } else {
        const match =
          await db.orm.public.Match
            .where({
              id:
                body.matchId,
            })
            .include(
              "homeTeam",
            )
            .include(
              "awayTeam",
            )
            .first();

        if (!match) {
          return NextResponse.json(
            {
              ok:
                false,

              error:
                "Target match was not found.",
            },
            {
              status:
                404,
            },
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

        nextMatchId =
          match.id;

        nextSeasonId =
          match.seasonId;
      }
    }

    const updated =
      await db.orm.public.MediaItem
        .where({
          id:
            media.id,
        })
        .update({
          type:
            nextType,

          matchId:
            nextMatchId,

          seasonId:
            nextSeasonId,
        });

    if (!updated) {
      throw new Error(
        "Media item could not be updated.",
      );
    }

    await recordOverride({
      mediaId:
        media.id,

      action:
        "update",

      before: {
        type:
          media.type,

        matchId:
          media.matchId,

        seasonId:
          media.seasonId,
      },

      after: {
        type:
          updated.type,

        matchId:
          updated.matchId,

        seasonId:
          updated.seasonId,
      },
    });

    return NextResponse.json({
      ok:
        true,

      result: {
        id:
          updated.id,

        type:
          updated.type,

        matchId:
          updated.matchId,
      },
    });
  } catch (
    error
  ) {
    console.error(
      "ADMIN MEDIA UPDATE FAILED:",
      error,
    );

    return serverError(
      error,
    );
  }
}

/*
|--------------------------------------------------------------------------
| DELETE
|--------------------------------------------------------------------------
|
| mode = unlink
|   Keep the MediaItem but detach it from its match.
|
| mode = delete
|   Permanently remove the MediaItem row.
|--------------------------------------------------------------------------
*/

export async function DELETE(
  request:
    Request,
) {
  try {
    const body =
      (
        await request.json()
      ) as DeleteBody;

    if (
      typeof body.mediaId !==
        "string" ||
      !isUuid(
        body.mediaId,
      )
    ) {
      return badRequest(
        "A valid mediaId is required.",
      );
    }

    if (
      body.mode !==
        "unlink" &&
      body.mode !==
        "delete"
    ) {
      return badRequest(
        'mode must be "unlink" or "delete".',
      );
    }

    const media =
      await db.orm.public.MediaItem
        .where({
          id:
            body.mediaId,
        })
        .first();

    if (!media) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Media item was not found.",
        },
        {
          status:
            404,
        },
      );
    }

    if (
      body.mode ===
      "unlink"
    ) {
      const updated =
        await db.orm.public.MediaItem
          .where({
            id:
              media.id,
          })
          .update({
            matchId:
              null,
          });

      if (!updated) {
        throw new Error(
          "Media item could not be unlinked.",
        );
      }

      await recordOverride({
        mediaId:
          media.id,

        action:
          "unlink",

        before: {
          type:
            media.type,

          matchId:
            media.matchId,

          seasonId:
            media.seasonId,
        },

        after: {
          type:
            updated.type,

          matchId:
            null,

          seasonId:
            updated.seasonId,
        },
      });

      return NextResponse.json({
        ok:
          true,

        result: {
          mode:
            "unlink",

          id:
            updated.id,
        },
      });
    }

    const deleted =
      await db.orm.public.MediaItem
        .where({
          id:
            media.id,
        })
        .delete();

    if (!deleted) {
      throw new Error(
        "Media item could not be deleted.",
      );
    }

    await recordOverride({
      mediaId:
        media.id,

      action:
        "delete",

      before: {
        type:
          media.type,

        matchId:
          media.matchId,

        seasonId:
          media.seasonId,

        title:
          media.title,

        url:
          media.url,

        externalMediaId:
          media.externalMediaId,
      },

      after:
        null,
    });

    return NextResponse.json({
      ok:
        true,

      result: {
        mode:
          "delete",

        id:
          media.id,
      },
    });
  } catch (
    error
  ) {
    console.error(
      "ADMIN MEDIA DELETE FAILED:",
      error,
    );

    return serverError(
      error,
    );
  }
}

/*
|--------------------------------------------------------------------------
| POST
|--------------------------------------------------------------------------
|
| Rescan one finished Barça fixture using the trusted official
| YouTube matcher.
|--------------------------------------------------------------------------
*/

export async function POST(
  request:
    Request,
) {
  try {
    const body =
      (
        await request.json()
      ) as PostBody;

    if (
      body.action !==
      "rescan"
    ) {
      return badRequest(
        'action must be "rescan".',
      );
    }

    if (
      typeof body.matchId !==
        "string" ||
      !isUuid(
        body.matchId,
      )
    ) {
      return badRequest(
        "A valid matchId is required.",
      );
    }

    const result =
      await syncOfficialMatchMedia({
        matchId:
          body.matchId,

        dryRun:
          false,
      });

    return NextResponse.json({
      ok:
        true,

      result: {
        fixture:
          result.fixture,

        accepted:
          result.accepted.map(
            (
              candidate,
            ) => ({
              videoId:
                candidate.videoId,

              title:
                candidate.title,

              type:
                candidate.type,

              score:
                candidate.score,
            }),
          ),

        writePlan:
          result.writePlan,

        reviewPlan:
          result.reviewPlan,

        youtube:
          result.youtube,
      },
    });
  } catch (
    error
  ) {
    console.error(
      "ADMIN MEDIA RESCAN FAILED:",
      error,
    );

    return serverError(
      error,
    );
  }
}

/*
|--------------------------------------------------------------------------
| Audit trail
|--------------------------------------------------------------------------
*/

type AuditJson =
  | string
  | number
  | boolean
  | null
  | AuditJson[]
  | {
      [key: string]:
        AuditJson;
    };

async function recordOverride(
  input: {
    mediaId:
      string;

    action:
      string;

    before:
      AuditJson;

    after:
      AuditJson;
  },
) {
  try {
    await db.orm.public.ManualOverride
      .create({
        entityType:
          "media_item",

        entityId:
          input.mediaId,

        fieldName:
          "admin_media",

        payload: {
          action:
            input.action,

          before:
            input.before,

          after:
            input.after,
        },

        reason:
          "Admin Media Manager",
      });
  } catch (
    error
  ) {
    /*
     * The canonical media mutation has already succeeded.
     *
     * Do not turn an audit-log problem into a fake failed edit,
     * but make it very visible in the server logs.
     */
    console.error(
      "ADMIN MEDIA AUDIT LOG FAILED:",
      error,
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

function isUuid(
  value:
    string,
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
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

function serverError(
  error:
    unknown,
) {
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
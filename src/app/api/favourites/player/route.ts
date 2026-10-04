import {
  NextResponse,
} from "next/server";

import {
  db,
} from "../../../../prisma/db";

type FavouriteBody = {
  playerId?:
    unknown;
};

/*
|--------------------------------------------------------------------------
| Favourite player
|--------------------------------------------------------------------------
*/

export async function PUT(
  request:
    Request,
) {
  try {
    const body =
      (
        await request.json()
      ) as FavouriteBody;

    if (
      typeof body.playerId !==
        "string" ||
      !isUuid(
        body.playerId,
      )
    ) {
      return badRequest(
        "A valid playerId is required.",
      );
    }

    const player =
      await db.orm.public.Player
        .where({
          id:
            body.playerId,
        })
        .first();

    if (!player) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Player was not found.",
        },
        {
          status:
            404,
        },
      );
    }

    const existing =
      await db.orm.public.FavouritePlayer
        .where({
          playerId:
            player.id,
        })
        .first();

    if (existing) {
      return NextResponse.json({
        ok:
          true,

        result: {
          playerId:
            player.id,

          favourite:
            true,

          id:
            existing.id,
        },
      });
    }

    const favourites =
      await db.orm.public.FavouritePlayer
        .all();

    const nextSortOrder =
      favourites.reduce(
        (
          highest,
          favourite,
        ) =>
          Math.max(
            highest,
            favourite.sortOrder,
          ),
        -1,
      ) +
      1;

    const favourite =
      await db.orm.public.FavouritePlayer
        .create({
          playerId:
            player.id,

          sortOrder:
            nextSortOrder,
        });

    return NextResponse.json({
      ok:
        true,

      result: {
        playerId:
          player.id,

        favourite:
          true,

        id:
          favourite.id,
      },
    });
  } catch (
    error
  ) {
    console.error(
      "FAVOURITE PLAYER CREATE FAILED:",
      error,
    );

    return serverError(
      error,
    );
  }
}

/*
|--------------------------------------------------------------------------
| Unfavourite player
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
      ) as FavouriteBody;

    if (
      typeof body.playerId !==
        "string" ||
      !isUuid(
        body.playerId,
      )
    ) {
      return badRequest(
        "A valid playerId is required.",
      );
    }

    const favourite =
      await db.orm.public.FavouritePlayer
        .where({
          playerId:
            body.playerId,
        })
        .first();

    if (!favourite) {
      return NextResponse.json({
        ok:
          true,

        result: {
          playerId:
            body.playerId,

          favourite:
            false,
        },
      });
    }

    await db.orm.public.FavouritePlayer
      .where({
        id:
          favourite.id,
      })
      .delete();

    return NextResponse.json({
      ok:
        true,

      result: {
        playerId:
          body.playerId,

        favourite:
          false,
      },
    });
  } catch (
    error
  ) {
    console.error(
      "FAVOURITE PLAYER DELETE FAILED:",
      error,
    );

    return serverError(
      error,
    );
  }
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
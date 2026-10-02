import {
  NextResponse,
} from "next/server";

import {
  getMatchCenter,
} from "../../../../lib/matches/get-match-center";

function isUuid(
  value:
    string,
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(
      value,
    );
}

export async function GET(
  request:
    Request,
) {
  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    return NextResponse.json(
      {
        ok:
          false,

        error:
          "Not found.",
      },
      {
        status:
          404,
      },
    );
  }

  try {
    const matchId =
      new URL(
        request.url,
      ).searchParams
        .get(
          "matchId",
        )
        ?.trim();

    if (!matchId) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "matchId is required.",
        },
        {
          status:
            400,
        },
      );
    }

    if (
      !isUuid(
        matchId,
      )
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "matchId must be a valid UUID.",
        },
        {
          status:
            400,
        },
      );
    }

    const match =
      await getMatchCenter(
        matchId,
      );

    if (!match) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Match not found.",
        },
        {
          status:
            404,
        },
      );
    }

    return NextResponse.json({
      ok:
        true,

      result:
        match,
    });
  } catch (
    error
  ) {
    console.error(
      "MATCH CENTER READ FAILED:",
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
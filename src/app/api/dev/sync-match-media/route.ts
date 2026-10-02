import {
  NextResponse,
} from "next/server";

import {
  syncOfficialMatchMedia,
} from "../../../../lib/providers/youtube-fcbarcelona/match-media";

type RequestBody = {
  matchId?:
    unknown;

  dryRun?:
    unknown;
};

export async function POST(
  request:
    Request,
) {
  try {
    if (
      process.env
        .NODE_ENV ===
      "production"
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "This development endpoint is disabled in production.",
        },

        {
          status:
            404,
        },
      );
    }

    const body =
      (
        await request.json()
      ) as RequestBody;

    if (
      typeof body.matchId !==
        "string" ||
      !isUuid(
        body.matchId,
      )
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "A valid matchId UUID is required.",
        },

        {
          status:
            400,
        },
      );
    }

    const dryRun =
      typeof body.dryRun ===
      "boolean"
        ? body.dryRun
        : true;

    const result =
      await syncOfficialMatchMedia({
        matchId:
          body.matchId,

        dryRun,
      });

    return NextResponse.json({
      ok:
        true,

      result,
    });
  } catch (
    error
  ) {
    console.error(
      "MATCH MEDIA SYNC FAILED:",
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

function isUuid(
  value:
    string,
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
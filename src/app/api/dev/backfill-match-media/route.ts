import {
  NextResponse,
} from "next/server";

import {
  backfillOfficialMatchMedia,
} from "../../../../lib/providers/youtube-fcbarcelona/backfill";

type RequestBody = {
  dryRun?:
    unknown;

  competitionCodes?:
    unknown;

  onlyMissingHighlights?:
    unknown;

  limit?:
    unknown;
};

export async function POST(
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
          "This development endpoint is disabled in production.",
      },
      {
        status:
          404,
      },
    );
  }

  try {
    const body =
      (
        await request.json()
      ) as RequestBody;

    if (
      body.dryRun !==
        undefined &&
      typeof body.dryRun !==
        "boolean"
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "dryRun must be a boolean when supplied.",
        },
        {
          status:
            400,
        },
      );
    }

    if (
      body.onlyMissingHighlights !==
        undefined &&
      typeof body.onlyMissingHighlights !==
        "boolean"
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "onlyMissingHighlights must be a boolean when supplied.",
        },
        {
          status:
            400,
        },
      );
    }

    let competitionCodes:
      string[] |
      undefined;

    if (
      body.competitionCodes !==
      undefined
    ) {
      if (
        !Array.isArray(
          body.competitionCodes,
        ) ||
        !body.competitionCodes.every(
          (
            value,
          ) =>
            typeof value ===
              "string" &&
            value.trim().length >
              0,
        )
      ) {
        return NextResponse.json(
          {
            ok:
              false,

            error:
              "competitionCodes must be an array of non-empty strings.",
          },
          {
            status:
              400,
          },
        );
      }

      competitionCodes =
        body.competitionCodes.map(
          (
            value,
          ) =>
            value.trim(),
        );
    }

    let limit:
      number |
      undefined;

    if (
      body.limit !==
      undefined
    ) {
      if (
        typeof body.limit !==
          "number" ||
        !Number.isInteger(
          body.limit,
        ) ||
        body.limit <
          1 ||
        body.limit >
          100
      ) {
        return NextResponse.json(
          {
            ok:
              false,

            error:
              "limit must be an integer between 1 and 100 when supplied.",
          },
          {
            status:
              400,
          },
        );
      }

      limit =
        body.limit;
    }

    const result =
      await backfillOfficialMatchMedia({
        dryRun:
          body.dryRun ??
          true,

        competitionCodes,

        onlyMissingHighlights:
          body.onlyMissingHighlights ??
          true,

        limit,
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
      "MATCH MEDIA SEASON BACKFILL FAILED:",
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

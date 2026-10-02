import { NextResponse } from "next/server";

import { backfillCurrentRichSeason } from "../../../../lib/providers/rich-match/backfill";

export async function POST(
  request: Request,
) {
  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "Not found.",
      },
      {
        status: 404,
      },
    );
  }

  try {
    const body =
      (await request.json()) as {
        dryRun?: unknown;
        competitionCodes?: unknown;
      };

    if (
      body.dryRun !==
        undefined &&
      typeof body.dryRun !==
        "boolean"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "dryRun must be a boolean when supplied.",
        },
        {
          status: 400,
        },
      );
    }

    let competitionCodes:
      | string[]
      | undefined;

    if (
      body.competitionCodes !==
      undefined
    ) {
      if (
        !Array.isArray(
          body.competitionCodes,
        ) ||
        !body.competitionCodes.every(
          (value) =>
            typeof value ===
              "string" &&
            value.trim().length >
              0,
        )
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "competitionCodes must be an array of non-empty strings.",
          },
          {
            status: 400,
          },
        );
      }

      competitionCodes =
        body.competitionCodes.map(
          (value) =>
            value.trim(),
        );
    }

    const result =
      await backfillCurrentRichSeason(
        {
          dryRun:
            body.dryRun ??
            true,

          competitionCodes,
        },
      );

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    console.error(
      "RICH SEASON BACKFILL FAILED:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      },
    );
  }
}
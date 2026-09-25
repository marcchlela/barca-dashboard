import { NextResponse } from "next/server";

import { syncRichMatch } from "../../../../lib/providers/rich-match/sync";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
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
    const body = (await request.json()) as {
      matchId?: unknown;
      dryRun?: unknown;
    };

    if (
      typeof body.matchId !== "string" ||
      body.matchId.trim().length === 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "matchId must be a non-empty string.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      body.dryRun !== undefined &&
      typeof body.dryRun !== "boolean"
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

    const result = await syncRichMatch({
      matchId: body.matchId.trim(),
      dryRun: body.dryRun ?? true,
    });

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    console.error(
      "RICH MATCH SYNC FAILED:",
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
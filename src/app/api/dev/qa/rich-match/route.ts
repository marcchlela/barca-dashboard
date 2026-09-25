import { NextResponse } from "next/server";

import { richMatchQa } from "../../../../../lib/providers/rich-match/qa";

export async function GET(
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
    const matchId =
      new URL(
        request.url,
      ).searchParams.get(
        "matchId",
      );

    if (
      !matchId ||
      matchId.trim().length ===
        0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "matchId is required.",
        },
        {
          status: 400,
        },
      );
    }

    const result =
      await richMatchQa(
        matchId.trim(),
      );

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    console.error(
      "RICH MATCH QA FAILED:",
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
import {
  NextResponse,
} from "next/server";

import {
  previewCanonicalPlayerStatistics,
} from "../../../../lib/providers/rich-match/canonical-player-stats";

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
        error:
          "Not found.",
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

    if (!matchId) {
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
      await previewCanonicalPlayerStatistics(
        matchId,
      );

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    console.error(
      "CANONICAL PLAYER STAT PREVIEW FAILED:",
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
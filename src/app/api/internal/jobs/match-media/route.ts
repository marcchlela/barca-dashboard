import {
  NextResponse,
} from "next/server";

import {
  runAutomaticMatchMediaWorker,
} from "../../../../../lib/providers/youtube-fcbarcelona/automatic-worker";

export const dynamic =
  "force-dynamic";

export async function POST(
  request:
    Request,
) {
  try {
    const configuredSecret =
      process.env
        .INTERNAL_JOB_SECRET;

    if (!configuredSecret) {
      console.error(
        "MATCH MEDIA JOB: INTERNAL_JOB_SECRET is not configured.",
      );

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Internal job authentication is not configured.",
        },
        {
          status:
            503,
        },
      );
    }

    const authorization =
      request.headers.get(
        "authorization",
      );

    const expected =
      `Bearer ${configuredSecret}`;

    if (
      !authorization ||
      authorization !==
        expected
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Unauthorized.",
        },
        {
          status:
            401,
        },
      );
    }

    const result =
      await runAutomaticMatchMediaWorker({
        dryRun:
          false,

        forceAllFinished:
          false,
      });

    const failed =
      result.counts
        .failed;

    if (
      failed >
      0
    ) {
      console.error(
        `MATCH MEDIA JOB: completed with ${failed} failed match(es).`,
      );
    }

    return NextResponse.json(
      {
        ok:
          failed ===
          0,

        result,
      },
      {
        status:
          failed ===
          0
            ? 200
            : 207,
      },
    );
  } catch (
    error
  ) {
    console.error(
      "MATCH MEDIA JOB FAILED:",
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
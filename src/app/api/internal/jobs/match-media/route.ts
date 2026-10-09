import {
  NextResponse,
} from "next/server";

import {
  runScheduledMatchMediaJob,
} from "../../../../../lib/providers/youtube-fcbarcelona/scheduled-job";

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

    const job = await runScheduledMatchMediaJob();
    if (job.status === "already-running") {
      return NextResponse.json({ ok: true, status: job.status, result: null, goalMedia: job.goalMedia }, { status: 202 });
    }
    const result = job.result;

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
        fixtureRefresh: job.fixtureRefresh,
        eventRefresh: job.eventRefresh,
        goalMedia: job.goalMedia,
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

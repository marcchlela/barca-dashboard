import {
  NextResponse,
} from "next/server";
import { guardAdminRequest } from "../../../../lib/admin/access";

import {
  syncCurrentBarcelonaPlayerHeatmaps,
} from "../../../../lib/squad/sync-player-heatmaps";

type RequestBody = {
  matchId?:
    string;

  force?:
    boolean;
};

export async function POST(
  request:
    Request,
) {
  const denied = await guardAdminRequest(request);
  if (denied) return denied;
  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    return NextResponse.json(
      {
        ok:
          false,

        error:
          "Player heatmap sync is disabled in production until admin authentication is added.",
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
        await request
          .json()
          .catch(
            () => ({}),
          )
      ) as RequestBody;

    const startedAt =
      new Date();

    const result =
      await syncCurrentBarcelonaPlayerHeatmaps(
        {
          matchId:
            typeof body.matchId ===
            "string"
              ? body.matchId
              : undefined,

          force:
            body.force ===
            true,
        },
      );

    const finishedAt =
      new Date();

    return NextResponse.json({
      ok:
        true,

      startedAt:
        startedAt.toISOString(),

      finishedAt:
        finishedAt.toISOString(),

      durationMs:
        finishedAt.getTime() -
        startedAt.getTime(),

      result,
    });
  } catch (
    error
  ) {
    console.error(
      "PLAYER HEATMAP SYNC FAILED:",
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

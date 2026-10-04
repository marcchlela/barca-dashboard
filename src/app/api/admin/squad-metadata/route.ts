import {
  NextResponse,
} from "next/server";

import {
  syncCurrentBarcelonaSquadMetadata,
} from "../../../../lib/squad/sync-squad-metadata";

import {
  syncCurrentBarcelonaCaptains,
} from "../../../../lib/squad/sync-captains";

export async function POST() {
  /*
  |--------------------------------------------------------------------------
  | Development-only until admin auth exists
  |--------------------------------------------------------------------------
  */

  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    return NextResponse.json(
      {
        ok:
          false,

        error:
          "Squad metadata sync is disabled in production until admin authentication is added.",
      },
      {
        status:
          404,
      },
    );
  }

  try {
    const startedAt =
      new Date();

    /*
    |--------------------------------------------------------------------------
    | Player metadata
    |--------------------------------------------------------------------------
    */

    const metadata =
      await syncCurrentBarcelonaSquadMetadata();

    /*
    |--------------------------------------------------------------------------
    | Leadership
    |--------------------------------------------------------------------------
    */

    const leadership =
      await syncCurrentBarcelonaCaptains();

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

      result: {
        ...metadata,

        leadership,
      },
    });
  } catch (
    error
  ) {
    console.error(
      "SQUAD METADATA SYNC FAILED:",
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
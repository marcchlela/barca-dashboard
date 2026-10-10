import {
  NextResponse,
} from "next/server";
import { guardAdminRequest } from "../../../../lib/admin/access";

import {
  syncCurrentBarcelonaOfficialSquad,
} from "../../../../lib/squad/sync-official-squad";

import {
  syncCurrentBarcelonaSquadMetadata,
} from "../../../../lib/squad/sync-squad-metadata";

import {
  syncCurrentBarcelonaCaptains,
} from "../../../../lib/squad/sync-captains";

export async function POST(request: Request) {
  const denied = await guardAdminRequest(request);
  if (denied) return denied;
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
    | 01 — authoritative season roster
    |--------------------------------------------------------------------------
    |
    | This must happen first.
    |
    | Metadata providers and leadership logic should operate on the actual
    | verified current first-team membership set.
    |--------------------------------------------------------------------------
    */

    const officialRoster =
      await syncCurrentBarcelonaOfficialSquad();

    /*
    |--------------------------------------------------------------------------
    | 02 — provider metadata
    |--------------------------------------------------------------------------
    */

    const metadata =
      await syncCurrentBarcelonaSquadMetadata();

    /*
    |--------------------------------------------------------------------------
    | 03 — leadership
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
        officialRoster,

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

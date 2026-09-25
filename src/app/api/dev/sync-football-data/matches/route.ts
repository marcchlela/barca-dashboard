import { NextResponse } from "next/server";

import {
  syncBarcelonaMatches,
} from "../../../../../lib/providers/football-data/sync";

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name:
        error.name,

      message:
        error.message,

      stack:
        error.stack ?? null,
    };
  }

  return {
    value:
      String(error),
  };
}

export async function POST() {
  try {
    const result =
      await syncBarcelonaMatches();

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    console.error(
      "BARÇA MATCH SYNC FAILED:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          serializeError(error),
      },
      {
        status: 500,
      },
    );
  }
}
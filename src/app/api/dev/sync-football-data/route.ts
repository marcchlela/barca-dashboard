import { NextResponse } from "next/server";

import {
  syncLaLigaCurrentSeason,
} from "../../../../lib/providers/football-data/sync";

function serializeError(error: unknown) {
  if (error instanceof Error) {
    const extended = error as Error & {
      code?: unknown;
      cause?: unknown;
      meta?: unknown;
    };

    return {
      name: error.name,
      message: error.message,
      code: extended.code ?? null,
      cause:
        extended.cause instanceof Error
          ? {
              name: extended.cause.name,
              message: extended.cause.message,
              stack: extended.cause.stack,
            }
          : extended.cause ?? null,
      meta: extended.meta ?? null,
      stack: error.stack ?? null,
      properties: Object.getOwnPropertyNames(error),
    };
  }

  return {
    value: String(error),
    rawType: typeof error,
  };
}

export async function POST() {
  try {
    const result =
      await syncLaLigaCurrentSeason();

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    console.error(
      "FOOTBALL DATA SYNC FAILED:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error: serializeError(error),
      },
      {
        status: 500,
      },
    );
  }
}
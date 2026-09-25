import { NextRequest, NextResponse } from "next/server";

import {
  DataLabMatchNotFoundError,
  runBarcelonaDataLab,
} from "../../../../../lib/data-lab";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  try {
    const matchId = request.nextUrl.searchParams.get("matchId") ?? undefined;
    const refresh = request.nextUrl.searchParams.get("refresh") === "1";
    const report = await runBarcelonaDataLab({ matchId, refresh });

    return NextResponse.json(
      { ok: true, report },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    const notFound = error instanceof DataLabMatchNotFoundError;

    if (!notFound) {
      console.error("DATA LAB PROBE FAILED:", error);
    }
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: notFound ? 404 : 500 },
    );
  }
}

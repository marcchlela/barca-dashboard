import { NextResponse } from "next/server";

import { richMatchQa } from "../../../../../lib/providers/rich-match/qa";
import { RICH_MATCH_TARGET } from "../../../../../lib/providers/rich-match/constants";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  try {
    const matchId = new URL(request.url).searchParams.get("matchId");
    if (matchId !== RICH_MATCH_TARGET.id) {
      return NextResponse.json(
        { ok: false, error: `matchId must equal ${RICH_MATCH_TARGET.id}.` },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, result: await richMatchQa(matchId) });
  } catch (error) {
    console.error("RICH MATCH QA FAILED:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

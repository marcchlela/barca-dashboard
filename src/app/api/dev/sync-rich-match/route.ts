import { NextResponse } from "next/server";

import { syncRichMatch } from "../../../../lib/providers/rich-match/sync";
import { RICH_MATCH_TARGET } from "../../../../lib/providers/rich-match/constants";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  try {
    const body = (await request.json()) as { matchId?: unknown; dryRun?: unknown };
    if (body.matchId !== RICH_MATCH_TARGET.id) {
      return NextResponse.json(
        { ok: false, error: `matchId must equal ${RICH_MATCH_TARGET.id}.` },
        { status: 400 },
      );
    }
    if (body.dryRun !== undefined && typeof body.dryRun !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "dryRun must be a boolean when supplied." },
        { status: 400 },
      );
    }
    const result = await syncRichMatch({
      matchId: body.matchId,
      dryRun: body.dryRun ?? true,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("RICH MATCH SYNC FAILED:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

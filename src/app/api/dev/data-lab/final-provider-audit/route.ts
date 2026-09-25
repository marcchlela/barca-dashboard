import { NextRequest, NextResponse } from "next/server";

import { runFinalProviderAudit } from "../../../../../lib/data-lab/final-provider-audit";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  try {
    const refresh = request.nextUrl.searchParams.get("refresh") === "1";
    const report = await runFinalProviderAudit({ refresh });
    return NextResponse.json(
      { ok: true, report },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("FINAL PROVIDER AUDIT FAILED:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

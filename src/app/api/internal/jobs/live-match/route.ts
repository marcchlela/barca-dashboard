import { NextResponse } from "next/server";
import { runLiveMatchRefresh } from "../../../../../lib/providers/goal-api/live-refresh";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.INTERNAL_JOB_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "Internal job authentication is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  try {
    const result = await runLiveMatchRefresh();
    const status = result.status;
    const ok = !["failed", "blocked", "unconfigured"].includes(status);
    // BusyBox wget in the scheduler drops 207 responses, hiding the useful
    // retry/error JSON. This is an authenticated job-result envelope, so keep
    // handled provider failures visible with `ok: false` and a 200 transport.
    return NextResponse.json({ ok, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("LIVE MATCH JOB FAILED:", message);
    return NextResponse.json({ ok: false, status: "failed", error: message }, { status: 500 });
  }
}

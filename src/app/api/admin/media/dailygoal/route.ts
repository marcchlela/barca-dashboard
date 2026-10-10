import { NextResponse } from "next/server";
import { applyDailyGoalImport, previewDailyGoalImport, reviewDailyGoalCandidate } from "../../../../../lib/providers/dailygoal/import";
import { guardAdminRequest } from "../../../../../lib/admin/access";

const bad = (message: string, status = 400) => NextResponse.json({ ok: false, error: message }, { status });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const denied = await guardAdminRequest(request);
  if (denied) return denied;
  try {
    const body = await request.json() as { url?: unknown; mode?: unknown; preRoll?: unknown };
    if (typeof body.url !== "string" || body.url.length > 300 || !["preview", "apply"].includes(String(body.mode))) return bad("Choose a DailyGoal match URL and preview or apply mode.");
    const preRoll = body.preRoll === undefined ? 1 : Number(body.preRoll);
    const result = body.mode === "apply" ? await applyDailyGoalImport(body.url, preRoll) : await previewDailyGoalImport(body.url, preRoll);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return bad(error instanceof Error ? error.message : "DailyGoal import failed.");
  }
}

export async function PATCH(request: Request) {
  const denied = await guardAdminRequest(request);
  if (denied) return denied;
  try {
    const body = await request.json() as { id?: unknown; action?: unknown; matchEventId?: unknown; startSecond?: unknown; reviewNote?: unknown };
    if (typeof body.id !== "string" || !uuid.test(body.id) || !["approve", "reject"].includes(String(body.action))) return bad("Choose a pending candidate and review action.");
    if (body.matchEventId !== undefined && (typeof body.matchEventId !== "string" || !uuid.test(body.matchEventId))) return bad("Choose a valid canonical goal.");
    const startSecond = body.startSecond === undefined ? undefined : Number(body.startSecond);
    if (startSecond !== undefined && (!Number.isInteger(startSecond) || startSecond < 0)) return bad("Start time must be a nonnegative whole second.");
    const result = await reviewDailyGoalCandidate({ id: body.id, action: body.action as "approve" | "reject", matchEventId: body.matchEventId as string | undefined, startSecond, reviewNote: typeof body.reviewNote === "string" ? body.reviewNote : undefined });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return bad(error instanceof Error ? error.message : "Review failed.");
  }
}

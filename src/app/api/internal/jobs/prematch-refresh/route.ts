import { NextResponse } from "next/server";
import { Temporal } from "temporal-polyfill";
import { db } from "../../../../../prisma/db";
import { runScheduledGoalEventRefresh } from "../../../../../lib/providers/rich-match/scheduled-events";
import { runAutomaticMatchMediaWorker } from "../../../../../lib/providers/youtube-fcbarcelona/automatic-worker";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const configuredSecret = process.env.INTERNAL_JOB_SECRET;
  if (!configuredSecret) {
    return NextResponse.json({ ok: false, error: "Internal job authentication is not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${configuredSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  if (process.env.GOAL_MEDIA_SCHEDULE_ENABLED !== "true") {
    return NextResponse.json({ ok: true, status: "disabled", reason: "GOAL_MEDIA_SCHEDULE_ENABLED is off." });
  }

  const lockKey = "scheduled-pregame-refresh";
  const now = Date.now();
  const active = await db.orm.public.GoalMediaSyncRun.where({ lockKey }).first();
  if (active && now - Date.parse(active.startedAt.toString()) < 15 * 60_000) {
    return NextResponse.json({ ok: true, status: "already-running" }, { status: 202 });
  }
  if (active) {
    await db.orm.public.GoalMediaSyncRun.where({ id: active.id }).update({ lockKey: null, status: "interrupted", finishedAt: Temporal.Instant.from(new Date(now).toISOString()), error: "Pregame refresh exceeded its 15-minute lease." });
  }
  let run;
  try {
    run = await db.orm.public.GoalMediaSyncRun.create({ lockKey, mode: "pregame-job", status: "running", startedAt: Temporal.Instant.from(new Date(now).toISOString()) });
  } catch {
    return NextResponse.json({ ok: true, status: "already-running" }, { status: 202 });
  }

  const [lineups, previews] = await Promise.allSettled([
    runScheduledGoalEventRefresh(),
    process.env.YOUTUBE_API_KEY
      ? runAutomaticMatchMediaWorker({ dryRun: false, previewOnly: true })
      : Promise.resolve({ status: "unconfigured" as const, error: "YOUTUBE_API_KEY is not configured." }),
  ]);

  const lineupResult = lineups.status === "fulfilled"
    ? lineups.value
    : { status: "failed" as const, error: lineups.reason instanceof Error ? lineups.reason.message : String(lineups.reason) };
  const previewResult = previews.status === "fulfilled"
    ? previews.value
    : { status: "failed" as const, error: previews.reason instanceof Error ? previews.reason.message : String(previews.reason) };
  const lineupOk = lineups.status === "fulfilled" && !["failed", "blocked", "unconfigured"].includes(lineupResult.status);
  const previewOk = previews.status === "fulfilled" && !("status" in previewResult && previewResult.status === "unconfigured") && (!("counts" in previewResult) || previewResult.counts.failed === 0);

  const result = {
    ok: lineupOk && previewOk,
    lineups: lineupResult,
    previews: previewResult,
  };
  await db.orm.public.GoalMediaSyncRun.where({ id: run.id }).update({
    lockKey: null,
    status: result.ok ? "success" : "partial",
    finishedAt: Temporal.Instant.from(new Date().toISOString()),
    result,
    error: result.ok ? null : "One or more pre-match sync stages failed.",
  });
  // BusyBox wget treats 207 as a transport error and discards the JSON body in
  // scheduler logs. Stage failures are represented by `ok: false` and the
  // persisted run status, so return 200 for an authenticated, handled run.
  return NextResponse.json(result);
}

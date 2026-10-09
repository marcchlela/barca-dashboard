import "server-only";

import { Temporal } from "temporal-polyfill";
import { db } from "../../../prisma/db";
import { runScheduledFixtureRefresh } from "../football-data/scheduled-refresh";
import { runScheduledGoalEventRefresh } from "../rich-match/scheduled-events";
import { runGoalMediaBackgroundWorker } from "../dailygoal/background-worker";
import { runAutomaticMatchMediaWorker } from "./automatic-worker";

const JOB_LOCK = "scheduled-match-media-job";
const LOCK_LEASE_MS = 45 * 60_000;

type OfficialWorker = typeof runAutomaticMatchMediaWorker;
type GoalWorker = typeof runGoalMediaBackgroundWorker;
type FixtureWorker = typeof runScheduledFixtureRefresh;
type EventWorker = typeof runScheduledGoalEventRefresh;

export function goalMediaJobEnabled() {
  return process.env.GOAL_MEDIA_SCHEDULE_ENABLED === "true";
}

function instant(ms: number) {
  return Temporal.Instant.from(new Date(ms).toISOString());
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function skipAfterLockFailure(error: unknown) {
  console.error("MATCH MEDIA JOB LOCK UNAVAILABLE; ALL STAGES SKIPPED:", error);
  return { status: "already-running" as const, result: null, goalMedia: { status: "skipped" as const,
    error: `Goal-media job lock unavailable: ${message(error)}`.slice(0, 500) } };
}

/** The existing authenticated job owns this sequence; no second scheduler is needed. */
export async function runScheduledMatchMediaJob(input: {
  fixtureWorker?: FixtureWorker;
  eventWorker?: EventWorker;
  officialWorker?: OfficialWorker;
  goalWorker?: GoalWorker;
  goalEnabled?: boolean;
  youtubeConfigured?: boolean;
} = {}) {
  const now = Date.now();
  const officialWorker = input.officialWorker ?? runAutomaticMatchMediaWorker;
  let active: { id: string; startedAt: { toString(): string } } | null;
  try {
    active = await db.orm.public.GoalMediaSyncRun.where({ lockKey: JOB_LOCK }).first();
  } catch (error) {
    return skipAfterLockFailure(error);
  }
  if (active) {
    if (now - Date.parse(active.startedAt.toString()) < LOCK_LEASE_MS) {
      return { status: "already-running" as const, result: null, goalMedia: { status: "skipped" as const, reason: "The authenticated match-media job is already running." } };
    }
    try {
      await db.orm.public.GoalMediaSyncRun.where({ id: active.id }).update({
        lockKey: null, status: "interrupted", finishedAt: instant(now), error: "An incomplete scheduled job exceeded its 45-minute lease.",
      });
    } catch (error) {
      return skipAfterLockFailure(error);
    }
  }

  let run: Awaited<ReturnType<typeof db.orm.public.GoalMediaSyncRun.create>>;
  try {
    run = await db.orm.public.GoalMediaSyncRun.create({ lockKey: JOB_LOCK, mode: "scheduled-job", status: "running", startedAt: instant(now) });
  } catch (error) {
    // The unique lock also protects multiple application processes racing to start.
    try {
      if (await db.orm.public.GoalMediaSyncRun.where({ lockKey: JOB_LOCK }).first()) {
        return { status: "already-running" as const, result: null, goalMedia: { status: "skipped" as const, reason: "The authenticated match-media job is already running." } };
      }
    } catch {
      // The lock table is unavailable, not an overlapping run.
    }
    return skipAfterLockFailure(error);
  }

  let status = "failed";
  let errorText: string | null = null;
  let resultData: Record<string, string | number | null> | null = null;
  try {
    const enabled = input.goalEnabled ?? goalMediaJobEnabled();
    let fixtureRefresh: { status: string; nextAt: string | null; fetched: number; error: string | null } =
      { status: "disabled", nextAt: null, fetched: 0, error: null };
    if (enabled) try {
      fixtureRefresh = await (input.fixtureWorker ?? runScheduledFixtureRefresh)();
    } catch (error) {
      fixtureRefresh = { status: "failed", nextAt: new Date(Date.now() + 3 * 3_600_000).toISOString(), fetched: 0, error: message(error).slice(0, 500) };
      console.error("FIXTURE REFRESH STAGE FAILED:", error);
    }
    let eventRefresh: { status: string; matchId: string | null; nextAt: string | null; error: string | null };
    if (!enabled) eventRefresh = { status: "disabled", matchId: null, nextAt: null, error: null };
    else try {
      eventRefresh = await (input.eventWorker ?? runScheduledGoalEventRefresh)();
    } catch (error) {
      eventRefresh = { status: "failed", matchId: null, nextAt: null, error: message(error).slice(0, 500) };
      console.error("CANONICAL GOAL EVENT STAGE FAILED:", error);
    }
    const result = await officialWorker({ dryRun: false, forceAllFinished: false });
    const youtubeConfigured = input.youtubeConfigured ?? Boolean(process.env.YOUTUBE_API_KEY);
    let goalMedia: { status: string; reason?: string; error?: string; result?: Awaited<ReturnType<GoalWorker>> };
    if (!enabled) goalMedia = { status: "disabled", reason: "GOAL_MEDIA_SCHEDULE_ENABLED is off." };
    else if (result.counts.failed > 0) goalMedia = { status: "skipped", reason: "Official media sync reported failed fixtures; goal sync will wait for the next job." };
    else if (!youtubeConfigured) goalMedia = { status: "skipped", reason: "YOUTUBE_API_KEY is not configured." };
    else {
      try {
        const goalResult = await (input.goalWorker ?? runGoalMediaBackgroundWorker)({ dryRun: false });
        goalMedia = { status: goalResult.status, result: goalResult };
        if (goalResult.status === "blocked") {
          const until = "blockedUntil" in goalResult && typeof goalResult.blockedUntil === "string" ? ` Retry after ${goalResult.blockedUntil}.` : "";
          errorText = `Goal-media source cooldown (403/429).${until}`.slice(0, 500);
        } else if (goalResult.status === "retry-wait" && "reason" in goalResult && typeof goalResult.reason === "string") {
          errorText = `Goal-media stage: ${goalResult.reason}`.slice(0, 500);
        }
      } catch (error) {
        errorText = `Goal-media stage: ${message(error)}`.slice(0, 500);
        goalMedia = { status: "failed", error: errorText };
        console.error("GOAL MEDIA JOB FAILED:", error);
      }
    }
    status = result.counts.failed > 0 ? "primary-partial" : goalMedia.status === "failed" ? "goal-failed" :
      fixtureRefresh.status === "failed" || fixtureRefresh.status === "blocked" || fixtureRefresh.status === "unconfigured" ? "fixture-partial" :
      eventRefresh.status === "failed" || eventRefresh.status === "blocked" || eventRefresh.status === "unconfigured" ? "events-partial" : "success";
    resultData = { fixtureStatus: fixtureRefresh.status, fixtureFetched: fixtureRefresh.fetched, fixtureNextAt: fixtureRefresh.nextAt,
      eventStatus: eventRefresh.status, eventMatchId: eventRefresh.matchId, officialFailed: result.counts.failed, officialEligible: result.counts.eligible,
      goalStatus: goalMedia.status, goalsPublished: goalMedia.result && "goalsPublished" in goalMedia.result ? goalMedia.result.goalsPublished : 0,
      goalsQueued: goalMedia.result && "goalsQueued" in goalMedia.result ? goalMedia.result.goalsQueued : 0 };
    return { status: "completed" as const, fixtureRefresh, eventRefresh, result, goalMedia };
  } catch (error) {
    errorText = `Official media stage: ${message(error)}`.slice(0, 500);
    throw error;
  } finally {
    try {
      await db.orm.public.GoalMediaSyncRun.where({ id: run.id }).update({
        lockKey: null, status, finishedAt: instant(Date.now()), error: errorText, result: resultData,
        goalsPublished: Number(resultData?.goalsPublished ?? 0), goalsQueued: Number(resultData?.goalsQueued ?? 0),
      });
    } catch (error) {
      console.error("MATCH MEDIA JOB STATUS/LOCK RELEASE FAILED:", error);
    }
  }
}

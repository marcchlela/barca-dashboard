import "server-only";

import { Temporal } from "temporal-polyfill";
import { db } from "../../../prisma/db";
import { syncBarcelonaMatches } from "./sync";

const HOUR = 3_600_000;

export function fixtureRefreshDue(last: { status: string; finishedAt: string } | null, now = Date.now()) {
  if (!last) return { due: true, nextAt: null };
  const delay = (last.status === "blocked" ? 24 : last.status === "success" ? 6 : 3) * HOUR;
  const next = Date.parse(last.finishedAt) + delay;
  return { due: !Number.isFinite(next) || now >= next, nextAt: Number.isFinite(next) ? new Date(next).toISOString() : null };
}

/** Runs under the authenticated job's cross-process lock; one provider request per attempt. */
export async function runScheduledFixtureRefresh(input: { refresh?: typeof syncBarcelonaMatches; now?: number } = {}) {
  if (!process.env.FOOTBALL_DATA_API_KEY && !input.refresh) return { status: "unconfigured" as const, nextAt: null, fetched: 0, error: null };
  const now = input.now ?? Date.now();
  const latest = await db.orm.public.GoalMediaSyncRun.where({ mode: "fixture-refresh" }).orderBy((run) => run.startedAt.desc()).first();
  const due = fixtureRefreshDue(latest?.finishedAt ? { status: latest.status, finishedAt: latest.finishedAt.toString() } : null, now);
  if (!due.due) return { status: "cooldown" as const, nextAt: due.nextAt, fetched: 0, error: null };
  const run = await db.orm.public.GoalMediaSyncRun.create({ mode: "fixture-refresh", status: "running", startedAt: Temporal.Instant.from(new Date(now).toISOString()) });
  try {
    const result = await (input.refresh ?? syncBarcelonaMatches)();
    await db.orm.public.GoalMediaSyncRun.where({ id: run.id }).update({ status: "success", finishedAt: Temporal.Now.instant(), result: { fetched: result.fetched, created: result.matchesCreated, updated: result.matchesUpdated } });
    return { status: "success" as const, nextAt: new Date(Date.now() + 6 * HOUR).toISOString(), fetched: result.fetched, error: null };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const blocked = /(?:^|\D)(?:403|429)(?:\D|$)/.test(detail);
    await db.orm.public.GoalMediaSyncRun.where({ id: run.id }).update({ status: blocked ? "blocked" : "failed", finishedAt: Temporal.Now.instant(), error: detail.slice(0, 500) });
    return { status: blocked ? "blocked" as const : "failed" as const, nextAt: new Date(Date.now() + (blocked ? 24 : 3) * HOUR).toISOString(), fetched: 0, error: detail.slice(0, 500) };
  }
}

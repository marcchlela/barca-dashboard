import "server-only";

import { Temporal } from "temporal-polyfill";
import { db } from "../../../prisma/db";
import { syncCompetitionFixtures } from "../../analytics/competition-sync";
import { fixtureRefreshDue } from "./scheduled-refresh";

/** The same authenticated job owns this bounded, two-request CL snapshot refresh. */
export async function runScheduledChampionsLeagueRefresh(input: {
  refresh?: typeof syncCompetitionFixtures;
  now?: number;
} = {}) {
  if (!process.env.FOOTBALL_DATA_API_KEY && !input.refresh) {
    return { status: "unconfigured" as const, nextAt: null, fixturesChanged: 0, standingsChanged: 0, error: null };
  }
  const now = input.now ?? Date.now();
  const latest = await db.orm.public.GoalMediaSyncRun.where({ mode: "champions-refresh" }).orderBy((run) => run.startedAt.desc()).first();
  const due = fixtureRefreshDue(latest?.finishedAt ? { status: latest.status, finishedAt: latest.finishedAt.toString() } : null, now);
  if (!due.due) return { status: "cooldown" as const, nextAt: due.nextAt, fixturesChanged: 0, standingsChanged: 0, error: null };

  const run = await db.orm.public.GoalMediaSyncRun.create({ mode: "champions-refresh", status: "running", startedAt: Temporal.Instant.from(new Date(now).toISOString()) });
  try {
    const result = await (input.refresh ?? syncCompetitionFixtures)("CL", false);
    if (!("standingRowsChanged" in result) || typeof result.standingRowsChanged !== "number") throw new Error("Champions League refresh returned preview data instead of an applied result.");
    const finishedAt = Temporal.Now.instant();
    await db.orm.public.GoalMediaSyncRun.where({ id: run.id }).update({ status: "success", finishedAt, result: { fixturesChanged: result.changed, standingsChanged: result.standingRowsChanged } });
    return { status: "success" as const, nextAt: new Date(finishedAt.epochMilliseconds + 6 * 3_600_000).toISOString(), fixturesChanged: result.changed, standingsChanged: result.standingRowsChanged, error: null };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const blocked = /(?:^|\D)(?:403|429)(?:\D|$)/.test(detail);
    const finishedAt = Temporal.Now.instant();
    await db.orm.public.GoalMediaSyncRun.where({ id: run.id }).update({ status: blocked ? "blocked" : "failed", finishedAt, error: detail.slice(0, 500) });
    return { status: blocked ? "blocked" as const : "failed" as const, nextAt: new Date(finishedAt.epochMilliseconds + (blocked ? 24 : 3) * 3_600_000).toISOString(), fixturesChanged: 0, standingsChanged: 0, error: detail.slice(0, 500) };
  }
}

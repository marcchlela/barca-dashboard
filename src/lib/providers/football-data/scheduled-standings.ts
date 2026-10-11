
import "server-only";

import { Temporal } from "temporal-polyfill";
import { db } from "../../../prisma/db";
import { syncLaLigaCurrentSeason } from "./sync";
import { fixtureRefreshDue } from "./scheduled-refresh";

type StandingsWorker = typeof syncLaLigaCurrentSeason;

/**
 * Refreshes the official La Liga table.
 * Runs under the existing scheduled-job database lock.
 */
export async function runScheduledStandingsRefresh(
  input: {
    refresh?: StandingsWorker;
    now?: number;
  } = {},
) {
  if (!process.env.FOOTBALL_DATA_API_KEY && !input.refresh) {
    return {
      status: "unconfigured" as const,
      nextAt: null,
      synced: 0,
      error: null,
    };
  }

  const now = input.now ?? Date.now();

  const latest = await db.orm.public.GoalMediaSyncRun
    .where({ mode: "standings-refresh" })
    .orderBy((run) => run.startedAt.desc())
    .first();

  const due = fixtureRefreshDue(
    latest?.finishedAt
      ? {
          status: latest.status,
          finishedAt: latest.finishedAt.toString(),
        }
      : null,
    now,
  );

  if (!due.due) {
    return {
      status: "cooldown" as const,
      nextAt: due.nextAt,
      synced: 0,
      error: null,
    };
  }

  const run = await db.orm.public.GoalMediaSyncRun.create({
    mode: "standings-refresh",
    status: "running",
    startedAt: Temporal.Instant.from(
      new Date(now).toISOString(),
    ),
  });

  try {
    const result = await (
      input.refresh ?? syncLaLigaCurrentSeason
    )();

    const finishedAt = Temporal.Now.instant();

    await db.orm.public.GoalMediaSyncRun
      .where({ id: run.id })
      .update({
        status: "success",
        finishedAt,
        result: {
          teamsSynced: result.teamsSynced,
          standingsSynced: result.standingsSynced,
        },
      });

    return {
      status: "success" as const,
      nextAt: new Date(
        finishedAt.epochMilliseconds + 6 * 3_600_000,
      ).toISOString(),
      synced: result.standingsSynced,
      error: null,
    };
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : String(error);

    const blocked = /(?:^|\D)(?:403|429)(?:\D|$)/.test(detail);
    const finishedAt = Temporal.Now.instant();

    await db.orm.public.GoalMediaSyncRun
      .where({ id: run.id })
      .update({
        status: blocked ? "blocked" : "failed",
        finishedAt,
        error: detail.slice(0, 500),
      });

    return {
      status: blocked ? "blocked" as const : "failed" as const,
      nextAt: new Date(
        finishedAt.epochMilliseconds +
          (blocked ? 24 : 3) * 3_600_000,
      ).toISOString(),
      synced: 0,
      error: detail.slice(0, 500),
    };
  }
}

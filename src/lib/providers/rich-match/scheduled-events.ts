import "server-only";

import { Temporal } from "temporal-polyfill";
import { db } from "../../../prisma/db";
import { fixtureRefreshDue } from "../football-data/scheduled-refresh";
import { lineupNeedsBackfill } from "./lineup-coverage";
import type { syncRichMatch, syncGoalLineups } from "./sync";

const GOAL_TYPES = new Set(["goal", "penalty_goal", "own_goal"]);

/** Backfills one recent finished league/European match with missing events or lineups. */
export async function runScheduledGoalEventRefresh(input: { sync?: typeof syncRichMatch; syncLineups?: typeof syncGoalLineups; now?: number } = {}) {
  if ((!process.env.GOAL_API_KEY || !process.env.BBS_API_KEY) && !input.sync) return { status: "unconfigured" as const, matchId: null, nextAt: null, error: null };
  const now = input.now ?? Date.now();
  const season = await db.orm.public.Season.where({ isCurrent: true }).first();
  if (!season) return { status: "no-season" as const, matchId: null, nextAt: null, error: null };
  const [matches, events] = await Promise.all([
    db.orm.public.Match.where({ seasonId: season.id, status: "finished" }).include("homeTeam").include("awayTeam").include("competition").orderBy((match) => match.kickoff.asc()).all(),
    db.orm.public.MatchEvent.all(),
  ]);
  let candidate: (typeof matches)[number] | null = null;
  let kind: "events" | "lineups" | null = null;
  for (const match of matches) {
    if (!match.homeTeam.isBarcelona && !match.awayTeam.isBarcelona) continue;
    if (match.competition.code !== "PD" && match.competition.code !== "CL") continue;
    const age = now - Date.parse(match.kickoff.toString());
    if (age < 0 || age > 14 * 86_400_000 || match.homeScore === null || match.awayScore === null) continue;
    const expected = match.homeScore + match.awayScore;
    if (expected > 0 && events.filter((event) => event.matchId === match.id && GOAL_TYPES.has(event.type)).length < expected) {
      candidate = match;
      kind = "events";
      break;
    }
    const lineups = await db.orm.public.Lineup.where({ matchId: match.id }).include("players").all();
    const coverage = lineupNeedsBackfill(match.homeTeamId, match.awayTeamId, lineups);
    if (coverage.home === "missing" || coverage.away === "missing") {
      candidate = match;
      kind = "lineups";
      break;
    }
  }
  if (!candidate) return { status: "complete" as const, matchId: null, nextAt: null, error: null };
  const latest = await db.orm.public.GoalMediaSyncRun.where({ mode: "event-refresh" }).orderBy((run) => run.startedAt.desc()).first();
  const due = fixtureRefreshDue(latest?.finishedAt ? { status: latest.status, finishedAt: latest.finishedAt.toString() } : null, now);
  if (!due.due) return { status: "cooldown" as const, matchId: candidate.id, nextAt: due.nextAt, error: null };
  const run = await db.orm.public.GoalMediaSyncRun.create({ mode: "event-refresh", status: "running", startedAt: Temporal.Instant.from(new Date(now).toISOString()) });
  try {
    if (kind === "lineups") {
      const sync = input.syncLineups ?? (await import("./sync")).syncGoalLineups;
      await sync({ matchId: candidate.id, dryRun: false });
    } else {
      const sync = input.sync ?? (await import("./sync")).syncRichMatch;
      await sync({ matchId: candidate.id, dryRun: false });
    }
    await db.orm.public.GoalMediaSyncRun.where({ id: run.id }).update({ status: "success", finishedAt: Temporal.Instant.from(new Date(now).toISOString()), result: { matchId: candidate.id, kind } });
    return { status: "success" as const, matchId: candidate.id, nextAt: new Date(Date.now() + 6 * 3_600_000).toISOString(), error: null };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const blocked = /(?:^|\D)(?:403|429)(?:\D|$)/.test(detail);
    await db.orm.public.GoalMediaSyncRun.where({ id: run.id }).update({ status: blocked ? "blocked" : "failed", finishedAt: Temporal.Instant.from(new Date(now).toISOString()), error: detail.slice(0, 500), result: { matchId: candidate.id, kind } });
    return { status: blocked ? "blocked" as const : "failed" as const, matchId: candidate.id, nextAt: new Date(Date.now() + (blocked ? 24 : 3) * 3_600_000).toISOString(), error: detail.slice(0, 500) };
  }
}

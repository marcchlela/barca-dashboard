import "server-only";

import { Temporal } from "temporal-polyfill";
import { db } from "../../../prisma/db";
import { fixtureRefreshDue } from "../football-data/scheduled-refresh";
import { lineupNeedsBackfill } from "./lineup-coverage";
import type { syncRichMatch, syncGoalLineups } from "./sync";

const GOAL_TYPES = new Set(["goal", "penalty_goal", "own_goal"]);
const PREMATCH_LINEUP_WINDOW_MS = 150 * 60_000;

export function preMatchLineupRefreshDue(last: { status: string; finishedAt: string } | null, now = Date.now()) {
  if (!last) return { due: true, nextAt: null as string | null };
  const delay = last.status === "blocked" ? 24 * 3_600_000 : last.status === "success" ? 20 * 60_000 : 10 * 60_000;
  const next = Date.parse(last.finishedAt) + delay;
  return { due: now >= next, nextAt: new Date(next).toISOString() };
}

/** Refreshes upcoming confirmed lineups and backfills recent finished fixtures, one bounded provider call at a time. */
export async function runScheduledGoalEventRefresh(input: { sync?: typeof syncRichMatch; syncLineups?: typeof syncGoalLineups; now?: number } = {}) {
  if (!process.env.GOAL_API_KEY && !input.sync && !input.syncLineups) return { status: "unconfigured" as const, matchId: null, nextAt: null, error: null };
  const now = input.now ?? Date.now();
  const season = await db.orm.public.Season.where({ isCurrent: true }).first();
  if (!season) return { status: "no-season" as const, matchId: null, nextAt: null, error: null };
  const [matches, events] = await Promise.all([
    db.orm.public.Match.where({ seasonId: season.id }).include("homeTeam").include("awayTeam").include("competition").orderBy((match) => match.kickoff.asc()).all(),
    db.orm.public.MatchEvent.all(),
  ]);

  let candidate: (typeof matches)[number] | null = null;
  let kind: "events" | "lineups" | "pregame-lineups" | null = null;

  for (const match of matches) {
    if (match.status !== "scheduled" || (!match.homeTeam.isBarcelona && !match.awayTeam.isBarcelona)) continue;
    const untilKickoff = Date.parse(match.kickoff.toString()) - now;
    if (untilKickoff < 0 || untilKickoff > PREMATCH_LINEUP_WINDOW_MS) continue;
    if (match.competition.code !== "PD" && match.competition.code !== "CL") continue;
    const lineups = await db.orm.public.Lineup.where({ matchId: match.id }).include("players").all();
    const coverage = lineupNeedsBackfill(match.homeTeamId, match.awayTeamId, lineups);
    if (coverage.home === "partial" || coverage.away === "partial") continue;
    if (coverage.home === "missing" || coverage.away === "missing") {
      candidate = match;
      kind = "pregame-lineups";
      break;
    }
  }

  for (const match of matches) {
    if (candidate) break;
    if (match.status !== "finished") continue;
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
  if (kind === "events" && !process.env.BBS_API_KEY && !input.sync) return { status: "unconfigured" as const, matchId: candidate.id, nextAt: null, error: "BBS_API_KEY is not configured." };
  const runMode = kind === "pregame-lineups" ? "pregame-lineup-refresh" : "event-refresh";
  const lineupLockKey = kind === "pregame-lineups" ? "scheduled-pregame-lineup-sync" : null;
  if (lineupLockKey) {
    const activeLineupRun = await db.orm.public.GoalMediaSyncRun.where({ lockKey: lineupLockKey }).first();
    if (activeLineupRun && now - Date.parse(activeLineupRun.startedAt.toString()) < 15 * 60_000) {
      return { status: "already-running" as const, matchId: candidate.id, nextAt: null, error: null };
    }
    if (activeLineupRun) {
      await db.orm.public.GoalMediaSyncRun.where({ id: activeLineupRun.id }).update({ lockKey: null, status: "interrupted", finishedAt: Temporal.Instant.from(new Date(now).toISOString()), error: "Pre-match lineup sync exceeded its 15-minute lease." });
    }
  }
  const latest = await db.orm.public.GoalMediaSyncRun.where({ mode: runMode }).orderBy((run) => run.startedAt.desc()).first();
  const due = kind === "pregame-lineups"
    ? preMatchLineupRefreshDue(latest?.finishedAt ? { status: latest.status, finishedAt: latest.finishedAt.toString() } : null, now)
    : fixtureRefreshDue(latest?.finishedAt ? { status: latest.status, finishedAt: latest.finishedAt.toString() } : null, now);
  if (!due.due) return { status: "cooldown" as const, matchId: candidate.id, nextAt: due.nextAt, error: null };
  let run;
  try {
    run = await db.orm.public.GoalMediaSyncRun.create({ lockKey: lineupLockKey, mode: runMode, status: "running", startedAt: Temporal.Instant.from(new Date(now).toISOString()) });
  } catch {
    if (lineupLockKey && await db.orm.public.GoalMediaSyncRun.where({ lockKey: lineupLockKey }).first()) {
      return { status: "already-running" as const, matchId: candidate.id, nextAt: null, error: null };
    }
    throw new Error("Could not create the scheduled match-data sync record.");
  }
  try {
    if (kind === "lineups" || kind === "pregame-lineups") {
      const sync = input.syncLineups ?? (await import("./sync")).syncGoalLineups;
      await sync({ matchId: candidate.id, dryRun: false });
    } else {
      const sync = input.sync ?? (await import("./sync")).syncRichMatch;
      await sync({ matchId: candidate.id, dryRun: false });
    }
    await db.orm.public.GoalMediaSyncRun.where({ id: run.id }).update({ lockKey: null, status: "success", finishedAt: Temporal.Instant.from(new Date(now).toISOString()), result: { matchId: candidate.id, kind } });
    return { status: "success" as const, matchId: candidate.id, nextAt: new Date(Date.now() + (kind === "pregame-lineups" ? 20 * 60_000 : 6 * 3_600_000)).toISOString(), error: null };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const blocked = /(?:^|\D)(?:403|429)(?:\D|$)/.test(detail);
    await db.orm.public.GoalMediaSyncRun.where({ id: run.id }).update({ lockKey: null, status: blocked ? "blocked" : "failed", finishedAt: Temporal.Instant.from(new Date(now).toISOString()), error: detail.slice(0, 500), result: { matchId: candidate.id, kind } });
    const retryDelay = kind === "pregame-lineups" ? (blocked ? 24 * 3_600_000 : 10 * 60_000) : (blocked ? 24 : 3) * 3_600_000;
    return { status: blocked ? "blocked" as const : "failed" as const, matchId: candidate.id, nextAt: new Date(Date.now() + retryDelay).toISOString(), error: detail.slice(0, 500) };
  }
}

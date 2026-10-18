import "server-only";

import { Temporal } from "temporal-polyfill";
import { db } from "../../../prisma/db";
import { fixtureRefreshDue } from "../football-data/scheduled-refresh";
import { lineupNeedsBackfill } from "./lineup-coverage";
import { lineupNotPublishedYet, lineupRefreshWindow } from "./lineup-refresh-window";
import { needsBarcelonaPlayerPerformance, playerRatingRefreshDue } from "./rich-data-coverage";
import type { syncRichMatch, syncConfirmedLineups } from "./sync";
import type { persistCanonicalPlayerStatistics } from "./persist-canonical-player-stats";

const GOAL_TYPES = new Set(["goal", "penalty_goal", "own_goal"]);

export function preMatchLineupRefreshDue(last: { status: string; finishedAt: string } | null, now = Date.now()) {
  if (!last) return { due: true, nextAt: null as string | null };
  const delay = last.status === "blocked" ? 24 * 3_600_000 : last.status === "success" ? 20 * 60_000 : 10 * 60_000;
  const next = Date.parse(last.finishedAt) + delay;
  return { due: now >= next, nextAt: new Date(next).toISOString() };
}

/** Refreshes upcoming confirmed lineups and backfills recent finished fixtures, one bounded provider call at a time. */
export async function runScheduledGoalEventRefresh(input: { sync?: typeof syncRichMatch; syncLineups?: typeof syncConfirmedLineups; syncPlayerStats?: typeof persistCanonicalPlayerStatistics; now?: number } = {}) {
  if (!process.env.HIGHLIGHTLY_API_KEY && !process.env.GOAL_API_KEY && !input.sync && !input.syncLineups) return { status: "unconfigured" as const, matchId: null, nextAt: null, error: null };
  const now = input.now ?? Date.now();
  const season = await db.orm.public.Season.where({ isCurrent: true }).first();
  if (!season) return { status: "no-season" as const, matchId: null, nextAt: null, error: null };
  const [matches, events, playerStatistics] = await Promise.all([
    db.orm.public.Match.where({ seasonId: season.id }).include("homeTeam").include("awayTeam").include("competition").orderBy((match) => match.kickoff.asc()).all(),
    db.orm.public.MatchEvent.all(),
    db.orm.public.PlayerMatchStatistic.all(),
  ]);

  let candidate: (typeof matches)[number] | null = null;
  let kind: "events" | "lineups" | "pregame-lineups" | "player-performance" | null = null;

  for (const match of [...matches].reverse()) {
    if ((!match.homeTeam.isBarcelona && !match.awayTeam.isBarcelona) || !lineupRefreshWindow(match.status, match.kickoff.toString(), now)) continue;
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

  for (const match of [...matches].reverse()) {
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
    const barcelonaTeamId = match.homeTeam.isBarcelona ? match.homeTeamId : match.awayTeamId;
    if (needsBarcelonaPlayerPerformance(match.id, barcelonaTeamId, playerStatistics)) {
      candidate = match;
      kind = "player-performance";
      break;
    }
  }
  if (!candidate) return { status: "complete" as const, matchId: null, nextAt: null, error: null };
  if (kind === "events" && !process.env.BBS_API_KEY && !input.sync) return { status: "unconfigured" as const, matchId: candidate.id, nextAt: null, error: "BBS_API_KEY is not configured." };
  if (kind === "player-performance" && !process.env.STATSHAWK_API_KEY && !process.env.BBS_API_KEY && !input.syncPlayerStats) return { status: "unconfigured" as const, matchId: candidate.id, nextAt: null, error: "STATSHAWK_API_KEY or BBS_API_KEY is not configured." };
  const runMode = kind === "pregame-lineups" ? "pregame-lineup-refresh" : kind === "player-performance" ? "player-performance-refresh" : "event-refresh";
  const workerLockKey = kind === "pregame-lineups" ? "scheduled-pregame-lineup-sync" : "scheduled-finished-match-sync";
  {
    const activeLineupRun = await db.orm.public.GoalMediaSyncRun.where({ lockKey: workerLockKey }).first();
    if (activeLineupRun && now - Date.parse(activeLineupRun.startedAt.toString()) < 30 * 60_000) {
      return { status: "already-running" as const, matchId: candidate.id, nextAt: null, error: null };
    }
    if (activeLineupRun) {
      await db.orm.public.GoalMediaSyncRun.where({ id: activeLineupRun.id }).update({ lockKey: null, status: "interrupted", finishedAt: Temporal.Instant.from(new Date(now).toISOString()), error: "Scheduled match-data sync exceeded its 30-minute lease." });
    }
  }
  const latest = await db.orm.public.GoalMediaSyncRun.where({ mode: runMode }).orderBy((run) => run.startedAt.desc()).first();
  const due = kind === "pregame-lineups"
    ? preMatchLineupRefreshDue(latest?.finishedAt ? { status: latest.status, finishedAt: latest.finishedAt.toString() } : null, now)
    : kind === "player-performance"
      ? playerRatingRefreshDue(latest?.finishedAt ? { status: latest.status, finishedAt: latest.finishedAt.toString() } : null, now)
    : fixtureRefreshDue(latest?.finishedAt ? { status: latest.status, finishedAt: latest.finishedAt.toString() } : null, now);
  if (!due.due) return { status: "cooldown" as const, matchId: candidate.id, nextAt: due.nextAt, error: null };
  let run;
  try {
    run = await db.orm.public.GoalMediaSyncRun.create({ lockKey: workerLockKey, mode: runMode, status: "running", startedAt: Temporal.Instant.from(new Date(now).toISOString()) });
  } catch {
    if (await db.orm.public.GoalMediaSyncRun.where({ lockKey: workerLockKey }).first()) {
      return { status: "already-running" as const, matchId: candidate.id, nextAt: null, error: null };
    }
    throw new Error("Could not create the scheduled match-data sync record.");
  }
  try {
    if (kind === "lineups" || kind === "pregame-lineups") {
      const sync = input.syncLineups ?? (await import("./sync")).syncConfirmedLineups;
      await sync({ matchId: candidate.id, dryRun: false });
    } else if (kind === "player-performance") {
      const sync = input.syncPlayerStats ?? (await import("./persist-canonical-player-stats")).persistCanonicalPlayerStatistics;
      await sync({ matchId: candidate.id, dryRun: false });
      const refreshed = await db.orm.public.PlayerMatchStatistic.where({ matchId: candidate.id }).all();
      const barcelonaTeamId = candidate.homeTeam.isBarcelona ? candidate.homeTeamId : candidate.awayTeamId;
      if (needsBarcelonaPlayerPerformance(candidate.id, barcelonaTeamId, refreshed)) {
        throw new Error("The canonical providers have not published Barcelona player performance statistics yet.");
      }
    } else {
      const sync = input.sync ?? (await import("./sync")).syncRichMatch;
      await sync({ matchId: candidate.id, dryRun: false });
    }
    await db.orm.public.GoalMediaSyncRun.where({ id: run.id }).update({ lockKey: null, status: "success", finishedAt: Temporal.Instant.from(new Date(now).toISOString()), result: { matchId: candidate.id, kind } });
    return { status: "success" as const, matchId: candidate.id, nextAt: new Date(Date.now() + (kind === "pregame-lineups" || kind === "player-performance" ? 20 * 60_000 : 6 * 3_600_000)).toISOString(), error: null };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if ((kind === "lineups" || kind === "pregame-lineups") && lineupNotPublishedYet(detail)) {
      const nextAt = new Date(now + 10 * 60_000).toISOString();
      await db.orm.public.GoalMediaSyncRun.where({ id: run.id }).update({
        lockKey: null,
        status: "pending",
        finishedAt: Temporal.Instant.from(new Date(now).toISOString()),
        error: null,
        result: { matchId: candidate.id, kind, reason: "lineup-not-published", detail: detail.slice(0, 500) },
      });
      return { status: "pending" as const, matchId: candidate.id, nextAt, error: null };
    }
    const blocked = /(?:^|\D)(?:403|429)(?:\D|$)/.test(detail);
    await db.orm.public.GoalMediaSyncRun.where({ id: run.id }).update({ lockKey: null, status: blocked ? "blocked" : "failed", finishedAt: Temporal.Instant.from(new Date(now).toISOString()), error: detail.slice(0, 500), result: { matchId: candidate.id, kind } });
    const retryDelay = kind === "pregame-lineups" ? (blocked ? 24 * 3_600_000 : 10 * 60_000) : (blocked ? 24 : 3) * 3_600_000;
    return { status: blocked ? "blocked" as const : "failed" as const, matchId: candidate.id, nextAt: new Date(Date.now() + retryDelay).toISOString(), error: detail.slice(0, 500) };
  }
}

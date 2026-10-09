import "server-only";

import { Temporal } from "temporal-polyfill";
import { db } from "../../../prisma/db";
import { discoverDailyGoalMatches } from "./discovery";
import { coverageComplete, nextGoalRetry, retryDecision, skipCachedPage, sourceBlockedUntil, sourceFailureRetryAt, type GoalCoverage } from "./background-policy";

const GOAL_TYPES = new Set(["goal", "penalty_goal", "own_goal"]);
const LOCK = "dailygoal-goal-media";

function instant(value: string) { return Temporal.Instant.from(value); }
function iso(value: { toString(): string } | null | undefined) { return value?.toString() ?? null; }

export async function runGoalMediaBackgroundWorker(input: { dryRun: boolean; preRoll?: number; now?: number }) {
  const now = input.now ?? Date.now();
  const preRoll = input.preRoll ?? 1;
  if (!Number.isInteger(preRoll) || preRoll < 0 || preRoll > 10) throw new Error("Pre-roll must be 0–10 seconds.");
  const [season, previousRuns] = await Promise.all([
    db.orm.public.Season.where({ isCurrent: true }).first(),
    db.orm.public.GoalMediaSyncRun.where({ mode: "apply" }).orderBy((run) => run.startedAt.desc()).all(),
  ]);
  if (!season) throw new Error("No current season exists.");
  const blockedUntil = previousRuns[0] ? sourceBlockedUntil((previousRuns[0].finishedAt ?? previousRuns[0].startedAt).toString(), previousRuns[0].status, now) : null;
  if (blockedUntil) return { mode: input.dryRun ? "dry-run" : "apply", status: "blocked", blockedUntil, reason: "DailyGoal or video metadata returned 403/429; no source requests were made.", season: season.label };
  const retryAt = previousRuns[0] ? sourceFailureRetryAt((previousRuns[0].finishedAt ?? previousRuns[0].startedAt).toString(), previousRuns[0].status, now) : null;
  if (retryAt) return { mode: input.dryRun ? "dry-run" : "apply", status: "retry-wait", retryAt, reason: "The previous source request failed; no source requests were made during the short recovery cooldown.", season: season.label };

  const [matches, states, pages, events, moments, candidates] = await Promise.all([
    db.orm.public.Match.where({ seasonId: season.id, status: "finished" }).include("homeTeam").include("awayTeam").orderBy((match) => match.kickoff.desc()).all(),
    db.orm.public.GoalMediaSyncState.all(),
    db.orm.public.GoalMediaPageCache.all(),
    db.orm.public.MatchEvent.all(),
    db.orm.public.MediaMoment.include("mediaItem").all(),
    db.orm.public.GoalTimestampCandidate.where({ status: "pending" }).all(),
  ]);
  const barcaMatches = matches.filter((match) => match.homeTeam.isBarcelona || match.awayTeam.isBarcelona);
  const stateByMatch = new Map(states.map((state) => [state.matchId, state]));
  const coverageByMatch = new Map<string, GoalCoverage>();
  const decisions = barcaMatches.map((match) => {
    const goalIds = events.filter((event) => event.matchId === match.id && GOAL_TYPES.has(event.type)).map((event) => event.id);
    const coveredIds = new Set(moments.filter((moment) => goalIds.includes(moment.matchEventId) && moment.mediaItem.isOfficial).map((moment) => moment.matchEventId));
    const coverage = { goalsTotal: goalIds.length, goalsCovered: coveredIds.size,
      reviewPending: candidates.filter((candidate) => candidate.matchId === match.id).length,
      scoreTotal: match.homeScore !== null && match.awayScore !== null ? match.homeScore + match.awayScore : null };
    coverageByMatch.set(match.id, coverage);
    const state = stateByMatch.get(match.id);
    const decision = retryDecision(match.kickoff.toString(), coverage, state ? { status: state.status, attempts: state.attempts, nextRetryAt: iso(state.nextRetryAt), goalsTotal: state.goalsTotal } : null, now);
    return { matchId: match.id, fixture: `${match.homeTeam.name} ${match.homeScore ?? "?"}–${match.awayScore ?? "?"} ${match.awayTeam.name}`,
      kickoff: match.kickoff.toString(), coverage, due: decision.due, reason: decision.reason,
      attempts: state?.attempts ?? 0, nextRetryAt: iso(state?.nextRetryAt), sourceUrl: state?.sourceUrl ?? null };
  });
  const dueIds = new Set(decisions.filter((decision) => decision.due).map((decision) => decision.matchId));
  const skipUrls = new Set(pages.filter((page) => skipCachedPage({ matchId: page.matchId, status: page.status, checkedAt: page.checkedAt.toString() }, dueIds, now)).map((page) => page.url));
  const base = { mode: input.dryRun ? "dry-run" : "apply", season: season.label, policy: { recentDays: 14, maxAttempts: 8, maxMatchPages: 12, sourceCooldownHours: 24 },
    fixtures: decisions.filter((decision) => decision.due || decision.reason === "covered").slice(0, 24), due: dueIds.size, alreadyCovered: decisions.filter((decision) => decision.reason === "covered").length };
  if (input.dryRun) {
    const discovery = dueIds.size ? await discoverDailyGoalMatches({ mode: "preview", preRoll, eligibleMatchIds: dueIds, skipUrls }) : null;
    return { ...base, status: "preview", discovery };
  }

  const active = await db.orm.public.GoalMediaSyncRun.where({ lockKey: LOCK }).first();
  if (active && now - Date.parse(active.startedAt.toString()) > 30 * 60_000) {
    await db.orm.public.GoalMediaSyncRun.where({ id: active.id }).update({ lockKey: null, status: "interrupted", finishedAt: instant(new Date(now).toISOString()), error: "An incomplete run exceeded the 30-minute lease." });
  } else if (active) throw new Error("A goal-media background run is already in progress.");
  const run = await db.orm.public.GoalMediaSyncRun.create({ lockKey: LOCK, mode: "apply", status: "running", startedAt: instant(new Date(now).toISOString()) });
  try {
    const discovery = dueIds.size ? await discoverDailyGoalMatches({ mode: "apply", preRoll, eligibleMatchIds: dueIds, skipUrls }) : null;
    const stopped = discovery?.stopped ?? false;
    const finishedAt = new Date(now).toISOString();
    const inspectedByMatch = new Map(discovery?.results.filter((item) => item.matchId).map((item) => [item.matchId!, item]) ?? []);
    if (!stopped) {
      for (const page of discovery?.results ?? []) {
        await db.orm.public.GoalMediaPageCache.upsert({ create: { url: page.url, matchId: page.matchId, status: page.status, reason: page.reason.slice(0, 500), checkedAt: instant(finishedAt) },
          update: { matchId: page.matchId, status: page.status, reason: page.reason.slice(0, 500), checkedAt: instant(finishedAt) }, conflictOn: { url: page.url } });
      }
      const refreshedMoments = await db.orm.public.MediaMoment.include("mediaItem").all();
      const refreshedCandidates = await db.orm.public.GoalTimestampCandidate.where({ status: "pending" }).all();
      for (const decision of decisions) {
        const initial = coverageByMatch.get(decision.matchId)!;
        if (!decision.due && !coverageComplete(initial)) continue;
        const goalIds = events.filter((event) => event.matchId === decision.matchId && GOAL_TYPES.has(event.type)).map((event) => event.id);
        const covered = new Set(refreshedMoments.filter((moment) => goalIds.includes(moment.matchEventId) && moment.mediaItem.isOfficial).map((moment) => moment.matchEventId)).size;
        const pending = refreshedCandidates.filter((candidate) => candidate.matchId === decision.matchId).length;
        const coverage = { ...initial, goalsCovered: covered, reviewPending: pending };
        const previous = stateByMatch.get(decision.matchId);
        const result = inspectedByMatch.get(decision.matchId);
        const countedAttempt = decision.due && (Boolean(result) || (discovery?.uninspected ?? 0) === 0);
        const attempts = (previous?.attempts ?? 0) + (countedAttempt ? 1 : 0);
        const complete = coverageComplete(coverage);
        const exhausted = !complete && attempts >= 8;
        const values = { status: complete ? "complete" : exhausted ? pending ? "review" : "exhausted" : "pending", attempts,
          lastCheckedAt: decision.due ? instant(finishedAt) : previous?.lastCheckedAt ?? null,
          nextRetryAt: complete || exhausted ? null : decision.due ? instant(nextGoalRetry(Math.max(1, attempts), now)!) : previous?.nextRetryAt ?? null,
          sourceUrl: result?.url ?? previous?.sourceUrl ?? null, lastVideoId: result?.videoId ?? previous?.lastVideoId ?? null,
          goalsTotal: coverage.goalsTotal, goalsCovered: coverage.goalsCovered, reviewPending: pending,
          lastError: result?.status === "unavailable" ? result.reason.slice(0, 500) : null };
        if (previous) await db.orm.public.GoalMediaSyncState.where({ id: previous.id }).update(values);
        else await db.orm.public.GoalMediaSyncState.create({ matchId: decision.matchId, ...values });
      }
    }
    const status = stopped ? "blocked" : discovery?.totals.unavailable ? "partial" : "success";
    const summary = { ...base, status, discovery, fixturesChecked: discovery?.inspected ?? 0,
      goalsPublished: discovery?.totals.published ?? 0, goalsQueued: discovery?.totals.queued ?? 0,
      missingCoverage: discovery?.missingCoverage.length ?? 0,
      blockedUntil: stopped ? new Date(now + 24 * 3_600_000).toISOString() : null };
    await db.orm.public.GoalMediaSyncRun.where({ id: run.id }).update({ lockKey: null, status, finishedAt: instant(finishedAt),
      fixturesChecked: summary.fixturesChecked, goalsPublished: summary.goalsPublished, goalsQueued: summary.goalsQueued,
      missingCoverage: summary.missingCoverage, error: stopped ? "Provider returned 403/429; stopped for 24 hours." : null,
      result: { due: base.due, listed: discovery?.listed ?? 0, inspected: discovery?.inspected ?? 0, unavailable: discovery?.totals.unavailable ?? 0 } });
    if (summary.goalsPublished || summary.goalsQueued || status !== "success") console.info("GOAL MEDIA WORKER", { status, checked: summary.fixturesChecked, published: summary.goalsPublished, review: summary.goalsQueued });
    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown goal-media worker failure.";
    const blocked = /403|429|importing stopped/i.test(message);
    await db.orm.public.GoalMediaSyncRun.where({ id: run.id }).update({ lockKey: null, status: blocked ? "blocked" : "failed", finishedAt: instant(new Date(now).toISOString()), error: message.slice(0, 500) });
    throw error;
  }
}

export const GOAL_MEDIA_LOOKBACK_DAYS = 14;
export const GOAL_MEDIA_MAX_ATTEMPTS = 8;
// Eight checks span almost the full fourteen-day discovery window.
export const GOAL_MEDIA_RETRY_HOURS = [3, 6, 12, 24, 48, 72, 144] as const;
export const GOAL_MEDIA_SOURCE_COOLDOWN_HOURS = 24;
export const GOAL_MEDIA_FAILURE_COOLDOWN_MINUTES = 15;

export type GoalCoverage = {
  goalsTotal: number;
  goalsCovered: number;
  reviewPending: number;
  scoreTotal: number | null;
};

export type GoalRetryState = {
  status: string;
  attempts: number;
  nextRetryAt: string | null;
  goalsTotal: number;
};

export function coverageComplete(coverage: GoalCoverage): boolean {
  if (coverage.goalsTotal > 0) return coverage.goalsCovered === coverage.goalsTotal;
  return coverage.scoreTotal === 0;
}

export function retryDecision(kickoff: string, coverage: GoalCoverage, state: GoalRetryState | null, now = Date.now()) {
  if (coverageComplete(coverage)) return { due: false, reason: "covered" as const };
  if (coverage.scoreTotal !== null && coverage.goalsTotal < coverage.scoreTotal) return { due: false, reason: "awaiting-events" as const };
  const age = now - Date.parse(kickoff);
  if (!Number.isFinite(age) || age < 0) return { due: false, reason: "not-finished" as const };
  if (age > GOAL_MEDIA_LOOKBACK_DAYS * 86_400_000) return { due: false, reason: "outside-window" as const };
  if (state && state.attempts >= GOAL_MEDIA_MAX_ATTEMPTS) return { due: false, reason: "attempts-exhausted" as const };
  if (state?.nextRetryAt && now < Date.parse(state.nextRetryAt)) return { due: false, reason: "backoff" as const };
  return { due: true, reason: "due" as const };
}

export function nextGoalRetry(attempts: number, now = Date.now()): string | null {
  if (attempts >= GOAL_MEDIA_MAX_ATTEMPTS) return null;
  const hours = GOAL_MEDIA_RETRY_HOURS[Math.max(0, Math.min(attempts - 1, GOAL_MEDIA_RETRY_HOURS.length - 1))];
  return new Date(now + hours * 3_600_000).toISOString();
}

export function sourceBlockedUntil(startedAt: string, status: string, now = Date.now()): string | null {
  if (status !== "blocked") return null;
  const until = Date.parse(startedAt) + GOAL_MEDIA_SOURCE_COOLDOWN_HOURS * 3_600_000;
  return now < until ? new Date(until).toISOString() : null;
}

/** A failed listing request must not be retried on every scheduler tick. */
export function sourceFailureRetryAt(finishedAt: string, status: string, now = Date.now()): string | null {
  if (status !== "failed") return null;
  const until = Date.parse(finishedAt) + GOAL_MEDIA_FAILURE_COOLDOWN_MINUTES * 60_000;
  return Number.isFinite(until) && now < until ? new Date(until).toISOString() : null;
}

/** Cache old/unrelated pages, but always revisit a page belonging to a due fixture. */
export function skipCachedPage(cache: { matchId: string | null; status: string; checkedAt: string }, dueIds: ReadonlySet<string>, now = Date.now()): boolean {
  if (cache.matchId && dueIds.has(cache.matchId)) return false;
  const ttl = cache.matchId ? 14 * 86_400_000 : cache.status === "rejected" ? 6 * 3_600_000 : 3_600_000;
  return now - Date.parse(cache.checkedAt) < ttl;
}

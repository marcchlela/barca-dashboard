import test from "node:test";
import assert from "node:assert/strict";
import { coverageComplete, nextGoalRetry, retryDecision, skipCachedPage, sourceBlockedUntil, sourceFailureRetryAt } from "../src/lib/providers/dailygoal/background-policy.ts";

const kickoff = "2026-10-08T18:00:00Z";
const now = Date.parse("2026-10-08T21:00:00Z");
const missing = { goalsTotal: 2, goalsCovered: 0, reviewPending: 0, scoreTotal: 2 };

test("newly finished fixtures are due, while published goals and scoreless games are complete", () => {
  assert.equal(retryDecision(kickoff, missing, null, now).due, true);
  assert.equal(coverageComplete({ ...missing, goalsCovered: 2 }), true);
  assert.equal(retryDecision(kickoff, { ...missing, goalsCovered: 2 }, null, now).reason, "covered");
  assert.equal(coverageComplete({ goalsTotal: 0, goalsCovered: 0, reviewPending: 0, scoreTotal: 0 }), true);
  assert.equal(coverageComplete({ goalsTotal: 0, goalsCovered: 0, reviewPending: 0, scoreTotal: 3 }), false);
  assert.equal(retryDecision(kickoff, { goalsTotal: 0, goalsCovered: 0, reviewPending: 0, scoreTotal: 3 }, null, now).reason, "awaiting-events");
});

test("missing video retries with bounded exponential backoff and recovers when published", () => {
  const first = { status: "pending", attempts: 1, goalsTotal: 2, nextRetryAt: nextGoalRetry(1, now) };
  assert.equal(retryDecision(kickoff, missing, first, now + 30 * 60_000).reason, "backoff");
  assert.equal(retryDecision(kickoff, missing, first, now + 2 * 3_600_000).reason, "backoff");
  assert.equal(retryDecision(kickoff, missing, first, now + 3 * 3_600_000 + 60_000).due, true);
  assert.equal(nextGoalRetry(2, now), new Date(now + 6 * 3_600_000).toISOString());
  assert.equal(nextGoalRetry(8, now), null);
  assert.equal(retryDecision(kickoff, missing, { ...first, attempts: 8 }, now + 13 * 86_400_000).reason, "attempts-exhausted");
  assert.equal([3, 6, 12, 24, 48, 72, 144].reduce((sum, hours) => sum + hours, 0), 309);
  assert.equal(retryDecision(kickoff, missing, null, now + 15 * 86_400_000).reason, "outside-window");
  assert.equal(retryDecision(kickoff, { ...missing, goalsCovered: 2 }, first, now).reason, "covered");
});

test("page cache avoids duplicate scans but revisits a due match and expires negative entries", () => {
  const page = { matchId: "barca", status: "matched", checkedAt: new Date(now - 3_600_000).toISOString() };
  assert.equal(skipCachedPage(page, new Set(), now), true);
  assert.equal(skipCachedPage(page, new Set(["barca"]), now), false);
  const rejected = { matchId: null, status: "rejected", checkedAt: new Date(now - 7 * 3_600_000).toISOString() };
  assert.equal(skipCachedPage(rejected, new Set(), now), false);
});

test("provider 403/429 stops source requests for 24 hours before recovery", () => {
  const started = new Date(now).toISOString();
  assert.equal(sourceBlockedUntil(started, "blocked", now + 2 * 3_600_000), new Date(now + 24 * 3_600_000).toISOString());
  assert.equal(sourceBlockedUntil(started, "blocked", now + 25 * 3_600_000), null);
  assert.equal(sourceBlockedUntil(started, "success", now), null);
});

test("temporary listing failures wait 15 minutes before another request", () => {
  const finished = new Date(now).toISOString();
  assert.equal(sourceFailureRetryAt(finished, "failed", now + 60_000), new Date(now + 15 * 60_000).toISOString());
  assert.equal(sourceFailureRetryAt(finished, "failed", now + 15 * 60_000), null);
  assert.equal(sourceFailureRetryAt(finished, "success", now), null);
});

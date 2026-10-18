import test from "node:test";
import assert from "node:assert/strict";
import {
  liveFixtureMatches,
  finishedCoverageIncomplete,
  liveRetryDelayMs,
  normalizeLiveEvents,
  normalizeLiveSubstitutions,
  normalizeLiveStatus,
  normalizeLivePeriod,
  postMatchPollDelayMs,
  shouldFetchLiveStatistics,
  liveStatisticsAreCoherent,
} from "../src/lib/providers/goal-api/live-refresh-core.ts";
import { liveEventSemanticKey, liveEventsLikelySame } from "../src/lib/providers/shared/live-event-identity.ts";

test("live event adapter extracts goals, assists, own goals and cards from public fixture event data", () => {
  const events = normalizeLiveEvents({ data: [
    { id: "g1", type: "goal", time: { elapsed: 12 }, team: { name: "FC Barcelona" }, player: { id: "p1", name: "Lamine Yamal" }, assist: "Pedri" },
    { id: "g2", type: "Own Goal", minute: 33, team: { name: "Sevilla FC" }, player: { id: "p2", name: "Sergio Ramos" } },
    { id: "g3", type: "Penalty Goal", minute: 56, homeScorer: "Robert Lewandowski" },
    { id: "c1", type: "Yellow Card", minute: 61, team: { name: "Sevilla FC" }, player: { name: "Player B" } },
    { id: "c2", type: "Red Card", minute: 87, team: { name: "FC Barcelona" }, player: { name: "Player C" } },
    { id: "unknown", type: "Foul", minute: 77 },
  ] }, "FC Barcelona", "Sevilla FC");
  assert.deepEqual(events.map(({ type }) => type), ["goal", "own_goal", "penalty_goal", "yellow_card", "red_card"]);
  assert.equal(events[0].assistName, "Pedri");
  assert.equal(events[0].scorerName, "Lamine Yamal");
  assert.equal(events[1].side, "away");
  assert.equal(events[2].side, "home");
});

test("the separate cards feed resolves the correct side and player without a lineup", () => {
  const cards = normalizeLiveEvents({ data: [
    { id: "card-home", card: "yellow card", timeNum: 64, homeFault: "R. Leao", homePlayerId: "3613754290" },
    { id: "card-away", card: "red card", timeNum: 86, awayFault: "Player B", awayPlayerId: "123" },
  ] }, "Galatasaray SK", "FC Barcelona");
  assert.deepEqual(cards.map(({ type, side, scorerName, minute }) => ({ type, side, scorerName, minute })), [
    { type: "yellow_card", side: "home", scorerName: "R. Leao", minute: 64 },
    { type: "red_card", side: "away", scorerName: "Player B", minute: 86 },
  ]);
});

test("the separate substitutions feed preserves off/on order and rejects ambiguous rows", () => {
  const substitutions = normalizeLiveSubstitutions({ data: [
    { id: "s1", team: "home", timeNum: 58, substitution: "M. Lemina | L. Ugochukwu", substitutionPlayerId: "870571787 | 2725297698" },
    { id: "s2", team: "away", timeNum: 71, substitution: "Gavi | Pedri" },
    { id: "bad", team: "unknown", timeNum: 72, substitution: "A | B" },
  ] });
  assert.deepEqual(substitutions.map(({ type, side, minute, scorerName, assistName }) => ({ type, side, minute, scorerName, assistName })), [
    { type: "substitution", side: "home", minute: 58, scorerName: "M. Lemina", assistName: "L. Ugochukwu" },
    { type: "substitution", side: "away", minute: 71, scorerName: "Gavi", assistName: "Pedri" },
  ]);
});

test("fixture matching requires both teams, exact kickoff proximity and the competition", () => {
  const canonical = { kickoff: "2026-10-13T19:00:00Z", home: "Galatasaray", away: "FC Barcelona", competition: "UEFA Champions League" };
  const provider = { kickoff: "2026-10-13T19:05:00Z", home: "Galatasaray", away: "Barcelona", competition: "Champions League" };
  assert.equal(liveFixtureMatches({ canonical, provider }), true);
  assert.equal(liveFixtureMatches({ canonical, provider: { ...provider, home: "Real Madrid" } }), false);
  assert.equal(liveFixtureMatches({ canonical, provider: { ...provider, kickoff: "2026-10-14T19:00:00Z" } }), false);
  assert.equal(liveFixtureMatches({ canonical, provider: { ...provider, competition: "La Liga" } }), false);
  assert.equal(liveFixtureMatches({ canonical, provider: { ...provider, kickoff: null } }), false);
  assert.equal(liveFixtureMatches({ canonical: { ...canonical, home: "Galatasaray SK" }, provider }), true);
});

test("provider status and five-minute stats interval are normalized", () => {
  assert.equal(normalizeLiveStatus({ status: "1H" }), "live");
  assert.equal(normalizeLiveStatus({ status: "HT" }), "halftime");
  assert.equal(normalizeLiveStatus({ status: "FT" }), "finished");
  assert.equal(normalizeLiveStatus({ matchStatus: "67", matchPeriod: "SECOND_HALF" }), "live");
  assert.equal(normalizeLivePeriod({ statusShort: "1H" }), 1);
  assert.equal(normalizeLivePeriod({ matchPeriod: "SECOND_HALF" }), 2);
  assert.equal(normalizeLivePeriod({ status: "HT" }), null);
  assert.equal(shouldFetchLiveStatistics(null, 300_000), true);
  assert.equal(shouldFetchLiveStatistics(new Date(0).toISOString(), 299_999), false);
  assert.equal(shouldFetchLiveStatistics(new Date(0).toISOString(), 300_000), true);
});

test("explicit penalty and overturned-goal events are not mistaken for new goals", () => {
  const events = normalizeLiveEvents({ data: [
    { id: "p1", type: "Penalty Awarded", minute: 23, team: { name: "FC Barcelona" } },
    { id: "p2", type: "Missed Penalty", minute: 24, team: { name: "FC Barcelona" }, player: { name: "Lamine Yamal" } },
    { id: "v1", type: "Goal Disallowed by VAR", minute: 67, team: { name: "Sevilla FC" } },
    { id: "p3", type: "Penalty Goal", minute: 80, team: { name: "FC Barcelona" }, player: { name: "Pedri" } },
  ] }, "FC Barcelona", "Sevilla FC");
  assert.deepEqual(events.map((event) => event.type), ["penalty_awarded", "missed_penalty", "var_overturned", "penalty_goal"]);
});

test("provider failures back off; 403 and 429 pause polling safely", () => {
  assert.equal(liveRetryDelayMs({ status: "failed", consecutiveFailures: 1, error: "timeout" }), 60_000);
  assert.equal(liveRetryDelayMs({ status: "failed", consecutiveFailures: 4, error: "timeout" }), 8 * 60_000);
  assert.equal(liveRetryDelayMs({ status: "blocked", consecutiveFailures: 4, error: "HTTP 429" }), 15 * 60_000);
  assert.equal(liveRetryDelayMs({ status: "blocked", consecutiveFailures: 4, error: "HTTP 403" }), 24 * 60 * 60_000);
});

test("recent finished matches reconcile delayed cards and substitutions, then retry missing goals or statistics only", () => {
  const kickoff = "2026-10-13T19:00:00Z";
  const input = { kickoff, now: Date.parse("2026-10-13T23:00:00Z"), homeScore: 1, awayScore: 4, goalCount: 0, statisticSides: 0 };
  assert.equal(finishedCoverageIncomplete(input), true);
  assert.equal(finishedCoverageIncomplete({ ...input, goalCount: 5, statisticSides: 1 }), true);
  assert.equal(finishedCoverageIncomplete({ ...input, goalCount: 5, statisticSides: 2 }), true);
  assert.equal(finishedCoverageIncomplete({ ...input, now: Date.parse("2026-10-14T10:00:00Z"), goalCount: 5, statisticSides: 2 }), false);
  assert.equal(finishedCoverageIncomplete({ ...input, now: Date.parse("2026-10-15T00:00:00Z") }), false);
});

test("post-match catch-up is spaced out to protect the free provider quota", () => {
  const kickoff = "2026-10-13T19:00:00Z";
  assert.equal(postMatchPollDelayMs("live", kickoff, Date.parse("2026-10-13T20:00:00Z")), 0);
  assert.equal(postMatchPollDelayMs("finished", kickoff, Date.parse("2026-10-13T21:00:00Z")), 30 * 60_000);
  assert.equal(postMatchPollDelayMs("scheduled", kickoff, Date.parse("2026-10-13T23:01:00Z")), 30 * 60_000);
});

test("live event identity deduplicates provider IDs while preserving distinct real events", () => {
  const base = { type: "yellow_card", teamId: "barca", minute: 52, primaryName: "Lamine Yamal" };
  assert.equal(liveEventSemanticKey(base), liveEventSemanticKey({ ...base, primaryName: "Lámine Yamal" }));
  assert.notEqual(liveEventSemanticKey(base), liveEventSemanticKey({ ...base, minute: 53 }));
});

test("minute corrections collapse repeated events without merging distinct goals", () => {
  const card = { type: "red_card", teamId: "betis", minute: 54, primaryName: "F. Bernal" };
  assert.equal(liveEventsLikelySame(card, { ...card, minute: 57 }), true);
  const yellow = { type: "yellow_card", teamId: "barca", minute: 55, primaryName: "Lamine Yamal" };
  assert.equal(liveEventsLikelySame(yellow, { ...yellow, minute: 57 }), true);
  const substitution = { type: "substitution", teamId: "barca", minute: 62, primaryName: "Fermin", relatedName: "D. Olmo" };
  assert.equal(liveEventsLikelySame(substitution, { ...substitution, minute: 64 }), true);
  const goal = { type: "goal", teamId: "barca", minute: 62, primaryName: "E. Garcia", score: "2-4" };
  assert.equal(liveEventsLikelySame(goal, { ...goal, minute: 63 }), true);
  assert.equal(liveEventsLikelySame(goal, { ...goal, minute: 63, score: "2-5" }), false);
  assert.equal(liveEventsLikelySame({ ...goal, score: null }, { ...goal, minute: 63, score: null }), false);
});

test("impossible statistic snapshots are rejected instead of replacing coherent values", () => {
  assert.equal(liveStatisticsAreCoherent({ shots: 0, shotsOnTarget: 1, passes: 10, completedPasses: 8 }), false);
  assert.equal(liveStatisticsAreCoherent({ shots: 4, shotsOnTarget: 2, passes: 10, completedPasses: 11 }), false);
  assert.equal(liveStatisticsAreCoherent({ shots: 4, shotsOnTarget: 2, passes: 10, completedPasses: 8 }), true);
});

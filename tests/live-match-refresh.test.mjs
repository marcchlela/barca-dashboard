import test from "node:test";
import assert from "node:assert/strict";
import {
  liveFixtureMatches,
  liveRetryDelayMs,
  normalizeLiveEvents,
  normalizeLiveStatus,
  shouldFetchLiveStatistics,
} from "../src/lib/providers/goal-api/live-refresh-core.ts";

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

test("fixture matching requires both teams, exact kickoff proximity and the competition", () => {
  const canonical = { kickoff: "2026-10-13T19:00:00Z", home: "Galatasaray", away: "FC Barcelona", competition: "UEFA Champions League" };
  const provider = { kickoff: "2026-10-13T19:05:00Z", home: "Galatasaray", away: "Barcelona", competition: "Champions League" };
  assert.equal(liveFixtureMatches({ canonical, provider }), true);
  assert.equal(liveFixtureMatches({ canonical, provider: { ...provider, home: "Real Madrid" } }), false);
  assert.equal(liveFixtureMatches({ canonical, provider: { ...provider, kickoff: "2026-10-14T19:00:00Z" } }), false);
  assert.equal(liveFixtureMatches({ canonical, provider: { ...provider, competition: "La Liga" } }), false);
  assert.equal(liveFixtureMatches({ canonical, provider: { ...provider, kickoff: null } }), false);
});

test("provider status and five-minute stats interval are normalized", () => {
  assert.equal(normalizeLiveStatus({ status: "1H" }), "live");
  assert.equal(normalizeLiveStatus({ status: "HT" }), "halftime");
  assert.equal(normalizeLiveStatus({ status: "FT" }), "finished");
  assert.equal(normalizeLiveStatus({ matchStatus: "67", matchPeriod: "SECOND_HALF" }), "live");
  assert.equal(shouldFetchLiveStatistics(null, 300_000), true);
  assert.equal(shouldFetchLiveStatistics(new Date(0).toISOString(), 299_999), false);
  assert.equal(shouldFetchLiveStatistics(new Date(0).toISOString(), 300_000), true);
});

test("provider failures back off; 403 and 429 pause polling safely", () => {
  assert.equal(liveRetryDelayMs({ status: "failed", consecutiveFailures: 1, error: "timeout" }), 60_000);
  assert.equal(liveRetryDelayMs({ status: "failed", consecutiveFailures: 4, error: "timeout" }), 8 * 60_000);
  assert.equal(liveRetryDelayMs({ status: "blocked", consecutiveFailures: 4, error: "HTTP 429" }), 15 * 60_000);
  assert.equal(liveRetryDelayMs({ status: "blocked", consecutiveFailures: 4, error: "HTTP 403" }), 24 * 60 * 60_000);
});

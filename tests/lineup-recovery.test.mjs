import test from "node:test";
import assert from "node:assert/strict";
import { goalFixtureListingPath } from "../src/lib/providers/goal-api/fixture-search-path.ts";
import { lineupNeedsBackfill } from "../src/lib/providers/rich-match/lineup-coverage.ts";

test("known Barça leagues use a bounded provider-side league filter", () => {
  assert.equal(goalFixtureListingPath("Primera Division", "2026-09-13", 0),
    "/fixtures/date/2026-09-13?leagueId=cmr77dvnt006nrx063v3w622e&limit=100&offset=0");
  assert.equal(goalFixtureListingPath("UEFA Champions League", "2026-09-09", 100),
    "/fixtures/date/2026-09-09?leagueId=cmr77dw3900f5rx06j05wgzv4&limit=100&offset=100");
  assert.equal(goalFixtureListingPath("Other Cup", "2026-09-09", 0),
    "/fixtures?from=2026-09-09&to=2026-09-09&limit=100&offset=0");
});

test("lineup recovery selects only missing sides and protects completed sides", () => {
  const complete = { teamId: "home", isConfirmed: true,
    players: Array.from({ length: 11 }, () => ({ role: "starter" })) };
  assert.deepEqual(lineupNeedsBackfill("home", "away", [complete]),
    { home: "complete", away: "missing" });
  assert.deepEqual(lineupNeedsBackfill("home", "away", [complete, { ...complete, teamId: "away" }]),
    { home: "complete", away: "complete" });
  assert.deepEqual(lineupNeedsBackfill("home", "away", [{ ...complete, isConfirmed: false }]),
    { home: "partial", away: "missing" });
  assert.deepEqual(lineupNeedsBackfill("home", "away", [{ ...complete, players: complete.players.slice(0, 10) }]),
    { home: "partial", away: "missing" });
});

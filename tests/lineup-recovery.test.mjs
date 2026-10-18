import test from "node:test";
import assert from "node:assert/strict";
import { goalFixtureListingPath } from "../src/lib/providers/goal-api/fixture-search-path.ts";
import { lineupNeedsBackfill } from "../src/lib/providers/rich-match/lineup-coverage.ts";
import { lineupNotPublishedYet, lineupRefreshWindow } from "../src/lib/providers/rich-match/lineup-refresh-window.ts";
import { needsBarcelonaPlayerPerformance, needsBarcelonaPlayerRatings, playerRatingRefreshDue } from "../src/lib/providers/rich-match/rich-data-coverage.ts";
import { resolveMatchIdentity } from "../src/lib/providers/shared/match-identity.ts";

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

test("missing confirmed lineups remain retryable from pre-match through the live window", () => {
  const kickoff = "2026-10-13T19:00:00Z";
  const at = (iso) => Date.parse(iso);
  assert.equal(lineupRefreshWindow("scheduled", kickoff, at("2026-10-13T17:00:00Z")), true);
  assert.equal(lineupRefreshWindow("scheduled", kickoff, at("2026-10-13T19:30:00Z")), true);
  assert.equal(lineupRefreshWindow("halftime", kickoff, at("2026-10-13T20:00:00Z")), true);
  assert.equal(lineupRefreshWindow("live", kickoff, at("2026-10-13T20:45:00Z")), true);
  assert.equal(lineupRefreshWindow("finished", kickoff, at("2026-10-13T21:00:00Z")), false);
  assert.equal(lineupRefreshWindow("scheduled", kickoff, at("2026-10-14T00:00:00Z")), false);
});

test("an unpublished or incomplete provider lineup is pending rather than a worker failure", () => {
  assert.equal(lineupNotPublishedYet("GOAL returned 0 home starters; expected 11."), true);
  assert.equal(lineupNotPublishedYet("GOAL returned 7 away starters; expected 11."), true);
  assert.equal(lineupNotPublishedYet("Highlightly returned 0 home starters; expected 11."), true);
  assert.equal(lineupNotPublishedYet("GOAL did not supply exactly 11 starters for both sides."), true);
  assert.equal(lineupNotPublishedYet("GOAL request failed with 429."), false);
});

test("GOAL's Galatasaray name resolves to the canonical SK fixture without relying on a live score", () => {
  const identity = resolveMatchIdentity({
    kickoff: "2026-10-13T19:00:00Z", competition: { name: "UEFA Champions League" },
    homeTeam: { name: "Galatasaray SK" }, awayTeam: { name: "FC Barcelona" },
    score: { home: null, away: null }, providerIds: {},
  }, {
    providerMatchId: "cmtyc05y5p62alc07oclfffo3", kickoff: "2026-10-13T19:00:00Z",
    calendarDate: "2026-10-13", localTime: null, temporalPrecision: "exact",
    homeTeam: "Galatasaray", awayTeam: "Barcelona", homeScore: 1, awayScore: 4,
    competition: "UEFA Champions League",
  });
  assert.equal(identity.matched, true);
  assert.equal(identity.criteria.homeTeamMethod, "known_alias");
});

test("post-match rich data remains retryable until a Barcelona rating is stored", () => {
  const rows = [
    { matchId: "match", teamId: "barca", rating: null },
    { matchId: "match", teamId: "opponent", rating: 7.2 },
    { matchId: "other", teamId: "barca", rating: 8.1 },
  ];
  assert.equal(needsBarcelonaPlayerRatings("match", "barca", rows), true);
  assert.equal(needsBarcelonaPlayerRatings("match", "barca", [...rows, { matchId: "match", teamId: "barca", rating: 7.8 }]), false);
});

test("a provider box score completes player performance even when ratings are unavailable", () => {
  const empty = [{ matchId: "match", teamId: "barca", rating: null }];
  assert.equal(needsBarcelonaPlayerPerformance("match", "barca", empty), true);
  assert.equal(needsBarcelonaPlayerPerformance("match", "barca", [
    ...empty,
    { matchId: "match", teamId: "barca", rating: null, minutes: 90, goals: 0, assists: 0 },
  ]), false);
  assert.equal(needsBarcelonaPlayerPerformance("match", "barca", [
    { matchId: "match", teamId: "opponent", rating: 8.2, minutes: 90 },
  ]), true);
});

test("rating publication retries are bounded and respect provider blocks", () => {
  const finishedAt = "2026-10-13T22:00:00Z";
  assert.equal(playerRatingRefreshDue(null, Date.parse(finishedAt)).due, true);
  assert.equal(playerRatingRefreshDue({ status: "success", finishedAt }, Date.parse("2026-10-13T22:19:59Z")).due, false);
  assert.equal(playerRatingRefreshDue({ status: "success", finishedAt }, Date.parse("2026-10-13T22:20:00Z")).due, true);
  assert.equal(playerRatingRefreshDue({ status: "failed", finishedAt }, Date.parse("2026-10-14T00:59:59Z")).due, false);
  assert.equal(playerRatingRefreshDue({ status: "blocked", finishedAt }, Date.parse("2026-10-14T21:59:59Z")).due, false);
});

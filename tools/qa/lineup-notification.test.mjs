import test from "node:test";
import assert from "node:assert/strict";
import { extractOfficialStartingEleven } from "../../src/lib/providers/official-barca/lineup-core.ts";
import { lineupNeedsBackfill } from "../../src/lib/providers/rich-match/lineup-coverage.ts";
import { lineupNotPublishedYet } from "../../src/lib/providers/rich-match/lineup-refresh-window.ts";
import { confirmedLineupNotificationDue } from "../../src/lib/notifications/policy.ts";
import { formatNotificationKickoffTime, validNotificationTimeZone } from "../../src/lib/notifications/catalog.ts";

const starters = "Joan García, Cancelo, Balde, Pau Cubarsí, Gavi, Fermín, Pedri, Gabriel Jesus, Lamine Yamal, Raphinha, Rodri";

test("official article confirms only eleven distinct, affirmative starters", () => {
  assert.equal(extractOfficialStartingEleven(`Barça starting XI: ${starters}`).length, 11);
  assert.deepEqual(extractOfficialStartingEleven(`Predicted Barça starting XI: ${starters}`), []);
  assert.deepEqual(extractOfficialStartingEleven(`Barça starting XI: ${starters.replace("Rodri", "Raphinha")}`), []);
  assert.deepEqual(extractOfficialStartingEleven("The squad for Barça includes 23 players."), []);
});

test("one confirmed Barça side is enough to send once before kickoff", () => {
  const coverage = lineupNeedsBackfill("barca", "madrid", [
    { teamId: "barca", isConfirmed: true, players: Array.from({ length: 11 }, () => ({ role: "starter" })) },
  ]);
  assert.deepEqual(coverage, { home: "complete", away: "missing" });
  const kickoff = "2026-10-25T20:00:00Z";
  assert.equal(confirmedLineupNotificationDue({ previousLineup: false, currentLineup: true, status: "scheduled", kickoff, now: Date.parse(kickoff) - 3600000 }), true);
  assert.equal(confirmedLineupNotificationDue({ previousLineup: true, currentLineup: true, status: "scheduled", kickoff, now: Date.parse(kickoff) - 3600000 }), false);
  assert.equal(confirmedLineupNotificationDue({ previousLineup: false, currentLineup: true, status: "finished", kickoff, now: Date.parse(kickoff) + 3600000 }), false);
});

test("an unpublished official XI remains pending, while a rate limit is an error", () => {
  assert.equal(lineupNotPublishedYet("FC Barcelona: no explicitly confirmed starting XI published for this fixture."), true);
  assert.equal(lineupNotPublishedYet("Highlightly request failed (429); FC Barcelona: no explicitly confirmed starting XI published"), false);
});

test("kickoff time follows the subscriber's IANA timezone", () => {
  const kickoff = "2026-10-25T20:00:00Z";
  assert.equal(validNotificationTimeZone("Asia/Beirut"), true);
  assert.equal(validNotificationTimeZone("Mars/Olympus"), false);
  assert.equal(formatNotificationKickoffTime(kickoff, "Asia/Beirut"), "10:00 PM");
  assert.equal(formatNotificationKickoffTime(kickoff, "America/New_York"), "4:00 PM");
});

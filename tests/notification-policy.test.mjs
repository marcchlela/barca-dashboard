import assert from "node:assert/strict";
import test from "node:test";
import { confirmedLineupNotificationDue } from "../src/lib/notifications/policy.ts";

const kickoff = "2026-10-17T16:30:00.000Z";

test("confirmed lineups notify only before kickoff", () => {
  assert.equal(confirmedLineupNotificationDue({
    previousLineup: false,
    currentLineup: true,
    status: "scheduled",
    kickoff,
    now: Date.parse("2026-10-17T16:00:00.000Z"),
  }), true);

  assert.equal(confirmedLineupNotificationDue({
    previousLineup: false,
    currentLineup: true,
    status: "scheduled",
    kickoff,
    now: Date.parse(kickoff),
  }), false);

  assert.equal(confirmedLineupNotificationDue({
    previousLineup: false,
    currentLineup: true,
    status: "finished",
    kickoff,
    now: Date.parse("2026-10-17T18:30:00.000Z"),
  }), false);
});

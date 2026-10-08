import test from "node:test";
import assert from "node:assert/strict";
import { resolveWatchedAt, validWatchedOn } from "./watch-date.ts";

const base = { watched: true, watchType: "replay", previousWatchType: null, kickoff: "2026-10-05T23:30:00Z", existingWatchedAt: null, watchedOn: undefined, now: "2026-10-08T12:00:00Z" };

test("live always follows fixture kickoff, even when logged later", () => {
  assert.equal(resolveWatchedAt({ ...base, watchType: "live", watchedOn: "2026-10-08" }), base.kickoff);
});
test("replay and highlights default to first save date and accept edits", () => {
  assert.equal(resolveWatchedAt(base), base.now);
  assert.equal(resolveWatchedAt({ ...base, watchType: "highlights_only", watchedOn: "2026-10-07" }), "2026-10-07T12:00:00Z");
  assert.equal(resolveWatchedAt({ ...base, previousWatchType: "replay", existingWatchedAt: "2026-10-06T20:00:00Z", watchedOn: "2026-10-06" }), "2026-10-06T20:00:00Z");
  assert.equal(resolveWatchedAt({ ...base, previousWatchType: "replay", existingWatchedAt: "2026-10-06T20:00:00Z", watchedOn: "2026-10-09" }), "2026-10-09T12:00:00Z");
});
test("unwatch clears date; legacy replay without date stays unknown until supplied", () => {
  assert.equal(resolveWatchedAt({ ...base, watched: false }), null);
  assert.equal(resolveWatchedAt({ ...base, previousWatchType: "replay", watchedOn: null }), null);
});
test("date validation rejects impossible dates", () => {
  assert.equal(validWatchedOn("2026-02-29"), false);
  assert.equal(validWatchedOn("2026-10-05"), true);
  assert.equal(validWatchedOn("2026-1-05"), false);
});

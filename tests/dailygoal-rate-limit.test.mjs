import test from "node:test";
import assert from "node:assert/strict";
import { discoverBarcelonaMatchLinks } from "../src/lib/providers/dailygoal/adapter.ts";

test("a public 429 stops further requests and permits recovery only after the cooldown", async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  let clock = Date.parse("2026-10-09T00:00:00Z");
  let calls = 0;
  try {
    Date.now = () => clock;
    globalThis.fetch = async () => {
      calls++;
      return calls === 1
        ? new Response("", { status: 429, headers: { "Retry-After": "30" } })
        : new Response("<html></html>", { status: 200, headers: { "Content-Type": "text/html" } });
    };
    await assert.rejects(discoverBarcelonaMatchLinks(), /429/);
    await assert.rejects(discoverBarcelonaMatchLinks(), /cooldown/);
    assert.equal(calls, 1);
    clock += 25 * 3_600_000;
    assert.deepEqual(await discoverBarcelonaMatchLinks(), []);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});

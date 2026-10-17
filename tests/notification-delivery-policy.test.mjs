import test from "node:test";
import assert from "node:assert/strict";
import { allowedPushEndpoint, shouldRetryDelivery } from "../src/lib/notifications/delivery-policy.ts";

test("push endpoint validation accepts known browser services, not arbitrary hosts", () => {
  assert.equal(allowedPushEndpoint("https://web.push.apple.com/abc"), true);
  assert.equal(allowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc"), true);
  assert.equal(allowedPushEndpoint("https://example.com/fcm/send/abc"), false);
  assert.equal(allowedPushEndpoint("http://web.push.apple.com/abc"), false);
  assert.equal(allowedPushEndpoint("https://web.push.apple.com.evil.example/abc"), false);
});

test("temporary push failures retry after fifteen minutes, at most three attempts", () => {
  const now = Date.now();
  const input = { status: "failed", errorCode: "429:1", lastAttempt: now - 16 * 60_000, now };
  assert.equal(shouldRetryDelivery(input), true);
  assert.equal(shouldRetryDelivery({ ...input, lastAttempt: now - 14 * 60_000 }), false);
  assert.equal(shouldRetryDelivery({ ...input, errorCode: "503:2" }), true);
  assert.equal(shouldRetryDelivery({ ...input, errorCode: "503:3" }), false);
  assert.equal(shouldRetryDelivery({ ...input, errorCode: "410:1" }), false);
  assert.equal(shouldRetryDelivery({ ...input, status: "accepted" }), false);
});

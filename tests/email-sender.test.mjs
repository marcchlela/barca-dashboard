import test from "node:test";
import assert from "node:assert/strict";
import { parseDashboardMailFrom } from "../src/lib/email/sender.ts";

test("accepts plain sender addresses and branded display-name addresses", () => {
  assert.deepEqual(parseDashboardMailFrom("demo.test.sender@gmail.com"), {
    address: "demo.test.sender@gmail.com",
  });
  assert.deepEqual(parseDashboardMailFrom('Barça Dashboard <demo.test.sender@gmail.com>'), {
    name: "Barça Dashboard",
    address: "demo.test.sender@gmail.com",
  });
  assert.deepEqual(parseDashboardMailFrom('"Barça Dashboard" <demo.test.sender@gmail.com>'), {
    name: "Barça Dashboard",
    address: "demo.test.sender@gmail.com",
  });
});

test("rejects malformed sender values and header-injection attempts", () => {
  assert.equal(parseDashboardMailFrom("Barça Dashboard <not-an-email>"), null);
  assert.equal(parseDashboardMailFrom("<demo.test.sender@gmail.com>"), null);
  assert.equal(parseDashboardMailFrom("Barça Dashboard\r\nBcc: attacker@example.com <demo.test.sender@gmail.com>"), null);
  assert.equal(parseDashboardMailFrom(`Name <${"a".repeat(255)}@example.com>`), null);
});

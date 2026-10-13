import test from "node:test";
import assert from "node:assert/strict";
import { adminExecutionEnabled, productionAdminEditingEnabled } from "../src/lib/admin/write-policy.ts";

test("production admin editing is opt-in and requires the exact enabled value", () => {
  assert.equal(productionAdminEditingEnabled(undefined), false);
  assert.equal(productionAdminEditingEnabled(""), false);
  assert.equal(productionAdminEditingEnabled("true"), false);
  assert.equal(productionAdminEditingEnabled("0"), false);
  assert.equal(productionAdminEditingEnabled("1"), true);
});

test("admin execution is available outside production and opt-in within production", () => {
  assert.equal(adminExecutionEnabled("development", undefined), true);
  assert.equal(adminExecutionEnabled("test", "0"), true);
  assert.equal(adminExecutionEnabled("production", undefined), false);
  assert.equal(adminExecutionEnabled("production", "0"), false);
  assert.equal(adminExecutionEnabled("production", "1"), true);
});

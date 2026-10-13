import test from "node:test";
import assert from "node:assert/strict";
import { productionAdminEditingEnabled } from "../src/lib/admin/write-policy.ts";

test("production admin editing is opt-in and requires the exact enabled value", () => {
  assert.equal(productionAdminEditingEnabled(undefined), false);
  assert.equal(productionAdminEditingEnabled(""), false);
  assert.equal(productionAdminEditingEnabled("true"), false);
  assert.equal(productionAdminEditingEnabled("0"), false);
  assert.equal(productionAdminEditingEnabled("1"), true);
});

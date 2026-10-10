import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { TABLES, SNAPSHOT_VERSION } from "../tools/data-compare/catalog.mjs";
import { executeTransfer } from "../tools/data-compare/apply-core.mjs";
import { buildTransferPlan } from "../tools/data-compare/transfer-plan-core.mjs";

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const seasons = Array.from({ length: 128 }, (_, i) => {
  const year = 1899 + i;
  return { id: id(i + 1), label: `${year}/${String((year + 1) % 100).padStart(2, "0")}`,
    startYear: year, endYear: year + 1, isCurrent: year === 2026 };
});
function envelope(environment, seasonRows) {
  const snapshot = { version: SNAPSHOT_VERSION, environment, generatedAt: "2026-10-09T14:00:00.000Z",
    schema: TABLES.flatMap((table) => (table === "season" ? ["id", "label", "startYear", "endYear", "isCurrent"] : ["id"])
      .map((column) => ({ table, column, type: column === "id" ? "uuid" : "text", udt: column === "id" ? "uuid" : "text", nullable: "NO" }))),
    rows: Object.fromEntries(TABLES.map((table) => [table, table === "season" ? seasonRows : []])), assets: { status: "not_scanned", files: [] } };
  return { snapshot, sha256: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex") };
}
function fakeClient(production, manifest, failFirstWrite = false) {
  const rows = structuredClone(production.snapshot.rows);
  const history = [];
  let index = 0;
  return { rows, history, async query(sql) {
    history.push(sql);
    if (sql.startsWith("SELECT pg_try_advisory")) return { rows: [{ acquired: true }] };
    if (sql.includes("FROM information_schema.columns")) return { rows: production.snapshot.schema };
    if (sql.startsWith("SELECT * FROM")) {
      const table = sql.match(/FROM "([a-z_]+)"/)?.[1];
      return { rows: structuredClone(rows[table]).sort((a, b) => a.id.localeCompare(b.id)) };
    }
    if (sql.startsWith("INSERT INTO") || sql.startsWith("UPDATE")) {
      if (failFirstWrite) throw new Error("simulated database write failure");
      const operation = manifest.operations[index++];
      if (operation.action === "insert") rows[operation.table].push(structuredClone(operation.values));
      else Object.assign(rows[operation.table].find((row) => row.id === operation.targetId), structuredClone(operation.changes));
      return { rows: [{ id: operation.targetId }] };
    }
    return { rows: [] };
  } };
}

test("transaction runner applies approved rows, then repeats as a no-op", async () => {
  const local = envelope("local", seasons), production = envelope("production", [{ ...seasons[127], id: id(500) }]);
  const manifest = buildTransferPlan(local, production).manifest;
  assert.equal(manifest.counts.inserts, 127);
  const client = fakeClient(production, manifest);
  const first = await executeTransfer(client, manifest, production.snapshot);
  assert.equal(first.status, "applied");
  assert.equal(client.rows.season.length, 128);
  const writes = client.history.filter((sql) => sql.startsWith("INSERT INTO")).length;
  const second = await executeTransfer(client, manifest, production.snapshot);
  assert.equal(second.status, "already_applied");
  assert.equal(client.history.filter((sql) => sql.startsWith("INSERT INTO")).length, writes);
});

test("a database write failure rolls the transaction back", async () => {
  const local = envelope("local", seasons), production = envelope("production", [{ ...seasons[127], id: id(500) }]);
  const manifest = buildTransferPlan(local, production).manifest;
  const client = fakeClient(production, manifest, true);
  await assert.rejects(executeTransfer(client, manifest, production.snapshot), /simulated database write failure/);
  assert.ok(client.history.includes("ROLLBACK"));
  assert.ok(!client.history.includes("COMMIT"));
});

test("stale production rows stop before any write", async () => {
  const local = envelope("local", seasons), production = envelope("production", [{ ...seasons[127], id: id(500) }]);
  const manifest = buildTransferPlan(local, production).manifest;
  const client = fakeClient(production, manifest);
  client.rows.season[0].visualKey = "changed-after-snapshot";
  await assert.rejects(executeTransfer(client, manifest, production.snapshot), /Production changed since preview/);
  assert.equal(client.history.filter((sql) => sql.startsWith("INSERT INTO")).length, 0);
  assert.ok(client.history.includes("ROLLBACK"));
});

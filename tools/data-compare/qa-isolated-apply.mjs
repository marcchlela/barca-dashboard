/** End-to-end transfer rehearsal in a disposable, loopback-only PostgreSQL database. */
import "dotenv/config";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { TABLES, SNAPSHOT_VERSION } from "./catalog.mjs";
import { validateSnapshot } from "./compare-core.mjs";
import { executeTransfer } from "./apply-core.mjs";
import { buildTransferPlan, domainDigest, EXCLUDED_OPERATIONAL, TRANSFER_ORDER } from "./transfer-plan-core.mjs";

const at = process.argv.indexOf("--local");
const productionAt = process.argv.indexOf("--production");
if (at < 0 || !process.argv[at + 1] || ![4, 6].includes(process.argv.length) ||
  (process.argv.length === 6 && (productionAt < 0 || !process.argv[productionAt + 1]))) {
  throw new Error("Usage: node qa-isolated-apply.mjs --local <private-local-snapshot.json> [--production <private-production-snapshot.json>]");
}
const local = JSON.parse(await readFile(path.resolve(process.argv[at + 1]), "utf8"));
const check = validateSnapshot(local);
if (check.errors.length || check.broken.length || check.relationshipIssues.length || local.snapshot.environment !== "local") {
  throw new Error("Local snapshot failed validation.");
}
const suppliedProduction = productionAt < 0 ? null : JSON.parse(await readFile(path.resolve(process.argv[productionAt + 1]), "utf8"));
if (suppliedProduction) {
  const report = validateSnapshot(suppliedProduction);
  if (report.errors.length || report.broken.length || report.relationshipIssues.length || suppliedProduction.snapshot.environment !== "production") {
    throw new Error("Production snapshot failed validation.");
  }
}
const baseUrl = new URL(process.env.DATABASE_URL ?? "");
if (!["localhost", "127.0.0.1", "[::1]"].includes(baseUrl.hostname) || !baseUrl.pathname || baseUrl.pathname === "/") {
  throw new Error("Disposable QA requires a named loopback PostgreSQL connection.");
}
const qaName = `barca_transfer_qa_${randomBytes(8).toString("hex")}`;
const qaUrl = new URL(baseUrl);
qaUrl.pathname = `/${qaName}`;
const administrator = new pg.Client({ connectionString: baseUrl.toString() });
const isolated = new pg.Client({ connectionString: qaUrl.toString() });
let created = false;
let connected = false;
try {
  await administrator.connect();
  await administrator.query(`CREATE DATABASE "${qaName}"`);
  created = true;
  execFileSync(process.execPath, [path.join(process.cwd(), "node_modules", "prisma", "dist", "prisma.js"), "db", "migrate", "--yes"], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: qaUrl.toString() }, stdio: "pipe", timeout: 120_000,
  });
  await isolated.connect();
  connected = true;
  const schema = (await isolated.query(`SELECT table_name AS "table", column_name AS "column", data_type AS "type", udt_name AS "udt", is_nullable AS "nullable"
    FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`)).rows;
  const snapshot = { version: SNAPSHOT_VERSION, environment: "production", generatedAt: new Date().toISOString(),
    scope: "all application rows", schema, rows: Object.fromEntries(TABLES.map((table) => [table, []])),
    assets: { status: "not_scanned", files: [] } };
  const target = suppliedProduction ?? { snapshot, sha256: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex") };
  if (suppliedProduction) {
    for (const table of [...TRANSFER_ORDER, ...EXCLUDED_OPERATIONAL]) {
      const jsonColumns = new Set(schema.filter((column) => column.table === table && ["json", "jsonb"].includes(column.udt)).map((column) => column.column));
      for (const row of suppliedProduction.snapshot.rows[table]) {
        const fields = Object.keys(row);
        const values = fields.map((field) => jsonColumns.has(field) && row[field] != null ? JSON.stringify(row[field]) : row[field]);
        const quoted = fields.map((field) => `"${field}"`).join(", ");
        const slots = fields.map((_, index) => `$${index + 1}`).join(", ");
        await isolated.query(`INSERT INTO "${table}" (${quoted}) VALUES (${slots})`, values);
      }
    }
  }
  const plan = buildTransferPlan(local, target);
  assert.deepEqual(plan.errors, []);
  const inserts = plan.manifest.operations.filter((operation) => operation.action === "insert");
  assert.ok(inserts.length >= 2);
  const deliberatelyInvalid = structuredClone(plan.manifest);
  const secondInsert = deliberatelyInvalid.operations.find((operation) => operation.action === "insert" && operation.targetId === inserts[1].targetId);
  secondInsert.values.id = inserts[0].values.id;
  delete deliberatelyInvalid.sha256;
  deliberatelyInvalid.sha256 = createHash("sha256").update(JSON.stringify(deliberatelyInvalid)).digest("hex");
  await assert.rejects(executeTransfer(isolated, deliberatelyInvalid, target.snapshot));
  const afterFailed = {};
  for (const table of TRANSFER_ORDER) afterFailed[table] = JSON.parse(JSON.stringify((await isolated.query(`SELECT * FROM "${table}" ORDER BY id`)).rows));
  assert.equal(domainDigest({ rows: afterFailed }), domainDigest(target.snapshot), "failed transfer must roll back every table");
  const first = await executeTransfer(isolated, plan.manifest, target.snapshot);
  assert.equal(first.status, "applied");
  const second = await executeTransfer(isolated, plan.manifest, target.snapshot);
  assert.equal(second.status, "already_applied");
  for (const table of EXCLUDED_OPERATIONAL) {
    const count = Number((await isolated.query(`SELECT count(*)::int AS count FROM "${table}"`)).rows[0].count);
    assert.equal(count, target.snapshot.rows[table].length, `${table} should remain environment-local`);
  }
  const counts = {};
  for (const table of ["match_event", "lineup", "lineup_player", "media_item", "media_moment", "favourite_match", "match_diary_entry"]) {
    counts[table] = Number((await isolated.query(`SELECT count(*)::int AS count FROM "${table}"`)).rows[0].count);
  }
  console.log(JSON.stringify({ disposableDatabase: qaName, first: first.status, second: second.status,
    seededFromPrivateProductionSnapshot: Boolean(suppliedProduction), inserts: first.inserts, updates: first.updates,
    blocked: first.blocked, counts, productionTouched: false }, null, 2));
} finally {
  if (connected) await isolated.end().catch(() => {});
  if (created) {
    if (!/^barca_transfer_qa_[0-9a-f]{16}$/.test(qaName)) throw new Error("Unsafe disposable database name; cleanup stopped.");
    await administrator.query(`DROP DATABASE "${qaName}" WITH (FORCE)`);
  }
  await administrator.end().catch(() => {});
}

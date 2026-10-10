import "dotenv/config";
import pg from "pg";
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { TABLES, CATEGORIES } from "./catalog.mjs";
import { TRANSFER_ORDER, buildTransferPlan } from "./transfer-plan-core.mjs";
import { compareSnapshots, validateSnapshot } from "./compare-core.mjs";
import { executeVerifiedAccountTransfer as executeAccountTransfer } from "./account-transfer-verified.mjs";

const sourceFile = ".artifacts/data-compare/local-20261010-171405.json";
const productionFile = ".artifacts/data-compare/production-20261010.json";
const candidateFile = ".artifacts/data-compare/combined-account-transfer-candidate.json";

const load = async file =>
  JSON.parse(await readFile(path.resolve(file), "utf8"));

const [local, production, candidate] = await Promise.all(
  [sourceFile, productionFile, candidateFile].map(load)
);

const hash = value => createHash("sha256")
  .update(JSON.stringify(value)).digest("hex");

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const assertSnapshot = envelope => {
  const result = validateSnapshot(envelope);
  assert.equal(result.errors.length, 0);
  assert.equal(result.broken.length, 0);
  assert.equal(result.relationshipIssues.length, 0);
};

assertSnapshot(local);
assertSnapshot(production);

const localOwner = "84864dc9-11fd-4f3b-bbfd-e52016e0384b";
const productionOwner = "49adb054-2071-4565-9169-247e0b092e7d";

assert.equal(candidate.ownerMapping.local, localOwner);
assert.equal(candidate.ownerMapping.production, productionOwner);
assert.equal(candidate.localSnapshotSha256, local.sha256);
assert.equal(candidate.productionSnapshotSha256, production.sha256);

const { sha256, ...body } = candidate;
assert.equal(hash(body), sha256);

const excluded = new Set([
  ...CATEGORIES["Personal archive"],
  ...CATEGORIES["Operational state"]
]);

function sharedOnly(envelope) {
  const snapshot = structuredClone(envelope.snapshot);
  for (const table of excluded) snapshot.rows[table] = [];
  delete snapshot.authIsolation;
  delete snapshot.ownerAccounts;
  return { snapshot, sha256: hash(snapshot) };
}

// Independently regenerate and verify every shared operation.
const rebuilt = buildTransferPlan(
  sharedOnly(local),
  sharedOnly(production)
);

assert.deepEqual(rebuilt.errors, []);
assert.ok(same(rebuilt.manifest.operations, candidate.sharedOperations));
assert.ok(same(rebuilt.manifest.blocked, candidate.blocked));

const comparison = compareSnapshots(local, production, {
  localOwnerId: localOwner,
  productionOwnerId: productionOwner
});

assert.deepEqual(comparison.errors, []);
assert.deepEqual(comparison.schemaDiff, []);

for (const table of ["favourite_player", "favourite_match", "media_save"]) {
  for (const op of candidate.personalInserts.filter(x => x.table === table)) {
    const source = local.snapshot.rows[table].find(x => x.id === op.localId);
    assert.ok(source);
    assert.equal(source.userId, localOwner);
    assert.equal(op.values.userId, productionOwner);

    const expected = structuredClone(source);
    expected.userId = productionOwner;

    // Verify every field except foreign keys, which are checked against
    // the independently rebuilt shared identity mapping.
    const { REFERENCES } = await import("./catalog.mjs");
    for (const [field, target] of Object.entries(REFERENCES[table] ?? {})) {
      if (expected[field] != null) {
        expected[field] = rebuilt.mapping[target].get(expected[field]);
      }
    }
    assert.ok(same(expected, op.values));
  }
}

assert.equal(candidate.personalInserts.length, 4);
assert.equal(comparison.tables.match_diary_entry.common.length, 6);
assert.equal(comparison.tables.match_diary_entry.different.length, 2);

console.log("Candidate integrity: PASS");
console.log("Independent shared plan: PASS");
console.log("Personal ownership and FK mapping: PASS");

const baseUrl = new URL(process.env.DATABASE_URL ?? "");
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(baseUrl.hostname),
  "DATABASE_URL must point to Windows loopback PostgreSQL."
);
assert.ok(baseUrl.pathname.length > 1);

const qaName = "barca_account_qa_" + randomBytes(8).toString("hex");
const qaUrl = new URL(baseUrl);
qaUrl.pathname = "/" + qaName;

const admin = new pg.Client({ connectionString: baseUrl.toString() });
const qa = new pg.Client({ connectionString: qaUrl.toString() });

const quote = name => {
  assert.match(name, /^[A-Za-z][A-Za-z0-9_]*$/);
  return `"${name}"`;
};

let created = false;
let connected = false;

async function readRows(client) {
  const result = {};
  for (const table of TABLES) {
    result[table] = JSON.parse(JSON.stringify(
      (await client.query(`SELECT * FROM ${quote(table)} ORDER BY id`)).rows
    ));
  }
  return result;
}

async function insertRow(client, table, row, schema) {
  const columns = new Map(
    schema.filter(x => x.table === table).map(x => [x.column, x])
  );
  const fields = Object.keys(row);
  const values = fields.map(field => {
    const value = row[field];
    return value != null && ["json", "jsonb"].includes(columns.get(field)?.udt)
      ? JSON.stringify(value)
      : value;
  });

  await client.query(
    `INSERT INTO ${quote(table)} (${fields.map(quote).join(", ")})
     VALUES (${fields.map((_, i) => "$" + (i + 1)).join(", ")})`,
    values
  );
}

try {
  await admin.connect();

  await admin.query(`CREATE DATABASE ${quote(qaName)}`);
  created = true;

  console.log("Disposable database created:", qaName);

  execFileSync(
    process.execPath,
    [
      path.join(process.cwd(), "node_modules", "prisma", "dist", "prisma.js"),
      "db", "migrate", "--yes"
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: qaUrl.toString() },
      stdio: "pipe",
      timeout: 180000
    }
  );

  await qa.connect();
  connected = true;

  // Seed a temporary account using the local account's database shape.
  // Credentials are never printed and this account exists only in QA.
  const sourceAccount = (
    await admin.query('SELECT * FROM app_user WHERE id = $1', [localOwner])
  ).rows[0];

  assert.ok(sourceAccount, "Local source account missing.");

  const accountColumns = await qa.query(`
    SELECT column_name, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_user'
    ORDER BY ordinal_position
  `);

  const temporaryAccount = { ...sourceAccount };
  temporaryAccount.id = productionOwner;

  if ("username" in temporaryAccount) temporaryAccount.username = "chlelaaa";
  if ("email" in temporaryAccount) {
    temporaryAccount.email = "qa-" + qaName + "@example.invalid";
  }

  const allowed = new Set(accountColumns.rows.map(x => x.column_name));
  for (const key of Object.keys(temporaryAccount)) {
    if (!allowed.has(key)) delete temporaryAccount[key];
  }

  const accountSchema = accountColumns.rows.map(x => ({
    table: "app_user",
    column: x.column_name,
    udt: x.udt_name
  }));

  await insertRow(qa, "app_user", temporaryAccount, accountSchema);

  // Seed shared production data in FK parent-first order.
  for (const table of TRANSFER_ORDER) {
    if (CATEGORIES["Personal archive"].includes(table)) continue;
    for (const row of production.snapshot.rows[table]) {
      await insertRow(qa, table, row, production.snapshot.schema);
    }
  }

  // Seed the already-claimed production diary and other personal rows.
  for (const table of CATEGORIES["Personal archive"]) {
    for (const row of production.snapshot.rows[table]) {
      await insertRow(qa, table, row, production.snapshot.schema);
    }
  }

  // Seed operational data last; the importer must not alter it.
  for (const table of CATEGORIES["Operational state"]) {
    for (const row of production.snapshot.rows[table]) {
      await insertRow(qa, table, row, production.snapshot.schema);
    }
  }

  const baseline = await readRows(qa);

  for (const table of TABLES) {
    assert.ok(
      same(baseline[table], production.snapshot.rows[table]),
      `Seed verification failed: ${table}`
    );
  }

  console.log("Production snapshot seeded and verified: PASS");

  // Deliberately corrupt the final personal insert's ID.
  // This should fail after earlier SQL operations and roll back all writes.
  const bad = structuredClone(candidate);
  bad.personalInserts.at(-1).values.id =
    "00000000-0000-4000-8000-000000000001";
  delete bad.sha256;
  bad.sha256 = hash(bad);

  await assert.rejects(
    executeAccountTransfer(qa, bad, local, production)
  );

  const afterFailure = await readRows(qa);

  for (const table of TABLES) {
    assert.ok(
      same(afterFailure[table], baseline[table]),
      `ROLLBACK FAILED: ${table}`
    );
  }

  console.log("Deliberately invalid transfer rolled back: PASS");

  const result = await executeAccountTransfer(
    qa, candidate, local, production
  );

  assert.equal(result.status, "applied");

  const after = await readRows(qa);

  const expectedInserts = new Map();
  const updates = new Map();

  for (const op of [...candidate.sharedOperations, ...candidate.personalInserts]) {
    const key = op.table;
    if (op.action === "insert") {
      expectedInserts.set(key, (expectedInserts.get(key) ?? 0) + 1);
    } else {
      updates.set(key, (updates.get(key) ?? 0) + 1);
    }
  }

  for (const table of TABLES) {
    assert.equal(
      after[table].length,
      baseline[table].length + (expectedInserts.get(table) ?? 0),
      `Wrong final count: ${table}`
    );

    const touched = new Set(
      [...candidate.sharedOperations, ...candidate.personalInserts]
        .filter(op => op.table === table)
        .map(op => op.targetId)
    );

    for (const old of baseline[table]) {
      if (touched.has(old.id)) continue;
      const current = after[table].find(row => row.id === old.id);
      assert.ok(
        same(old, current),
        `Protected production row changed: ${table}/${old.id}`
      );
    }
  }

  assert.ok(
    same(baseline.match_diary_entry, after.match_diary_entry),
    "Diary records changed."
  );

  const ownerCounts = {};
  for (const table of CATEGORIES["Personal archive"]) {
    ownerCounts[table] = after[table]
      .filter(row => row.userId === productionOwner).length;
  }

  assert.equal(ownerCounts.favourite_player, 1);
  assert.equal(ownerCounts.favourite_match, 2);
  assert.equal(ownerCounts.match_diary_entry, 8);
  assert.equal(ownerCounts.media_save, 1);

  console.log("\nACCOUNT-AWARE TRANSFER REHEARSAL");
  console.log("--------------------------------");
  console.log(JSON.stringify({
    status: "PASS",
    disposableDatabase: qaName,
    inserts: result.inserts,
    updates: result.updates,
    blocked: result.blocked,
    protectedDiaryEntries: 8,
    finalPersonalCounts: ownerCounts,
    allUntouchedRowsPreserved: true,
    rollbackVerified: true,
    originalWindowsDatabaseTouched: false,
    ubuntuProductionTouched: false
  }, null, 2));

} finally {
  if (connected) await qa.end().catch(() => {});

  if (created) {
    assert.match(qaName, /^barca_account_qa_[0-9a-f]{16}$/);
    await admin.query(
      `DROP DATABASE ${quote(qaName)} WITH (FORCE)`
    );
    console.log("Disposable database deleted.");
  }

  await admin.end().catch(() => {});
}

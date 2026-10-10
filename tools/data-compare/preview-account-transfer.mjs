import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { validateSnapshot, compareSnapshots } from "./compare-core.mjs";
import { CATEGORIES } from "./catalog.mjs";

const args = process.argv.slice(2);
const get = (name) => {
  const index = args.indexOf(name);
  return index < 0 ? null : args[index + 1];
};

const localPath = get("--local");
const productionPath = get("--production");
const ownerId = get("--production-owner-id");
const out = get("--out");

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

if (!localPath || !productionPath || !uuid.test(ownerId ?? "")) {
  throw new Error("Required: --local FILE --production FILE --production-owner-id UUID");
}

if (out && !/^[a-z0-9][a-z0-9_.-]{0,100}\.json$/i.test(out)) {
  throw new Error("Invalid output filename.");
}

const [local, production] = await Promise.all(
  [localPath, productionPath].map(async (filename) =>
    JSON.parse(await readFile(path.resolve(filename), "utf8"))
  )
);

for (const [name, envelope] of [
  ["local", local],
  ["production", production],
]) {
  const result = validateSnapshot(envelope);
  if (result.errors.length || result.broken.length || result.relationshipIssues.length) {
    throw new Error(`${name} snapshot failed validation: ${JSON.stringify(result)}`);
  }
}

if (!local.snapshot.authIsolation || !production.snapshot.authIsolation) {
  throw new Error("Both databases must have account-era snapshots.");
}

const account = production.snapshot.ownerAccounts.find(
  (item) => item.id === ownerId
);

if (!account) {
  throw new Error("Selected production account does not exist in snapshot.");
}

const comparison = compareSnapshots(local, production);

if (comparison.errors.length || comparison.schemaDiff.length) {
  throw new Error("Snapshots cannot be compared safely.");
}

const personalTables = new Set(CATEGORIES["Personal archive"]);

const tables = {};

for (const [table, result] of Object.entries(comparison.tables)) {
  const sourceRows = local.snapshot.rows[table];
  const targetRows = production.snapshot.rows[table];

  tables[table] = {
    scope: personalTables.has(table) ? "personal" : "shared-or-operational",
    localCount: sourceRows.length,
    productionCount: targetRows.length,
    common: result.common.length,
    different: result.different.length,
    onlyLocal: result.onlyLocal.length,
    onlyProduction: result.onlyProduction.length,
    ambiguous: result.ambiguous.length,
    localUnclaimed: personalTables.has(table)
      ? sourceRows.filter((row) => row.userId == null).length
      : null,
    productionSelectedOwner: personalTables.has(table)
      ? targetRows.filter((row) => row.userId === ownerId).length
      : null,
    productionOtherOwners: personalTables.has(table)
      ? targetRows.filter((row) => row.userId && row.userId !== ownerId).length
      : null,
  };
}

const body = {
  kind: "BARCA_ACCOUNT_TRANSFER_REVIEW_V1",
  executable: false,
  productionWriteAuthorized: false,
  generatedAt: new Date().toISOString(),
  localSnapshotSha256: local.sha256,
  productionSnapshotSha256: production.sha256,
  productionOwnerId: ownerId,
  productionUsername: account.username,
  tables,
  warnings: [
    "This is a read-only review, not an import manifest.",
    "Personal ownership must be explicitly approved.",
    "Operational tables must remain environment-local.",
    "Authentication tables are excluded.",
    "Conflicting and ambiguous identities require separate resolution.",
  ],
};

const sha256 = createHash("sha256")
  .update(JSON.stringify(body))
  .digest("hex");

const report = { ...body, sha256 };

console.log(JSON.stringify({
  kind: report.kind,
  executable: report.executable,
  productionUsername: report.productionUsername,
  tables: report.tables,
}, null, 2));

if (out) {
  const directory = path.resolve(".artifacts/data-compare");
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, out),
    JSON.stringify(report, null, 2) + "\n",
    { flag: "wx", mode: 0o600 }
  );
  console.log(`Private review written: ${out}`);
}

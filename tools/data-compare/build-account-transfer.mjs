import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { validateSnapshot, compareSnapshots } from "./compare-core.mjs";
import { buildTransferPlan } from "./transfer-plan-core.mjs";
import { CATEGORIES, REFERENCES } from "./catalog.mjs";

const LOCAL_OWNER = "84864dc9-11fd-4f3b-bbfd-e52016e0384b";
const PRODUCTION_OWNER = "49adb054-2071-4565-9169-247e0b092e7d";

const args = process.argv.slice(2);
const arg = (flag) => {
  const i = args.indexOf(flag);
  return i < 0 ? null : args[i + 1];
};

const localFile = arg("--local");
const productionFile = arg("--production");

if (!localFile || !productionFile) {
  throw new Error("Required: --local FILE --production FILE");
}

const [local, production] = await Promise.all(
  [localFile, productionFile].map(async (file) =>
    JSON.parse(await readFile(path.resolve(file), "utf8"))
  )
);

for (const [label, envelope] of [
  ["local", local],
  ["production", production],
]) {
  const check = validateSnapshot(envelope);

  if (
    check.errors.length ||
    check.broken.length ||
    check.relationshipIssues.length ||
    !envelope.snapshot.authIsolation ||
    envelope.snapshot.environment !== label
  ) {
    throw new Error(`${label} account-era snapshot failed validation.`);
  }
}

if (!local.snapshot.ownerAccounts.some(a => a.id === LOCAL_OWNER)) {
  throw new Error("Local owner missing.");
}

if (!production.snapshot.ownerAccounts.some(a => a.id === PRODUCTION_OWNER)) {
  throw new Error("Production owner missing.");
}

const excluded = new Set([
  ...CATEGORIES["Personal archive"],
  ...CATEGORIES["Operational state"],
]);

function sharedEnvelope(envelope) {
  const snapshot = structuredClone(envelope.snapshot);

  for (const table of excluded) snapshot.rows[table] = [];

  delete snapshot.authIsolation;
  delete snapshot.ownerAccounts;

  return {
    snapshot,
    sha256: createHash("sha256")
      .update(JSON.stringify(snapshot))
      .digest("hex"),
  };
}

const shared = buildTransferPlan(
  sharedEnvelope(local),
  sharedEnvelope(production)
);

if (shared.errors.length) {
  throw new Error(shared.errors.join("\n"));
}

const comparison = compareSnapshots(local, production, {
  localOwnerId: LOCAL_OWNER,
  productionOwnerId: PRODUCTION_OWNER,
});

if (comparison.errors.length || comparison.schemaDiff.length) {
  throw new Error("Account comparison failed.");
}

const personalTables = [
  "favourite_player",
  "favourite_match",
  "media_save",
];

const personalInserts = [];

for (const table of personalTables) {
  const localRows = local.snapshot.rows[table]
    .filter(row => row.userId === LOCAL_OWNER);

  const productionRows = production.snapshot.rows[table];

  const expected = comparison.tables[table];

  if (
    expected.ambiguous.length ||
    expected.different.length ||
    expected.onlyProduction.length ||
    expected.common.length ||
    expected.onlyLocal.length !== localRows.length
  ) {
    throw new Error(`Unexpected personal identity state: ${table}`);
  }

  for (const row of localRows) {
    const values = structuredClone(row);
    values.userId = PRODUCTION_OWNER;

    for (const [field, targetTable] of Object.entries(REFERENCES[table] ?? {})) {
      if (values[field] == null) continue;

      const mapped = shared.mapping[targetTable]?.get(values[field]);

      if (!mapped) {
        throw new Error(
          `Unresolved personal reference: ${table}/${row.id}/${field}`
        );
      }

      values[field] = mapped;
    }

    if (productionRows.some(item => item.id === values.id)) {
      throw new Error(`Personal UUID collision: ${table}/${values.id}`);
    }

    personalInserts.push({
      action: "insert",
      table,
      localId: row.id,
      targetId: row.id,
      values,
    });
  }
}

const diary = comparison.tables.match_diary_entry;

if (
  diary.common.length !== 6 ||
  diary.different.length !== 2 ||
  diary.onlyLocal.length ||
  diary.onlyProduction.length ||
  diary.ambiguous.length
) {
  throw new Error("Diary reconciliation differs from reviewed expectations.");
}

const body = {
  kind: "BARCA_ACCOUNT_TRANSFER_CANDIDATE_V1",
  executable: false,
  productionWriteAuthorized: false,
  generatedAt: new Date().toISOString(),
  localSnapshotSha256: local.sha256,
  productionSnapshotSha256: production.sha256,
  ownerMapping: {
    local: LOCAL_OWNER,
    production: PRODUCTION_OWNER,
  },
  sharedOperations: shared.manifest.operations,
  personalInserts,
  blocked: shared.manifest.blocked,
  protectedProduction: {
    contested: shared.manifest.contestedProductionRows,
    productionOnly: shared.manifest.preservedProductionOnly,
    diaryEntries: production.snapshot.rows.match_diary_entry
      .filter(row => row.userId === PRODUCTION_OWNER)
      .map(row => row.id),
  },
  counts: {
    sharedInserts: shared.manifest.counts.inserts,
    sharedUpdates: shared.manifest.counts.updates,
    personalInserts: personalInserts.length,
    blocked: shared.manifest.counts.blocked,
    preservedDiaryEntries: 8,
  },
  warnings: [
    "NOT executable; account-aware production writer is not implemented.",
    "Two different diary records are preserved without updates.",
    "Authentication and operational records are excluded.",
    "All blocked conflicts require separate review.",
    "Fresh snapshots and isolated rehearsal required before production.",
  ],
};

const sha256 = createHash("sha256")
  .update(JSON.stringify(body))
  .digest("hex");

const manifest = { ...body, sha256 };

const directory = path.resolve(".artifacts/data-compare");
await mkdir(directory, { recursive: true });

const filename = "combined-account-transfer-candidate.json";

await writeFile(
  path.join(directory, filename),
  JSON.stringify(manifest, null, 2) + "\n",
  { flag: "wx", mode: 0o600 }
);

console.log(JSON.stringify({
  status: "CANDIDATE_CREATED",
  executable: false,
  counts: manifest.counts,
  sha256,
  output: path.join(directory, filename),
}, null, 2));

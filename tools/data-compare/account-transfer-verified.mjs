import { createHash } from "node:crypto";
import { CATEGORIES, REFERENCES } from "./catalog.mjs";
import { validateSnapshot, compareSnapshots } from "./compare-core.mjs";
import { buildTransferPlan } from "./transfer-plan-core.mjs";
import { executeAccountTransfer as executeCore } from "./account-apply-core.mjs";

const hash = value => createHash("sha256")
  .update(JSON.stringify(value)).digest("hex");

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function requireCondition(value, message) {
  if (!value) throw new Error(message);
}

function sharedOnly(envelope) {
  const snapshot = structuredClone(envelope.snapshot);
  const excluded = [
    ...CATEGORIES["Personal archive"],
    ...CATEGORIES["Operational state"]
  ];

  for (const table of excluded) snapshot.rows[table] = [];

  delete snapshot.authIsolation;
  delete snapshot.ownerAccounts;

  return { snapshot, sha256: hash(snapshot) };
}

export function verifyAccountCandidate(candidate, local, production) {
  requireCondition(
    candidate.kind === "BARCA_ACCOUNT_TRANSFER_CANDIDATE_V1",
    "Unsupported candidate type."
  );

  const { sha256, ...body } = candidate;
  requireCondition(hash(body) === sha256, "Candidate checksum mismatch.");
  requireCondition(candidate.executable === false, "Invalid executable flag.");
  requireCondition(candidate.productionWriteAuthorized === false,
    "Unexpected production authorization.");

  requireCondition(
    candidate.localSnapshotSha256 === local.sha256 &&
    candidate.productionSnapshotSha256 === production.sha256,
    "Snapshot identity mismatch."
  );

  for (const [label, envelope] of [
    ["local", local],
    ["production", production]
  ]) {
    const check = validateSnapshot(envelope);
    requireCondition(
      !check.errors.length &&
      !check.broken.length &&
      !check.relationshipIssues.length &&
      envelope.snapshot.authIsolation &&
      envelope.snapshot.environment === label,
      `Invalid ${label} snapshot.`
    );
  }

  const ownerLocal = candidate.ownerMapping.local;
  const ownerProduction = candidate.ownerMapping.production;

  requireCondition(
    local.snapshot.ownerAccounts.some(a => a.id === ownerLocal),
    "Local account not found."
  );

  requireCondition(
    production.snapshot.ownerAccounts.some(a => a.id === ownerProduction),
    "Production account not found."
  );

  const shared = buildTransferPlan(
    sharedOnly(local),
    sharedOnly(production)
  );

  requireCondition(!shared.errors.length,
    "Independent shared-data reconstruction failed.");

  requireCondition(
    same(shared.manifest.operations, candidate.sharedOperations),
    "Shared operations differ from independently reconstructed plan."
  );

  requireCondition(
    same(shared.manifest.blocked, candidate.blocked),
    "Blocked conflicts differ from reconstructed plan."
  );

  requireCondition(
    same(shared.manifest.contestedProductionRows,
      candidate.protectedProduction.contested) &&
    same(shared.manifest.preservedProductionOnly,
      candidate.protectedProduction.productionOnly),
    "Protected production rows differ from reconstructed plan."
  );

  const comparison = compareSnapshots(local, production, {
    localOwnerId: ownerLocal,
    productionOwnerId: ownerProduction
  });

  requireCondition(
    !comparison.errors.length && !comparison.schemaDiff.length,
    "Account-aware comparison failed."
  );

  const personalTables = [
    "favourite_player",
    "favourite_match",
    "media_save"
  ];

  const expectedPersonal = [];

  for (const table of personalTables) {
    const result = comparison.tables[table];

    requireCondition(
      !result.common.length &&
      !result.different.length &&
      !result.ambiguous.length &&
      !result.onlyProduction.length,
      `Unexpected personal-data conflict in ${table}.`
    );

    for (const row of local.snapshot.rows[table]
      .filter(item => item.userId === ownerLocal)) {

      requireCondition(
        result.onlyLocal.some(item => item.id === row.id),
        `Unverified personal record: ${table}/${row.id}`
      );

      const values = structuredClone(row);
      values.userId = ownerProduction;

      for (const [field, target] of Object.entries(REFERENCES[table] ?? {})) {
        if (values[field] == null) continue;

        const mapped = shared.mapping[target]?.get(values[field]);

        requireCondition(
          mapped,
          `Unresolved personal reference: ${table}/${row.id}/${field}`
        );

        values[field] = mapped;
      }

      expectedPersonal.push({
        action: "insert",
        table,
        localId: row.id,
        targetId: row.id,
        values
      });
    }
  }

  requireCondition(
    same(expectedPersonal, candidate.personalInserts),
    "Personal inserts differ from independently reconstructed records."
  );

  const diary = comparison.tables.match_diary_entry;

  requireCondition(
    diary.common.length === 6 &&
    diary.different.length === 2 &&
    !diary.onlyLocal.length &&
    !diary.onlyProduction.length &&
    !diary.ambiguous.length,
    "Diary reconciliation differs from reviewed baseline."
  );

  const protectedDiaries = production.snapshot.rows.match_diary_entry
    .filter(row => row.userId === ownerProduction)
    .map(row => row.id);

  requireCondition(
    same(protectedDiaries, candidate.protectedProduction.diaryEntries),
    "Protected diary inventory mismatch."
  );

  requireCondition(
    candidate.counts.sharedInserts === shared.manifest.counts.inserts &&
    candidate.counts.sharedUpdates === shared.manifest.counts.updates &&
    candidate.counts.blocked === shared.manifest.counts.blocked &&
    candidate.counts.personalInserts === expectedPersonal.length &&
    candidate.counts.preservedDiaryEntries === protectedDiaries.length,
    "Candidate counts differ from reconstructed counts."
  );

  return {
    status: "VERIFIED",
    sharedInserts: shared.manifest.counts.inserts,
    sharedUpdates: shared.manifest.counts.updates,
    personalInserts: expectedPersonal.length,
    blocked: shared.manifest.counts.blocked
  };
}

export async function executeVerifiedAccountTransfer(
  client, candidate, local, production
) {
  verifyAccountCandidate(candidate, local, production);
  return executeCore(client, candidate, local, production);
}

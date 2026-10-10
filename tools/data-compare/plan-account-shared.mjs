import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { CATEGORIES } from "./catalog.mjs";
import { validateSnapshot } from "./compare-core.mjs";
import { buildTransferPlan } from "./transfer-plan-core.mjs";

const args = process.argv.slice(2);
const option = (flag) => {
  const i = args.indexOf(flag);
  return i === -1 ? null : args[i + 1];
};

const localFile = option("--local");
const productionFile = option("--production");

if (!localFile || !productionFile) {
  throw new Error("Specify --local and --production.");
}

const [local, production] = await Promise.all(
  [localFile, productionFile].map(async (file) =>
    JSON.parse(await readFile(file, "utf8"))
  )
);

for (const [name, envelope] of [["local", local], ["production", production]]) {
  const result = validateSnapshot(envelope);
  if (result.errors.length || result.broken.length || result.relationshipIssues.length) {
    throw new Error(`${name} snapshot validation failed.`);
  }
  if (!envelope.snapshot.authIsolation) {
    throw new Error(`${name} is not an account-era snapshot.`);
  }
}

const excluded = new Set([
  ...CATEGORIES["Personal archive"],
  ...CATEGORIES["Operational state"],
]);

function sharedOnly(envelope) {
  const snapshot = structuredClone(envelope.snapshot);

  for (const table of excluded) {
    snapshot.rows[table] = [];
  }

  // This temporary legacy-compatible envelope is for offline
  // planning ONLY. It is never accepted as production authorization.
  delete snapshot.authIsolation;
  delete snapshot.ownerAccounts;

  return {
    snapshot,
    sha256: createHash("sha256")
      .update(JSON.stringify(snapshot))
      .digest("hex"),
  };
}

const result = buildTransferPlan(
  sharedOnly(local),
  sharedOnly(production)
);

if (result.errors.length) {
  console.error("PLANNING BLOCKED:");
  console.error(result.errors.join("\n"));
  process.exitCode = 1;
} else {
  const manifest = result.manifest;

  const summary = {
    mode: "READ_ONLY_SHARED_DATA_PLAN",
    executable: false,
    sourceLocalSnapshot: local.sha256,
    sourceProductionSnapshot: production.sha256,
    counts: manifest.counts,
    operationsByTable: {},
    blockedByTable: {},
  };

  for (const op of manifest.operations) {
    const counts = summary.operationsByTable[op.table] ??= {
      inserts: 0,
      updates: 0,
    };
    counts[op.action === "insert" ? "inserts" : "updates"]++;
  }

  for (const item of manifest.blocked) {
    summary.blockedByTable[item.table] =
      (summary.blockedByTable[item.table] ?? 0) + 1;
  }

  console.log(JSON.stringify(summary, null, 2));

  const dir = path.resolve(".artifacts/data-compare");
  await mkdir(dir, { recursive: true });

  await writeFile(
    path.join(dir, "account-shared-plan-review.json"),
    JSON.stringify({
      ...summary,
      warnings: [
        "Read-only planning artifact.",
        "Not authorized for production execution.",
        "Personal and operational tables excluded.",
        "Original account-era snapshots must remain unchanged.",
      ],
    }, null, 2),
    { flag: "wx", mode: 0o600 }
  );
}

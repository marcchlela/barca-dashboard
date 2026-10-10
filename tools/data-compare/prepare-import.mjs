import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { compareSnapshots } from "./compare-core.mjs";

const args = process.argv.slice(2);
function argument(name) {
  const index = args.indexOf(name);
  if (index < 0 || !args[index + 1]) {
    throw new Error(`Missing ${name}`);
  }
  return args[index + 1];
}

const localFile = argument("--local");
const productionFile = argument("--production");

const [local, production] = await Promise.all(
  [localFile, productionFile].map(async file =>
    JSON.parse(await readFile(resolve(file), "utf8"))
  )
);

const comparison = compareSnapshots(local, production);

if (
  comparison.errors.length ||
  comparison.schemaDiff.length ||
  comparison.broken.local.length ||
  comparison.broken.production.length ||
  comparison.relationshipIssues.local.length ||
  comparison.relationshipIssues.production.length
) {
  throw new Error(
    "Snapshot integrity, schema, or relationship validation failed."
  );
}

// Approved scope, excluding all operational state.
const groups = {
  foundation: [
    "season", "competition", "team",
    "data_source", "player", "provider_mapping"
  ],
  football: [
    "football_match", "squad_membership",
    "lineup", "lineup_player", "match_event",
    "match_statistic", "player_match_statistic",
    "player_absence"
  ],
  media: [
    "media_item", "media_moment",
    "media_review_candidate",
    "goal_timestamp_candidate", "manual_override"
  ],
  personal: [
    "favourite_player", "favourite_match",
    "match_diary_entry", "media_save"
  ],
  history: [
    "competition_fixture_snapshot",
    "standing_snapshot", "season_moment"
  ]
};

const plan = {
  kind: "BARCA_OFFLINE_IMPORT_PLAN",
  executable: false,
  productionWriteAuthorized: false,
  localSnapshotHash: local.sha256,
  productionSnapshotHash: production.sha256,
  localSnapshotAt: local.snapshot.generatedAt,
  productionSnapshotAt: production.snapshot.generatedAt,
  rules: {
    localVerifiedUpdates: true,
    preserveProductionOnly: true,
    includeValidatedEmptySeasons: true,
    transferOnlyValidAudits: true,
    unresolvedIdentities: "BLOCK",
    operationalData: "EXCLUDE"
  },
  groups: {},
  warnings: []
};

for (const [groupName, tables] of Object.entries(groups)) {
  plan.groups[groupName] = {};

  for (const table of tables) {
    const result = comparison.tables[table];
    if (!result) throw new Error(`Missing comparison table: ${table}`);

    const softAuditIds = new Set(
      comparison.softReferences.local
        .filter(item => item.table === table)
        .map(item => item.id)
    );

    const createCandidates = result.onlyLocal
      .filter(item => !softAuditIds.has(item.id))
      .map(item => ({
        localId: item.id,
        identity: item.identity,
        status: "PENDING_TARGET_AND_DEPENDENCY_VALIDATION"
      }));

    const updateCandidates = result.different.map(item => ({
      localId: item.localId,
      productionId: item.productionId,
      changedFields: item.fields,
      status: "PENDING_FIELD_AND_RELATIONSHIP_VALIDATION"
    }));

    const blocked = [
      ...result.ambiguous.map(item => ({
        localId: item.localId,
        reason: item.reason
      })),
      ...result.relationshipReview.map(item => ({
        localId: item.localId,
        reason: `Unresolved references: ${item.fields.join(", ")}`
      })),
      ...result.onlyLocal
        .filter(item => softAuditIds.has(item.id))
        .map(item => ({
          localId: item.id,
          reason: "Audit target does not exist locally"
        }))
    ];

    plan.groups[groupName][table] = {
      existingIdentical: result.commonCount,
      createCandidates,
      updateCandidates,
      blocked,
      preserveProductionOnly: result.onlyProduction.map(
        item => item.id
      )
    };
  }
}

plan.warnings.push(
  "This is not an executable SQL plan.",
  "Create candidates are not approved inserts.",
  "All target identities and foreign keys require validation.",
  "All 127 extra season records require legitimacy validation.",
  "Different fields are not automatically authorized overwrites.",
  "The eight invalid local audit references remain blocked.",
  "Source snapshots must be refreshed before any production write."
);

const outputDir = resolve(".artifacts/data-compare");
await mkdir(outputDir, { recursive: true });

const filename = "approved-scope-import-preview.json";
const output = join(outputDir, filename);

await writeFile(
  output,
  JSON.stringify(plan, null, 2) + "\n",
  { flag: "wx", mode: 0o600 }
);

console.log("\nBARCA — OFFLINE IMPORT PREVIEW");
console.log("==============================");
console.log("Production writes: DISABLED\n");

for (const [group, tables] of Object.entries(plan.groups)) {
  const totals = {
    create: 0,
    update: 0,
    blocked: 0,
    preserve: 0
  };

  for (const entry of Object.values(tables)) {
    totals.create += entry.createCandidates.length;
    totals.update += entry.updateCandidates.length;
    totals.blocked += entry.blocked.length;
    totals.preserve += entry.preserveProductionOnly.length;
  }

  console.log(group.toUpperCase(), totals);
}

console.log("\nPrivate manifest:", output);
console.log("No database was modified.");

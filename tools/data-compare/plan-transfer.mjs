/**
 * Barça Dashboard — offline transfer planning.
 * Reads two existing JSON snapshots.
 * Does not connect to PostgreSQL or modify data.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { compareSnapshots } from "./compare-core.mjs";

const args = process.argv.slice(2);

let localPath;
let productionPath;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--local") {
    localPath = args[++i];
  } else if (args[i] === "--production") {
    productionPath = args[++i];
  } else {
    throw new Error(`Unknown option: ${args[i]}`);
  }
}

if (!localPath || !productionPath) {
  throw new Error("Provide --local and --production snapshot paths.");
}

const [local, production] = await Promise.all(
  [localPath, productionPath].map(async (file) =>
    JSON.parse(await readFile(path.resolve(file), "utf8"))
  )
);

const report = compareSnapshots(local, production);

if (
  report.errors.length ||
  report.schemaDiff.length ||
  report.broken.local.length ||
  report.broken.production.length ||
  report.relationshipIssues.local.length ||
  report.relationshipIssues.production.length
) {
  console.error("STOP: Snapshot integrity or relationship problem detected.");
  process.exit(1);
}

const groups = {
  "Football, players and portraits": [
    "season", "competition", "team", "football_match",
    "player", "squad_membership", "lineup",
    "lineup_player", "match_event", "match_statistic",
    "player_match_statistic", "player_absence",
    "data_source", "provider_mapping"
  ],

  "Media, goal timestamps and curation": [
    "media_item", "media_moment", "media_review_candidate",
    "goal_timestamp_candidate", "manual_override"
  ],

  "Personal dashboard": [
    "favourite_player", "favourite_match",
    "match_diary_entry", "media_save"
  ],

  "Historical seasons and stories": [
    "competition_fixture_snapshot",
    "standing_snapshot", "season_moment"
  ]
};

const priorityFields = {
  player: ["portraitUrl", "displayName", "nationality", "birthDate"],
  match_event: ["primaryPlayerId", "relatedPlayerId", "type", "teamId"],
  media_item: ["url", "externalMediaId", "matchId", "type"],
  match_diary_entry: ["rating", "watched", "watchedAt", "notes"],
  standing_snapshot: ["position", "points", "played"]
};

console.log("\nBARÇA DASHBOARD — TRANSFER PLANNING");
console.log("==================================");
console.log("MODE: OFFLINE / READ-ONLY");
console.log("No production writes or import decisions.\n");

for (const [group, tables] of Object.entries(groups)) {
  console.log(`\n=== ${group} ===`);

  for (const table of tables) {
    const data = report.tables[table];

    if (!data) {
      throw new Error(`Missing comparison data: ${table}`);
    }

    const localOnly = data.onlyLocal.length;
    const productionOnly = data.onlyProduction.length;
    const different = data.different.length;
    const ambiguous = data.ambiguous.length;

    if (!localOnly && !productionOnly && !different && !ambiguous) {
      continue;
    }

    console.log(`\n${table}`);
    console.log(
      `  Local: ${data.localCount} | Production: ${data.productionCount}`
    );

    console.log(
      `  Identical: ${data.commonCount} | Local-only: ${localOnly}`
    );

    console.log(
      `  Different: ${different} | Production-only: ${productionOnly}`
    );

    if (ambiguous) {
      console.log(`  BLOCKED — ${ambiguous} ambiguous identities`);
    }

    if (different) {
      const fieldCounts = new Map();

      for (const item of data.different) {
        for (const field of item.fields) {
          fieldCounts.set(field, (fieldCounts.get(field) ?? 0) + 1);
        }
      }

      console.log(
        "  Changed fields: " +
        [...fieldCounts]
          .sort((a, b) => b[1] - a[1])
          .map(([field, count]) => `${field} (${count})`)
          .join(", ")
      );

      if (priorityFields[table]) {
        const priority = data.different.filter((item) =>
          item.fields.some((field) =>
            priorityFields[table].includes(field)
          )
        );

        console.log(`  Priority conflicts: ${priority.length}`);
      }
    }

    if (productionOnly) {
      console.log("  Production-only records require preservation review.");
    }
  }
}

console.log("\n=== INTEGRITY ===");
console.log(`Local soft audit references: ${report.softReferences.local.length}`);
console.log(`Production soft audit references: ${report.softReferences.production.length}`);
console.log(`Local-only static assets: ${report.assets.onlyLocal.length}`);

console.log("\n=== EXCLUDED ===");
console.log("Operational job runs, retry state, and caches.");

console.log("\nNo data was imported, modified, or deleted.");

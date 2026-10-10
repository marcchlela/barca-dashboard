import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { compareSnapshots } from "./compare-core.mjs";
import {
  REFERENCES,
  POLYMORPHIC,
  OVERRIDE_TARGETS
} from "./catalog.mjs";

const base = ".artifacts/data-compare/";
const local = JSON.parse(await readFile(
  resolve(base + "local-20261009-160808.json"), "utf8"
));
const production = JSON.parse(await readFile(
  resolve(base + "production-20261009.json"), "utf8"
));

const report = compareSnapshots(local, production);

if (
  report.errors?.length ||
  report.schemaDiff.length ||
  report.broken.local.length ||
  report.broken.production.length ||
  report.relationshipIssues.local.length ||
  report.relationshipIssues.production.length
) {
  throw new Error("Comparison integrity checks failed.");
}

const groups = {
  foundation: [
    "season", "competition", "team", "data_source",
    "player", "provider_mapping"
  ],
  football: [
    "football_match", "squad_membership", "lineup",
    "lineup_player", "match_event", "match_statistic",
    "player_match_statistic", "player_absence"
  ],
  media: [
    "media_item", "media_moment", "media_review_candidate",
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

const tables = [...new Set(Object.values(groups).flat())];

const states = new Map();
const matched = new Map();
const blocked = new Map();

const key = (table, id) => `${table}:${id}`;

const localRows = Object.fromEntries(
  tables.map(table => [
    table,
    new Map(local.snapshot.rows[table].map(row => [row.id, row]))
  ])
);

const productionRows = Object.fromEntries(
  tables.map(table => [
    table,
    new Map(production.snapshot.rows[table].map(row => [row.id, row]))
  ])
);

const sourceIdentityCounts = new Map();

for (const table of tables) {
  const result = report.tables[table];

  for (const item of [
    ...result.onlyLocal,
    ...result.different,
    ...result.ambiguous
  ]) {
    if (!item.identity) continue;
    const identity = `${table}:${item.identity}`;
    sourceIdentityCounts.set(
      identity,
      (sourceIdentityCounts.get(identity) ?? 0) + 1
    );
  }

  for (const item of [...result.common, ...result.different]) {
    const id = key(table, item.localId);
    matched.set(id, item.productionId);
    states.set(id, item.fields ? "matched-different" : "matched-same");
  }

  for (const item of result.ambiguous) {
    const id = key(table, item.localId);
    blocked.set(id, item.reason);
    states.set(id, "blocked");
  }

  for (const item of result.onlyLocal) {
    states.set(key(table, item.id), "pending");
  }
}

const invalidAudits = new Set(
  report.softReferences.local.map(item => key(item.table, item.id))
);

const relationshipReviews = new Set(
  tables.flatMap(table =>
    report.tables[table].relationshipReview.map(
      item => key(table, item.localId)
    )
  )
);

function dependencies(table, row) {
  const refs = { ...(REFERENCES[table] ?? {}) };

  if (table === "provider_mapping") {
    refs.internalId = POLYMORPHIC[row.entityType];
  }

  if (table === "manual_override") {
    refs.entityId = OVERRIDE_TARGETS[row.entityType];
  }

  return Object.entries(refs)
    .filter(([field]) => row[field] != null)
    .map(([field, target]) => ({
      field,
      target,
      id: row[field]
    }));
}

const reasons = new Map();

function block(id, reason) {
  blocked.set(id, reason);
  states.set(id, "blocked");
  reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
}

for (const table of tables) {
  for (const item of report.tables[table].onlyLocal) {
    const id = key(table, item.id);

    if (invalidAudits.has(id)) {
      block(id, "unresolved audit target");
    } else if (!item.identity) {
      block(id, "no independent identity");
    } else if (
      sourceIdentityCounts.get(`${table}:${item.identity}`) !== 1
    ) {
      block(id, "duplicate local identity");
    } else if (productionRows[table].has(item.id)) {
      block(id, "UUID collision with production");
    }
  }
}

// Resolve prerequisite chains, without generating IDs or writes.
let changed = true;

while (changed) {
  changed = false;

  for (const table of tables) {
    for (const item of report.tables[table].onlyLocal) {
      const id = key(table, item.id);
      if (states.get(id) !== "pending") continue;

      const row = localRows[table].get(item.id);
      if (!row) {
        block(id, "source row missing");
        changed = true;
        continue;
      }

      const deps = dependencies(table, row);

      if (deps.some(dep => !dep.target)) {
        block(id, "unknown polymorphic target");
        changed = true;
        continue;
      }

      const resolved = deps.every(dep => {
        const state = states.get(key(dep.target, dep.id));
        return (
          state === "matched-same" ||
          state === "matched-different" ||
          state === "provisional-create"
        );
      });

      if (resolved) {
        states.set(id, "provisional-create");
        changed = true;
      }
    }
  }
}

for (const [id, state] of states) {
  if (state === "pending") {
    block(id, "unresolved dependency chain");
  }
}

console.log("\nBARÇA — DEPENDENCY VALIDATION");
console.log("============================");
console.log("OFFLINE ONLY — NO DATABASE WRITES\n");

for (const [group, groupTables] of Object.entries(groups)) {
  const counts = {
    matched: 0,
    provisionalCreates: 0,
    blocked: 0,
    updatesForReview: 0,
    relationshipReview: 0
  };

  for (const table of groupTables) {
    const result = report.tables[table];

    counts.matched += result.commonCount;

    counts.updatesForReview += result.different.length;

    for (const item of result.onlyLocal) {
      const state = states.get(key(table, item.id));
      if (state === "provisional-create") {
        counts.provisionalCreates++;
      } else {
        counts.blocked++;
      }
    }

    counts.blocked += result.ambiguous.length;
    counts.relationshipReview += result.relationshipReview.length;
  }

  console.log(group.toUpperCase(), counts);
}

console.log("\nBLOCKED REASONS");
for (const [reason, count] of reasons) {
  console.log(`- ${reason}: ${count}`);
}

console.log("\nADDITIONAL SAFETY");
console.log(`Soft audit references excluded: ${invalidAudits.size}`);
console.log(`Matched records needing relationship review: ${relationshipReviews.size}`);
console.log(`Verified local-to-production ID pairs: ${matched.size}`);
console.log("Historical season legitimacy: NOT YET VALIDATED");
console.log("Update field permissions: NOT YET VALIDATED");
console.log("Target constraints and insert order: NOT YET VALIDATED");
console.log("Production writes: NOT AUTHORIZED");



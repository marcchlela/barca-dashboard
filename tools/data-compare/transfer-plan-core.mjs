import { createHash } from "node:crypto";
import { compareSnapshots } from "./compare-core.mjs";
import { OVERRIDE_TARGETS, POLYMORPHIC, REFERENCES, TABLES } from "./catalog.mjs";

// Parent-first, application rows only. Operational retry, cache, lock and job rows are excluded.
export const TRANSFER_ORDER = [
  "season", "competition", "team", "data_source", "model_version", "player", "trophy",
  "football_match", "squad_membership", "lineup", "lineup_player", "match_event",
  "match_statistic", "player_match_statistic", "standing_snapshot", "competition_fixture_snapshot",
  "media_item", "media_review_candidate", "media_moment", "goal_timestamp_candidate", "media_save",
  "favourite_player", "favourite_match", "match_diary_entry", "trophy_win", "season_moment",
  "player_absence", "prediction", "kit_theme", "provider_mapping", "manual_override",
];
export const EXCLUDED_OPERATIONAL = TABLES.filter((table) => !TRANSFER_ORDER.includes(table));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OMIT_UPDATE = new Set(["id", "createdAt", "updatedAt"]);
const UNIQUE = {
  season: [["label"]], competition: [["code"]], team: [["code"]], data_source: [["code"]], model_version: [["version"]],
  squad_membership: [["seasonId", "teamId", "playerId"]], lineup: [["matchId", "teamId"]],
  lineup_player: [["lineupId", "playerId"]], match_statistic: [["matchId", "teamId"]],
  player_match_statistic: [["matchId", "playerId"]],
  standing_snapshot: [["seasonId", "competitionId", "matchday", "teamId"]],
  competition_fixture_snapshot: [["sourceCode", "providerId"]],
  media_review_candidate: [["dataSourceId", "externalMediaId", "matchId"]],
  media_moment: [["mediaItemId", "matchEventId"]], goal_timestamp_candidate: [["clipUrl"]],
  media_save: [["mediaItemId"]], favourite_player: [["playerId"]],
  favourite_match: [["matchId"], ["seasonId", "slot"]], match_diary_entry: [["matchId"]],
  kit_theme: [["seasonId", "type"]], provider_mapping: [["dataSourceId", "entityType", "providerId"]],
};
const RESOLVE_AMBIGUOUS_BY_UNIQUE = new Set(["squad_membership", "lineup_player", "player_match_statistic"]);
const FINISHED = new Set(["finished", "Finished"]);
const digest = (value) => createHash("sha256").update(JSON.stringify(value) ?? "undefined").digest("hex");
const equal = (a, b) => digest(a) === digest(b);

export function domainDigest(snapshot) {
  return digest(Object.fromEntries(TRANSFER_ORDER.map((table) => [table, snapshot.rows[table]])));
}

export function validateHistoricalSeasons(rows) {
  const errors = [];
  const sorted = [...rows].sort((a, b) => a.startYear - b.startYear);
  if (sorted.length !== 128) errors.push(`Expected the sourced 128-season spine; found ${sorted.length}.`);
  for (let i = 0; i < 128; i++) {
    const season = sorted[i];
    const year = 1899 + i;
    const label = `${year}/${String((year + 1) % 100).padStart(2, "0")}`;
    if (!season || season.label !== label || season.startYear !== year || season.endYear !== year + 1 || season.isCurrent !== (year === 2026)) {
      errors.push(`Historical season index mismatch at ${label}.`);
    }
  }
  return errors;
}

function refsFor(table, row) {
  const references = { ...(REFERENCES[table] ?? {}) };
  if (table === "provider_mapping") references.internalId = POLYMORPHIC[row.entityType];
  if (table === "manual_override") references.entityId = OVERRIDE_TARGETS[row.entityType];
  return references;
}

function uniqueKey(row, fields) {
  if (fields.some((field) => row[field] === null || row[field] === undefined)) return null;
  return JSON.stringify(fields.map((field) => row[field]));
}

function sameUnique(table, a, b) {
  return (UNIQUE[table] ?? []).some((fields) => {
    const left = uniqueKey(a, fields), right = uniqueKey(b, fields);
    return left !== null && left === right;
  });
}

function semanticCollision(table, a, b) {
  if (table === "media_item") return a.matchId === b.matchId &&
    (a.externalMediaId && b.externalMediaId && a.externalMediaId === b.externalMediaId || a.url && b.url && a.url === b.url);
  if (table === "match_event") return a.matchId === b.matchId && a.teamId === b.teamId && a.period === b.period &&
    a.minute === b.minute && a.eventOrder === b.eventOrder;
  if (table === "season_moment") return a.seasonId === b.seasonId && a.type === b.type && a.title === b.title && a.occurredAt === b.occurredAt;
  return false;
}

function protectedConflict(table, source, target, changes) {
  if (table === "match_event" && changes.type) return "goal-event type differs (for example goal versus own goal)";
  if (table === "football_match" && FINISHED.has(source.status) && FINISHED.has(target.status) &&
    ["homeScore", "awayScore", "homePenaltyScore", "awayPenaltyScore"].some((field) => changes[field] !== undefined)) return "finished fixture score conflicts";
  if (table === "match_diary_entry" && changes.notes !== undefined && source.notes && target.notes && source.notes !== target.notes) return "both diaries contain different nonempty notes";
  if (table === "media_moment" && target.verificationBasis === "manual_visual" &&
    ["startSecond", "endSecond", "verificationBasis"].some((field) => changes[field] !== undefined)) return "existing visually verified timestamp differs";
  if (table === "season" && changes.isCurrent !== undefined) return "current-season ownership differs";
  if (table === "player" && changes.birthDate !== undefined && source.birthDate && target.birthDate && source.birthDate !== target.birthDate) return "two nonempty player birth dates conflict";
  if (table === "player_match_statistic" && changes.rawData !== undefined) return "provider raw payload differs; observed metrics alone do not justify overwriting it";
  return null;
}

export function buildTransferPlan(localEnvelope, productionEnvelope) {
  if (localEnvelope?.snapshot?.authIsolation || productionEnvelope?.snapshot?.authIsolation) {
    return { errors: ["Account-era snapshots are comparison-only. User ownership mapping and a new transfer policy require explicit review."], manifest: null };
  }
  const comparison = compareSnapshots(localEnvelope, productionEnvelope);
  const fatal = [...(comparison.errors ?? []), ...comparison.schemaDiff?.map((table) => `Schema differs: ${table}`) ?? [],
    ...(comparison.broken?.local ?? []).map((item) => `Local broken reference: ${item.table}/${item.id}`),
    ...(comparison.broken?.production ?? []).map((item) => `Production broken reference: ${item.table}/${item.id}`),
    ...(comparison.relationshipIssues?.local ?? []).map((item) => `Local relationship issue: ${item.table}/${item.id}`),
    ...(comparison.relationshipIssues?.production ?? []).map((item) => `Production relationship issue: ${item.table}/${item.id}`),
    ...validateHistoricalSeasons(localEnvelope?.snapshot?.rows?.season ?? [])];
  if (fatal.length) return { errors: fatal, manifest: null };
  const local = localEnvelope.snapshot.rows, production = productionEnvelope.snapshot.rows;
  const targetById = Object.fromEntries(TRANSFER_ORDER.map((table) => [table, new Map(production[table].map((row) => [row.id, row]))]));
  const idMap = Object.fromEntries(TRANSFER_ORDER.map((table) => [table, new Map()]));
  const operations = [], blocked = [], preserved = [], contestedProductionRows = [];
  const addedByTable = Object.fromEntries(TRANSFER_ORDER.map((table) => [table, []]));
  const blockedIds = new Set();
  const key = (table, id) => `${table}:${id}`;
  const block = (table, row, reason) => { blocked.push({ table, localId: row.id, reason }); blockedIds.add(key(table, row.id)); };
  const schemaByTable = Object.fromEntries(TRANSFER_ORDER.map((table) => [table, productionEnvelope.snapshot.schema.filter((column) => column.table === table)]));

  // These independently verified pairs are the only pre-existing target ID mappings.
  const pairByTable = Object.fromEntries(TRANSFER_ORDER.map((table) => [table, new Map(
    [...comparison.tables[table].common, ...comparison.tables[table].different].map((item) => [item.localId, item.productionId]))]));

  for (const table of TRANSFER_ORDER) {
    const contestedIds = new Set(comparison.tables[table].ambiguous.flatMap((item) => item.productionIds ?? []));
    for (const item of comparison.tables[table].onlyProduction) if (!contestedIds.has(item.id)) preserved.push({ table, productionId: item.id });
    for (const productionId of contestedIds) contestedProductionRows.push({ table, productionId });
    for (const row of local[table]) {
      const refs = refsFor(table, row);
      const values = { ...row };
      let unresolved = null;
      for (const [field, target] of Object.entries(refs)) {
        if (row[field] == null) continue;
        if (!target || !idMap[target]?.has(row[field])) { unresolved = `${field} has no verified target ${target ?? "type"}`; break; }
        values[field] = idMap[target].get(row[field]);
      }
      if (unresolved) { block(table, row, unresolved); continue; }
      const nonnullable = schemaByTable[table].filter((column) => column.nullable === "NO" && values[column.column] == null);
      if (nonnullable.length) { block(table, row, `required fields missing: ${nonnullable.map((column) => column.column).join(", ")}`); continue; }
      const explicitTargetId = pairByTable[table].get(row.id);
      let target = explicitTargetId ? targetById[table].get(explicitTargetId) : null;
      if (!target && RESOLVE_AMBIGUOUS_BY_UNIQUE.has(table)) {
        const candidates = production[table].filter((candidate) => sameUnique(table, values, candidate));
        if (candidates.length === 1) target = candidates[0];
        if (candidates.length > 1) { block(table, row, "multiple production rows share mapped unique identity"); continue; }
      }
      if (target) {
        if (idMap[table].has(row.id) && idMap[table].get(row.id) !== target.id) { block(table, row, "local row resolves to multiple target IDs"); continue; }
        // A unique-key reconciliation must not silently change another target's identity.
        if ([...idMap[table].values()].includes(target.id)) { block(table, row, "two local rows resolve to one production row"); continue; }
        if (table === "match_event" && (values.matchId !== target.matchId || values.teamId !== target.teamId || values.type !== target.type)) {
          block(table, row, "goal-event fixture/side/type contradiction"); continue;
        }
        if (table === "media_item" && values.matchId !== target.matchId) { block(table, row, "video fixture contradiction"); continue; }
        idMap[table].set(row.id, target.id);
        const changes = Object.fromEntries(Object.entries(values).filter(([field, value]) => !OMIT_UPDATE.has(field) && !equal(value, target[field])));
        const conflict = protectedConflict(table, values, target, changes);
        if (conflict) { block(table, row, conflict); continue; }
        if (Object.keys(changes).length) operations.push({ action: "update", table, localId: row.id, targetId: target.id,
          expected: Object.fromEntries(Object.keys(changes).map((field) => [field, target[field]])), changes });
      } else {
        if (comparison.tables[table].ambiguous.some((item) => item.localId === row.id)) { block(table, row, "ambiguous identity remains unresolved"); continue; }
        if (!UUID.test(row.id) || targetById[table].has(row.id)) { block(table, row, "source UUID collides with a different production identity"); continue; }
        if (!comparison.tables[table].onlyLocal.some((item) => item.id === row.id)) { block(table, row, "row is neither verified match nor independently identified local-only record"); continue; }
        if (!comparison.tables[table].onlyLocal.find((item) => item.id === row.id)?.identity) { block(table, row, "no independent source identity"); continue; }
        const collision = [...production[table], ...addedByTable[table]].find((candidate) => sameUnique(table, values, candidate) || semanticCollision(table, values, candidate));
        if (collision) { block(table, row, "target or planned insert has a unique/semantic identity collision"); continue; }
        idMap[table].set(row.id, row.id);
        addedByTable[table].push(values);
        operations.push({ action: "insert", table, localId: row.id, targetId: row.id, values });
      }
    }
  }
  const unresolvedContested = contestedProductionRows.filter(({ table, productionId }) =>
    ![...idMap[table].values()].includes(productionId));
  const manifestBody = { kind: "BARCA_CURATED_TRANSFER_V1", executable: false,
    generatedAt: new Date().toISOString(), sourceSnapshotSha256: localEnvelope.sha256,
    productionSnapshotSha256: productionEnvelope.sha256,
    sourceDomainSha256: domainDigest(localEnvelope.snapshot), productionDomainSha256: domainDigest(productionEnvelope.snapshot),
    order: TRANSFER_ORDER, excludedOperational: EXCLUDED_OPERATIONAL,
    operations, blocked, preservedProductionOnly: preserved, contestedProductionRows: unresolvedContested,
    counts: { inserts: operations.filter((item) => item.action === "insert").length,
      updates: operations.filter((item) => item.action === "update").length, blocked: blocked.length,
      preservedProductionOnly: preserved.length, contestedProductionRows: unresolvedContested.length },
    warnings: ["Offline candidate plan only. Revalidate both environments and obtain explicit approval before any apply.",
      "Blocked rows and their dependents are excluded; production-only rows are untouched.",
      "Two ignored private trophy assets are outside this database transfer."] };
  return { errors: [], manifest: { ...manifestBody, sha256: digest(manifestBody) }, mapping: idMap, comparison };
}

export function validateManifest(manifest) {
  if (!manifest || manifest.kind !== "BARCA_CURATED_TRANSFER_V1") return false;
  const { sha256, ...body } = manifest;
  return sha256 === digest(body) && JSON.stringify(manifest.order) === JSON.stringify(TRANSFER_ORDER);
}

/** Offline expectation only; database triggers/defaults may change timestamps on real apply. */
export function simulateTransfer(productionSnapshot, manifest) {
  if (!validateManifest(manifest)) throw new Error("Manifest checksum or order is invalid.");
  const result = structuredClone(productionSnapshot);
  for (const operation of manifest.operations) {
    const rows = result.rows[operation.table];
    if (operation.action === "insert") {
      if (rows.some((row) => row.id === operation.targetId)) throw new Error(`Duplicate planned ID ${operation.table}/${operation.targetId}.`);
      rows.push(structuredClone(operation.values));
    } else {
      const target = rows.find((row) => row.id === operation.targetId);
      if (!target) throw new Error(`Missing planned update target ${operation.table}/${operation.targetId}.`);
      Object.assign(target, structuredClone(operation.changes));
    }
    rows.sort((a, b) => a.id.localeCompare(b.id));
  }
  return result;
}

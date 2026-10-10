import { createHash } from "node:crypto";
import { CATEGORIES, CATEGORY_QUESTIONS, OVERRIDE_TARGETS, POLYMORPHIC, REFERENCES, SNAPSHOT_VERSION, TABLES } from "./catalog.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const first = (value) => value == null ? null : String(value);
const day = (value) => value ? new Date(value).toISOString().slice(0, 10) : null;
const stable = (value) => JSON.stringify(value, (_key, item) => item && !Array.isArray(item) && typeof item === "object"
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);

export function validateSnapshot(envelope) {
  const errors = [];
  const snapshot = envelope?.snapshot;
  if (!snapshot || snapshot.version !== SNAPSHOT_VERSION || !["local", "production"].includes(snapshot.environment)) errors.push("Unsupported or missing snapshot metadata.");
  if (snapshot && createHash("sha256").update(JSON.stringify(snapshot)).digest("hex") !== envelope.sha256) errors.push("Snapshot SHA-256 mismatch.");
  if (snapshot?.authIsolation && !Array.isArray(snapshot.ownerAccounts)) errors.push("Account-era snapshot has no owner identity inventory.");
  const accountIds = new Set();
  for (const account of snapshot?.ownerAccounts ?? []) {
    if (!UUID.test(account?.id ?? "") || accountIds.has(account.id) || typeof account.username !== "string") errors.push("Invalid or repeated account identity in snapshot.");
    accountIds.add(account.id);
  }
  const schemaTables = new Set(snapshot?.schema?.map((column) => column.table));
  const ids = {};
  for (const table of TABLES) {
    if (!Array.isArray(snapshot?.rows?.[table]) || !schemaTables.has(table)) { errors.push(`Missing table or schema: ${table}.`); continue; }
    ids[table] = new Set();
    for (const row of snapshot.rows[table]) {
      if (!UUID.test(row?.id ?? "") || ids[table].has(row.id)) errors.push(`Invalid/repeated ID in ${table}: ${row?.id ?? "missing"}.`);
      ids[table].add(row.id);
    }
  }
  const broken = [];
  const ownerIds = accountIds;
  for (const table of CATEGORIES["Personal archive"]) for (const row of snapshot?.rows?.[table] ?? []) {
    if (row.userId && !ownerIds.has(row.userId)) broken.push({ table, id: row.id, field: "userId", target: "app_user" });
  }
  for (const [table, references] of Object.entries(REFERENCES)) for (const row of snapshot?.rows?.[table] ?? []) {
    for (const [field, target] of Object.entries(references)) {
      if (row[field] && !ids[target]?.has(row[field])) broken.push({ table, id: row.id, field, target });
    }
  }
  for (const row of snapshot?.rows?.provider_mapping ?? []) {
    const target = POLYMORPHIC[row.entityType];
    if (!target || !ids[target]?.has(row.internalId)) broken.push({ table: "provider_mapping", id: row.id, field: "internalId", target: target ?? "unknown" });
  }
  // ManualOverride can target free-form entity types, so unknown targets are review items, not assumed missing.
  const softReferences = [];
  for (const row of snapshot?.rows?.manual_override ?? []) {
    const target = OVERRIDE_TARGETS[row.entityType];
    if (target && !ids[target]?.has(row.entityId)) softReferences.push({ table: "manual_override", id: row.id, field: "entityId", target });
  }
  const relationshipIssues = [];
  const row = (table, id) => snapshot?.rows?.[table]?.find((item) => item.id === id);
  const issue = (table, id, reason) => relationshipIssues.push({ table, id, reason });
  const sides = (match, teamId) => !teamId || teamId === match?.homeTeamId || teamId === match?.awayTeamId;
  for (const matchEvent of snapshot?.rows?.match_event ?? []) {
    if (!sides(row("football_match", matchEvent.matchId), matchEvent.teamId)) issue("match_event", matchEvent.id, "team is not a fixture side");
  }
  for (const lineup of snapshot?.rows?.lineup ?? []) {
    if (!sides(row("football_match", lineup.matchId), lineup.teamId)) issue("lineup", lineup.id, "team is not a fixture side");
    if (lineup.isConfirmed && (snapshot.rows.lineup_player ?? []).filter((entry) => entry.lineupId === lineup.id && entry.role === "starter").length !== 11) issue("lineup", lineup.id, "confirmed lineup does not have 11 starters");
  }
  for (const table of ["match_statistic", "player_match_statistic"]) for (const stat of snapshot?.rows?.[table] ?? []) {
    if (!sides(row("football_match", stat.matchId), stat.teamId)) issue(table, stat.id, "team is not a fixture side");
  }
  for (const moment of snapshot?.rows?.media_moment ?? []) {
    const media = row("media_item", moment.mediaItemId), event = row("match_event", moment.matchEventId);
    if (media && event && media.matchId !== event.matchId) issue("media_moment", moment.id, "video and goal belong to different fixtures");
  }
  for (const diary of snapshot?.rows?.match_diary_entry ?? []) {
    const goal = row("match_event", diary.favouriteGoalEventId);
    if (goal && goal.matchId !== diary.matchId) issue("match_diary_entry", diary.id, "favourite goal belongs to another fixture");
  }
  for (const favourite of snapshot?.rows?.favourite_match ?? []) {
    const match = row("football_match", favourite.matchId);
    if (match && match.seasonId !== favourite.seasonId) issue("favourite_match", favourite.id, "Top 3 season differs from fixture season");
  }
  for (const fixture of snapshot?.rows?.competition_fixture_snapshot ?? []) {
    const match = row("football_match", fixture.canonicalMatchId);
    if (match && (match.seasonId !== fixture.seasonId || match.competitionId !== fixture.competitionId)) issue("competition_fixture_snapshot", fixture.id, "canonical fixture has different season/competition");
  }
  for (const media of snapshot?.rows?.media_item ?? []) {
    const match = row("football_match", media.matchId);
    if (match && media.seasonId && match.seasonId !== media.seasonId) issue("media_item", media.id, "media season differs from fixture season");
  }
  for (const review of snapshot?.rows?.goal_timestamp_candidate ?? []) {
    const media = row("media_item", review.mediaItemId), event = row("match_event", review.matchEventId);
    if (media?.matchId && review.matchId && media.matchId !== review.matchId || event && review.matchId && event.matchId !== review.matchId) issue("goal_timestamp_candidate", review.id, "review media/goal belongs to another fixture");
  }
  for (const override of snapshot?.rows?.manual_override ?? []) {
    if (!OVERRIDE_TARGETS[override.entityType]) issue("manual_override", override.id, "unknown polymorphic entity type; manual target review");
  }
  return { errors, broken, softReferences, relationshipIssues };
}

function identityIndex(snapshot, selectedOwnerId = null) {
  const byId = Object.fromEntries(TABLES.map((table) => [table, new Map(snapshot.rows[table].map((row) => [row.id, row]))]));
  const providers = new Map();
  for (const mapping of snapshot.rows.provider_mapping) {
    const source = byId.data_source.get(mapping.dataSourceId)?.code;
    if (!source) continue;
    const key = `${mapping.entityType}:${mapping.internalId}`;
    if (!providers.has(key)) providers.set(key, []);
    providers.get(key).push(`${source}:${mapping.providerId}`);
  }
  const cache = new Map();
  const owner = (userId) => userId == null ? "legacy" : userId === selectedOwnerId ? "selected-owner" : `${snapshot.environment}:${userId}`;
  function keys(table, row) {
    const cached = cache.get(`${table}:${row.id}`);
    if (cached) return cached;
    const ref = (target, id) => id ? primary(target, byId[target]?.get(id)) : null;
    const pair = (...values) => values.every((value) => value !== null && value !== undefined) ? values.join("|") : null;
    const provider = (entity) => (providers.get(`${entity}:${row.id}`) ?? []).map((id) => `provider:${id}`);
    let found = [];
    switch (table) {
      case "season": found = [row.label]; break;
      case "competition": case "team": case "data_source": found = [row.code]; break;
      case "model_version": found = [row.version]; break;
      case "player": found = [row.birthDate ? pair("biographic", row.displayName?.normalize("NFKC").toLowerCase(), day(row.birthDate)) : null, ...provider("player")]; break;
      case "football_match": found = [pair(ref("season", row.seasonId), ref("competition", row.competitionId), ref("team", row.homeTeamId), ref("team", row.awayTeamId), day(row.kickoff)), ...provider("match")]; break;
      case "squad_membership": found = [pair(ref("season", row.seasonId), ref("team", row.teamId), ref("player", row.playerId))]; break;
      case "player_absence": found = [pair(ref("season", row.seasonId), ref("player", row.playerId), row.type, row.startDate ? day(row.startDate) : "open")]; break;
      case "lineup": found = [pair(ref("football_match", row.matchId), ref("team", row.teamId))]; break;
      case "lineup_player": found = [pair(ref("lineup", row.lineupId), ref("player", row.playerId))]; break;
      case "match_event": found = [pair(ref("football_match", row.matchId), ref("team", row.teamId) ?? "unknown-team", row.type, first(row.period) ?? "?", first(row.minute) ?? "?", first(row.second) ?? "?", first(row.eventOrder) ?? "?"), ...provider("event")]; break;
      case "match_statistic": found = [pair(ref("football_match", row.matchId), ref("team", row.teamId))]; break;
      case "player_match_statistic": found = [pair(ref("football_match", row.matchId), ref("player", row.playerId))]; break;
      case "standing_snapshot": found = [pair(ref("season", row.seasonId), ref("competition", row.competitionId), row.matchday, ref("team", row.teamId))]; break;
      case "competition_fixture_snapshot": found = [pair(row.sourceCode, row.providerId)]; break;
      case "media_item": found = [row.externalMediaId ? pair("video", row.externalMediaId, ref("football_match", row.matchId) ?? "no-match") : null, row.url ? pair("url", row.url, ref("football_match", row.matchId) ?? "no-match") : null, ...provider("media")]; break;
      case "media_moment": found = [pair(ref("media_item", row.mediaItemId), ref("match_event", row.matchEventId))]; break;
      case "media_review_candidate": found = [pair(ref("data_source", row.dataSourceId), row.externalMediaId, ref("football_match", row.matchId))]; break;
      case "goal_timestamp_candidate": found = [row.clipUrl]; break;
      case "goal_media_sync_state": found = [ref("football_match", row.matchId)]; break;
      case "goal_media_page_cache": found = [row.url]; break;
      case "media_save": found = [pair(owner(row.userId), ref("media_item", row.mediaItemId))]; break;
      case "kit_theme": found = [pair(ref("season", row.seasonId), row.type)]; break;
      case "trophy": found = [...provider("trophy"), row.name ? row.name.toLowerCase() : null]; break;
      case "trophy_win": found = [pair(ref("trophy", row.trophyId), ref("season", row.seasonId), ref("competition", row.competitionId) ?? "none", row.wonAt ? day(row.wonAt) : "undated")]; break;
      case "favourite_player": found = [pair(owner(row.userId), ref("player", row.playerId))]; break;
      case "favourite_match": found = [pair(owner(row.userId), ref("season", row.seasonId), row.slot)]; break;
      case "match_diary_entry": found = [pair(owner(row.userId), ref("football_match", row.matchId))]; break;
      case "prediction": found = [pair(ref("football_match", row.matchId), ref("model_version", row.modelVersionId), row.generatedAt)]; break;
      case "provider_mapping": found = [pair(ref("data_source", row.dataSourceId), row.entityType, row.providerId)]; break;
      case "season_moment": found = [pair(ref("season", row.seasonId), row.type, row.title, row.occurredAt)]; break;
      case "manual_override": {
        const target = OVERRIDE_TARGETS[row.entityType];
        found = target ? [pair(row.entityType, ref(target, row.entityId), row.fieldName ?? "all", row.createdAt)] : [];
        break;
      }
      // Job runs have no cross-environment natural identity: do not pair equal UUIDs.
      case "goal_media_sync_run": found = []; break;
    }
    const result = [...new Set(found.filter(Boolean).map((value) => `${table}:${value}`))];
    cache.set(`${table}:${row.id}`, result);
    return result;
  }
  function primary(table, row) { return row ? keys(table, row)[0] ?? null : null; }
  function normalized(table, row) {
    const normalizedRow = {};
    for (const [field, value] of Object.entries(row)) {
      if (["id", "createdAt", "updatedAt"].includes(field)) continue;
      if (field === "userId" && CATEGORIES["Personal archive"].includes(table)) {
        normalizedRow[field] = owner(value);
        continue;
      }
      const target = REFERENCES[table]?.[field] ?? (table === "provider_mapping" && field === "internalId" ? POLYMORPHIC[row.entityType] : null)
        ?? (table === "manual_override" && field === "entityId" ? OVERRIDE_TARGETS[row.entityType] : null);
      normalizedRow[field] = target && value ? primary(target, byId[target]?.get(value)) ?? `unresolved:${snapshot.environment}:${value}` : value;
    }
    return normalizedRow;
  }
  return { byId, keys, normalized, providerIds: (entity, id) => providers.get(`${entity}:${id}`) ?? [] };
}

function compatible(table, left, right, li, ri) {
  const identity = (index, target, id) => id ? index.keys(target, index.byId[target].get(id) ?? {})[0] : null;
  const entity = { player: "player", football_match: "match", match_event: "event", media_item: "media", trophy: "trophy" }[table];
  if (entity) {
    const leftProviders = li.providerIds(entity, left.id);
    const rightProviders = ri.providerIds(entity, right.id);
    for (const identityValue of leftProviders) {
      const source = identityValue.split(":")[0];
      const targetValues = rightProviders.filter((value) => value.startsWith(`${source}:`));
      if (targetValues.length && !targetValues.includes(identityValue)) return false;
    }
  }
  if (table === "football_match") return ["seasonId", "competitionId", "homeTeamId", "awayTeamId"].every((field) => {
    const target = REFERENCES.football_match[field];
    return identity(li, target, left[field]) === identity(ri, target, right[field]);
  });
  if (table === "player") return !left.birthDate || !right.birthDate || day(left.birthDate) === day(right.birthDate);
  if (table === "match_event") return identity(li, "football_match", left.matchId) === identity(ri, "football_match", right.matchId)
    && identity(li, "team", left.teamId) === identity(ri, "team", right.teamId) && left.type === right.type;
  if (table === "media_item") return (!left.externalMediaId || !right.externalMediaId || left.externalMediaId === right.externalMediaId)
    && (!left.matchId && !right.matchId || identity(li, "football_match", left.matchId) === identity(ri, "football_match", right.matchId));
  return true;
}

export function compareSnapshots(local, production, { localOwnerId = null, productionOwnerId = null } = {}) {
  const localValidation = validateSnapshot(local);
  const productionValidation = validateSnapshot(production);
  const errors = [...localValidation.errors.map((v) => `local: ${v}`), ...productionValidation.errors.map((v) => `production: ${v}`)];
  if (local?.snapshot?.environment !== "local" || production?.snapshot?.environment !== "production") errors.push("Expected local and production snapshots in that order.");
  if (Boolean(localOwnerId) !== Boolean(productionOwnerId)) errors.push("An explicit account comparison requires both owner IDs.");
  if (localOwnerId && !local?.snapshot?.ownerAccounts?.some((owner) => owner.id === localOwnerId)) errors.push("Selected local owner ID is absent from the local snapshot.");
  if (productionOwnerId && !production?.snapshot?.ownerAccounts?.some((owner) => owner.id === productionOwnerId)) errors.push("Selected production owner ID is absent from the production snapshot.");
  if (errors.length) return { errors };
  const ls = local.snapshot, ps = production.snapshot;
  const schemaDiff = [];
  for (const table of TABLES) {
    const fields = (snapshot) => snapshot.schema.filter((column) => column.table === table).map((column) => `${column.column}:${column.type}:${column.nullable}`).sort();
    if (JSON.stringify(fields(ls)) !== JSON.stringify(fields(ps))) schemaDiff.push(table);
  }
  const li = identityIndex(ls, localOwnerId), ri = identityIndex(ps, productionOwnerId);
  const tables = {};
  for (const table of TABLES) {
    const left = ls.rows[table], right = ps.rows[table];
    const rightKeys = new Map();
    for (const row of right) for (const key of ri.keys(table, row)) {
      if (!rightKeys.has(key)) rightKeys.set(key, []);
      rightKeys.get(key).push(row);
    }
    const matchedRight = new Set();
    const common = [], different = [], onlyLocal = [], ambiguous = [], relationshipReview = [];
    for (const row of left) {
      const keys = li.keys(table, row);
      const candidates = [...new Map(keys.flatMap((key) => rightKeys.get(key) ?? []).map((candidate) => [candidate.id, candidate])).values()];
      if (candidates.length !== 1 || !keys.length) {
        const sameId = right.find((other) => other.id === row.id);
        if (candidates.length > 1 || sameId) {
          if (sameId) matchedRight.add(sameId.id);
          ambiguous.push({ localId: row.id, reason: candidates.length > 1 ? "multiple identity candidates" : keys.length ? "same UUID but conflicting independent identity" : "UUID overlap without independent identity", productionIds: sameId ? [sameId.id] : candidates.map((candidate) => candidate.id) });
        } else onlyLocal.push({ id: row.id, identity: keys[0] ?? null });
        continue;
      }
      const candidate = candidates[0];
      if (matchedRight.has(candidate.id) || !compatible(table, row, candidate, li, ri)) {
        ambiguous.push({ localId: row.id, reason: matchedRight.has(candidate.id) ? "multiple local rows resolve to one production row" : "contradictory parent identity", productionIds: [candidate.id] });
        continue;
      }
      matchedRight.add(candidate.id);
      const l = li.normalized(table, row), r = ri.normalized(table, candidate);
      const fields = [...new Set([...Object.keys(l), ...Object.keys(r)])].filter((field) => stable({ value: l[field] }) !== stable({ value: r[field] }));
      const entry = { localId: row.id, productionId: candidate.id, identity: keys[0] ?? null };
      const unresolvedFields = [...new Set([...Object.keys(l), ...Object.keys(r)])].filter((field) =>
        [l[field], r[field]].some((value) => typeof value === "string" && value.startsWith("unresolved:")));
      if (unresolvedFields.length) relationshipReview.push({ ...entry, fields: unresolvedFields });
      if (fields.length) different.push({ ...entry, fields }); else common.push(entry);
    }
    const onlyProduction = right.filter((row) => !matchedRight.has(row.id)).map((row) => ({ id: row.id, identity: ri.keys(table, row)[0] ?? null }));
    tables[table] = { localCount: left.length, productionCount: right.length, commonCount: common.length, common,
      different, onlyLocal, onlyProduction, ambiguous, relationshipReview };
  }
  const localAssets = new Map(ls.assets?.files?.map((asset) => [asset.path, asset]));
  const productionAssets = new Map(ps.assets?.files?.map((asset) => [asset.path, asset]));
  const assetDiff = { localStatus: ls.assets?.status, productionStatus: ps.assets?.status,
    onlyLocal: [...localAssets.keys()].filter((key) => !productionAssets.has(key)),
    onlyProduction: [...productionAssets.keys()].filter((key) => !localAssets.has(key)),
    different: [...localAssets.keys()].filter((key) => productionAssets.has(key) && localAssets.get(key).sha256 !== productionAssets.get(key).sha256) };
  return { errors, generatedAt: new Date().toISOString(), snapshots: { local: ls.generatedAt, production: ps.generatedAt },
    ownerComparison: localOwnerId ? { localOwnerId, productionOwnerId } : null,
    schemaDiff, broken: { local: localValidation.broken, production: productionValidation.broken },
    softReferences: { local: localValidation.softReferences, production: productionValidation.softReferences },
    relationshipIssues: { local: localValidation.relationshipIssues, production: productionValidation.relationshipIssues }, tables, assets: assetDiff };
}

export function markdownReport(report) {
  if (report.errors?.length) return `# Comparison stopped\n\n${report.errors.map((error) => `- ${error}`).join("\n")}\n`;
  const out = ["# Barça dashboard — read-only data comparison", "", `Local snapshot: ${report.snapshots.local}  `, `Production snapshot: ${report.snapshots.production}  `, "No merge or replacement decision has been made.", ""];
  if (report.ownerComparison) out.push(`**Explicit personal-owner comparison:** local ${report.ownerComparison.localOwnerId} ↔ production ${report.ownerComparison.productionOwnerId}. This is an operator-selected mapping, not proof of ownership.`, "");
  else out.push("**Personal rows:** owned records are intentionally not paired across environments without an explicit owner mapping.", "");
  if (report.schemaDiff.length) out.push(`**Schema differences:** ${report.schemaDiff.join(", ")}. Interpret row differences cautiously until migration state is reconciled.`, "");
  for (const [category, names] of Object.entries(CATEGORIES)) {
    out.push(`## ${category}`, "", "| Table | Local | Production | Same | Different | Only local | Only production | Ambiguous | Relationship review |", "|---|---:|---:|---:|---:|---:|---:|---:|---:|");
    for (const table of names) {
      const t = report.tables[table];
      out.push(`| ${table} | ${t.localCount} | ${t.productionCount} | ${t.commonCount} | ${t.different.length} | ${t.onlyLocal.length} | ${t.onlyProduction.length} | ${t.ambiguous.length} | ${t.relationshipReview.length} |`);
    }
    out.push("");
    for (const table of names) {
      const t = report.tables[table];
      if (!t.different.length && !t.onlyLocal.length && !t.onlyProduction.length && !t.ambiguous.length && !t.relationshipReview.length) continue;
      out.push(`### ${table}`, "");
      if (t.different.length) out.push("Different values (field names only; notes and personal text are not printed):", ...t.different.map((v) => `- ${v.identity ?? v.localId}: ${v.fields.join(", ")}`), "");
      if (t.onlyLocal.length) out.push("Only local:", ...t.onlyLocal.map((v) => `- ${v.identity ?? `unresolved ${v.id}`}`), "");
      if (t.onlyProduction.length) out.push("Only production — preserve/review before any future transfer:", ...t.onlyProduction.map((v) => `- ${v.identity ?? `unresolved ${v.id}`}`), "");
      if (t.ambiguous.length) out.push("Requires manual identity review:", ...t.ambiguous.map((v) => `- ${v.localId}: ${v.reason}`), "");
      if (t.relationshipReview.length) out.push("Matched rows with unresolved related identities:", ...t.relationshipReview.map((v) => `- ${v.identity ?? v.localId}: ${v.fields.join(", ")}`), "");
    }
    out.push(`**Question for review:** ${CATEGORY_QUESTIONS[category]}`, "");
  }
  out.push("## Integrity and assets", "", `Broken local references: ${report.broken.local.length}; broken production references: ${report.broken.production.length}.`);
  for (const [environment, issues] of Object.entries(report.broken)) for (const issue of issues) out.push(`- ${environment}: ${issue.table} ${issue.id} → ${issue.field} (${issue.target})`);
  out.push(`Soft audit references to absent targets: ${report.softReferences.local.length} local; ${report.softReferences.production.length} production. These have no database foreign key and can reflect historical curation, not necessarily corruption.`);
  for (const [environment, issues] of Object.entries(report.softReferences)) for (const issue of issues) out.push(`- ${environment}: ${issue.table} ${issue.id} → absent ${issue.target}`);
  out.push(`Cross-record relationship issues: ${report.relationshipIssues.local.length} local; ${report.relationshipIssues.production.length} production.`);
  for (const [environment, issues] of Object.entries(report.relationshipIssues)) for (const issue of issues) out.push(`- ${environment}: ${issue.table} ${issue.id}: ${issue.reason}`);
  out.push("", `Static public files: ${report.assets.onlyLocal.length} only local, ${report.assets.onlyProduction.length} only production, ${report.assets.different.length} different.`,
    `Asset scan status: local ${report.assets.localStatus}; production ${report.assets.productionStatus}.`,
    "This compares source public/ files, not the running container image or external image availability/cache.", "");
  for (const [label, paths] of [["Only local", report.assets.onlyLocal], ["Only production", report.assets.onlyProduction], ["Different hashes", report.assets.different]]) {
    if (paths.length) out.push(`${label}:`, ...paths.map((file) => `- ${file}`), "");
  }
  out.push("## Decisions reserved for the user", "", "Review each category separately: leave unchanged, preserve production-only records, or later design an approved selective merge/replace procedure. This report does not choose a policy or provide a write path.",
    "Resolve ambiguous identities, schema differences, broken references, and asset/build discrepancies before any transfer.", "");
  return `${out.join("\n")}\n`;
}


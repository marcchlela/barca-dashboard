import { createHash } from "node:crypto";
import { validateSnapshot } from "./compare-core.mjs";
import { domainDigest, TRANSFER_ORDER, validateManifest } from "./transfer-plan-core.mjs";

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const rowsById = (rows) => new Map(rows.map((row) => [row.id, row]));
const quote = (name) => {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) throw new Error(`Unsafe SQL identifier: ${name}`);
  return `"${name}"`;
};

async function readDomain(client) {
  const rows = {};
  for (const table of TRANSFER_ORDER) rows[table] = (await client.query(`SELECT * FROM ${quote(table)} ORDER BY id`)).rows;
  return JSON.parse(JSON.stringify(rows));
}

function fulfilled(rows, manifest) {
  const byId = Object.fromEntries(TRANSFER_ORDER.map((table) => [table, rowsById(rows[table])]));
  return manifest.operations.every((operation) => {
    const current = byId[operation.table].get(operation.targetId);
    if (!current) return false;
    const intended = operation.action === "insert" ? operation.values : operation.changes;
    return Object.entries(intended).every(([field, value]) => same(current[field], value));
  });
}

function verifyPostState(before, after, manifest, schema) {
  const inserted = Object.fromEntries(TRANSFER_ORDER.map((table) => [table, manifest.operations.filter((op) => op.table === table && op.action === "insert").length]));
  for (const table of TRANSFER_ORDER) {
    if (after[table].length !== before[table].length + inserted[table]) throw new Error(`Post-apply count mismatch in ${table}.`);
  }
  if (!fulfilled(after, manifest)) throw new Error("Post-apply operation values do not match the manifest.");
  const unchanged = [...manifest.preservedProductionOnly, ...manifest.contestedProductionRows];
  for (const item of unchanged) {
    const old = before[item.table].find((row) => row.id === item.productionId);
    const current = after[item.table].find((row) => row.id === item.productionId);
    if (!old || !current || !same(old, current)) throw new Error(`A protected production row changed: ${item.table}/${item.productionId}.`);
  }
  const snapshot = { version: 1, environment: "production", schema, rows: {
    ...Object.fromEntries(schema.map((column) => [column.table, []])), ...after,
  } };
  const validation = validateSnapshot({ snapshot, sha256: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex") });
  if (validation.errors.length) throw new Error("Post-apply snapshot validation failed.");
  if (validation.broken.length || validation.relationshipIssues.length) throw new Error("Post-apply referential or relationship validation failed.");
}

/** Injection-friendly transaction runner; the CLI supplies a real pg.Client. */
export async function executeTransfer(client, manifest, productionSnapshot) {
  if (!validateManifest(manifest)) throw new Error("Invalid or tampered operation manifest.");
  if (manifest.productionDomainSha256 !== domainDigest(productionSnapshot)) throw new Error("Manifest/production snapshot digest mismatch.");
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");
  try {
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '60s'");
    const lock = await client.query("SELECT pg_try_advisory_xact_lock(17091799) AS acquired");
    if (!lock.rows[0]?.acquired) throw new Error("Another transfer is running.");
    const schema = (await client.query(`SELECT table_name AS "table", column_name AS "column", data_type AS "type", udt_name AS "udt", is_nullable AS "nullable"
      FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`)).rows;
    if (schema.some((column) => column.table === "app_user")) {
      throw new Error("Legacy transfer writer is disabled for account-era databases until user ownership mapping is reviewed.");
    }
    for (const table of TRANSFER_ORDER) {
      const shape = (list) => list.filter((column) => column.table === table).map((column) => `${column.column}:${column.type}:${column.udt}:${column.nullable}`).sort();
      if (!same(shape(schema), shape(productionSnapshot.schema))) throw new Error(`Live schema differs from the approved snapshot: ${table}.`);
    }
    const before = await readDomain(client);
    if (domainDigest({ rows: before }) !== manifest.productionDomainSha256) {
      if (fulfilled(before, manifest)) { await client.query("COMMIT"); return { status: "already_applied", inserts: 0, updates: 0 }; }
      throw new Error("Production changed since preview; capture fresh snapshots and rebuild the manifest.");
    }
    const columnsByTable = Object.fromEntries(TRANSFER_ORDER.map((table) => [table,
      new Map(schema.filter((column) => column.table === table).map((column) => [column.column, column]))]));
    for (const operation of manifest.operations) {
      if (!TRANSFER_ORDER.includes(operation.table)) throw new Error(`Forbidden table ${operation.table}.`);
      const fields = Object.keys(operation.action === "insert" ? operation.values : operation.changes);
      if (!fields.length || fields.some((field) => !columnsByTable[operation.table].has(field))) throw new Error(`Invalid columns for ${operation.table}.`);
      const encode = (field, value) => value != null && ["json", "jsonb"].includes(columnsByTable[operation.table].get(field).udt)
        ? JSON.stringify(value) : value;
      let result;
      if (operation.action === "insert") {
        const values = fields.map((field) => encode(field, operation.values[field]));
        result = await client.query(`INSERT INTO ${quote(operation.table)} (${fields.map(quote).join(", ")}) VALUES (${fields.map((_, index) => `$${index + 1}`).join(", ")}) RETURNING id`, values);
      } else if (operation.action === "update") {
        const values = fields.map((field) => encode(field, operation.changes[field]));
        result = await client.query(`UPDATE ${quote(operation.table)} SET ${fields.map((field, index) => `${quote(field)} = $${index + 1}`).join(", ")} WHERE id = $${fields.length + 1} RETURNING id`, [...values, operation.targetId]);
      } else throw new Error(`Unknown action ${operation.action}.`);
      if (result.rows.length !== 1 || result.rows[0].id !== operation.targetId) throw new Error(`Operation affected the wrong row: ${operation.table}/${operation.targetId}.`);
    }
    const after = await readDomain(client);
    verifyPostState(before, after, manifest, schema);
    await client.query("COMMIT");
    return { status: "applied", inserts: manifest.counts.inserts, updates: manifest.counts.updates,
      blocked: manifest.counts.blocked, postDomainSha256: domainDigest({ rows: after }) };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

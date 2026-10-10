/** Read-only, full-application snapshot for offline comparison. No import path. */
import "dotenv/config";
import pg from "pg";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { CATEGORIES, EXCLUDED_AUTH_TABLES, MAX_ROWS_PER_TABLE, MAX_SNAPSHOT_BYTES, SNAPSHOT_VERSION, TABLES } from "./catalog.mjs";

const args = process.argv.slice(2);
let environment = null;
let outputName = null;
let publicRoot = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--environment") environment = args[++i];
  else if (args[i] === "--out") outputName = args[++i];
  else if (args[i] === "--public-root") publicRoot = args[++i];
  else throw new Error(`Unknown argument ${args[i]}`);
}
if (!["local", "production"].includes(environment)) throw new Error("Specify --environment local|production.");
if (outputName && !/^[a-z0-9][a-z0-9_.-]{0,100}\.json$/i.test(outputName)) throw new Error("--out must be a simple .json filename.");
const dbUrl = new URL(process.env.DATABASE_URL ?? "");
if (environment === "local" && !["localhost", "127.0.0.1", "[::1]"].includes(dbUrl.hostname)) {
  throw new Error("Local snapshot refuses a non-loopback PostgreSQL host.");
}

async function staticAssets(root) {
  if (!root || !existsSync(root)) return { status: "not_scanned", files: [] };
  const base = await realpath(root);
  const files = [];
  async function visit(dir) {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      if (item.isSymbolicLink()) continue;
      if (item.isDirectory()) await visit(full);
      else if (item.isFile()) {
        const size = (await stat(full)).size;
        const relativePath = path.relative(base, full).replaceAll("\\", "/");
        files.push({ path: relativePath, bytes: size,
          sha256: createHash("sha256").update(await readFile(full)).digest("hex") });
      }
    }
  }
  await visit(base);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { status: "scanned_source_public_directory", files };
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
let snapshot;
try {
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await client.query("SET LOCAL statement_timeout = '60s'");
  const schema = (await client.query(`SELECT table_name AS "table", column_name AS "column", data_type AS "type", udt_name AS "udt", is_nullable AS "nullable"
    FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`)).rows;
  const excluded = new Set(EXCLUDED_AUTH_TABLES);
  const exportSchema = schema.filter((column) => !excluded.has(column.table));
  const available = new Set(schema.map((row) => row.table));
  const missing = TABLES.filter((table) => !available.has(table));
  if (missing.length) throw new Error(`Snapshot stopped: missing application tables: ${missing.join(", ")}. Check migration state before comparing.`);
  const rows = {};
  for (const table of TABLES) {
    const count = Number((await client.query(`SELECT count(*)::int AS count FROM "${table}"`)).rows[0].count);
    if (count > MAX_ROWS_PER_TABLE) throw new Error(`${table} has ${count} rows; exceeds the read-only snapshot limit of ${MAX_ROWS_PER_TABLE}.`);
    rows[table] = (await client.query(`SELECT * FROM "${table}" ORDER BY id`)).rows;
  }
  const ownerAccounts = available.has("app_user")
    ? (await client.query('SELECT id, username FROM app_user ORDER BY id')).rows
    : [];
  await client.query("COMMIT");
  snapshot = JSON.parse(JSON.stringify({ version: SNAPSHOT_VERSION, environment,
    generatedAt: new Date().toISOString(), scope: "dashboard data excluding authentication records", schema: exportSchema,
    ...(available.has("app_user") ? { authIsolation: "excluded; account-era snapshots are comparison-only" } : {}),
    ownerAccounts, categories: CATEGORIES, rows }));
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end();
}
snapshot.assets = await staticAssets(publicRoot ?? (existsSync("public") ? "public" : null));
const payload = JSON.stringify(snapshot);
const sha256 = createHash("sha256").update(payload).digest("hex");
const serialized = `${JSON.stringify({ snapshot, sha256 })}\n`;
if (Buffer.byteLength(serialized) > MAX_SNAPSHOT_BYTES) throw new Error("Snapshot exceeds 100 MiB; no file written.");
const counts = Object.fromEntries(TABLES.map((table) => [table, snapshot.rows[table].length]));
console.log(JSON.stringify({ mode: outputName ? "private-file" : "read-only-count-preview", environment,
  generatedAt: snapshot.generatedAt, counts, assetCount: snapshot.assets.files.length,
  bytes: Buffer.byteLength(serialized), sha256 }, null, 2));
if (outputName) {
  const outputDir = path.resolve(process.env.COMPARE_OUTPUT_DIR ?? ".artifacts/data-compare");
  await mkdir(outputDir, { recursive: true, mode: 0o700 });
  const safeDir = await realpath(outputDir);
  const target = path.join(safeDir, outputName);
  await writeFile(target, serialized, { flag: "wx", mode: 0o600 });
  console.log(`Private comparison snapshot written to ${target}`);
}

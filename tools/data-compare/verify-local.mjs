/** Freshness attestation for a private local snapshot; read-only PostgreSQL. */
import "dotenv/config";
import pg from "pg";
import { createHash } from "node:crypto";
import { readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateSnapshot } from "./compare-core.mjs";
import { domainDigest, TRANSFER_ORDER } from "./transfer-plan-core.mjs";

const args = process.argv.slice(2);
const value = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const snapshotFile = value("--snapshot"), outputName = value("--out");
if (!snapshotFile) throw new Error("Specify --snapshot local-private.json.");
if (outputName && !/^[a-z0-9][a-z0-9_.-]{0,100}\.json$/i.test(outputName)) throw new Error("--out must be a simple .json filename.");
const envelope = JSON.parse(await readFile(path.resolve(snapshotFile), "utf8"));
const validation = validateSnapshot(envelope);
if (validation.errors.length || envelope.snapshot.environment !== "local") throw new Error(`Invalid local snapshot: ${validation.errors.join("; ")}`);
const url = new URL(process.env.DATABASE_URL ?? "");
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("Freshness verification refuses a non-loopback database.");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
let liveRows;
try {
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await client.query("SET LOCAL statement_timeout = '60s'");
  liveRows = {};
  for (const table of TRANSFER_ORDER) liveRows[table] = (await client.query(`SELECT * FROM "${table}" ORDER BY id`)).rows;
  await client.query("COMMIT");
} catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
finally { await client.end(); }
const liveDigest = domainDigest({ rows: JSON.parse(JSON.stringify(liveRows)) });
const expected = domainDigest(envelope.snapshot);
const fresh = liveDigest === expected;
console.log(JSON.stringify({ fresh, checkedAt: new Date().toISOString(), snapshotSha256: envelope.sha256,
  databaseMatchesSnapshot: fresh }, null, 2));
if (!fresh) process.exitCode = 1;
else if (outputName) {
  const body = { kind: "BARCA_LOCAL_FRESHNESS_V1", snapshotSha256: envelope.sha256, domainSha256: liveDigest,
    checkedAt: new Date().toISOString() };
  const attestation = { ...body, sha256: createHash("sha256").update(JSON.stringify(body)).digest("hex") };
  const dir = await realpath(path.resolve(".artifacts/data-compare"));
  const target = path.join(dir, outputName);
  await writeFile(target, `${JSON.stringify(attestation)}\n`, { flag: "wx", mode: 0o600 });
  console.log(`Private local freshness attestation written to ${target}`);
}

/** Restore a private local pg_dump into a disposable loopback database, then drop it. */
import "dotenv/config";
import pg from "pg";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { realpath } from "node:fs/promises";
import path from "node:path";

const backupArg = process.argv[2];
const migrationCheck = process.argv[3] === "--migration-check";
if (!backupArg || process.argv.length > 4 || (process.argv.length === 4 && !migrationCheck)) {
  throw new Error("Use node tools/auth/qa-backup-restore.mjs .artifacts/local-db-backups/BACKUP.dump [--migration-check]");
}
const source = new URL(process.env.DATABASE_URL ?? "");
if (!["localhost", "127.0.0.1", "[::1]"].includes(source.hostname) || source.pathname !== "/barca_dashboard") {
  throw new Error("Restore QA refuses a non-local or unexpected PostgreSQL source.");
}
const backupRoot = await realpath(path.resolve(".artifacts/local-db-backups"));
const backup = await realpath(path.resolve(backupArg));
if (!backup.startsWith(`${backupRoot}${path.sep}`) || !backup.endsWith(".dump")) throw new Error("Backup must be a private local .dump file.");
const databaseName = `barca_restore_qa_${randomBytes(6).toString("hex")}`;
const adminUrl = new URL(source);
adminUrl.pathname = "/postgres";
const testUrl = new URL(source);
testUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: adminUrl.toString() });
await admin.connect();
let created = false;
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  const binary = process.platform === "win32" ? "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_restore.exe" : "pg_restore";
  const restored = spawnSync(binary, ["--exit-on-error", "--no-owner", "--no-privileges", "-h", source.hostname,
    "-p", String(source.port || 5432), "-U", decodeURIComponent(source.username), "-d", databaseName, backup],
    { env: { ...process.env, PGPASSWORD: decodeURIComponent(source.password) }, encoding: "utf8", timeout: 120_000 });
  if (restored.status !== 0) throw new Error(`Disposable restore failed: ${(restored.stderr ?? "").slice(0, 1000)}`);
  const countRows = async () => {
    const db = new pg.Client({ connectionString: testUrl.toString() });
    await db.connect();
    try {
      const counts = {};
      for (const table of ["football_match", "match_diary_entry", "favourite_player", "favourite_match", "media_save", "media_moment", "match_event"]) {
        counts[table] = (await db.query(`SELECT count(*)::int AS count FROM "${table}"`)).rows[0].count;
      }
      return counts;
    } finally { await db.end(); }
  };
  const before = await countRows();
  let after = null;
  if (migrationCheck) {
    const command = process.platform === "win32" ? "cmd.exe" : "npx";
    const arguments_ = process.platform === "win32" ? ["/d", "/s", "/c", "npx.cmd prisma db migrate"] : ["prisma", "db", "migrate"];
    const migrated = spawnSync(command, arguments_, { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: testUrl.toString() }, encoding: "utf8", timeout: 120_000 });
    if (migrated.status !== 0) throw new Error(`Disposable migration failed: ${((migrated.stderr ?? "") + (migrated.stdout ?? "")).slice(0, 1500)}`);
    after = await countRows();
    if (JSON.stringify(after) !== JSON.stringify(before)) throw new Error("Disposable account migration changed protected record counts.");
    const db = new pg.Client({ connectionString: testUrl.toString() });
    await db.connect();
    try {
      const accounts = await db.query("SELECT count(*)::int AS count FROM app_user");
      const unclaimed = await db.query('SELECT count(*)::int AS count FROM match_diary_entry WHERE "userId" IS NULL');
      if (accounts.rows[0].count !== 0 || unclaimed.rows[0].count !== before.match_diary_entry) {
        throw new Error("Disposable account migration did not preserve legacy diary ownership.");
      }
    } finally { await db.end(); }
  }
  console.log(JSON.stringify({ disposableRestorePassed: true, migrationCheckPassed: migrationCheck, counts: before, afterMigration: after }, null, 2));
} finally {
  if (created) await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
  await admin.end();
}

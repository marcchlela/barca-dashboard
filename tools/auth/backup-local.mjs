/** Private, loopback-only PostgreSQL backup before an account ownership claim. */
import "dotenv/config";
import { randomBytes, createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, stat, unlink } from "node:fs/promises";
import path from "node:path";

const source = new URL(process.env.DATABASE_URL ?? "");
if (!["localhost", "127.0.0.1", "[::1]"].includes(source.hostname) || source.pathname !== "/barca_dashboard") {
  throw new Error("Local backup refuses a non-local or unexpected PostgreSQL database.");
}
const directory = path.resolve(".artifacts/local-db-backups");
await mkdir(directory, { recursive: true, mode: 0o700 });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = path.join(directory, `barca-local-pre-claim-${stamp}-${randomBytes(3).toString("hex")}.dump`);
const binary = process.platform === "win32" ? "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe" : "pg_dump";
const result = spawnSync(binary, ["-h", source.hostname, "-p", String(source.port || 5432), "-U", decodeURIComponent(source.username),
  "-d", "barca_dashboard", "-Fc", "-f", target],
{ env: { ...process.env, PGPASSWORD: decodeURIComponent(source.password) }, encoding: "utf8", timeout: 120_000 });
if (result.status !== 0) {
  await unlink(target).catch(() => {});
  throw new Error(`Local backup failed: ${(result.stderr ?? result.error?.message ?? "unknown error").slice(0, 800)}`);
}
const bytes = (await stat(target)).size;
if (bytes < 1000) throw new Error("Backup unexpectedly small; do not claim legacy rows.");
const sha256 = createHash("sha256").update(await readFile(target)).digest("hex");
console.log(JSON.stringify({ backup: target, bytes, sha256 }, null, 2));

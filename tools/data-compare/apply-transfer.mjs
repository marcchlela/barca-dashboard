/** Explicitly gated production write CLI. Never used by page rendering or schedulers. */
import "dotenv/config";
import pg from "pg";
import { createHash } from "node:crypto";
import { readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateSnapshot } from "./compare-core.mjs";
import { executeTransfer } from "./apply-core.mjs";
import { buildTransferPlan, domainDigest, validateManifest } from "./transfer-plan-core.mjs";

const args = process.argv.slice(2);
const value = (flag) => { const i = args.indexOf(flag); return i < 0 ? null : args[i + 1]; };
const manifestPath = value("--manifest"), localPath = value("--local"), productionPath = value("--production-snapshot");
const attestationPath = value("--local-attestation"), backupPath = value("--backup");
const apply = args.includes("--apply"), confirmation = value("--confirm"), acknowledgedBlocked = value("--acknowledge-blocked");
if (!manifestPath || !localPath || !productionPath) throw new Error("Specify --manifest, --local and --production-snapshot.");
const [manifest, local, production] = await Promise.all([manifestPath, localPath, productionPath].map(async (file) =>
  JSON.parse(await readFile(path.resolve(file), "utf8"))));
if (!validateManifest(manifest)) throw new Error("Manifest checksum/order is invalid.");
for (const [label, envelope] of [["local", local], ["production", production]]) {
  const report = validateSnapshot(envelope);
  if (report.errors.length || envelope.snapshot.environment !== label) throw new Error(`Invalid ${label} snapshot: ${report.errors.join("; ")}`);
}
if (manifest.sourceSnapshotSha256 !== local.sha256 || manifest.productionSnapshotSha256 !== production.sha256 ||
  manifest.sourceDomainSha256 !== domainDigest(local.snapshot) || manifest.productionDomainSha256 !== domainDigest(production.snapshot)) {
  throw new Error("Manifest does not refer to the supplied exact snapshots.");
}
const rebuilt = buildTransferPlan(local, production);
if (rebuilt.errors.length || JSON.stringify(rebuilt.manifest?.operations) !== JSON.stringify(manifest.operations) ||
  JSON.stringify(rebuilt.manifest?.blocked) !== JSON.stringify(manifest.blocked) ||
  JSON.stringify(rebuilt.manifest?.counts) !== JSON.stringify(manifest.counts)) {
  throw new Error("Approved manifest no longer matches a fresh deterministic preview of these snapshots.");
}
if (!apply) {
  console.log(JSON.stringify({ mode: "offline-preview-only", manifestSha256: manifest.sha256, counts: manifest.counts,
    blocked: manifest.blocked.length, sourceSnapshotAt: local.snapshot.generatedAt,
    productionSnapshotAt: production.snapshot.generatedAt, productionWrites: false }, null, 2));
  process.exit(0);
}
if (confirmation !== manifest.sha256) throw new Error("--confirm must equal the exact reviewed manifest SHA-256.");
if (acknowledgedBlocked !== String(manifest.blocked.length)) throw new Error("--acknowledge-blocked must equal the reviewed blocked-row count.");
if (process.env.GOAL_MEDIA_SCHEDULE_ENABLED === "true") throw new Error("Goal-media scheduling must remain disabled for this transfer.");
const host = new URL(process.env.DATABASE_URL ?? "").hostname;
if (!["db", "barca-dashboard-db"].includes(host)) throw new Error("Apply refuses a database outside the private production Docker network.");
const now = Date.now();
const within = (value, ms) => Number.isFinite(Date.parse(value)) && Date.parse(value) <= now && now - Date.parse(value) <= ms;
if (!within(local.snapshot.generatedAt, 30 * 60_000) || !within(production.snapshot.generatedAt, 30 * 60_000) ||
  !within(manifest.generatedAt, 30 * 60_000)) throw new Error("Snapshots/manifest are stale; recapture and re-preview before apply.");
if (!attestationPath) throw new Error("A fresh --local-attestation is required.");
const attestation = JSON.parse(await readFile(path.resolve(attestationPath), "utf8"));
const { sha256, ...attestationBody } = attestation;
if (attestation.kind !== "BARCA_LOCAL_FRESHNESS_V1" ||
  sha256 !== createHash("sha256").update(JSON.stringify(attestationBody)).digest("hex") ||
  attestation.snapshotSha256 !== local.sha256 || attestation.domainSha256 !== manifest.sourceDomainSha256 ||
  !within(attestation.checkedAt, 15 * 60_000) || Date.parse(attestation.checkedAt) < Date.parse(local.snapshot.generatedAt)) {
  throw new Error("Local source freshness attestation is missing, mismatched or stale.");
}
if (!backupPath) throw new Error("A fresh --backup is mandatory.");
const backup = await realpath(path.resolve(backupPath));
if (!backup.startsWith(`/backups${path.sep}`) || !backup.endsWith(".dump")) throw new Error("Backup must be a private /backups/*.dump file.");
const backupInfo = await stat(backup);
if (backupInfo.size < 4096 || now - backupInfo.mtimeMs > 60 * 60_000 || backupInfo.mtimeMs > now) throw new Error("Backup is too small, too old or has an invalid timestamp.");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
let result;
try { result = await executeTransfer(client, manifest, production.snapshot); }
finally { await client.end(); }
const directory = await realpath(path.resolve(process.env.COMPARE_OUTPUT_DIR ?? "/private"));
const resultFile = path.join(directory, `apply-result-${new Date().toISOString().replaceAll(/[:.]/g, "-")}.json`);
const privateResult = { ...result, manifestSha256: manifest.sha256, sourceSnapshotSha256: local.sha256,
  productionSnapshotSha256: production.sha256, backupPath: backup, completedAt: new Date().toISOString(),
  appliedOperations: result.status === "applied" ? manifest.operations.map((item) => ({ action: item.action, table: item.table, targetId: item.targetId })) : [],
  blocked: manifest.blocked, preservedProductionOnly: manifest.preservedProductionOnly,
  contestedProductionRows: manifest.contestedProductionRows };
await writeFile(resultFile, `${JSON.stringify(privateResult, null, 2)}\n`, { flag: "wx", mode: 0o600 });
console.log(JSON.stringify({ status: result.status, inserts: result.inserts, updates: result.updates,
  blocked: result.blocked ?? manifest.blocked.length, manifestSha256: manifest.sha256, privateResultFile: resultFile }, null, 2));

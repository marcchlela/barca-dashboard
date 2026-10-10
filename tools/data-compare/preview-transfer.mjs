/** Offline manifest generation. This file has no database connection or write path. */
import { readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildTransferPlan } from "./transfer-plan-core.mjs";

const args = process.argv.slice(2);
let localPath, productionPath, outputName;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--local") localPath = args[++i];
  else if (args[i] === "--production") productionPath = args[++i];
  else if (args[i] === "--out") outputName = args[++i];
  else throw new Error(`Unknown argument ${args[i]}`);
}
if (!localPath || !productionPath) throw new Error("Specify --local and --production snapshots.");
if (outputName && !/^[a-z0-9][a-z0-9_.-]{0,100}\.json$/i.test(outputName)) throw new Error("--out must be a simple .json filename.");
const [local, production] = await Promise.all([localPath, productionPath].map(async (filename) =>
  JSON.parse(await readFile(path.resolve(filename), "utf8"))));
const result = buildTransferPlan(local, production);
if (result.errors.length) { console.error(result.errors.join("\n")); process.exitCode = 1; }
else {
  const summary = Object.fromEntries(result.manifest.order.map((table) => [table, {
    insert: result.manifest.operations.filter((item) => item.table === table && item.action === "insert").length,
    update: result.manifest.operations.filter((item) => item.table === table && item.action === "update").length,
    blocked: result.manifest.blocked.filter((item) => item.table === table).length,
    preservedProductionOnly: result.manifest.preservedProductionOnly.filter((item) => item.table === table).length,
  }]));
  console.log(JSON.stringify({ mode: "offline-preview", snapshotAt: { local: local.snapshot.generatedAt,
    production: production.snapshot.generatedAt }, counts: result.manifest.counts,
    blockedReasons: Object.fromEntries([...new Set(result.manifest.blocked.map((item) => item.reason))].map((reason) =>
      [reason, result.manifest.blocked.filter((item) => item.reason === reason).length])),
    byTable: summary, manifestSha256: result.manifest.sha256,
    productionWriteAuthorized: false }, null, 2));
  if (outputName) {
    const dir = await realpath(path.resolve(".artifacts/data-compare"));
    const target = path.join(dir, outputName);
    await writeFile(target, `${JSON.stringify(result.manifest, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    console.log(`Private candidate operation manifest written to ${target}`);
  }
}

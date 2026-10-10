/** Offline only: never opens a database connection. */
import { readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { compareSnapshots, markdownReport } from "./compare-core.mjs";

const args = process.argv.slice(2);
let localFile, productionFile, outputName;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--local") localFile = args[++i];
  else if (args[i] === "--production") productionFile = args[++i];
  else if (args[i] === "--out") outputName = args[++i];
  else throw new Error(`Unknown argument ${args[i]}`);
}
if (!localFile || !productionFile) throw new Error("Specify --local and --production private snapshot files.");
if (outputName && !/^[a-z0-9][a-z0-9_.-]{0,100}\.md$/i.test(outputName)) throw new Error("--out must be a simple .md filename.");
const local = JSON.parse(await readFile(path.resolve(localFile), "utf8"));
const production = JSON.parse(await readFile(path.resolve(productionFile), "utf8"));
const report = compareSnapshots(local, production);
if (report.errors.length) {
  console.error(report.errors.join("\n"));
  process.exitCode = 1;
} else {
  const summary = Object.fromEntries(Object.entries(report.tables).map(([table, result]) => [table, {
    local: result.localCount, production: result.productionCount, same: result.commonCount,
    different: result.different.length, onlyLocal: result.onlyLocal.length,
    onlyProduction: result.onlyProduction.length, ambiguous: result.ambiguous.length,
    relationshipReview: result.relationshipReview.length }]));
  console.log(JSON.stringify({ snapshots: report.snapshots, schemaDiff: report.schemaDiff,
    broken: { local: report.broken.local.length, production: report.broken.production.length },
    softReferences: { local: report.softReferences.local.length, production: report.softReferences.production.length },
    relationshipIssues: { local: report.relationshipIssues.local.length, production: report.relationshipIssues.production.length },
    staticAssets: { onlyLocal: report.assets.onlyLocal.length, onlyProduction: report.assets.onlyProduction.length,
      different: report.assets.different.length }, tables: summary }, null, 2));
  if (outputName) {
    const outputDir = await realpath(path.resolve(".artifacts/data-compare"));
    const target = path.join(outputDir, outputName);
    await writeFile(target, markdownReport(report), { flag: "wx", mode: 0o600 });
    console.log(`Private human-readable comparison written to ${target}`);
  }
}

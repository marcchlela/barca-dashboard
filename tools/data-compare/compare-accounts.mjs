/** Offline, read-only comparison of two explicitly selected owner accounts. */
import { readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { CATEGORIES } from "./catalog.mjs";
import { compareSnapshots, markdownReport } from "./compare-core.mjs";

const args = process.argv.slice(2);
const value = (flag) => args.includes(flag) ? args[args.indexOf(flag) + 1] : null;
const localPath = value("--local"), productionPath = value("--production");
const localOwnerId = value("--local-owner-id"), productionOwnerId = value("--production-owner-id");
const outputName = value("--out");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!localPath || !productionPath || !uuid.test(localOwnerId ?? "") || !uuid.test(productionOwnerId ?? "") ||
  args.some((arg) => arg.startsWith("--") && !["--local", "--production", "--local-owner-id", "--production-owner-id", "--out"].includes(arg))) {
  throw new Error("Use --local SNAPSHOT --production SNAPSHOT --local-owner-id UUID --production-owner-id UUID [--out report.md].");
}
if (outputName && !/^[a-z0-9][a-z0-9_.-]{0,100}\.md$/i.test(outputName)) throw new Error("--out must be a simple .md filename.");
const [local, production] = await Promise.all([localPath, productionPath].map(async (filename) =>
  JSON.parse(await readFile(path.resolve(filename), "utf8"))));
if (!local.snapshot.authIsolation || !production.snapshot.authIsolation) {
  throw new Error("Both snapshots must be from account-enabled databases. No legacy or guessed owner mapping is accepted.");
}
const report = compareSnapshots(local, production, { localOwnerId, productionOwnerId });
if (report.errors.length) throw new Error(report.errors.join("; "));
const localOwner = local.snapshot.ownerAccounts.find((account) => account.id === localOwnerId);
const productionOwner = production.snapshot.ownerAccounts.find((account) => account.id === productionOwnerId);
const lines = ["# Selected-account comparison — read-only", "",
  `Local account: ${localOwner.username} (${localOwnerId})  `,
  `Production account: ${productionOwner.username} (${productionOwnerId})  `,
  "This mapping was supplied by the operator. Matching names are not proof that accounts belong to the same person.",
  "No transfer manifest or write permission is produced.", "",
  "| Personal table | Local selected | Production selected | Matched | Different | Local only | Production only | Unclaimed local | Unclaimed production | Other production users |",
  "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|" ];
for (const table of CATEGORIES["Personal archive"]) {
  const l = local.snapshot.rows[table], p = production.snapshot.rows[table], t = report.tables[table];
  const localSelected = new Set(l.filter((row) => row.userId === localOwnerId).map((row) => row.id));
  const productionSelected = new Set(p.filter((row) => row.userId === productionOwnerId).map((row) => row.id));
  const matched = t.common.filter((row) => localSelected.has(row.localId)).length;
  const different = t.different.filter((row) => localSelected.has(row.localId)).length;
  const localOnly = t.onlyLocal.filter((row) => localSelected.has(row.id)).length;
  const productionOnly = t.onlyProduction.filter((row) => productionSelected.has(row.id)).length;
  const otherProduction = p.filter((row) => row.userId && row.userId !== productionOwnerId).length;
  lines.push(`| ${table} | ${localSelected.size} | ${productionSelected.size} | ${matched} | ${different} | ${localOnly} | ${productionOnly} | ${l.filter((row) => row.userId == null).length} | ${p.filter((row) => row.userId == null).length} | ${otherProduction} |`);
}
lines.push("", `Schema differences: ${report.schemaDiff.join(", ") || "none"}.`,
  "Production-only rows and all records belonging to other production users remain protected; this command never chooses a merge policy.",
  "", markdownReport(report));
const content = `${lines.join("\n")}\n`;
console.log(lines.slice(0, CATEGORIES["Personal archive"].length + 9).join("\n"));
if (outputName) {
  const directory = await realpath(path.resolve(".artifacts/data-compare"));
  const target = path.join(directory, outputName);
  await writeFile(target, content, { flag: "wx", mode: 0o600 });
  console.log(`Private read-only report written to ${target}`);
}

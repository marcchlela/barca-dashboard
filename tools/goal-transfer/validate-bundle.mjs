/** Offline, read-only validation of a private transfer bundle. */
import { readFile, stat } from "node:fs/promises";
import { MAX_BUNDLE_BYTES, validateTransferEnvelope } from "./bundle.mjs";

const [flag, filename] = process.argv.slice(2);
if (flag !== "--file" || !filename || process.argv.length !== 4) throw new Error("Usage: node tools/goal-transfer/validate-bundle.mjs --file <bundle.json>");
const info = await stat(filename);
if (!info.isFile() || info.size > MAX_BUNDLE_BYTES) throw new Error("Bundle must be a regular file smaller than 10 MiB.");
const envelope = JSON.parse(await readFile(filename, "utf8"));
const report = validateTransferEnvelope(envelope);
console.log(JSON.stringify({ mode: "offline-validation", sha256: envelope.sha256,
  counts: report.counts, details: report.details, warnings: report.warnings, errors: report.errors }, null, 2));
if (report.errors.length) process.exitCode = 1;

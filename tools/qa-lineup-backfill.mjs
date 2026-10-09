/** Explicit lineup-only recovery. Defaults to provider/database read-only preview. */
import { registerHooks } from "node:module";
import "dotenv/config";

const matchId = process.argv[2];
if (!/^[a-f0-9-]{36}$/i.test(matchId ?? "")) throw new Error("Pass one canonical match UUID.");
const apply = process.argv.includes("--apply");
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export%20%7B%7D", shortCircuit: true };
  try { return nextResolve(specifier, context); }
  catch (error) {
    if (error.code !== "ERR_MODULE_NOT_FOUND" || !specifier.startsWith(".")) throw error;
    return nextResolve(`${specifier}.ts`, context);
  }
} });
const { syncGoalLineups } = await import("../src/lib/providers/rich-match/sync.ts");
console.log(JSON.stringify(await syncGoalLineups({ matchId, dryRun: !apply }), null, 2));

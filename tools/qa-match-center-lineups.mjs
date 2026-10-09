/** Read-only Match Center loader check for recovered lineups. */
import { registerHooks } from "node:module";
import "dotenv/config";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export%20%7B%7D", shortCircuit: true };
  try { return nextResolve(specifier, context); }
  catch (error) {
    if (error.code !== "ERR_MODULE_NOT_FOUND" || !specifier.startsWith(".")) throw error;
    return nextResolve(`${specifier}.ts`, context);
  }
} });
const { getMatchCenter } = await import("../src/lib/matches/get-match-center.ts");
for (const matchId of process.argv.slice(2)) {
  const center = await getMatchCenter(matchId);
  if (!center) throw new Error(`Match Center did not load ${matchId}.`);
  console.log(JSON.stringify({ matchId, lineups: center.coverage.lineups,
    formations: center.coverage.formations }, null, 2));
  if (!center.coverage.lineups.complete) process.exitCode = 1;
}

/** Read-only fingerprints for account-migration and claim checks. Never prints row values. */
import "dotenv/config";
import { createHash } from "node:crypto";
import pg from "pg";

const url = new URL(process.env.DATABASE_URL ?? "");
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.pathname !== "/barca_dashboard") {
  throw new Error("This local QA command refuses a non-local or unexpected database.");
}
const tables = ["match_diary_entry", "favourite_player", "favourite_match", "media_save", "media_moment", "match_event"];
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
try {
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const result = {};
  for (const table of tables) {
    const rows = (await client.query(`SELECT * FROM "${table}" ORDER BY id`)).rows;
    // The migration adds this column without changing the rest of a legacy row.
    const unchangedFields = rows.map((row) => { const copy = { ...row }; delete copy.userId; return copy; });
    result[table] = { count: rows.length, unchangedFieldsSha256: createHash("sha256").update(JSON.stringify(unchangedFields)).digest("hex"),
      unclaimed: rows.filter((row) => "userId" in row && row.userId === null).length };
  }
  const accounts = (await client.query('SELECT role FROM app_user')).rows;
  result.accounts = { count: accounts.length, admins: accounts.filter((account) => account.role === "admin").length };
  await client.query("COMMIT");
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end();
}

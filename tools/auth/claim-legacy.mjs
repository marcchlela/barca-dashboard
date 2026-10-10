/** Explicit one-time owner claim. Preview is read-only; --apply is deliberately separate. */
import "dotenv/config";
import pg from "pg";
import { createHash } from "node:crypto";

const args = process.argv.slice(2);
const value = (flag) => args.includes(flag) ? args[args.indexOf(flag) + 1] : null;
const email = value("--email")?.trim().toLowerCase();
const apply = args.includes("--apply");
const expectedUserId = value("--user-id");
const expectedDigest = value("--confirm");
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || args.some((arg) => arg.startsWith("--") && !["--email", "--apply", "--user-id", "--confirm"].includes(arg))) {
  throw new Error("Use --email YOUR_ACCOUNT_EMAIL [--apply --user-id UUID --confirm PREVIEW_DIGEST]. Default is read-only.");
}
if (apply && (!/^[0-9a-f-]{36}$/i.test(expectedUserId ?? "") || !/^[0-9a-f]{64}$/i.test(expectedDigest ?? ""))) {
  throw new Error("Apply requires the exact --user-id and --confirm digest from the read-only preview.");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(apply ? "BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE" : "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await client.query("SET LOCAL statement_timeout = '15s'");
  const one = async (sql, params = []) => (await client.query(sql, params)).rows[0];
  const user = await one('SELECT id, email, username, role FROM app_user WHERE email = $1', [email]);
  if (!user) throw new Error("Account not found. Create and sign in to your account first; no rows were changed.");
  const tables = [
    ["match_diary_entry", '"matchId"'],
    ["favourite_player", '"playerId"'],
    ["favourite_match", '"matchId"'],
    ["media_save", '"mediaItemId"'],
  ];
  const counts = {};
  const unclaimedIds = {};
  for (const [table, identity] of tables) {
    const row = await one(`SELECT count(*) FILTER (WHERE "userId" IS NULL)::int AS unclaimed,
      count(*) FILTER (WHERE "userId" = $1)::int AS already_owned,
      count(*) FILTER (WHERE "userId" IS NULL AND ${identity} IN
        (SELECT ${identity} FROM ${table} WHERE "userId" = $1))::int AS conflict
      FROM ${table}`, [user.id]);
    counts[table] = row;
    unclaimedIds[table] = (await client.query(`SELECT id FROM ${table} WHERE "userId" IS NULL ORDER BY id`)).rows.map((item) => item.id);
  }
  const slotConflict = await one(`SELECT count(*)::int AS count FROM favourite_match legacy
    JOIN favourite_match owned ON owned."userId" = $1 AND legacy."userId" IS NULL
      AND legacy."seasonId" = owned."seasonId" AND legacy.slot = owned.slot`, [user.id]);
  const conflicts = Object.values(counts).reduce((sum, row) => sum + row.conflict, slotConflict.count);
  const claimDigest = createHash("sha256").update(JSON.stringify({ accountId: user.id, unclaimedIds })).digest("hex");
  const sessionsToRevoke = user.role === "admin" ? 0 : (await one('SELECT count(*)::int AS count FROM user_session WHERE "userId" = $1', [user.id])).count;
  const report = { mode: apply ? "apply" : "preview", account: { id: user.id, email: user.email, username: user.username, existingRole: user.role }, counts, topThreeSlotConflicts: slotConflict.count, conflicts, claimDigest, sessionsToRevoke };
  if (conflicts) throw new Error(`Claim blocked by ${conflicts} existing personal-record conflict(s). Preview: ${JSON.stringify(report)}`);
  if (apply && (user.id !== expectedUserId || claimDigest !== expectedDigest)) throw new Error("Account ID or claim digest differs from preview; no rows were changed.");
  if (apply) {
    for (const [table] of tables) await client.query(`UPDATE ${table} SET "userId" = $1 WHERE "userId" IS NULL`, [user.id]);
    if (user.role !== "admin") await client.query('DELETE FROM user_session WHERE "userId" = $1', [user.id]);
    await client.query("UPDATE app_user SET role = 'admin', \"updatedAt\" = now() WHERE id = $1 AND role <> 'admin'", [user.id]);
    await client.query("COMMIT");
    console.log(JSON.stringify({ ...report, result: "claimed and granted admin", note: "Production admin also requires BARCA_ADMIN_SUBJECTS to include this account UUID." }, null, 2));
  } else {
    await client.query("ROLLBACK");
    console.log(JSON.stringify({ ...report, result: "no changes" }, null, 2));
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end();
}

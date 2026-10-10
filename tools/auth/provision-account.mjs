/** Private one-time account provisioning. Preview is read-only; passwords enter through stdin only. */
import "dotenv/config";
import pg from "pg";
import { createHash, randomUUID } from "node:crypto";
import { hashPassword, normalizeEmail, normalizeUsername, validEmail, validPassword, validUsername } from "../../src/lib/auth/policy.ts";

const args = process.argv.slice(2);
const allowed = new Set(["--email", "--username", "--apply", "--confirm", "--password-stdin"]);
if (args.some((arg) => arg.startsWith("--") && !allowed.has(arg))) throw new Error("Unknown option.");
const value = (flag) => args.includes(flag) ? args[args.indexOf(flag) + 1] : null;
const email = normalizeEmail(value("--email") ?? "");
const username = normalizeUsername(value("--username") ?? "");
const apply = args.includes("--apply");
const digest = value("--confirm");
if (!validEmail(email) || !validUsername(username)) {
  throw new Error("Use --email VALID_EMAIL --username VALID_USERNAME (3-30 lowercase letters, digits or underscores).");
}
if (apply && (!/^[0-9a-f]{64}$/.test(digest ?? "") || !args.includes("--password-stdin"))) {
  throw new Error("Apply requires --confirm DIGEST_FROM_PREVIEW --password-stdin. Never pass a password as an argument.");
}
if (!apply && (digest || args.includes("--password-stdin"))) throw new Error("Password and confirmation are only accepted with --apply.");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

async function passwordFromStdin() {
  let input = Buffer.alloc(0);
  for await (const chunk of process.stdin) {
    input = Buffer.concat([input, Buffer.from(chunk)]);
    if (input.length > 4098) throw new Error("Password input is too large.");
  }
  const password = input.toString("utf8").replace(/\r?\n$/, "");
  input.fill(0);
  if (!validPassword(password)) throw new Error("Password must be 8-1024 characters and at most 4096 UTF-8 bytes.");
  return password;
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(apply ? "BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE" : "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await client.query("SET LOCAL statement_timeout = '15s'");
  const schema = (await client.query("SELECT to_regclass('public.app_user') AS account_table")).rows[0];
  if (!schema.account_table) throw new Error("Account migration has not been applied; no account was created.");
  const existing = (await client.query("SELECT id, email, username, role FROM app_user WHERE email = $1 OR username = $2", [email, username])).rows;
  const legacy = {};
  for (const table of ["match_diary_entry", "favourite_match", "favourite_player", "media_save"]) {
    legacy[table] = (await client.query(`SELECT count(*)::int AS count FROM ${table} WHERE "userId" IS NULL`)).rows[0].count;
  }
  const confirmation = createHash("sha256").update(JSON.stringify({ email, username, existing, legacy })).digest("hex");
  const report = { mode: apply ? "apply" : "preview", email, username, accountExists: existing.length > 0, unclaimedPersonalRows: legacy, confirmation };
  if (existing.length) throw new Error(`Email or username is already registered. No changes made. ${JSON.stringify(report)}`);
  if (apply && digest !== confirmation) throw new Error("Preview changed or confirmation differs. No account was created; run preview again.");
  if (apply) {
    const password = await passwordFromStdin();
    const passwordHash = await hashPassword(password);
    const id = randomUUID();
    await client.query('INSERT INTO app_user (id, email, username, "passwordHash", role, "updatedAt") VALUES ($1, $2, $3, $4, $5, now())',
      [id, email, username, passwordHash, "user"]);
    await client.query("COMMIT");
    console.log(JSON.stringify({ ...report, result: "account created; sign in and preview the separate legacy claim", accountId: id }, null, 2));
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

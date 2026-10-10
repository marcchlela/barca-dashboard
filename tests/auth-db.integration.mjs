import test from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import pg from "pg";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { verifyPassword } from "../src/lib/auth/policy.ts";
import { allowSignupAttempt } from "../src/lib/auth/signup-limiter.ts";

test("isolated account migration, per-user ownership and explicit legacy claim", { skip: process.env.RUN_AUTH_DB_INTEGRATION !== "1" }, async () => {
  const source = new URL(process.env.DATABASE_URL ?? "");
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(source.hostname), "Test refuses non-local PostgreSQL");
  const name = `barca_auth_qa_${randomBytes(6).toString("hex")}`;
  const adminUrl = new URL(source);
  adminUrl.pathname = "/postgres";
  const testUrl = new URL(source);
  testUrl.pathname = `/${name}`;
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  let created = false;
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    const command = process.platform === "win32" ? "cmd.exe" : "npx";
    const migrate = (to) => {
      const prismaArgs = `npx.cmd prisma db migrate${to ? ` --to ${to}` : ""}`;
      const arguments_ = process.platform === "win32" ? ["/d", "/s", "/c", prismaArgs] : ["prisma", "db", "migrate", ...(to ? ["--to", to] : [])];
      const result = spawnSync(command, arguments_, { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: testUrl.toString() }, encoding: "utf8", timeout: 120_000 });
      assert.equal(result.status, 0, (result.stderr ?? "") + (result.stdout ?? ""));
    };
    migrate("f6097504120286aca553e1ede724057f6150800b76a93503305c0fc785245fd4");
    const client = new pg.Client({ connectionString: testUrl.toString() });
    await client.connect();
    try {
      const [first, second, player, legacyPlayer, legacyFavourite] = Array.from({ length: 5 }, () => randomUUID());
      await client.query(`INSERT INTO player (id,"displayName","updatedAt") VALUES ($1,'Legacy Player',now())`, [legacyPlayer]);
      await client.query('INSERT INTO favourite_player (id,"playerId","sortOrder") VALUES ($1,$2,0)', [legacyFavourite, legacyPlayer]);
      migrate();
      const preserved = (await client.query('SELECT id, "userId" FROM favourite_player WHERE id=$1', [legacyFavourite])).rows[0];
      assert.deepEqual(preserved, { id: legacyFavourite, userId: null });
      await client.query(`INSERT INTO app_user (id,email,username,"passwordHash","updatedAt") VALUES
        ($1,'owner@example.test','owner','hash',now()), ($2,'other@example.test','other','hash',now())`, [first, second]);
      await client.query('INSERT INTO user_session (id,"userId","tokenHash","expiresAt") VALUES ($1,$2,$3,now()+interval \'1 day\')',
        [randomUUID(), first, randomBytes(32).toString("hex")]);
      await client.query(`INSERT INTO player (id,"displayName","updatedAt") VALUES ($1,'Test Player',now())`, [player]);
      await client.query(`INSERT INTO favourite_player (id,"userId","playerId","sortOrder") VALUES
        ($1,$2,$3,0), ($4,$5,$3,0)`, [randomUUID(), first, player, randomUUID(), second]);
      const rows = (await client.query('SELECT "userId", "playerId" FROM favourite_player ORDER BY "userId" NULLS LAST')).rows;
      assert.equal(rows.length, 3);
      assert.equal(rows.filter((row) => row.userId === first).length, 1);
      assert.equal(rows.filter((row) => row.userId === second).length, 1);
      assert.equal(rows.filter((row) => row.userId === null).length, 1);
      await assert.rejects(client.query('INSERT INTO favourite_player (id,"userId","playerId") VALUES ($1,$2,$3)', [randomUUID(), first, player]), /duplicate key/);
      const runClaim = (apply, digest) => spawnSync("node", ["tools/auth/claim-legacy.mjs", "--email", "owner@example.test",
        ...(apply ? ["--apply", "--user-id", first, "--confirm", digest] : [])],
        { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: testUrl.toString() }, encoding: "utf8", timeout: 30_000 });
      const preview = runClaim(false);
      assert.equal(preview.status, 0, preview.stderr);
      const previewData = JSON.parse(preview.stdout);
      assert.equal(previewData.counts.favourite_player.unclaimed, 1);
      assert.equal(previewData.sessionsToRevoke, 1);
      assert.equal((await client.query('SELECT count(*)::int AS n FROM favourite_player WHERE "userId" IS NULL')).rows[0].n, 1);
      const wrongDigest = runClaim(true, "0".repeat(64));
      assert.notEqual(wrongDigest.status, 0);
      assert.equal((await client.query('SELECT count(*)::int AS n FROM favourite_player WHERE "userId" IS NULL')).rows[0].n, 1);
      const applied = runClaim(true, previewData.claimDigest);
      assert.equal(applied.status, 0, applied.stderr);
      assert.equal((await client.query('SELECT count(*)::int AS n FROM favourite_player WHERE "userId" IS NULL')).rows[0].n, 0);
      assert.equal((await client.query('SELECT count(*)::int AS n FROM user_session WHERE "userId" = $1', [first])).rows[0].n, 0);
      const repeatedPreview = runClaim(false);
      assert.equal(repeatedPreview.status, 0, repeatedPreview.stderr);
      const repeated = runClaim(true, JSON.parse(repeatedPreview.stdout).claimDigest);
      assert.equal(repeated.status, 0, repeated.stderr);
      assert.equal(JSON.parse(repeated.stdout).counts.favourite_player.unclaimed, 0);
      assert.equal((await client.query('SELECT count(*)::int AS n FROM favourite_player WHERE "userId" = $1', [first])).rows[0].n, 2);
      assert.equal((await client.query('SELECT role FROM app_user WHERE id=$1', [first])).rows[0].role, "admin");
      assert.equal((await client.query('SELECT role FROM app_user WHERE id=$1', [second])).rows[0].role, "user");

      const provisionArgs = ["tools/auth/provision-account.mjs", "--email", " NewFan@Example.test ", "--username", "NewFan"];
      const runProvision = (extra = [], input) => spawnSync("node", [...provisionArgs, ...extra], {
        cwd: process.cwd(), env: { ...process.env, DATABASE_URL: testUrl.toString() }, encoding: "utf8", input, timeout: 30_000,
      });
      const provisionPreview = runProvision();
      assert.equal(provisionPreview.status, 0, provisionPreview.stderr);
      const provisionData = JSON.parse(provisionPreview.stdout);
      assert.equal(provisionData.accountExists, false);
      assert.equal((await client.query("SELECT count(*)::int AS n FROM app_user")).rows[0].n, 2);
      const rejectedProvision = runProvision(["--apply", "--confirm", "0".repeat(64), "--password-stdin"], "a private password\n");
      assert.notEqual(rejectedProvision.status, 0);
      assert.equal((await client.query("SELECT count(*)::int AS n FROM app_user")).rows[0].n, 2);
      const provisioned = runProvision(["--apply", "--confirm", provisionData.confirmation, "--password-stdin"], "a private password\n");
      assert.equal(provisioned.status, 0, provisioned.stderr);
      assert.doesNotMatch(provisioned.stdout, /private password|scrypt\$/);
      const createdAccount = (await client.query("SELECT email, username, role, \"passwordHash\" FROM app_user WHERE email='newfan@example.test'")).rows[0];
      assert.equal(createdAccount.username, "newfan");
      assert.equal(createdAccount.role, "user");
      assert.equal(await verifyPassword("a private password", createdAccount.passwordHash), true);
      assert.notEqual(runProvision().status, 0, "Repeat provisioning must not create another account");

      const previousUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = testUrl.toString();
      try {
        const permits = await Promise.all(Array.from({ length: 8 }, () => allowSignupAttempt("Burst@Example.test", "Burst")));
        assert.equal(permits.filter(Boolean).length, 5, "Concurrent signup attempts must obey the identifier ceiling");
        assert.equal((await client.query("SELECT attempts FROM auth_throttle WHERE key LIKE 'signup:email:%'")).rows[0].attempts, 5);
        await client.query("UPDATE auth_throttle SET \"windowStart\" = now() - interval '2 hours' WHERE key LIKE 'signup:email:%' OR key LIKE 'signup:username:%'");
        assert.equal(await allowSignupAttempt("Burst@Example.test", "Burst"), true, "The ceiling resets after its window");
      } finally {
        process.env.DATABASE_URL = previousUrl;
      }
    } finally { await client.end(); }
  } finally {
    if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
  }
});

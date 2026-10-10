import { createHash } from "node:crypto";
import pg from "pg";

/** A database-backed ceiling for public signup. It does not trust spoofable forwarding headers. */
export async function allowSignupAttempt(emailInput: string, usernameInput: string): Promise<boolean> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const email = emailInput.trim().toLowerCase();
    const username = usernameInput.trim().toLowerCase();
    const digest = (value: string) => createHash("sha256").update(value).digest("hex");
    const limits: Array<[string, number]> = [
      ["signup:global", 60],
      [`signup:email:${digest(email)}`, 5],
      [`signup:username:${digest(username)}`, 5],
    ];
    for (const [key, ceiling] of limits) {
      const result = await client.query(`
        INSERT INTO auth_throttle (key, attempts, "windowStart", "updatedAt")
        VALUES ($1, 1, now(), now())
        ON CONFLICT (key) DO UPDATE SET
          attempts = CASE WHEN auth_throttle."windowStart" <= now() - interval '1 hour'
            THEN 1 ELSE auth_throttle.attempts + 1 END,
          "windowStart" = CASE WHEN auth_throttle."windowStart" <= now() - interval '1 hour'
            THEN now() ELSE auth_throttle."windowStart" END,
          "updatedAt" = now()
        WHERE auth_throttle."windowStart" <= now() - interval '1 hour' OR auth_throttle.attempts < $2
        RETURNING attempts`, [key, ceiling]);
      if (result.rowCount === 0) return false;
    }
    return true;
  } finally {
    await client.end();
  }
}

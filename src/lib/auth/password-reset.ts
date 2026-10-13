import "server-only";

import { randomUUID } from "node:crypto";
import pg from "pg";
import { hashPassword, hashToken, newSessionToken, normalizeEmail, validEmail, validPassword } from "./policy";
import { renderDashboardEmail } from "../email/templates";
import { getSmtpConfig, sendDashboardEmail, smtpPublicStatus } from "../email/smtp";

export const RESET_MESSAGE = "If an account uses that email, a password reset link will arrive shortly.";

export function passwordResetAvailable(): boolean {
  return smtpPublicStatus().configured;
}

async function withClient<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try { return await fn(client); } finally { await client.end(); }
}

export async function requestPasswordReset(emailInput: string): Promise<"sent" | "limited" | "unavailable"> {
  const config = getSmtpConfig();
  if (!config) return "unavailable";
  const email = normalizeEmail(emailInput);
  if (!validEmail(email)) return "sent";
  const token = newSessionToken();
  const tokenId = randomUUID();
  const user = await withClient(async (client) => {
    // Database-backed throttles cover unknown emails too, without trusting a forwarded IP.
    for (const [key, ceiling] of [["reset:global", 100], [`reset:email:${hashToken(email)}`, 3]] as const) {
      const result = await client.query(`INSERT INTO auth_throttle (key, attempts, "windowStart", "updatedAt")
        VALUES ($1, 1, now(), now()) ON CONFLICT (key) DO UPDATE SET
        attempts = CASE WHEN auth_throttle."windowStart" <= now() - interval '1 hour' THEN 1 ELSE auth_throttle.attempts + 1 END,
        "windowStart" = CASE WHEN auth_throttle."windowStart" <= now() - interval '1 hour' THEN now() ELSE auth_throttle."windowStart" END,
        "updatedAt" = now()
        WHERE auth_throttle."windowStart" <= now() - interval '1 hour' OR auth_throttle.attempts < $2
        RETURNING attempts`, [key, ceiling]);
      if (!result.rowCount) return { limited: true as const, email: null };
    }
    const found = await client.query<{ id: string; email: string }>(`SELECT id, email FROM app_user WHERE email = $1`, [email]);
    if (!found.rows[0]) return { limited: false as const, email: null };
    await client.query(`INSERT INTO password_reset_token (id, "userId", "tokenHash", "expiresAt")
      VALUES ($1, $2, $3, now() + interval '30 minutes')`, [tokenId, found.rows[0].id, hashToken(token)]);
    return { limited: false as const, email: found.rows[0].email };
  });
  if (user.limited) return "limited";
  if (!user.email) return "sent";
  const link = new URL("/account/reset-password", config.origin);
  link.searchParams.set("token", token);
  const outcome = await sendDashboardEmail({
    kind: "password_reset",
    to: user.email,
    ...renderDashboardEmail("password_reset", { resetUrl: link.toString(), origin: config.origin }),
  });
  if (!outcome.accepted) {
    await withClient((client) => client.query(`DELETE FROM password_reset_token WHERE id = $1`, [tokenId]).then(() => undefined));
  }
  return "sent";
}

export async function consumePasswordReset(token: string, password: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !validPassword(password)) return false;
  const passwordHash = await hashPassword(password);
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const result = await client.query<{ userId: string }>(`UPDATE password_reset_token SET "usedAt" = now()
        WHERE "tokenHash" = $1 AND "usedAt" IS NULL AND "expiresAt" > now() RETURNING "userId"`, [hashToken(token)]);
      const userId = result.rows[0]?.userId;
      if (!userId) { await client.query("ROLLBACK"); return false; }
      await client.query(`UPDATE app_user SET "passwordHash" = $2, "updatedAt" = now() WHERE id = $1`, [userId, passwordHash]);
      await client.query(`DELETE FROM user_session WHERE "userId" = $1`, [userId]);
      await client.query(`UPDATE password_reset_token SET "usedAt" = now() WHERE "userId" = $1 AND "usedAt" IS NULL`, [userId]);
      await client.query("COMMIT");
      return true;
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

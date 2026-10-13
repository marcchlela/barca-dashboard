import pg from "pg";
import { requireAdminPage } from "../../../../../lib/admin/access";
import { requireSameOrigin } from "../../../../../lib/auth/session";
import { getSmtpConfig, sendDashboardEmail } from "../../../../../lib/email/smtp";
import { renderDashboardEmail } from "../../../../../lib/email/templates";

export async function POST(request: Request) {
  const viewer = await requireAdminPage();
  const denied = requireSameOrigin(request);
  if (denied) return denied;
  const smtp = getSmtpConfig();
  if (!smtp) return Response.json({ ok: false, error: "SMTP is not configured." }, { status: 503 });
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const schema = await client.query<{ present: boolean }>(`SELECT to_regclass('public.email_delivery_attempt') IS NOT NULL AS present`);
    if (!schema.rows[0]?.present) return Response.json({ ok: false, error: "Email logging migration is pending." }, { status: 503, headers: { "cache-control": "no-store" } });
    const rate = await client.query(`INSERT INTO auth_throttle (key, attempts, "windowStart", "updatedAt")
      VALUES ($1,1,now(),now()) ON CONFLICT (key) DO UPDATE SET
      attempts=CASE WHEN auth_throttle."windowStart" <= now() - interval '1 hour' THEN 1 ELSE auth_throttle.attempts+1 END,
      "windowStart"=CASE WHEN auth_throttle."windowStart" <= now() - interval '1 hour' THEN now() ELSE auth_throttle."windowStart" END,
      "updatedAt"=now()
      WHERE auth_throttle."windowStart" <= now() - interval '1 hour' OR auth_throttle.attempts < 3
      RETURNING attempts`, [`email-test:${viewer.id}`]);
    if (!rate.rowCount) return Response.json({ ok: false, error: "Test email limit reached. Try again in an hour." }, { status: 429, headers: { "cache-control": "no-store" } });
  } finally { await client.end(); }
  const result = await sendDashboardEmail({ kind: "admin_test", to: viewer.email, ...renderDashboardEmail("admin_test", { origin: smtp.origin }) });
  return Response.json(result.accepted ? { ok: true, message: "SMTP accepted the test email. Check your inbox and spam folder." }
    : { ok: false, error: `SMTP did not accept the test email (${result.errorCode ?? "SMTP_ERROR"}).` },
  { status: result.accepted ? 200 : 502, headers: { "cache-control": "no-store" } });
}

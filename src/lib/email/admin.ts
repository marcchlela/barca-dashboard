import "server-only";

import pg from "pg";
import { smtpPublicStatus } from "./smtp";

export type EmailAttemptRow = {
  id: string;
  kind: string;
  recipientMasked: string;
  status: string;
  errorCode: string | null;
  createdAt: string;
};

export async function getAdminEmailData() {
  const smtp = smtpPublicStatus();
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const exists = await client.query<{ present: boolean }>(`SELECT to_regclass('public.email_delivery_attempt') IS NOT NULL AS present`);
    if (!exists.rows[0]?.present) return { smtp, schemaReady: false, accepted: 0, failed: 0, attempts: [] as EmailAttemptRow[] };
    const [counts, rows] = await Promise.all([
      client.query<{ accepted: number; failed: number }>(`SELECT count(*) FILTER (WHERE status='accepted')::int AS accepted, count(*) FILTER (WHERE status='failed')::int AS failed FROM email_delivery_attempt`),
      client.query<{ id: string; kind: string; recipientMasked: string; status: string; errorCode: string | null; createdAt: Date }>(`SELECT id, kind, "recipientMasked", status, "errorCode", "createdAt" FROM email_delivery_attempt ORDER BY "createdAt" DESC LIMIT 50`),
    ]);
    return { smtp, schemaReady: true, accepted: counts.rows[0]?.accepted ?? 0, failed: counts.rows[0]?.failed ?? 0, attempts: rows.rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })) };
  } finally { await client.end(); }
}

import pg from "pg";
import { hashPassword, validPassword } from "../../../../lib/auth/policy";
import { authenticate } from "../../../../lib/auth/accounts";
import { destroySession, getViewer, requireSameOrigin } from "../../../../lib/auth/session";
import { db } from "../../../../prisma/db";

export async function POST(request: Request) {
  const denied = requireSameOrigin(request);
  if (denied) return denied;
  const viewer = await getViewer();
  if (!viewer) return Response.json({ ok: false, error: "Sign in first." }, { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return Response.json({ ok: false, error: "Request too large." }, { status: 413 });
  try {
    const raw = await request.text();
    if (raw.length > 4096) return Response.json({ ok: false, error: "Request too large." }, { status: 413 });
    const body = JSON.parse(raw) as { currentPassword?: unknown; newPassword?: unknown };
    if (typeof body.currentPassword !== "string" || body.currentPassword.length > 1024 || typeof body.newPassword !== "string" || !validPassword(body.newPassword))
      return Response.json({ ok: false, error: "Use a new password of at least 8 characters." }, { status: 400 });
    const verified = await authenticate(viewer.email, body.currentPassword);
    if (!verified || verified.id !== viewer.id)
      return Response.json({ ok: false, error: "Current password is incorrect or temporarily locked." }, { status: 400 });
    const user = await db.orm.public.AppUser.where({ id: viewer.id }).first();
    if (!user) return Response.json({ ok: false, error: "Account unavailable." }, { status: 404 });
    const newHash = await hashPassword(body.newPassword);
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      await client.query("BEGIN");
      const changed = await client.query(`UPDATE app_user SET "passwordHash" = $1, "updatedAt" = now()
        WHERE id = $2 AND "passwordHash" = $3 RETURNING id`, [newHash, viewer.id, user.passwordHash]);
      if (!changed.rowCount) { await client.query("ROLLBACK"); return Response.json({ ok: false, error: "Account changed. Try again." }, { status: 409 }); }
      await client.query(`DELETE FROM user_session WHERE "userId" = $1`, [viewer.id]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { await client.end(); }
    await destroySession();
    return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
    console.error("PASSWORD CHANGE FAILED", error);
    return Response.json({ ok: false, error: "Could not change password." }, { status: 500 });
  }
}

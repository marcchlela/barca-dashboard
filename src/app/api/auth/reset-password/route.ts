import { consumePasswordReset } from "../../../../lib/auth/password-reset";
import { validPassword } from "../../../../lib/auth/policy";
import { requireSameOrigin } from "../../../../lib/auth/session";

export async function POST(request: Request) {
  const denied = requireSameOrigin(request);
  if (denied) return denied;
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return Response.json({ ok: false, error: "Request too large." }, { status: 413 });
  try {
    const raw = await request.text();
    if (raw.length > 4096) return Response.json({ ok: false, error: "Request too large." }, { status: 413 });
    const body = JSON.parse(raw) as { token?: unknown; password?: unknown };
    if (typeof body.token !== "string" || typeof body.password !== "string" || !validPassword(body.password))
      return Response.json({ ok: false, error: "Use a password of at least 8 characters." }, { status: 400 });
    const changed = await consumePasswordReset(body.token, body.password);
    return Response.json(changed ? { ok: true } : { ok: false, error: "This link is invalid or expired. Request a new one." }, { status: changed ? 200 : 400, headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
    console.error("PASSWORD RESET FAILED", error);
    return Response.json({ ok: false, error: "Could not reset your password." }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}

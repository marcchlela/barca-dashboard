import { passwordResetAvailable, requestPasswordReset, RESET_MESSAGE } from "../../../../lib/auth/password-reset";
import { requireSameOrigin } from "../../../../lib/auth/session";

export async function POST(request: Request) {
  const denied = requireSameOrigin(request);
  if (denied) return denied;
  if (!passwordResetAvailable()) return Response.json({ ok: false, error: "Password reset email is not configured yet." }, { status: 503, headers: { "cache-control": "no-store" } });
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return Response.json({ ok: false, error: "Request too large." }, { status: 413 });
  try {
    const raw = await request.text();
    if (raw.length > 4096) return Response.json({ ok: false, error: "Request too large." }, { status: 413 });
    const body = JSON.parse(raw) as { email?: unknown };
    if (typeof body.email !== "string" || body.email.length > 254) return Response.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
    await requestPasswordReset(body.email);
    return Response.json({ ok: true, message: RESET_MESSAGE }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
    console.error("PASSWORD RESET REQUEST FAILED", error);
    return Response.json({ ok: false, error: "Password reset is temporarily unavailable." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

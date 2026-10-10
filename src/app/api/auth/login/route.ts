import { authenticate } from "../../../../lib/auth/accounts";
import { createSession, destroySession, requireSameOrigin } from "../../../../lib/auth/session";

export async function POST(request: Request) {
  const denied = requireSameOrigin(request);
  if (denied) return denied;
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return Response.json({ ok: false, error: "Request too large." }, { status: 413 });
  try {
    const raw = await request.text();
    if (raw.length > 4096) return Response.json({ ok: false, error: "Request too large." }, { status: 413 });
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (typeof body.identifier !== "string" || typeof body.password !== "string") {
      return Response.json({ ok: false, error: "Username/email and password are required." }, { status: 400 });
    }
    const user = await authenticate(body.identifier, body.password);
    if (!user) return Response.json({ ok: false, error: "Invalid credentials or temporarily locked. Try again later." }, { status: 401, headers: { "cache-control": "no-store" } });
    await destroySession();
    await createSession(user.id);
    return Response.json({ ok: true, user: { id: user.id, username: user.username, role: user.role } }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
    console.error("ACCOUNT LOGIN FAILED", error);
    return Response.json({ ok: false, error: "Sign-in failed." }, { status: 500 });
  }
}

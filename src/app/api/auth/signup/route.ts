import { register } from "../../../../lib/auth/accounts";
import { requireSameOrigin, createSession } from "../../../../lib/auth/session";
import { allowSignupAttempt } from "../../../../lib/auth/signup-limiter";

export async function POST(request: Request) {
  const denied = requireSameOrigin(request);
  if (denied) return denied;
  if (process.env.NODE_ENV === "production" && process.env.BARCA_SIGNUP_ENABLED !== "1") {
    return Response.json({ ok: false, error: "Account registration is not open yet." }, { status: 503 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return Response.json({ ok: false, error: "Request too large." }, { status: 413 });
  try {
    const raw = await request.text();
    if (raw.length > 4096) return Response.json({ ok: false, error: "Request too large." }, { status: 413 });
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (typeof body.email !== "string" || typeof body.username !== "string" || typeof body.password !== "string") {
      return Response.json({ ok: false, error: "Email, username and password are required." }, { status: 400 });
    }
    if (!await allowSignupAttempt(body.email, body.username)) {
      return Response.json({ ok: false, error: "Too many account creation attempts. Try again later." },
        { status: 429, headers: { "retry-after": "3600", "cache-control": "no-store" } });
    }
    const result = await register({ email: body.email, username: body.username, password: body.password });
    if (!result.ok) return Response.json(result, { status: 400 });
    await createSession(result.userId);
    return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
    console.error("ACCOUNT SIGNUP FAILED", error);
    return Response.json({ ok: false, error: "Account creation failed." }, { status: 500 });
  }
}

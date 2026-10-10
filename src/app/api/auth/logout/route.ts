import { destroySession, requireSameOrigin } from "../../../../lib/auth/session";

export async function POST(request: Request) {
  const denied = requireSameOrigin(request);
  if (denied) return denied;
  await destroySession();
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}

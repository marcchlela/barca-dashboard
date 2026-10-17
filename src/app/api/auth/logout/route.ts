import { destroySession, getViewer, requireSameOrigin } from "../../../../lib/auth/session";
import { db } from "../../../../prisma/db";
import { Temporal } from "temporal-polyfill";

export async function POST(request: Request) {
  const denied = requireSameOrigin(request);
  if (denied) return denied;
  const viewer = await getViewer();
  const body = await request.json().catch(() => null) as { pushEndpoint?: unknown } | null;
  if (viewer && typeof body?.pushEndpoint === "string") {
    const subscription = await db.orm.public.PushSubscription.where({ userId: viewer.id, endpoint: body.pushEndpoint }).first();
    if (subscription) await db.orm.public.PushSubscription.where({ id: subscription.id }).update({ disabledAt: Temporal.Now.instant() });
  }
  await destroySession();
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}

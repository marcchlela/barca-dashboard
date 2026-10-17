import { db } from "../../../prisma/db";
import { getViewer, requireSameOrigin } from "../../../lib/auth/session";
import { notificationKinds, notificationKindIds } from "../../../lib/notifications/catalog";
import { allowedPushEndpoint, pushConfiguration } from "../../../lib/notifications/delivery";

export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ ok: false, error: "Sign in to manage notifications." }, { status: 401 });
  const preferences = await db.orm.public.NotificationPreference.where({ userId: viewer.id }).all();
  return Response.json({ ok: true, configured: Boolean(pushConfiguration()), publicKey: pushConfiguration()?.publicKey ?? null,
    kinds: notificationKinds.filter((item) => item.group !== "Admin" || viewer.role === "admin"),
    preferences: Object.fromEntries(preferences.map((row) => [row.kind, row.enabled])) },
  { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ ok: false, error: "Sign in to manage notifications." }, { status: 401 });
  const denied = requireSameOrigin(request);
  if (denied) return denied;
  const data = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!data) return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  if (data.action === "preference") {
    if (typeof data.kind !== "string" || !notificationKindIds.has(data.kind) || typeof data.enabled !== "boolean") return Response.json({ ok: false, error: "Invalid preference." }, { status: 400 });
    const kind = notificationKinds.find((item) => item.id === data.kind)!;
    if (kind.group === "Admin" && viewer.role !== "admin") return Response.json({ ok: false, error: "Not available." }, { status: 403 });
    const prior = await db.orm.public.NotificationPreference.where({ userId: viewer.id, kind: data.kind }).first();
    if (prior) await db.orm.public.NotificationPreference.where({ id: prior.id }).update({ enabled: data.enabled });
    else await db.orm.public.NotificationPreference.create({ userId: viewer.id, kind: data.kind, enabled: data.enabled });
    return Response.json({ ok: true });
  }
  if (data.action === "subscribe") {
    if (!pushConfiguration()) return Response.json({ ok: false, error: "Web Push is not configured." }, { status: 503 });
    const row = data.subscription && typeof data.subscription === "object" ? data.subscription as Record<string, unknown> : null;
    const keys = row?.keys && typeof row.keys === "object" ? row.keys as Record<string, unknown> : null;
    if (typeof row?.endpoint !== "string" || !allowedPushEndpoint(row.endpoint) || row.endpoint.length > 2048 ||
      typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string" || keys.p256dh.length > 512 || keys.auth.length > 512) {
      return Response.json({ ok: false, error: "Invalid push subscription." }, { status: 400 });
    }
    const prior = await db.orm.public.PushSubscription.where({ endpoint: row.endpoint }).first();
    if (prior && prior.userId !== viewer.id) return Response.json({ ok: false, error: "This device is linked to another account. Disable its old subscription first." }, { status: 409 });
    if (prior) await db.orm.public.PushSubscription.where({ id: prior.id }).update({ p256dh: keys.p256dh, auth: keys.auth, disabledAt: null });
    else {
      const devices = await db.orm.public.PushSubscription.where({ userId: viewer.id }).all();
      if (devices.filter((item) => !item.disabledAt).length >= 8) return Response.json({ ok: false, error: "Eight active devices is the current limit." }, { status: 429 });
      await db.orm.public.PushSubscription.create({ userId: viewer.id, endpoint: row.endpoint, p256dh: keys.p256dh, auth: keys.auth,
        userAgent: request.headers.get("user-agent")?.slice(0, 240) ?? null });
    }
    return Response.json({ ok: true });
  }
  if (data.action === "unsubscribe") {
    if (typeof data.endpoint !== "string") return Response.json({ ok: false, error: "Endpoint required." }, { status: 400 });
    const prior = await db.orm.public.PushSubscription.where({ endpoint: data.endpoint, userId: viewer.id }).first();
    if (prior) await db.orm.public.PushSubscription.where({ id: prior.id }).update({ disabledAt: new Date().toISOString() });
    return Response.json({ ok: true });
  }
  return Response.json({ ok: false, error: "Unknown action." }, { status: 400 });
}

import { randomUUID } from "node:crypto";
import { db } from "../../../../prisma/db";
import { guardAdminRequest, requireAdminPage } from "../../../../lib/admin/access";
import { notificationKinds, notificationKindIds } from "../../../../lib/notifications/catalog";
import { pushConfiguration, queueNotification } from "../../../../lib/notifications/delivery";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdminPage();
  const [templates, events, subscriptions] = await Promise.all([
    db.orm.public.NotificationTemplate.all(),
    db.orm.public.NotificationEvent.orderBy((row) => row.createdAt.desc()).limit(100).all(),
    db.orm.public.PushSubscription.where({ disabledAt: null }).all(),
  ]);
  const deliveries = await db.orm.public.NotificationDelivery.orderBy((row) => row.createdAt.desc()).limit(2000).all();
  const counts = new Map<string, { accepted: number; failed: number; pending: number }>();
  for (const delivery of deliveries) {
    const value = counts.get(delivery.eventId) ?? { accepted: 0, failed: 0, pending: 0 };
    if (delivery.status === "accepted") value.accepted += 1;
    else if (delivery.status === "failed") value.failed += 1;
    else value.pending += 1;
    counts.set(delivery.eventId, value);
  }
  return Response.json({ ok: true, configured: Boolean(pushConfiguration()), subscribers: subscriptions.length,
    kinds: notificationKinds, templates: Object.fromEntries(templates.map((item) => [item.kind, { title: item.title, body: item.body }])),
    history: events.map((event) => ({ id: event.id, kind: event.kind, title: event.title,
      body: event.body.replaceAll("{localKickoffTime}", "each recipient's local time").replaceAll("{localKickoff}", "each recipient's local date and time"), audience: event.audience,
      createdAt: event.createdAt.toString(), ...counts.get(event.id) ?? { accepted: 0, failed: 0, pending: 0 } })) },
  { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const denied = await guardAdminRequest(request);
  if (denied) return denied;
  const viewer = await requireAdminPage();
  const data = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!data) return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  if (data.action === "template") {
    if (typeof data.kind !== "string" || !notificationKindIds.has(data.kind) ||
      typeof data.title !== "string" || !data.title.trim() || data.title.length > 120 ||
      typeof data.body !== "string" || data.body.length > 240) return Response.json({ ok: false, error: "Invalid template." }, { status: 400 });
    const existing = await db.orm.public.NotificationTemplate.where({ kind: data.kind }).first();
    if (existing) await db.orm.public.NotificationTemplate.where({ kind: data.kind }).update({ title: data.title.trim(), body: data.body.trim() });
    else await db.orm.public.NotificationTemplate.create({ kind: data.kind, title: data.title.trim(), body: data.body.trim() });
    return Response.json({ ok: true });
  }
  if (data.action === "test" || data.action === "custom") {
    const isTest = data.action === "test";
    const title = isTest ? "Barça Dashboard test" : data.title;
    const body = isTest ? "Notifications are working on this device." : data.body;
    const audience = isTest ? "self" : data.audience;
    const url = isTest ? "/settings" : data.url;
    if (typeof title !== "string" || !title.trim() || title.length > 120 || typeof body !== "string" || body.length > 240 ||
      typeof url !== "string" || !url.startsWith("/") || url.startsWith("//") ||
      !["self", "admins", "supporters"].includes(String(audience))) return Response.json({ ok: false, error: "Invalid notification." }, { status: 400 });
    const recent = await db.orm.public.NotificationEvent.orderBy((event) => event.createdAt.desc()).limit(100).all();
    const limit = isTest ? 3 : 10;
    const count = recent.filter((event) => event.kind === (isTest ? "admin_test" : "custom") &&
      Date.now() - Date.parse(event.createdAt.toString()) < 3_600_000).length;
    if (count >= limit) return Response.json({ ok: false, error: `Hourly ${isTest ? "test" : "custom"} notification limit reached.` }, { status: 429 });
    const { event } = await queueNotification({ key: `${isTest ? "admin_test" : "custom"}:${randomUUID()}`,
      kind: isTest ? "admin_test" : "custom", title: title.trim(), body: body.trim(), url,
      audience: audience as "self" | "admins" | "supporters", userId: audience === "self" ? viewer.id : undefined });
    const delivered = await db.orm.public.NotificationDelivery.where({ eventId: event.id }).all();
    return Response.json({ ok: true, accepted: delivered.filter((row) => row.status === "accepted").length,
      failed: delivered.filter((row) => row.status === "failed").length });
  }
  return Response.json({ ok: false, error: "Unknown action." }, { status: 400 });
}

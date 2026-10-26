import "server-only";

import webpush from "web-push";
import { Temporal } from "temporal-polyfill";
import { db } from "../../prisma/db";
import { formatNotificationKickoffTime, notificationKinds, renderNotificationTemplate, validNotificationTimeZone, type NotificationKind } from "./catalog";
import { shouldRetryDelivery } from "./delivery-policy";

export { allowedPushEndpoint } from "./delivery-policy";

const APP_ICON = "/icon.png";

export function pushConfiguration() {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim();
  const contact = process.env.WEB_PUSH_CONTACT?.trim();
  return publicKey && privateKey && contact && /^mailto:[^@\s]+@[^@\s]+$/.test(contact)
    ? { publicKey, privateKey, contact }
    : null;
}

export async function queueNotification(input: {
  key: string;
  kind: NotificationKind | "custom" | "admin_test";
  values?: Record<string, string>;
  title?: string;
  body?: string;
  url: string;
  matchId?: string;
  iconUrl?: string | null;
  audience?: "supporters" | "admins" | "self";
  userId?: string;
}) {
  const officialClub = input.kind === "official_squad" && input.url.startsWith("https://www.fcbarcelona.com/en/");
  if (input.key.length > 200 || (!officialClub && (!input.url.startsWith("/") || input.url.startsWith("//")))) throw new Error("Invalid notification target.");
  const existing = await db.orm.public.NotificationEvent.where({ key: input.key }).first();
  if (existing) { await deliverNotification(existing.id, input.userId); return { event: existing, created: false }; }
  const defaults = notificationKinds.find((item) => item.id === input.kind);
  const override = defaults ? await db.orm.public.NotificationTemplate.where({ kind: input.kind }).first() : null;
  const values = input.values ?? {};
  const title = renderNotificationTemplate(input.title ?? override?.title ?? defaults?.title ?? "Barça Dashboard", values);
  const body = renderNotificationTemplate(input.body ?? override?.body ?? defaults?.body ?? "", values);
  if (!title.trim()) throw new Error("Notification title is empty.");
  let event;
  try {
    event = await db.orm.public.NotificationEvent.create({
      key: input.key, kind: input.kind, matchId: input.matchId ?? null, title, body,
      url: input.url, iconUrl: input.iconUrl ?? APP_ICON,
      audience: input.audience ?? (defaults?.group === "Admin" ? "admins" : "supporters"),
    });
  } catch (error) {
    const raced = await db.orm.public.NotificationEvent.where({ key: input.key }).first();
    if (!raced) throw error;
    return { event: raced, created: false };
  }
  await deliverNotification(event.id, input.userId);
  return { event, created: true };
}

export async function deliverNotification(eventId: string, onlyUserId?: string) {
  const configuration = pushConfiguration();
  if (!configuration) return { sent: 0, failed: 0, reason: "Web Push keys are not configured." };
  const event = await db.orm.public.NotificationEvent.where({ id: eventId }).first();
  if (!event) return { sent: 0, failed: 0, reason: "Notification not found." };
  webpush.setVapidDetails(configuration.contact, configuration.publicKey, configuration.privateKey);
  const subscriptions = await db.orm.public.PushSubscription.where({ disabledAt: null }).include("user").all();
  const match = event.matchId && (event.body.includes("{localKickoffTime}") || event.body.includes("{localKickoff}"))
    ? await db.orm.public.Match.where({ id: event.matchId }).first() : null;
  let sent = 0, failed = 0;
  for (const subscription of subscriptions) {
    if (onlyUserId && subscription.userId !== onlyUserId) continue;
    if (event.audience === "self" && (!onlyUserId || subscription.userId !== onlyUserId)) continue;
    if (event.audience === "admins" && subscription.user.role !== "admin") continue;
    if (event.kind !== "custom" && event.kind !== "admin_test") {
      const preference = await db.orm.public.NotificationPreference.where({ userId: subscription.userId, kind: event.kind }).first();
      if (preference?.enabled === false) continue;
    }
    const previous = await db.orm.public.NotificationDelivery.where({ eventId, subscriptionId: subscription.id }).first();
    if (previous) {
      const lastAttempt = previous.sentAt ? Date.parse(previous.sentAt.toString()) : Date.parse(previous.createdAt.toString());
      if (!shouldRetryDelivery({ status: previous.status, errorCode: previous.errorCode, lastAttempt, now: Date.now() })) continue;
    }
    let delivery;
    try {
      delivery = previous
        ? await db.orm.public.NotificationDelivery.where({ id: previous.id }).update({ status: "pending" })
        : await db.orm.public.NotificationDelivery.create({ eventId, subscriptionId: subscription.id, status: "pending" });
    } catch {
      continue;
    }
    if (!delivery) continue;
    try {
      const zoneRow = match ? await db.orm.public.NotificationCursor.where({ key: `push-timezone:${subscription.id}` }).first() : null;
      const zoneSnapshot = zoneRow?.snapshot && typeof zoneRow.snapshot === "object" && !Array.isArray(zoneRow.snapshot) ? zoneRow.snapshot as Record<string, unknown> : null;
      const timeZone = validNotificationTimeZone(zoneSnapshot?.timeZone) ? zoneSnapshot.timeZone : null;
      const kickoff = match?.kickoff.toString() ?? "";
      const body = (timeZone ? event.body : event.body
        .replace("starts at {localKickoffTime}", "starts in 30 minutes")
        .replace("is now scheduled for {localKickoff}", "has a new kickoff time; open Match Center"))
        .replaceAll("{localKickoffTime}", kickoff && timeZone ? formatNotificationKickoffTime(kickoff, timeZone) : "")
        .replaceAll("{localKickoff}", kickoff && timeZone ? new Intl.DateTimeFormat("en-US", {
          timeZone, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
        }).format(new Date(kickoff)) : "");
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify({ title: event.title, body, url: event.url, iconUrl: event.iconUrl || APP_ICON,
          imageUrl: event.iconUrl && event.iconUrl !== APP_ICON ? event.iconUrl : null, tag: event.key }),
        { TTL: 3600, urgency: event.kind.includes("goal") ? "high" : "normal", timeout: 10000 });
      await db.orm.public.NotificationDelivery.where({ id: delivery.id }).update({ status: "accepted", sentAt: Temporal.Instant.from(new Date().toISOString()) });
      sent += 1;
    } catch (error) {
      const code = typeof error === "object" && error !== null && "statusCode" in error ? String(error.statusCode) : "PUSH_ERROR";
      const attempts = previous ? Number((previous.errorCode ?? "").split(":")[1] || "1") + 1 : 1;
      await db.orm.public.NotificationDelivery.where({ id: delivery.id }).update({ status: "failed", errorCode: `${code}:${attempts}`,
        sentAt: Temporal.Instant.from(new Date().toISOString()) });
      if (code === "404" || code === "410") await db.orm.public.PushSubscription.where({ id: subscription.id }).update({ disabledAt: Temporal.Instant.from(new Date().toISOString()) });
      failed += 1;
    }
  }
  return { sent, failed, reason: null };
}

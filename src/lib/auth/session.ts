import "server-only";

import { cookies } from "next/headers";
import { Temporal } from "temporal-polyfill";
import { db } from "../../prisma/db";
import { hashToken, localRequestOrigin, newSessionToken, SESSION_SECONDS, sessionCookieName, sessionIsActive } from "./policy";

export type Viewer = { id: string; email: string; username: string; role: "user" | "admin" };

export async function getViewer(): Promise<Viewer | null> {
  const token = (await cookies()).get(sessionCookieName())?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const session = await db.orm.public.UserSession.where({ tokenHash: hashToken(token) }).first();
  if (!session || !sessionIsActive(session.expiresAt.toString())) return null;
  const user = await db.orm.public.AppUser.where({ id: session.userId }).first();
  return user ? { id: user.id, email: user.email, username: user.username, role: user.role } : null;
}

export async function createSession(userId: string): Promise<void> {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000);
  await db.orm.public.UserSession.create({ userId, tokenHash: hashToken(token), expiresAt: Temporal.Instant.from(expiresAt.toISOString()) });
  (await cookies()).set(sessionCookieName(), token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(sessionCookieName())?.value;
  if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
    const session = await db.orm.public.UserSession.where({ tokenHash: hashToken(token) }).first();
    if (session) await db.orm.public.UserSession.where({ id: session.id }).delete();
  }
  jar.set(sessionCookieName(), "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}

export function requireSameOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  const configured = process.env.BARCA_PUBLIC_ORIGIN;
  const expected = process.env.NODE_ENV === "production" ? configured : localRequestOrigin(request);
  if (process.env.NODE_ENV === "production" && (!expected || !expected.startsWith("https://"))) {
    return Response.json({ ok: false, error: "Authentication origin is not configured." }, { status: 503 });
  }
  if (!origin || !expected || origin !== expected) {
    return Response.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
  }
  return null;
}

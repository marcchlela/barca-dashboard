import "server-only";

import { Temporal } from "temporal-polyfill";
import { db } from "../../prisma/db";
import { hashPassword, hashToken, normalizeEmail, normalizeUsername, validEmail, validPassword, validUsername, verifyPassword } from "./policy";

const WINDOW_MS = 15 * 60_000;
const BLOCK_MS = 15 * 60_000;
const LIMIT = 8;
const dummyHash = hashPassword("an-unused-password-for-timing-only");

export async function register(input: { email: string; username: string; password: string }) {
  const email = normalizeEmail(input.email);
  const username = normalizeUsername(input.username);
  if (!validEmail(email) || !validUsername(username) || !validPassword(input.password)) {
    return { ok: false as const, error: "Use a valid email, a 3–30 character username (letters, numbers, underscores), and a password of at least 8 characters." };
  }
  const [emailUsed, usernameUsed] = await Promise.all([
    db.orm.public.AppUser.where({ email }).first(),
    db.orm.public.AppUser.where({ username }).first(),
  ]);
  if (emailUsed || usernameUsed) return { ok: false as const, error: "That email or username is already in use." };
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await db.orm.public.AppUser.create({ email, username, passwordHash, role: "user" });
    return { ok: true as const, userId: user.id };
  } catch (error) {
    // Unique constraints are authoritative when two registrations race.
    if (String(error).toLowerCase().includes("unique")) return { ok: false as const, error: "That email or username is already in use." };
    throw error;
  }
}

export async function authenticate(identifierInput: string, password: string) {
  const identifier = identifierInput.trim().toLowerCase();
  if (!identifier || identifier.length > 254 || password.length > 1024) return null;
  const key = `login:${hashToken(identifier)}`;
  const now = Date.now();
  const throttle = await db.orm.public.AuthThrottle.where({ key }).first();
  if (throttle?.blockedUntil && Date.parse(throttle.blockedUntil.toString()) > now) return null;
  const user = identifier.includes("@")
    ? await db.orm.public.AppUser.where({ email: identifier }).first()
    : await db.orm.public.AppUser.where({ username: identifier }).first();
  const valid = await verifyPassword(password, user?.passwordHash ?? await dummyHash);
  if (!user || !valid) {
    const windowStart = throttle ? Date.parse(throttle.windowStart.toString()) : 0;
    const attempts = now - windowStart < WINDOW_MS ? (throttle?.attempts ?? 0) + 1 : 1;
    const values = {
      attempts,
      windowStart: Temporal.Instant.from(new Date(now - windowStart < WINDOW_MS ? windowStart : now).toISOString()),
      blockedUntil: attempts >= LIMIT ? Temporal.Instant.from(new Date(now + BLOCK_MS).toISOString()) : null,
    };
    if (throttle) await db.orm.public.AuthThrottle.where({ key }).update(values);
    else await db.orm.public.AuthThrottle.create({ key, ...values });
    return null;
  }
  if (throttle) await db.orm.public.AuthThrottle.where({ key }).delete();
  return { id: user.id, email: user.email, username: user.username, role: user.role };
}

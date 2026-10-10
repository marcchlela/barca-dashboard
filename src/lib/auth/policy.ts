import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
function scrypt(password: string, salt: Buffer, size: number, options: { N: number; r: number; p: number; maxmem: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => scryptCallback(password, salt, size, options, (error, derived) => error ? reject(error) : resolve(derived)));
}
const COST = 32768;
const BLOCK_SIZE = 8;
const PARALLEL = 1;
const MAX_MEMORY = 64 * 1024 * 1024;

export const SESSION_SECONDS = 60 * 60 * 24 * 30;

/** Absolute expiry is checked on every authenticated server request. */
export function sessionIsActive(expiresAt: string, now = Date.now()): boolean {
  const expiry = Date.parse(expiresAt);
  return Number.isFinite(expiry) && expiry > now;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validUsername(value: string): boolean {
  return /^[a-z0-9][a-z0-9_]{2,29}$/.test(value);
}

export function validPassword(value: string): boolean {
  return value.length >= 8 && value.length <= 1024 && Buffer.byteLength(value, "utf8") <= 4096;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(24);
  const derived = await scrypt(password, salt, 64, { N: COST, r: BLOCK_SIZE, p: PARALLEL, maxmem: MAX_MEMORY }) as Buffer;
  return `scrypt$${COST}$${BLOCK_SIZE}$${PARALLEL}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nText, rText, pText, saltText, hashText] = parts;
  const n = Number(nText), r = Number(rText), p = Number(pText);
  if (n !== COST || r !== BLOCK_SIZE || p !== PARALLEL) return false;
  try {
    const salt = Buffer.from(saltText, "base64url");
    const expected = Buffer.from(hashText, "base64url");
    if (salt.length !== 24 || expected.length !== 64) return false;
    const actual = await scrypt(password, salt, expected.length, { N: n, r, p, maxmem: MAX_MEMORY }) as Buffer;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionCookieName(): string {
  return process.env.NODE_ENV === "production" ? "__Host-barca_session" : "barca_session";
}

export function validReturnPath(path: unknown): string {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") && !/[\r\n]/.test(path)
    ? path : "/my-barca";
}

/** Next dev may normalize Request.url to localhost while the browser used 127.0.0.1. */
export function localRequestOrigin(request: Request): string | null {
  try {
    const url = new URL(request.url);
    const host = request.headers.get("host");
    return host ? new URL(`${url.protocol}//${host}`).origin : url.origin;
  } catch {
    return null;
  }
}

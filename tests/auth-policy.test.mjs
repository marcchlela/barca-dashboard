import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, validPassword, validUsername, normalizeEmail, normalizeUsername, newSessionToken, hashToken, validReturnPath, sessionIsActive, localRequestOrigin } from "../src/lib/auth/policy.ts";

test("passwords are scrypt-hashed with distinct salts and checked safely", async () => {
  const password = "a long unique supporter passphrase";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("wrong password", first), false);
  assert.equal(await verifyPassword(password, "malformed"), false);
  assert.equal(validPassword("short"), false);
  assert.equal(validPassword("1234567"), false);
  assert.equal(validPassword("12345678"), true);
  assert.equal(validPassword(password), true);
});

test("account identifiers normalize and usernames have a narrow safe alphabet", () => {
  assert.equal(normalizeEmail("  Fan@Example.COM "), "fan@example.com");
  assert.equal(normalizeUsername(" Culer_10 "), "culer_10");
  assert.equal(validUsername("culer_10"), true);
  assert.equal(validUsername("a"), false);
  assert.equal(validUsername("bad/name"), false);
});

test("session tokens are random and only their digest is stored", () => {
  const a = newSessionToken(), b = newSessionToken();
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a, b);
  assert.notEqual(hashToken(a), a);
  assert.equal(hashToken(a).length, 64);
});
test("sessions expire server-side at the absolute deadline", () => {
  const now = Date.parse("2026-10-10T00:00:00.000Z");
  assert.equal(sessionIsActive("2026-10-10T00:00:01.000Z", now), true);
  assert.equal(sessionIsActive("2026-10-10T00:00:00.000Z", now), false);
  assert.equal(sessionIsActive("2026-10-09T23:59:59.000Z", now), false);
  assert.equal(sessionIsActive("not-a-date", now), false);
});

test("return paths cannot redirect to another origin", () => {
  assert.equal(validReturnPath("/matches/123#my-match"), "/matches/123#my-match");
  for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "/foo\r\nbar"]) assert.equal(validReturnPath(bad), "/my-barca");
});

test("development origin uses the browser-facing Host when Next normalizes Request.url", () => {
  const request = new Request("http://localhost:3000/api/auth/signup", { headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" } });
  assert.equal(localRequestOrigin(request), "http://127.0.0.1:3000");
  assert.equal(localRequestOrigin(new Request("http://localhost:3000/api/auth/signup")), "http://localhost:3000");
  assert.equal(localRequestOrigin(new Request("http://localhost:3000/api/auth/signup", { headers: { host: "bad host" } })), null);
});

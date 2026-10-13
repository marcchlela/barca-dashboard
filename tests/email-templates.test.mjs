import test from "node:test";
import assert from "node:assert/strict";
import { maskEmailAddress, renderDashboardEmail } from "../src/lib/email/templates.ts";

test("password reset template includes the precise link and expiration in text and HTML", () => {
  const link = "https://example.test/account/reset-password?token=abc123";
  const rendered = renderDashboardEmail("password_reset", { resetUrl: link, origin: "https://example.test" });
  assert.match(rendered.subject, /password/i);
  assert.match(rendered.text, /30 minutes/);
  assert.ok(rendered.text.includes(link));
  assert.ok(rendered.html.includes(link));
  assert.ok(rendered.html.includes("https://example.test/icon.png"));
  assert.match(rendered.html, /no action|ignore the email/i);
});

test("template escapes HTML in links and test email has no reset link", () => {
  const rendered = renderDashboardEmail("password_reset", { resetUrl: 'https://example.test/?x="<tag>', origin: "https://example.test" });
  assert.ok(rendered.html.includes("&quot;&lt;tag&gt;"));
  assert.ok(!rendered.html.includes('href="https://example.test/?x="<tag>'));
  const testMessage = renderDashboardEmail("admin_test", { origin: "https://example.test" });
  assert.ok(!testMessage.html.includes("reset-password"));
  assert.ok(!testMessage.text.includes("token="));
  assert.ok(testMessage.html.includes("https://example.test/icon.png"));
});

test("welcome email is branded, links home, and escapes the username", () => {
  const welcome = renderDashboardEmail("welcome", { origin: "https://example.test", username: "<chlelaaa>" });
  assert.match(welcome.subject, /welcome/i);
  assert.ok(welcome.html.includes("https://example.test/icon.png"));
  assert.ok(welcome.html.includes("https://example.test/"));
  assert.ok(welcome.html.includes("&lt;chlelaaa&gt;"));
  assert.ok(welcome.text.includes("<chlelaaa>"));
});

test("delivery recipient logging masks addresses", () => {
  assert.equal(maskEmailAddress("chlelaaa@example.com"), "ch***@e***");
  assert.equal(maskEmailAddress("bad-address"), "hidden recipient");
});

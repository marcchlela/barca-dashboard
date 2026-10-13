import "server-only";

import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import pg from "pg";
import { validEmail } from "../auth/policy";
import { maskEmailAddress, type DashboardEmailKind } from "./templates";

export function getSmtpConfig() {
  const host = process.env.BARCA_SMTP_HOST;
  const port = Number(process.env.BARCA_SMTP_PORT);
  const user = process.env.BARCA_SMTP_USER;
  const password = process.env.BARCA_SMTP_PASSWORD;
  const from = process.env.BARCA_MAIL_FROM;
  const origin = process.env.BARCA_PUBLIC_ORIGIN;
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !password || !from || !validEmail(from) || !origin) return null;
  try {
    const url = new URL(origin);
    if (url.origin !== origin || (process.env.NODE_ENV === "production" && url.protocol !== "https:")) return null;
  } catch { return null; }
  return { host, port, user, password, from, origin };
}

export function smtpPublicStatus() {
  const config = getSmtpConfig();
  return { configured: Boolean(config), from: config?.from ?? null };
}

function safeSmtpErrorCode(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error ? (error as { code: unknown }).code : null;
  return typeof code === "string" && /^[A-Z0-9_-]{1,40}$/.test(code) ? code : "SMTP_ERROR";
}

async function recordAttempt(input: { kind: DashboardEmailKind; to: string; status: "accepted" | "failed"; errorCode?: string; messageId?: string }) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`INSERT INTO email_delivery_attempt (id, kind, "recipientMasked", status, "errorCode", "providerMessageId") VALUES ($1,$2,$3,$4,$5,$6)`,
      [randomUUID(), input.kind, maskEmailAddress(input.to), input.status, input.errorCode ?? null, input.messageId ?? null]);
  } finally { await client.end(); }
}

export async function sendDashboardEmail(input: { kind: DashboardEmailKind; to: string; subject: string; text: string; html: string }): Promise<{ accepted: boolean; errorCode?: string }> {
  const config = getSmtpConfig();
  if (!config) return { accepted: false, errorCode: "NOT_CONFIGURED" };
  const transporter = nodemailer.createTransport({
    host: config.host, port: config.port, secure: config.port === 465,
    requireTLS: config.port !== 465, auth: { user: config.user, pass: config.password },
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
  });
  let result: { accepted: boolean; errorCode?: string; messageId?: string };
  try {
    const info = await transporter.sendMail({ from: config.from, to: input.to, subject: input.subject, text: input.text, html: input.html });
    const accepted = info.accepted.map(String).some((recipient) => recipient.toLowerCase() === input.to.toLowerCase());
    result = accepted ? { accepted: true, messageId: info.messageId } : { accepted: false, errorCode: "NO_ACCEPTED_RECIPIENT" };
  } catch (error) {
    result = { accepted: false, errorCode: safeSmtpErrorCode(error) };
  } finally { transporter.close(); }
  try {
    await recordAttempt({ kind: input.kind, to: input.to, status: result.accepted ? "accepted" : "failed", errorCode: result.errorCode, messageId: result.messageId });
  } catch {
    // A logging outage must not turn an already accepted email into a false send failure.
    console.error("EMAIL DELIVERY LOG FAILED", input.kind);
  }
  if (!result.accepted) console.error("EMAIL SEND FAILED", input.kind, result.errorCode);
  return { accepted: result.accepted, errorCode: result.errorCode };
}

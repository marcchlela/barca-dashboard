export type DashboardEmailKind = "password_reset" | "welcome" | "admin_test";

type EmailOptions = {
  resetUrl?: string;
  origin?: string;
  username?: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export function renderDashboardEmail(kind: DashboardEmailKind, options: EmailOptions = {}) {
  const isReset = kind === "password_reset";
  const isWelcome = kind === "welcome";
  if (isReset && !options.resetUrl) throw new Error("A reset URL is required.");
  if ((isReset || isWelcome) && !options.origin) throw new Error("A public origin is required.");

  const origin = options.origin?.replace(/\/$/, "");
  const resetUrl = options.resetUrl;
  const dashboardUrl = origin ? `${origin}/` : undefined;
  const username = options.username?.trim();
  const subject = isReset
    ? "Reset your Barça Dashboard password"
    : isWelcome
      ? "Welcome to Barça Dashboard"
      : "Barça Dashboard email test";
  const title = isReset
    ? "A fresh start."
    : isWelcome
      ? `Welcome${username ? `, ${escapeHtml(username)}` : ""}.`
      : "Your email channel is ready.";
  const description = isReset
    ? "You requested a password reset. This link works once and expires in 30 minutes."
    : isWelcome
      ? "Your account is ready. Find your matches, keep your Barça diary, and build your own collection of moments."
      : "This test confirms that your dashboard's SMTP server accepted an email to your account address.";
  const actionUrl = isReset ? resetUrl : isWelcome ? dashboardUrl : undefined;
  const actionLabel = isReset ? "Reset password" : "Open Barça Dashboard";
  const action = actionUrl
    ? `<a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#d39c43;color:#071426;padding:14px 22px;text-decoration:none;font-weight:700">${actionLabel} &rarr;</a>`
    : "";
  const fallback = isReset && resetUrl
    ? `<p style="font-size:13px;color:#91a5bf">If the button does not work, copy this link:<br><span style="overflow-wrap:anywhere">${escapeHtml(resetUrl)}</span></p>`
    : "";
  const icon = origin
    ? `<img src="${escapeHtml(`${origin}/icon.png`)}" width="48" height="48" alt="Barça Dashboard" style="display:block;width:48px;height:48px;border:0;border-radius:12px">`
    : "";
  const stripe = `<div style="height:5px;background:linear-gradient(90deg,#123c82 0 42%,#8b173c 42% 67%,#d39c43 67% 100%)"></div>`;
  const closing = isReset
    ? "If you didn't request this, ignore the email. Your password has not changed."
    : isWelcome
      ? "You can change your password and account preferences any time in Settings."
      : "No action is needed. You can return to the admin email desk to review the result.";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#071426;color:#f3f5f8;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#071426"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border:1px solid #28405d;background:#0b1a30"><tr><td>${stripe}</td></tr><tr><td style="padding:28px 30px 30px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding-right:14px;vertical-align:middle">${icon}</td><td style="vertical-align:middle"><p style="margin:0;color:#f3f5f8;font-size:15px;font-weight:700">Barça Dashboard</p><p style="margin:5px 0 0;color:#91a5bf;letter-spacing:2px;font-size:9px">MATCHDAY, YOUR WAY</p></td></tr></table><h1 style="margin:30px 0 14px;font-size:29px;line-height:1.2">${title}</h1><p style="color:#a5b4c9;line-height:1.7">${description}</p><div style="padding:18px 0 22px">${action}</div>${fallback}<p style="border-top:1px solid #28405d;padding-top:20px;color:#91a5bf;font-size:13px;line-height:1.6">${closing}</p></td></tr><tr><td>${stripe}</td></tr></table></td></tr></table></body></html>`;
  const text = isReset
    ? `Reset your Barça Dashboard password\n\n${description}\n\n${resetUrl}\n\nIf you didn't request this, ignore the email. Your password has not changed.`
    : isWelcome
      ? `Welcome to Barça Dashboard${username ? `, ${username}` : ""}.\n\n${description}\n\nOpen your dashboard: ${dashboardUrl}\n\n${closing}`
      : `Barça Dashboard email test\n\n${description}\n\nNo action is needed.`;
  return { subject, html, text };
}

export function maskEmailAddress(email: string): string {
  const [local, domain] = email.toLowerCase().split("@");
  if (!local || !domain) return "hidden recipient";
  return `${local.slice(0, 2)}***@${domain.slice(0, 1)}***`;
}

"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import DashboardSectionShell, { useDashboardSectionTheme } from "../shell/DashboardSectionShell";

export default function PasswordRecoveryScreen({ mode, token }: { mode: "request" | "reset"; token?: string }) {
  const { theme } = useDashboardSectionTheme("Your account");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/auth/${mode === "request" ? "forgot-password" : "reset-password"}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(mode === "request" ? { email: form.get("email") } : { token, password: form.get("password") }),
      });
      const result = await response.json() as { ok?: boolean; error?: string; message?: string };
      if (!response.ok) { setError(result.error ?? "Please try again."); return; }
      if (mode === "reset") window.history.replaceState(null, "", "/account/reset-password");
      setMessage(mode === "request" ? (result.message ?? "Check your email if an account exists.") : "Password changed. Sign in again on all your devices.");
    } catch { setError("Connection failed. Please try again."); }
    finally { setPending(false); }
  }
  return <DashboardSectionShell title="Account" season="Your archive" theme={theme}>
    <section className="mx-auto mt-8 max-w-xl border p-6 md:p-10" style={{ background: theme.colors.surface, borderColor: theme.colors.border }}>
      <p className="text-xs uppercase tracking-[.24em]" style={{ color: theme.colors.accent }}>Account security</p>
      <h1 className="mt-4 text-3xl">{mode === "request" ? "Forgot your password?" : "Choose a new password"}</h1>
      <p className="mt-3 text-sm leading-6" style={{ color: theme.colors.textMuted }}>{mode === "request" ? "Enter your account email. If it matches an account, we’ll send a one-use link valid for 30 minutes." : "The link works once. Changing your password signs out other devices."}</p>
      {mode === "reset" && !token ? <p className="mt-6" role="alert">This reset link is missing its token. Request a new one.</p> : <form onSubmit={submit} className="mt-7 grid gap-4">
        {mode === "request" ? <label className="grid gap-2 text-sm">Email<input name="email" type="email" autoComplete="email" required className="border bg-transparent px-4 py-3 outline-none focus-visible:outline-2" style={{ borderColor: theme.colors.border }} /></label> : <label className="grid gap-2 text-sm">New password<div className="relative"><input name="password" type={show ? "text" : "password"} minLength={8} maxLength={1024} autoComplete="new-password" required className="w-full border bg-transparent px-4 py-3 pr-14 outline-none focus-visible:outline-2" style={{ borderColor: theme.colors.border }} /><button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 w-12 cursor-pointer border-l" style={{ borderColor: theme.colors.border }}>{show ? <EyeOff size={18} className="mx-auto" /> : <Eye size={18} className="mx-auto" />}</button></div></label>}
        {error && <p role="alert" style={{ color: theme.colors.danger }}>{error}</p>}
        {message && <p role="status" style={{ color: theme.colors.success }}>{message}</p>}
        {!message && <button disabled={pending} className="cursor-pointer border px-5 py-3 text-left disabled:opacity-50" style={{ borderColor: theme.colors.accent, color: theme.colors.accent }}>{pending ? "Please wait…" : mode === "request" ? "Send reset link" : "Change password"}</button>}
      </form>}
      <Link href="/account" className="mt-7 inline-block text-sm underline underline-offset-4">Back to sign in</Link>
    </section>
  </DashboardSectionShell>;
}

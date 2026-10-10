"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import DashboardSectionShell, { useDashboardSectionTheme } from "../shell/DashboardSectionShell";

type Viewer = { username: string; email: string; role: "user" | "admin" } | null;

export default function AccountScreen({ viewer, next, signupOpen }: { viewer: Viewer; next: string; signupOpen: boolean }) {
  const { theme } = useDashboardSectionTheme("Your account");
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = mode === "login"
      ? { identifier: form.get("identifier"), password: form.get("password") }
      : { email: form.get("email"), username: form.get("username"), password: form.get("password") };
    try {
      const response = await fetch(`/api/auth/${mode === "login" ? "login" : "signup"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) { setError(result.error ?? "Could not sign in."); return; }
      router.push(next);
      router.refresh();
    } catch {
      setError("Connection failed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    setPending(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign-out failed");
      router.push("/account");
      router.refresh();
    } catch { setError("Could not sign out. Please try again."); }
    finally { setPending(false); }
  }

  const field = "w-full border bg-transparent px-4 py-3 outline-none focus-visible:outline-2";
  return <DashboardSectionShell title="Account" season="Your archive" theme={theme}>
    <section className="mx-auto mt-8 max-w-3xl border p-6 md:p-10" style={{ background: theme.colors.surface, borderColor: theme.colors.border }}>
      <p className="text-xs uppercase tracking-[.24em]" style={{ color: theme.colors.accent }}>A place for your memories</p>
      {viewer ? <>
        <h1 className="mt-4 text-3xl">Welcome back, {viewer.username}.</h1>
        <p className="mt-3 text-sm" style={{ color: theme.colors.textMuted }}>{viewer.email} · {viewer.role === "admin" ? "Admin" : "Supporter"}</p>
        <div className="mt-8 flex flex-wrap gap-3"><Link href="/my-barca" className="border px-5 py-3" style={{ borderColor: theme.colors.accent, color: theme.colors.accent }}>Open My Barça</Link>{viewer.role === "admin" && <Link href="/admin" className="border px-5 py-3" style={{ borderColor: theme.colors.border }}>Admin control</Link>}<button type="button" disabled={pending} onClick={logout} className="cursor-pointer border px-5 py-3 disabled:opacity-50" style={{ borderColor: theme.colors.border }}>Sign out</button></div>
      </> : <>
        <h1 className="mt-4 text-3xl tracking-tight md:text-5xl">{mode === "login" ? "Welcome back." : "Make it yours."}</h1>
        <p className="mt-3 max-w-xl leading-7" style={{ color: theme.colors.textMuted }}>The club archive is open to everyone. An account keeps your diary, ratings, favourites and watchlist separate.</p>
        {signupOpen ? <div role="tablist" aria-label="Account action" className="mt-8 flex border-b" style={{ borderColor: theme.colors.border }}>
          {(["login", "signup"] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={mode === tab} onClick={() => { setMode(tab); setShowPassword(false); setError(""); }} className="cursor-pointer border-b-2 px-5 py-3 focus-visible:outline-2" style={{ borderColor: mode === tab ? theme.colors.accent : "transparent", color: mode === tab ? theme.colors.text : theme.colors.textMuted }}>{tab === "login" ? "Sign in" : "Create account"}</button>)}
        </div> : <p className="mt-8 border-l-2 pl-4 text-sm" style={{ borderColor: theme.colors.accent, color: theme.colors.textMuted }}>New account registration is not open yet. Existing accounts can sign in.</p>}
        <form onSubmit={submit} className="mt-6 grid gap-4">
          {mode === "login" ? <label className="grid gap-2 text-sm">Email or username<input className={field} style={{ borderColor: theme.colors.border }} name="identifier" autoComplete="username" required /></label> : <>
            <label className="grid gap-2 text-sm">Email<input className={field} style={{ borderColor: theme.colors.border }} type="email" name="email" autoComplete="email" required /></label>
            <label className="grid gap-2 text-sm">Username<input className={field} style={{ borderColor: theme.colors.border }} name="username" minLength={3} maxLength={30} pattern="[A-Za-z0-9][A-Za-z0-9_]{2,29}" autoComplete="username" required /></label>
          </>}
          <div className="grid gap-2 text-sm">
            <label htmlFor="account-password">Password</label>
            <div className="relative">
              <input id="account-password" className={`${field} pr-14`} style={{ borderColor: theme.colors.border }} name="password" type={showPassword ? "text" : "password"} minLength={mode === "signup" ? 8 : undefined} autoComplete={mode === "login" ? "current-password" : "new-password"} required />
              <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} aria-controls="account-password" onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-px right-px flex w-12 cursor-pointer items-center justify-center border-l focus-visible:outline-2 focus-visible:outline-offset-[-2px]" style={{ borderColor: theme.colors.border, color: theme.colors.textMuted, background: theme.colors.surface }}>
                {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
          </div>
          {mode === "signup" && <p className="text-xs" style={{ color: theme.colors.textMuted }}>Use at least 8 characters; a longer, unique password is safer. Email verification and password recovery are not available yet, so use an address and password you can keep access to.</p>}
          {error && <p role="alert" className="text-sm" style={{ color: theme.colors.danger }}>{error}</p>}
          <button type="submit" disabled={pending} className="mt-2 cursor-pointer border px-5 py-3 text-left disabled:opacity-50" style={{ borderColor: theme.colors.accent, color: theme.colors.accent }}>{pending ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
        </form>
      </>}
    </section>
  </DashboardSectionShell>;
}

"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import DashboardSectionShell, { useDashboardSectionTheme } from "../shell/DashboardSectionShell";
import { getTheme, type KitType } from "../../lib/themes";
import NotificationsSettings from "./NotificationsSettings";

type Viewer = { username: string; email: string; role: "user" | "admin" } | null;

export default function SettingsScreen({ viewer }: { viewer: Viewer }) {
  const { theme, kit } = useDashboardSectionTheme("Settings");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);

  function selectKit(next: KitType) {
    window.localStorage.setItem("barca-dashboard-kit", next);
    window.location.reload();
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    if (form.get("newPassword") !== form.get("confirmPassword")) { setError("New passwords do not match."); return; }
    setPending(true); setError("");
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: form.get("currentPassword"), newPassword: form.get("newPassword") }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) { setError(result.error ?? "Could not change password."); return; }
      router.push("/account"); router.refresh();
    } catch { setError("Connection failed. Please try again."); }
    finally { setPending(false); }
  }

  const field = "w-full border bg-transparent px-4 py-3 outline-none focus-visible:outline-2";
  return <DashboardSectionShell title="Settings" season="Your dashboard" theme={theme}>
    <div className="mx-auto mt-8 grid max-w-5xl gap-5">
      <header><p className="text-xs uppercase tracking-[.24em]" style={{ color: theme.colors.accent }}>Control room / Preferences</p><h1 className="mt-3 text-3xl md:text-5xl">Make it yours.</h1></header>
      <section className="border p-5 md:p-7" style={{ background: theme.colors.surface, borderColor: theme.colors.border }}>
        <h2 className="text-xl">Kit theme</h2><p className="mt-1 text-sm" style={{ color: theme.colors.textMuted }}>Saved in this browser, not across devices.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">{(["home", "away", "third"] as const).map((option) => {
          const colors = getTheme("Settings", option).colors;
          return <button key={option} type="button" onClick={() => selectKit(option)} aria-pressed={kit === option} className="cursor-pointer border p-4 text-left focus-visible:outline-2" style={{ borderColor: kit === option ? theme.colors.accent : theme.colors.border, background: theme.colors.backgroundElevated }}>
            <span className="mb-4 flex h-8 overflow-hidden border" style={{ borderColor: theme.colors.border }}><span className="flex-1" style={{ background: colors.primary }} /><span className="flex-1" style={{ background: colors.secondary }} /><span className="w-8" style={{ background: colors.accent }} /></span>
            <span className="capitalize">{option} kit</span>{kit === option && <span className="ml-2 text-xs" style={{ color: theme.colors.accent }}>Active</span>}
          </button>;
        })}</div>
      </section>
      <NotificationsSettings signedIn={Boolean(viewer)} />
      <section className="border p-5 md:p-7" style={{ background: theme.colors.surface, borderColor: theme.colors.border }}>
        <h2 className="text-xl">Account & security</h2>
        {!viewer ? <p className="mt-4 text-sm" style={{ color: theme.colors.textMuted }}>Sign in to manage your personal archive and password. <Link href="/account?next=/settings" className="underline underline-offset-4" style={{ color: theme.colors.accent }}>Sign in</Link></p> : <>
          <div className="mt-5 grid gap-2 border-b pb-5 text-sm sm:grid-cols-2" style={{ borderColor: theme.colors.border }}><p>Username <span className="ml-2" style={{ color: theme.colors.textMuted }}>{viewer.username}</span></p><p>Email <span className="ml-2 break-all" style={{ color: theme.colors.textMuted }}>{viewer.email}</span></p></div>
          <p className="mt-4 text-sm" style={{ color: theme.colors.textMuted }}>Changing your password signs out all devices. Your email and username stay unchanged.</p>
          <form onSubmit={changePassword} className="mt-5 grid max-w-lg gap-4">
            <label className="grid gap-2 text-sm">Current password<input type={show ? "text" : "password"} name="currentPassword" autoComplete="current-password" required className={field} style={{ borderColor: theme.colors.border }} /></label>
            <label className="grid gap-2 text-sm">New password<input type={show ? "text" : "password"} name="newPassword" minLength={8} maxLength={1024} autoComplete="new-password" required className={field} style={{ borderColor: theme.colors.border }} /></label>
            <label className="grid gap-2 text-sm">Confirm new password<input type={show ? "text" : "password"} name="confirmPassword" minLength={8} maxLength={1024} autoComplete="new-password" required className={field} style={{ borderColor: theme.colors.border }} /></label>
            <button type="button" onClick={() => setShow(!show)} aria-pressed={show} className="flex w-fit cursor-pointer items-center gap-2 text-sm" style={{ color: theme.colors.textMuted }}>{show ? <EyeOff size={16} /> : <Eye size={16} />}{show ? "Hide passwords" : "Show passwords"}</button>
            {error && <p role="alert" style={{ color: theme.colors.danger }}>{error}</p>}
            <button type="submit" disabled={pending} className="w-fit cursor-pointer border px-5 py-3 disabled:opacity-50" style={{ borderColor: theme.colors.accent, color: theme.colors.accent }}>{pending ? "Saving…" : "Change password"}</button>
          </form>
          <p className="mt-6 text-sm" style={{ color: theme.colors.textMuted }}>Forgot your current password? <Link href="/account/forgot-password" className="underline underline-offset-4" style={{ color: theme.colors.accent }}>Reset it by email</Link>.</p>
        </>}
      </section>
    </div>
  </DashboardSectionShell>;
}

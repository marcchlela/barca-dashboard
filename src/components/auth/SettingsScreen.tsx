"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChevronRight, Eye, EyeOff, Palette, ShieldCheck } from "lucide-react";
import DashboardSectionShell, { useDashboardSectionTheme } from "../shell/DashboardSectionShell";
import { getTheme, type KitType } from "../../lib/themes";
import NotificationsSettings from "./NotificationsSettings";

type Viewer = { username: string; email: string; role: "user" | "admin" } | null;
type SettingsView = "hub" | "theme" | "notifications" | "account";

export default function SettingsScreen({ viewer, view = "hub" }: { viewer: Viewer; view?: SettingsView }) {
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
  const settingsSections = [
    { id: "theme" as const, href: "/settings/theme", label: "Theme", detail: "Choose the kit colours used across the dashboard.", icon: Palette },
    { id: "notifications" as const, href: "/settings/notifications", label: "Notifications", detail: "Manage matchday, media and system alerts.", icon: Bell },
    { id: "account" as const, href: "/settings/account", label: "Account & privacy", detail: "Review your identity and account security.", icon: ShieldCheck },
  ];
  const currentSection = settingsSections.find((section) => section.id === view);
  return <DashboardSectionShell title={currentSection?.label ?? "Settings"} season="Your dashboard" theme={theme}>
    <div className="mx-auto mt-8 grid max-w-5xl gap-5">
      <header>{view !== "hub" && <Link href="/settings" className="mb-5 inline-flex items-center gap-2 text-xs uppercase tracking-[.18em] focus-visible:outline-2" style={{ color: theme.colors.textMuted, outlineColor: theme.colors.accent }}>← Settings</Link>}<p className="text-xs uppercase tracking-[.24em]" style={{ color: theme.colors.accent }}>Control room / {currentSection?.label ?? "Preferences"}</p><h1 className="mt-3 text-3xl md:text-5xl">{currentSection?.label ?? "Make it yours."}</h1></header>
      {view === "hub" && <nav aria-label="Settings sections" className="grid gap-2">{settingsSections.map(({ id, href, label, detail, icon: Icon }) => {
        return <Link key={id} href={href} className="flex items-center gap-4 border p-4 text-left transition-colors hover:border-current focus-visible:outline-2 md:p-5" style={{ background: theme.colors.surface, borderColor: theme.colors.border, outlineColor: theme.colors.accent }}>
          <span className="grid h-10 w-10 shrink-0 place-items-center border" style={{ borderColor: theme.colors.border, color: theme.colors.textMuted }}><Icon size={19} /></span>
          <span className="min-w-0 flex-1"><span className="block font-medium">{label}</span><span className="mt-1 block text-xs leading-5" style={{ color: theme.colors.textMuted }}>{detail}</span></span>
          <ChevronRight size={18} style={{ color: theme.colors.textMuted }} />
        </Link>;
      })}</nav>}
      {view === "theme" && <section className="border p-5 md:p-7" style={{ background: theme.colors.surface, borderColor: theme.colors.border }}>
        <h2 className="text-xl">Kit theme</h2><p className="mt-1 text-sm" style={{ color: theme.colors.textMuted }}>Saved in this browser, not across devices.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">{(["home", "away", "third"] as const).map((option) => {
          const colors = getTheme("Settings", option).colors;
          return <button key={option} type="button" onClick={() => selectKit(option)} aria-pressed={kit === option} className="cursor-pointer border p-4 text-left focus-visible:outline-2" style={{ borderColor: kit === option ? theme.colors.accent : theme.colors.border, background: theme.colors.backgroundElevated }}>
            <span className="mb-4 flex h-8 overflow-hidden border" style={{ borderColor: theme.colors.border }}><span className="flex-1" style={{ background: colors.primary }} /><span className="flex-1" style={{ background: colors.secondary }} /><span className="w-8" style={{ background: colors.accent }} /></span>
            <span className="capitalize">{option} kit</span>{kit === option && <span className="ml-2 text-xs" style={{ color: theme.colors.accent }}>Active</span>}
          </button>;
        })}</div>
      </section>}
      {view === "notifications" && <NotificationsSettings signedIn={Boolean(viewer)} />}
      {view === "account" && <section className="border p-5 md:p-7" style={{ background: theme.colors.surface, borderColor: theme.colors.border }}>
        <h2 className="text-xl">Account & privacy</h2>
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
      </section>}
    </div>
  </DashboardSectionShell>;
}

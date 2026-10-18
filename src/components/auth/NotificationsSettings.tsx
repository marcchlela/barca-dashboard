"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useDashboardSectionTheme } from "../shell/DashboardSectionShell";

type Kind = { id: string; label: string; group: string; ready: boolean };
type State = { configured: boolean; publicKey: string | null; kinds: Kind[]; preferences: Record<string, boolean> };

function applicationServerKey(value: string) {
  const padded = (value + "=".repeat((4 - value.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

export default function NotificationsSettings({ signedIn }: { signedIn: boolean }) {
  const { theme } = useDashboardSectionTheme("Settings");
  const [data, setData] = useState<State | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!signedIn) return;
    void Promise.resolve().then(() => setSupported("serviceWorker" in navigator && "PushManager" in window && "Notification" in window));
    fetch("/api/notifications", { cache: "no-store" }).then((response) => response.json()).then((result: State) => setData(result)).catch(() => setMessage("Notification settings could not load."));
    if ("serviceWorker" in navigator) navigator.serviceWorker.getRegistration("/").then((registration) => registration?.pushManager.getSubscription()).then((subscription) => setEnabled(Boolean(subscription))).catch(() => {});
  }, [signedIn]);

  async function post(value: Record<string, unknown>) {
    const response = await fetch("/api/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value) });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Could not save notification settings.");
  }

  async function enable() {
    if (!data?.publicKey || busy) return;
    setBusy(true); setMessage("");
    try {
      const registration = await navigator.serviceWorker.register("/notification-sw.js", { scope: "/", updateViaCache: "none" });
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notification permission was not granted. Check your browser settings.");
      const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({
        userVisibleOnly: true, applicationServerKey: applicationServerKey(data.publicKey),
      });
      await post({ action: "subscribe", subscription: subscription.toJSON() });
      setEnabled(true); setMessage("Notifications enabled on this device.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not enable notifications."); }
    finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setMessage("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await post({ action: "unsubscribe", endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setEnabled(false); setMessage("Notifications disabled on this device.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not disable notifications."); }
    finally { setBusy(false); }
  }

  async function toggle(kind: string, current: boolean) {
    if (!data) return;
    setData({ ...data, preferences: { ...data.preferences, [kind]: !current } });
    try { await post({ action: "preference", kind, enabled: !current }); }
    catch (error) { setData(data); setMessage(error instanceof Error ? error.message : "Could not save preference."); }
  }

  const groups = [...new Set(data?.kinds.map((kind) => kind.group) ?? [])];
  return <section className="border p-5 md:p-7" style={{ background: theme.colors.surface, borderColor: theme.colors.border }}>
    <h2 className="text-xl">Notifications</h2>
    <p className="mt-2 text-sm leading-6" style={{ color: theme.colors.textMuted }}>Choose matchday and media alerts. Permission is requested only when you tap Enable. Your choices follow your account; device permission is set on each device.</p>
    {!signedIn ? <p className="mt-4 text-sm">Sign in to enable notifications.</p> : !data ? <p className="mt-4 text-sm">Loading notification settings…</p> : <>
      {!data.configured && <p className="mt-4 text-sm" style={{ color: theme.colors.textMuted }}>Push delivery is not configured on this server yet.</p>}
      {!supported && <p className="mt-4 text-sm" style={{ color: theme.colors.textMuted }}>This browser does not support Web Push here. On iPhone, open the installed Home Screen app, then enable notifications.</p>}
      <button type="button" disabled={busy || !data.configured || !supported} onClick={enabled ? disable : enable}
        className="mt-5 cursor-pointer border px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        style={{ borderColor: theme.colors.accent, color: theme.colors.accent }}>
        {busy ? "Please wait…" : enabled ? "Disable on this device" : "Enable on this device"}
      </button>
      {groups.map((group) => <div key={group} className="mt-7"><h3 className="text-sm font-semibold uppercase tracking-widest" style={{ color: theme.colors.accent }}>{group}</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">{data.kinds.filter((kind) => kind.group === group).map((kind) => {
          const checked = data.preferences[kind.id] ?? true;
          return <label key={kind.id} className={`flex items-center gap-3 border p-3 text-sm focus-within:outline-2 focus-within:outline-offset-2 ${kind.ready ? "cursor-pointer" : "cursor-not-allowed"}`} style={{ borderColor: checked && kind.ready ? theme.colors.accent : theme.colors.border, color: kind.ready ? theme.colors.text : theme.colors.textMuted, background: checked && kind.ready ? `${theme.colors.accent}0d` : theme.colors.backgroundElevated, outlineColor: theme.colors.accent }}>
            <input type="checkbox" checked={checked} disabled={!kind.ready} onChange={() => toggle(kind.id, checked)} className="sr-only" />
            <span aria-hidden="true" className="grid h-5 w-5 shrink-0 place-items-center border" style={{ borderColor: checked && kind.ready ? theme.colors.accent : theme.colors.border, background: checked && kind.ready ? theme.colors.accent : "transparent", color: theme.colors.background }}>{checked && kind.ready ? <Check size={14} strokeWidth={3} /> : null}</span>
            <span>{kind.label}{!kind.ready && <span className="ml-2 text-xs">Source validation pending</span>}</span>
          </label>;
        })}</div></div>)}
      {message && <p role="status" className="mt-5 text-sm" style={{ color: theme.colors.textMuted }}>{message}</p>}
    </>}
  </section>;
}

"use client";

import { useEffect, useState } from "react";
import { kitThemes } from "../../lib/themes";

type Kind = { id: string; label: string; group: string; title: string; body: string; ready: boolean };
type History = { id: string; kind: string; title: string; body: string; audience: string; createdAt: string; accepted: number; failed: number; pending: number };
type Data = { configured: boolean; subscribers: number; kinds: Kind[]; templates: Record<string, { title: string; body: string }>; history: History[] };

export default function AdminNotifications() {
  const theme = kitThemes.home;
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [customUrl, setCustomUrl] = useState("/");
  const [audience, setAudience] = useState<"admins" | "supporters">("admins");

  async function load() {
    const response = await fetch("/api/admin/notifications", { cache: "no-store" });
    const result = await response.json() as Data & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Could not load notifications.");
    setData(result);
    return result;
  }
  useEffect(() => { void Promise.resolve().then(load).catch((cause) => setError(String(cause))); }, []);
  function choose(kind: string, source = data) {
    if (!source) return;
    const defaults = source.kinds.find((item) => item.id === kind);
    if (!defaults) return;
    setSelected(kind); setTitle(source.templates[kind]?.title ?? defaults.title); setBody(source.templates[kind]?.body ?? defaults.body);
  }
  async function send(value: Record<string, unknown>) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value) });
      const result = await response.json() as { error?: string; accepted?: number; failed?: number };
      if (!response.ok) throw new Error(result.error ?? "Request failed.");
      setMessage(value.action === "template" ? "Template saved for future notifications." : `Push service accepted ${result.accepted ?? 0} delivery attempt(s); ${result.failed ?? 0} failed. This does not guarantee the device displayed them.`);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Request failed."); }
    finally { setBusy(false); }
  }
  const border = theme.colors.border;
  const input = "w-full border bg-transparent px-3 py-2 text-sm";
  return <div className="mx-auto max-w-6xl space-y-7 p-5 md:p-8" style={{ color: theme.colors.text, background: theme.colors.background }}>
    <header><p className="text-xs uppercase tracking-[.22em]" style={{ color: theme.colors.accent }}>Admin / Communications</p><h1 className="mt-3 text-3xl md:text-5xl">Notifications</h1>
      <p className="mt-3 text-sm" style={{ color: theme.colors.textMuted }}>{data?.subscribers ?? 0} active device subscription(s) · {data?.configured ? "Web Push configured" : "Web Push not configured"}</p></header>
    {error && <p role="alert" className="border p-3 text-sm" style={{ borderColor: theme.colors.danger, color: theme.colors.danger }}>{error}</p>}
    {message && <p role="status" className="border p-3 text-sm" style={{ borderColor: border }}>{message}</p>}
    <section className="border p-5" style={{ borderColor: border, background: theme.colors.surface }}>
      <h2 className="text-xl">Send a test</h2><p className="mt-2 text-sm" style={{ color: theme.colors.textMuted }}>Sends only to your subscribed devices. Enable notifications in Settings first.</p>
      <button type="button" disabled={busy || !data?.configured} onClick={() => send({ action: "test" })} className="mt-4 cursor-pointer border px-4 py-2 text-sm disabled:opacity-50" style={{ borderColor: theme.colors.accent }}>Send test notification</button>
    </section>
    <section className="border p-5" style={{ borderColor: border, background: theme.colors.surface }}>
      <h2 className="text-xl">Send a custom notification</h2><p className="mt-2 text-sm" style={{ color: theme.colors.textMuted }}>Only opted-in devices receive it. Check the message and audience before sending.</p>
      <div className="mt-4 grid gap-3"><label className="text-sm">Title<input className={`${input} mt-1`} style={{ borderColor: border }} maxLength={120} value={customTitle} onChange={(event) => setCustomTitle(event.target.value)} /></label>
        <label className="text-sm">Body<textarea className={`${input} mt-1`} style={{ borderColor: border }} maxLength={240} rows={3} value={customBody} onChange={(event) => setCustomBody(event.target.value)} /></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Destination within dashboard<input className={`${input} mt-1`} style={{ borderColor: border }} value={customUrl} onChange={(event) => setCustomUrl(event.target.value)} /></label>
          <label className="text-sm">Audience<select className={`${input} mt-1`} style={{ borderColor: border, background: theme.colors.surface }} value={audience} onChange={(event) => setAudience(event.target.value as "admins" | "supporters")}><option value="admins">Admins only</option><option value="supporters">All subscribed supporters</option></select></label></div>
        <div className="border p-4" style={{ borderColor: border }}><p className="text-xs uppercase tracking-widest" style={{ color: theme.colors.textMuted }}>Preview</p><p className="mt-2 font-semibold">{customTitle || "Notification title"}</p><p className="mt-1 text-sm" style={{ color: theme.colors.textMuted }}>{customBody || "Notification body"}</p></div>
        <button type="button" disabled={busy || !data?.configured || !customTitle.trim() || !customBody.trim()} onClick={() => { if (window.confirm(`Send this notification to ${audience === "admins" ? "admins" : "all subscribed supporters"}?`)) send({ action: "custom", title: customTitle, body: customBody, url: customUrl, audience }); }}
          className="w-fit cursor-pointer border px-4 py-2 text-sm disabled:opacity-50" style={{ borderColor: theme.colors.accent }}>Send custom notification</button></div>
    </section>
    <section className="border p-5" style={{ borderColor: border, background: theme.colors.surface }}><h2 className="text-xl">Message templates</h2>
      <p className="mt-2 text-sm" style={{ color: theme.colors.textMuted }}>Edit future messages. Available variables include {'{home}'}, {'{away}'}, {'{opponent}'}, {'{player}'}, {'{minute}'}, {'{homeScore}'}, {'{awayScore}'}, {'{kickoff}'}, {'{detail}'}, and {'{count}'}.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-[16rem_1fr]"><div className="max-h-96 overflow-auto border" style={{ borderColor: border }}>{data?.kinds.map((kind) => <button key={kind.id} type="button" onClick={() => choose(kind.id)} className="block w-full cursor-pointer border-b p-3 text-left text-sm" style={{ borderColor: border, color: selected === kind.id ? theme.colors.accent : theme.colors.text }}>{kind.label}{!kind.ready && <span className="block text-xs" style={{ color: theme.colors.textMuted }}>Awaiting verified source</span>}</button>)}</div>
        <div>{selected ? <><label className="text-sm">Title<input className={`${input} mt-1`} style={{ borderColor: border }} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label className="mt-3 block text-sm">Body<textarea className={`${input} mt-1`} style={{ borderColor: border }} rows={4} maxLength={240} value={body} onChange={(event) => setBody(event.target.value)} /></label>
          <div className="mt-4 border p-4" style={{ borderColor: border }}><p className="text-xs uppercase tracking-widest" style={{ color: theme.colors.textMuted }}>Template preview</p><p className="mt-2 font-semibold">{title}</p><p className="mt-1 text-sm">{body}</p></div>
          <button type="button" disabled={busy} onClick={() => send({ action: "template", kind: selected, title, body })} className="mt-4 cursor-pointer border px-4 py-2 text-sm disabled:opacity-50" style={{ borderColor: theme.colors.accent }}>Save template</button></> : <p className="text-sm" style={{ color: theme.colors.textMuted }}>Select a notification type.</p>}</div></div></section>
    <section className="border p-5" style={{ borderColor: border, background: theme.colors.surface }}><h2 className="text-xl">Recent notifications</h2>
      {!data?.history.length ? <p className="mt-4 text-sm" style={{ color: theme.colors.textMuted }}>No notifications have been queued yet.</p> : <div className="mt-4 space-y-2">{data.history.map((item) => <article key={item.id} className="border p-3 text-sm" style={{ borderColor: border }}><div className="flex flex-wrap justify-between gap-2"><strong>{item.title}</strong><span style={{ color: theme.colors.textMuted }}>{new Date(item.createdAt).toLocaleString()}</span></div><p className="mt-1" style={{ color: theme.colors.textMuted }}>{item.body}</p><p className="mt-2 text-xs" style={{ color: theme.colors.textMuted }}>{item.kind} · {item.audience} · Accepted {item.accepted} · Failed {item.failed} · Pending {item.pending}</p></article>)}</div>}
    </section>
  </div>;
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { kitThemes } from "../../lib/themes";
import type { getAdminEmailData } from "../../lib/email/admin";

type Data = Awaited<ReturnType<typeof getAdminEmailData>>;

export default function AdminEmailDesk({ data, ownEmail, previews }: { data: Data | null; ownEmail: string; previews: { reset: string; welcome: string; test: string } }) {
  const theme = kitThemes.home;
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState<"reset" | "welcome" | "test">("welcome");

  async function sendTest() {
    if (pending) return;
    setPending(true); setFeedback(null);
    try {
      const response = await fetch("/api/admin/email/test", { method: "POST" });
      const result = await response.json() as { ok?: boolean; message?: string; error?: string };
      setFeedback({ ok: response.ok, text: response.ok ? result.message ?? "Email accepted." : result.error ?? "Test failed." });
      router.refresh();
    } catch { setFeedback({ ok: false, text: "Connection failed. Try again." }); }
    finally { setPending(false); }
  }

  const border = theme.colors.border;
  return <div className="space-y-6 p-4 md:p-8">
    <header><p className="text-xs uppercase tracking-[.22em]" style={{ color: theme.colors.accent }}>Admin / Communications</p><h1 className="mt-3 text-3xl md:text-5xl">Email desk</h1><p className="mt-3 max-w-2xl text-sm leading-6" style={{ color: theme.colors.textMuted }}>Password recovery and connection tests. “Accepted” means SMTP took the message; it does not prove inbox delivery.</p></header>
    <section className="grid gap-px border sm:grid-cols-3" style={{ borderColor: border, background: border }}>
      {[["SMTP", data?.smtp.configured ? "Configured" : "Not configured"], ["Accepted", String(data?.accepted ?? 0)], ["Failed", String(data?.failed ?? 0)]].map(([label, value]) => <div key={label} className="p-5" style={{ background: theme.colors.surface }}><p className="text-xs uppercase tracking-widest" style={{ color: theme.colors.textMuted }}>{label}</p><p className="mt-2 text-xl">{value}</p></div>)}
    </section>
    <section className="border p-5 md:p-7" style={{ borderColor: border, background: theme.colors.surface }}>
      <h2 className="text-xl">Send a test to yourself</h2><p className="mt-2 text-sm" style={{ color: theme.colors.textMuted }}>Recipient: {ownEmail}. From: {data?.smtp.from ?? "not configured"}. Limited to three attempts per hour. No message is sent until you press the button.</p>
      {!data?.schemaReady && <p className="mt-3 text-sm" style={{ color: theme.colors.warning }}>The email log migration is pending or the database is unavailable. Apply it before testing.</p>}
      <button type="button" onClick={sendTest} disabled={pending || !data?.schemaReady || !data.smtp.configured} className="mt-5 cursor-pointer border px-5 py-3 disabled:cursor-not-allowed disabled:opacity-50" style={{ borderColor: theme.colors.accent, color: theme.colors.accent }}>{pending ? "Sending…" : "Send test email"}</button>
      {feedback && <p className="mt-4 text-sm" role="status" style={{ color: feedback.ok ? theme.colors.success : theme.colors.danger }}>{feedback.text}</p>}
    </section>
    <section className="border p-5 md:p-7" style={{ borderColor: border, background: theme.colors.surface }}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl">Templates</h2><p className="mt-1 text-sm" style={{ color: theme.colors.textMuted }}>Preview only. The reset link below is deliberately invalid. Welcome messages are sent after successful signup.</p></div><div className="flex flex-wrap gap-2">{(["welcome", "reset", "test"] as const).map((kind) => <button type="button" key={kind} onClick={() => setPreview(kind)} aria-pressed={preview === kind} className="cursor-pointer border px-3 py-2 text-sm" style={{ borderColor: preview === kind ? theme.colors.accent : border, color: preview === kind ? theme.colors.accent : theme.colors.textMuted }}>{kind === "reset" ? "Password reset" : kind === "welcome" ? "Welcome" : "Test email"}</button>)}</div></div>
      <iframe title={`${preview === "reset" ? "Password reset" : preview === "welcome" ? "Welcome" : "Test email"} template preview`} sandbox="" srcDoc={previews[preview]} className="mt-5 h-[520px] w-full border" style={{ borderColor: border }} />
    </section>
    <section className="border p-5 md:p-7" style={{ borderColor: border, background: theme.colors.surface }}>
      <h2 className="text-xl">Recent attempts</h2><p className="mt-1 text-sm" style={{ color: theme.colors.textMuted }}>Last 50 SMTP attempts. Recipients are masked; reset tokens, links, and message bodies are never stored here.</p>
      {!data?.attempts.length ? <p className="mt-5 text-sm" style={{ color: theme.colors.textMuted }}>No email attempts logged yet.</p> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[560px] border-collapse text-left text-sm"><thead><tr style={{ color: theme.colors.textMuted }}><th className="border-b p-3" style={{ borderColor: border }}>When</th><th className="border-b p-3" style={{ borderColor: border }}>Type</th><th className="border-b p-3" style={{ borderColor: border }}>Recipient</th><th className="border-b p-3" style={{ borderColor: border }}>Result</th></tr></thead><tbody>{data.attempts.map((item) => <tr key={item.id}><td className="border-b p-3" style={{ borderColor: border }}>{new Date(item.createdAt).toLocaleString()}</td><td className="border-b p-3" style={{ borderColor: border }}>{item.kind === "admin_test" ? "Test" : item.kind === "welcome" ? "Welcome" : "Password reset"}</td><td className="border-b p-3" style={{ borderColor: border }}>{item.recipientMasked}</td><td className="border-b p-3" style={{ borderColor: border, color: item.status === "failed" ? theme.colors.danger : theme.colors.success }}>{item.status === "accepted" ? "Accepted" : `Failed · ${item.errorCode ?? "SMTP_ERROR"}`}</td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}

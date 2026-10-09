"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, ScanSearch } from "lucide-react";
import type { getMediaCuration } from "../../lib/media/get-media-curation";
import type { previewDailyGoalImport } from "../../lib/providers/dailygoal/import";
import type { discoverDailyGoalMatches } from "../../lib/providers/dailygoal/discovery";
import { kitThemes } from "../../lib/themes";

type Data = Awaited<ReturnType<typeof getMediaCuration>>;
type Preview = Awaited<ReturnType<typeof previewDailyGoalImport>>;
type Discovery = Awaited<ReturnType<typeof discoverDailyGoalMatches>>;

export default function DailyGoalCuration({ data }: { data: Data }) {
  const router = useRouter();
  const theme = kitThemes.home;
  const [url, setUrl] = useState("");
  const [preRoll, setPreRoll] = useState("1");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [edits, setEdits] = useState<Record<string, { goal: string; second: string }>>({});
  const panel = { background: theme.colors.surface, borderColor: theme.colors.border };
  const field = { borderColor: theme.colors.border, background: theme.colors.background };

  async function runDiscovery(mode: "preview" | "apply") {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/media/dailygoal/discover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, preRoll: Number(preRoll) }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Discovery failed.");
      setDiscovery(payload.result);
      setMessage(mode === "preview" ? "Discovery preview complete. No rows changed." : `Bulk Apply: ${payload.result.totals.published} goals published, ${payload.result.totals.queued} queued, ${payload.result.totals.preserved} existing links preserved.`);
      if (mode === "apply") router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Discovery failed."); }
    finally { setBusy(false); }
  }

  async function run(mode: "preview" | "apply") {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/media/dailygoal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, mode, preRoll: Number(preRoll) }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "DailyGoal request failed.");
      setPreview(payload.result);
      setMessage(mode === "preview" ? "Dry-run complete. No rows changed." : `Applied: ${payload.result.applied.published} published, ${payload.result.applied.queued} queued, ${payload.result.applied.preserved} existing links preserved.`);
      if (mode === "apply") router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "DailyGoal request failed."); }
    finally { setBusy(false); }
  }

  async function review(id: string, action: "approve" | "reject") {
    const candidate = data.timestampCandidates.find((item) => item.id === id);
    if (!candidate) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/media/dailygoal", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action, matchEventId: edits[id]?.goal || candidate.matchEventId || undefined, startSecond: Number(edits[id]?.second ?? candidate.startSecond) }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Review failed.");
      setMessage(action === "approve" ? "Published as admin-reviewed metadata, not visually inspected footage." : "Candidate rejected.");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Review failed."); }
    finally { setBusy(false); }
  }

  return <>
    <section className="border p-5 sm:p-6" style={panel}>
      <div className="flex items-center gap-2"><ScanSearch size={19} style={{ color: theme.colors.accent }} /><h2 className="text-xl">Discover Barça matches</h2></div>
      <p className="mt-2 max-w-3xl text-sm" style={{ color: theme.colors.textMuted }}>Inspect real links on DailyGoal’s public Barça page against finished, current-season fixtures. The preview is read-only; Apply uses the existing goal importer. At most 12 linked match pages are inspected per run.</p>
      <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void runDiscovery("preview")} className="cursor-pointer border px-4 py-3 text-sm disabled:opacity-50 focus-visible:outline-2" style={{ borderColor: theme.colors.border }}>Discover Barça matches</button><button type="button" disabled={busy || !discovery || discovery.mode !== "preview" || discovery.stopped} onClick={() => void runDiscovery("apply")} className="cursor-pointer border px-4 py-3 text-sm disabled:opacity-50 focus-visible:outline-2" style={{ borderColor: theme.colors.accent, color: theme.colors.accent }}>Apply discovered goals</button></div>
      {discovery && <div className="mt-5 border p-4" style={{ borderColor: theme.colors.border }}>
        <p className="text-sm">{discovery.totals.matched} ready · {discovery.totals.missingVideo} missing video/goals · {discovery.totals.ambiguous} ambiguous · {discovery.totals.rejected} rejected · {discovery.totals.unavailable} unavailable · {discovery.uninspected} not inspected</p>
        <p className="mt-1 text-xs" style={{ color: theme.colors.textMuted }}>{discovery.totals.acceptedGoals} goal timestamps accepted · {discovery.totals.reviewGoals} need review · {discovery.missingCoverage.length} current-season fixtures without a DailyGoal match link{discovery.stopped ? " · source access stopped after 403/429" : ""}</p>
        <div className="mt-3 divide-y" style={{ borderColor: theme.colors.border }}>{discovery.results.map((item) => <div key={item.url} className="grid gap-2 py-3 text-sm md:grid-cols-[minmax(0,1fr)_110px_150px]"><div><a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline" style={{ color: theme.colors.accent }}>{item.fixture ?? "Uninspected fixture metadata"} <ExternalLink size={12} /></a><p className="mt-1 text-xs" style={{ color: theme.colors.textMuted }}>{item.canonicalFixture ? `Canonical: ${item.canonicalFixture} · ` : ""}{item.competition ?? "Competition unknown"} · {item.date ? new Date(item.date).toLocaleDateString() : "Date unknown"} · {item.reason}</p></div><span style={{ color: item.status === "matched" ? theme.colors.success : theme.colors.warning }}>{item.status}</span><span className="text-xs">{item.status === "matched" ? `${item.accepted} accepted · ${item.review} review${item.officialFilm ? "" : " · official film missing"}` : "No automatic import"}</span></div>)}</div>
        {discovery.missingCoverage.length > 0 && <details className="mt-3 border p-3" style={{ borderColor: theme.colors.border }}><summary className="cursor-pointer text-sm">Missing coverage · {discovery.missingCoverage.length}</summary><ul className="mt-2 space-y-1 text-xs" style={{ color: theme.colors.textMuted }}>{discovery.missingCoverage.map((item) => <li key={item.matchId}>{item.fixture} · {item.competition} · {new Date(item.kickoff).toLocaleDateString()}</li>)}</ul></details>}
      </div>}
    </section>
    <section className="border p-5 sm:p-6" style={panel}>
      <div className="flex items-center gap-2"><ScanSearch size={19} style={{ color: theme.colors.accent }} /><h2 className="text-xl">DailyGoal timestamps</h2></div>
      <p className="mt-2 max-w-3xl text-sm" style={{ color: theme.colors.textMuted }}>Read a public match page’s JSON-LD, then check its goals against canonical events and an existing official YouTube film. Preview changes nothing. Metadata confirmation does not mean a person watched the footage.</p>
      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_110px_auto_auto] md:items-end">
        <label className="min-w-0 text-xs">DailyGoal match URL<input type="url" value={url} onChange={(event) => { setUrl(event.target.value); setPreview(null); }} placeholder="https://dailygoal.tv/m/…" className="mt-1 w-full min-w-0 border p-3 text-sm" style={field} /></label>
        <label className="text-xs">Pre-roll (s)<input type="number" min="0" max="10" value={preRoll} onChange={(event) => { setPreRoll(event.target.value); setPreview(null); setDiscovery(null); }} className="mt-1 w-full border p-3 text-sm" style={field} /></label>
        <button type="button" disabled={busy || !url} onClick={() => void run("preview")} className="cursor-pointer border px-4 py-3 text-sm disabled:opacity-50 focus-visible:outline-2" style={{ borderColor: theme.colors.border }}>Dry-run preview</button>
        <button type="button" disabled={busy || !preview} onClick={() => void run("apply")} className="cursor-pointer border px-4 py-3 text-sm disabled:opacity-50 focus-visible:outline-2" style={{ borderColor: theme.colors.accent, color: theme.colors.accent }}>Apply import</button>
      </div>
      {preview && <div className="mt-5 border p-4" style={{ borderColor: theme.colors.border }}>
        <h3 className="text-base">{preview.source.home} {preview.source.homeScore}–{preview.source.awayScore} {preview.source.away}</h3>
        <p className="mt-1 text-xs" style={{ color: theme.colors.textMuted }}>{preview.video?.title ?? "Video metadata unavailable"} · {preview.video?.durationSeconds ?? "unknown"}s · {preview.mediaItem ? "Existing official film linked" : "No unique official film linked"}</p>
        <p className="mt-3 text-sm">{preview.summary.accepted} accepted · {preview.summary.review} review · {preview.summary.rejected} rejected</p>
        <div className="mt-3 divide-y" style={{ borderColor: theme.colors.border }}>{preview.decisions.map((item) => <div key={item.clip.permalink} className="grid gap-2 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_125px_140px]"><div><strong>{item.clip.minute}&apos; {item.clip.scorer}</strong><p className="mt-1 text-xs" style={{ color: theme.colors.textMuted }}>{item.reasons.join(" ")}</p><a href={item.clip.permalink} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs underline" style={{ color: theme.colors.accent }}>Source <ExternalLink size={12} /></a></div><span>{item.clip.startOffset}s → {item.startSecond}s</span><span style={{ color: item.status === "accepted" ? theme.colors.success : theme.colors.warning }}>{item.status}{item.existing ? " · preserved" : ""}</span></div>)}</div>
        {preview.source.warnings.map((warning) => <p key={warning} className="text-xs" style={{ color: theme.colors.warning }}>{warning}</p>)}
      </div>}
      {message && <p role="status" className="mt-4 border p-3 text-sm" style={{ borderColor: theme.colors.border }}>{message}</p>}
    </section>
    <section className="border p-5 sm:p-6" style={panel}>
      <h2 className="text-xl">Timestamp review queue · {data.timestampCandidates.length}</h2>
      <p className="mt-1 text-sm" style={{ color: theme.colors.textMuted }}>Correct the goal or starting second, then approve or reject. A missing official film must be attached in Media first.</p>
      <div className="mt-4 space-y-3">{data.timestampCandidates.map((candidate) => { const edit = edits[candidate.id]; return <div key={candidate.id} className="border p-4" style={{ borderColor: theme.colors.border }}>
        <p className="text-sm font-medium">{candidate.minute}&apos; {candidate.scorer} · source offset {candidate.sourceSecond}s</p>
        <p className="mt-1 text-xs" style={{ color: theme.colors.textMuted }}>{candidate.reasons.join(" ")}</p>
        <a href={candidate.clipUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs underline" style={{ color: theme.colors.accent }}>Inspect source <ExternalLink size={12} /></a>
        <div className="mt-3 flex flex-wrap gap-2"><select aria-label={`Canonical goal for ${candidate.scorer}`} value={edit?.goal ?? candidate.matchEventId ?? ""} onChange={(event) => setEdits((old) => ({ ...old, [candidate.id]: { goal: event.target.value, second: old[candidate.id]?.second ?? String(candidate.startSecond) } }))} className="min-w-0 flex-1 border p-2 text-sm" style={field}><option value="">Choose canonical goal</option>{data.goals.filter((goal) => goal.matchId === candidate.matchId).map((goal) => <option key={goal.id} value={goal.id}>{goal.label}</option>)}</select><input aria-label={`Start second for ${candidate.scorer}`} type="number" min="0" value={edit?.second ?? String(candidate.startSecond)} onChange={(event) => setEdits((old) => ({ ...old, [candidate.id]: { goal: old[candidate.id]?.goal ?? candidate.matchEventId ?? "", second: event.target.value } }))} className="w-24 border p-2 text-sm" style={field} /><button type="button" disabled={busy || !candidate.mediaItemId} onClick={() => void review(candidate.id, "approve")} className="cursor-pointer border px-3 py-2 text-sm disabled:opacity-50 focus-visible:outline-2" style={{ borderColor: theme.colors.accent, color: theme.colors.accent }}>Approve</button><button type="button" disabled={busy} onClick={() => void review(candidate.id, "reject")} className="cursor-pointer border px-3 py-2 text-sm disabled:opacity-50 focus-visible:outline-2" style={{ borderColor: theme.colors.border }}>Reject</button></div>
      </div>; })}{!data.timestampCandidates.length && <p className="text-sm" style={{ color: theme.colors.textMuted }}>No timestamps waiting for review.</p>}</div>
    </section>
  </>;
}

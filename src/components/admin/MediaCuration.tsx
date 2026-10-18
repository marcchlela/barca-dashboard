"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ExternalLink, Film, Link2, Play, Plus, Star, Trash2 } from "lucide-react";
import type { getMediaCuration } from "../../lib/media/get-media-curation";
import { kitThemes } from "../../lib/themes";
import { ThemedMenu } from "../my-barca/MyBarcaFilters";
import DailyGoalCuration from "./DailyGoalCuration";

type Data = Awaited<ReturnType<typeof getMediaCuration>>;

function goalPreviewUrl(url: string, startSecond: number | null) {
  if (startSecond === null) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("t", `${startSecond}s`);
    return parsed.toString();
  } catch { return url; }
}

function FixtureCrests({ homeCrest, awayCrest, homeName, awayName }: { homeCrest: string | null; awayCrest: string | null; homeName: string; awayName: string }) {
  return <span className="flex w-11 shrink-0 items-center -space-x-1">{homeCrest ? <Image unoptimized src={homeCrest} width={22} height={22} className="h-[22px] w-[22px] object-contain" alt="" /> : <span className="grid h-[22px] w-[22px] place-items-center border text-[8px]">{homeName.slice(0, 2).toUpperCase()}</span>}{awayCrest ? <Image unoptimized src={awayCrest} width={22} height={22} className="h-[22px] w-[22px] object-contain" alt="" /> : <span className="grid h-[22px] w-[22px] place-items-center border text-[8px]">{awayName.slice(0, 2).toUpperCase()}</span>}</span>;
}

export default function MediaCuration({ data }: { data: Data }) {
  const router = useRouter();
  const theme = kitThemes.home;
  const [filmId, setFilmId] = useState(data.media[0]?.id ?? "");
  const [goalId, setGoalId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [evidence, setEvidence] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [showGoalShelfPicker, setShowGoalShelfPicker] = useState(false);
  const shelfMatches = useMemo(() => [...new Map(data.shelfCandidates.map((candidate) => [candidate.matchId, { id: candidate.matchId, label: candidate.matchLabel, kickoff: candidate.kickoff, homeName: candidate.homeName, homeCrest: candidate.homeCrest, awayName: candidate.awayName, awayCrest: candidate.awayCrest }])).values()], [data.shelfCandidates]);
  const [shelfMatchId, setShelfMatchId] = useState(shelfMatches[0]?.id ?? "");
  const [shelfSelection, setShelfSelection] = useState<string[]>([]);
  const film = data.media.find((item) => item.id === filmId);
  const goals = useMemo(() => data.goals.filter((goal) => goal.matchId === film?.matchId), [data.goals, film?.matchId]);

  async function send(action: "feature" | "verify-goal", mediaItemId: string) {
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/admin/media/curation", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, mediaItemId, matchEventId: goalId, startSecond: start, endSecond: end, evidenceUrl: evidence, reviewNote: note }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save.");
      setStatus(action === "feature" ? "Featured film updated." : "Exact goal link verified. It is now available to the curated goal shelf and Match Center.");
      router.refresh();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not save."); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this verified goal link?")) return;
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/admin/media/curation", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (!response.ok) throw new Error("Could not remove goal link.");
      setStatus("Goal link removed."); router.refresh();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not remove."); }
    finally { setBusy(false); }
  }

  async function updateGoalShelf(action: "shelf-add" | "shelf-remove", momentIds: string[]) {
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/admin/media/curation", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, momentIds }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not update the goal shelf.");
      setShelfSelection([]);
      setShowGoalShelfPicker(false);
      setStatus(action === "shelf-add" ? `${result.updated} ${result.updated === 1 ? "goal" : "goals"} added to Goals worth another look.` : "Goal removed from Goals worth another look.");
      router.refresh();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not update the goal shelf."); }
    finally { setBusy(false); }
  }

  const panel = { borderColor: theme.colors.border, background: theme.colors.surface };
  return <div className="space-y-5 pb-12" style={{ color: theme.colors.text }}>
    <header className="border p-6" style={panel}><p className="text-xs uppercase tracking-[.2em]" style={{ color: theme.colors.accent }}>Media / Curation</p><h1 className="mt-2 text-3xl">The screening desk</h1><p className="mt-2 max-w-2xl text-sm" style={{ color: theme.colors.textMuted }}>Choose the featured film and verify exact goal footage. A match highlight is never presented as a specific goal until you link the right event and, for a longer film, its exact seconds.</p></header>
    <section className="border p-6" style={panel}><div className="flex items-center gap-2"><Star size={18} style={{ color: theme.colors.accent }} /><h2 className="text-xl">Featured film</h2></div><p className="mt-1 text-sm opacity-70">One editorial pick for the shared screening room. Personal recommendations can follow when accounts exist.</p><div className="mt-5 flex flex-col gap-3 sm:flex-row"><select aria-label="Featured film" className="min-w-0 flex-1 border bg-transparent p-3" style={{ borderColor: theme.colors.border }} defaultValue={data.featured.find((item) => item.featured)?.id ?? data.featured[0]?.id ?? ""} id="featured-film">{data.featured.map((item) => <option key={item.id} value={item.id} style={{ background: theme.colors.background }}>{item.title}</option>)}</select><button type="button" disabled={busy || !data.featured.length} className="border px-5 py-3 disabled:opacity-50" style={{ borderColor: theme.colors.accent, color: theme.colors.accent }} onClick={() => { const node = document.getElementById("featured-film") as HTMLSelectElement | null; if (node?.value) void send("feature", node.value); }}>Set as featured</button></div></section>
    <section className="border p-6" style={panel}>
      <div className="flex items-center gap-2"><Link2 size={18} style={{ color: theme.colors.accent }} /><h2 className="text-xl">Visually verify a goal moment</h2></div>
      <p className="mt-1 text-sm opacity-70">Open the stored film and inspect the goal before saving. Each verified link becomes one goal card in “Goals worth another look.” Add an end second when you want playback bounded to that goal.</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">Film<select value={filmId} onChange={(event) => { setFilmId(event.target.value); setGoalId(""); }} className="border bg-transparent p-3" style={{ borderColor: theme.colors.border }}><option value="" style={{ background: theme.colors.background }}>Choose film</option>{data.media.map((item) => <option key={item.id} value={item.id} style={{ background: theme.colors.background }}>{item.title} · {item.type}</option>)}</select></label>
        <label className="flex flex-col gap-2 text-sm">Goal event<select value={goalId} onChange={(event) => setGoalId(event.target.value)} className="border bg-transparent p-3" style={{ borderColor: theme.colors.border }}><option value="" style={{ background: theme.colors.background }}>Choose goal</option>{goals.map((goal) => <option key={goal.id} value={goal.id} style={{ background: theme.colors.background }}>{goal.label} · {goal.matchLabel}</option>)}</select></label>
        <label className="flex flex-col gap-2 text-sm">Starts at second<input type="number" min="0" value={start} onChange={(event) => setStart(event.target.value)} placeholder={film?.type === "goal_clip" ? "Optional for standalone clip" : "Required"} className="border bg-transparent p-3" style={{ borderColor: theme.colors.border }} /></label>
        <label className="flex flex-col gap-2 text-sm">Ends at second (optional for official YouTube)<input type="number" min="1" value={end} onChange={(event) => setEnd(event.target.value)} placeholder="Leave blank if unknown" className="border bg-transparent p-3" style={{ borderColor: theme.colors.border }} /></label>
        <label className="flex flex-col gap-2 text-sm md:col-span-2">Exact-goal evidence URL<input type="url" value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="https://…" className="border bg-transparent p-3" style={{ borderColor: theme.colors.border }} /></label>
        <label className="flex flex-col gap-2 text-sm md:col-span-2">Review note (optional)<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} className="border bg-transparent p-3" style={{ borderColor: theme.colors.border }} /></label>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">{film && <a href={film.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border px-4 py-3" style={{ borderColor: theme.colors.border }}>Inspect source <ExternalLink size={15} /></a>}<button type="button" disabled={busy || !filmId || !goalId} onClick={() => void send("verify-goal", filmId)} className="cursor-pointer border px-5 py-3 disabled:opacity-50" style={{ borderColor: theme.colors.accent, color: theme.colors.accent }}>Confirm exact goal</button></div>
    </section>
    <DailyGoalCuration data={data} />
    <section className="border p-6" style={panel}>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Star size={18} style={{ color: theme.colors.accent }} /><h2 className="text-xl">Goals worth another look</h2></div><p className="mt-1 text-sm opacity-70">Your hand-picked goal shelf. Only goals with verified footage can be selected.</p></div><button type="button" onClick={() => setShowGoalShelfPicker((shown) => !shown)} className="inline-flex cursor-pointer items-center gap-2 border px-4 py-3" style={{ borderColor: theme.colors.accent, color: theme.colors.accent }}><Plus size={16} /> Add goal</button></div>
      {showGoalShelfPicker && <div className="mt-5 border p-4" style={{ borderColor: theme.colors.border }}>
        <div className="max-w-3xl"><ThemedMenu label="Match" value={shelfMatchId} onChange={(value) => { setShelfMatchId(value); setShelfSelection([]); }} theme={theme} options={shelfMatches.map((match) => ({ value: match.id, label: `${match.label}${match.kickoff ? ` · ${new Date(match.kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}` : ""}`, mark: <FixtureCrests homeCrest={match.homeCrest} awayCrest={match.awayCrest} homeName={match.homeName} awayName={match.awayName} /> }))} /></div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">{data.shelfCandidates.filter((candidate) => candidate.matchId === shelfMatchId).map((candidate) => <div key={candidate.momentId} className="flex items-start justify-between gap-3 border p-3 text-sm" style={{ borderColor: candidate.curated ? theme.colors.accent : theme.colors.border, opacity: candidate.curated ? .65 : 1 }}><label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3"><input type="checkbox" className="mt-1" checked={candidate.curated || shelfSelection.includes(candidate.momentId)} disabled={candidate.curated} onChange={(event) => setShelfSelection((current) => event.target.checked ? [...current, candidate.momentId] : current.filter((id) => id !== candidate.momentId))} /><span className="min-w-0"><strong>{candidate.goalLabel}</strong><span className="mt-1 block text-xs opacity-70">{candidate.mediaTitle} · {candidate.sourceName}{candidate.curated ? " · already selected" : ""}</span></span></label><a href={goalPreviewUrl(candidate.mediaUrl, candidate.startSecond)} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 border px-2 py-1.5 text-xs" style={{ borderColor: theme.colors.accent, color: theme.colors.accent }} aria-label={`Watch ${candidate.goalLabel}`}><Play size={12} fill="currentColor" /> Watch goal</a></div>)}</div>
        {shelfMatchId && !data.shelfCandidates.some((candidate) => candidate.matchId === shelfMatchId) && <p className="mt-4 text-sm opacity-70">No verified goal footage is available for this match yet.</p>}
        <button type="button" disabled={busy || shelfSelection.length === 0} onClick={() => void updateGoalShelf("shelf-add", shelfSelection)} className="mt-4 cursor-pointer border px-5 py-3 disabled:opacity-50" style={{ borderColor: theme.colors.accent, color: theme.colors.accent }}>Add selected goals</button>
      </div>}
      <div className="mt-5 divide-y" style={{ borderColor: theme.colors.border }}>{data.shelfCandidates.filter((candidate) => candidate.curated).length ? data.shelfCandidates.filter((candidate) => candidate.curated).map((candidate) => <div key={candidate.momentId} className="flex items-center justify-between gap-3 py-3"><div><strong className="text-sm">{candidate.goalLabel}</strong><p className="text-xs opacity-70">{candidate.matchLabel} · {candidate.mediaTitle}</p></div><div className="flex shrink-0 items-center gap-2"><a href={goalPreviewUrl(candidate.mediaUrl, candidate.startSecond)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 border px-2 py-1.5 text-xs" style={{ borderColor: theme.colors.accent, color: theme.colors.accent }}><Play size={12} fill="currentColor" /> Watch goal</a><button type="button" disabled={busy} onClick={() => void updateGoalShelf("shelf-remove", [candidate.momentId])} className="cursor-pointer border p-2 disabled:opacity-50" style={{ borderColor: theme.colors.border }} aria-label={`Remove ${candidate.goalLabel} from Goals worth another look`}><Trash2 size={16} /></button></div></div>) : <p className="py-3 text-sm opacity-70">No goals selected yet.</p>}</div>
    </section>
    <section className="border p-6" style={panel}><div className="flex items-center gap-2"><Film size={18} style={{ color: theme.colors.accent }} /><h2 className="text-xl">Goal links</h2></div>{data.moments.length ? <div className="mt-4 divide-y" style={{ borderColor: theme.colors.border }}>{data.moments.map((moment) => <div key={moment.id} className="flex items-center justify-between gap-3 py-3"><div><strong className="text-sm">{moment.goalLabel}</strong><p className="text-xs opacity-70">{moment.mediaTitle}{moment.startSecond !== null ? ` · from ${moment.startSecond}s${moment.endSecond !== null ? ` to ${moment.endSecond}s` : " · end unknown"}` : " · standalone clip"} · {moment.verificationBasis === "manual_visual" ? "visually checked" : "metadata-confirmed"}</p></div><button type="button" disabled={busy} onClick={() => void remove(moment.id)} className="cursor-pointer border p-2 disabled:opacity-50" style={{ borderColor: theme.colors.border }} aria-label={`Remove ${moment.goalLabel} link`}><Trash2 size={16} /></button></div>)}</div> : <p className="mt-4 text-sm opacity-70">No goal moments are linked yet. Match highlights still appear as match highlights.</p>}</section>
    {status && <p role="status" className="border p-3 text-sm" style={panel}>{status}</p>}
  </div>;
}

"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Plus, Shield, X } from "lucide-react";
import type { MyBarcaData } from "../../lib/my-barca/get-my-barca";
import type { KitTheme } from "../../lib/themes";
import styles from "./TopMatches.module.css";

type Entry = MyBarcaData["entries"][number];
type Pick = MyBarcaData["favouriteMatches"][number];
const posterGold = "#D7AB48";

function Crest({ src, name, size = 42 }: { src: string | null; name: string; size?: number }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return <span className="inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
    {src && failedSrc !== src ? <Image unoptimized src={src} alt={name} width={size} height={size} className="h-full w-full object-contain" onError={() => setFailedSrc(src)} /> : <Shield size={size * .6} aria-label={name} />}
  </span>;
}

function Fixture({ entry, barcaCrest, compact = false }: { entry: Entry; barcaCrest: string | null; compact?: boolean }) {
  return <div className="flex items-center justify-center gap-1.5">
    <Crest src={barcaCrest} name="FC Barcelona" size={compact ? 30 : 42} />
    <span className="min-w-10 text-center text-base tabular-nums md:text-xl">{entry.result}</span>
    <Crest src={entry.opponent.crestUrl} name={entry.opponent.name} size={compact ? 30 : 42} />
  </div>;
}

export default function TopMatches({ entries, initialPicks, seasonId, barcaCrest, theme }: { entries: Entry[]; initialPicks: Pick[]; seasonId: string; barcaCrest: string | null; theme: KitTheme }) {
  const [picks, setPicks] = useState(initialPicks);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const seasonPicks = picks.filter((pick) => pick.seasonId === seasonId);

  function open(slot: number) { setActiveSlot(slot); setError(""); dialog.current?.showModal(); }
  async function save(slot: number, matchId: string | null) {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/favourites/match", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seasonId, slot, matchId }) });
      const payload = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Could not save your pick.");
      setPicks((current) => [...current.filter((pick) => pick.seasonId !== seasonId || pick.slot !== slot), ...(matchId ? [{ seasonId, slot, matchId }] : [])]);
      dialog.current?.close();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save your pick."); }
    finally { setSaving(false); }
  }

  return <><div className={styles.root}>
    <div className={styles.track} aria-label="Your three favourite matches">
      {[1, 2, 3].map((slot) => {
        const entry = entries.find((item) => item.id === seasonPicks.find((pick) => pick.slot === slot)?.matchId);
        return <div key={slot} className={styles.poster}>
          <button type="button" onClick={() => open(slot)} disabled={saving} className={`${styles.posterButton} border transition-colors hover:border-current focus-visible:outline-2 focus-visible:outline-offset-2`} style={{ borderColor: theme.colors.border, borderTop: `2px solid ${entry ? theme.colors.accent : posterGold}`, background: `linear-gradient(165deg, ${theme.colors.backgroundElevated}, ${theme.colors.surface})`, outlineColor: theme.colors.accent }} aria-label={entry ? `Change top match ${slot}: Barcelona ${entry.result} ${entry.opponent.name}` : `Choose top match ${slot}`}>
            <div className={`${styles.posterTop} ${entry ? styles.posterTopWithRemove : ""}`} style={{ color: theme.colors.accent }}><span>Favourite / 0{slot}</span></div>
            {entry ? <div className={styles.posterMiddle}><Fixture entry={entry} barcaCrest={barcaCrest} /><p className={styles.posterName}>vs {entry.opponent.name}</p><p className={styles.posterDate} style={{ color: theme.colors.textMuted }}>{new Date(entry.kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p></div> : <div className={`${styles.posterMiddle} flex flex-col items-center gap-3`}><span className="flex h-14 w-14 items-center justify-center border" style={{ borderColor: posterGold, color: posterGold }}><Plus size={29} /></span><span className="text-xs" style={{ color: theme.colors.textMuted }}>Choose a match</span></div>}
            <p className={styles.posterFoot} style={{ borderColor: theme.colors.border, color: theme.colors.textMuted }}>{entry ? `${entry.competition.name} · ${entry.rating !== null ? `${entry.rating.toFixed(1)} ★` : "Unrated"}` : "An empty place in your collection"}</p>
          </button>
          {entry && <button type="button" onClick={() => void save(slot, null)} disabled={saving} className={`${styles.remove} focus-visible:outline-2`} style={{ borderColor: theme.colors.border, background: theme.colors.surface, color: theme.colors.text }} aria-label={`Remove ${entry.opponent.name} from top match ${slot}`}><X size={13} />Remove</button>}
        </div>;
      })}
    </div>
    <p className="mt-3 text-xs" style={{ color: theme.colors.textMuted }}>These are your picks; they are separate from the automatically selected standout match.</p>
    {error && <p role="alert" className="mt-2 text-xs" style={{ color: theme.colors.danger }}>{error}</p>}
    </div>
    <dialog ref={dialog} onClose={() => setActiveSlot(null)} onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }} aria-label={`Choose favourite match ${activeSlot ?? ""}`} className={`${styles.dialog} border`} style={{ background: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }}>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b p-4" style={{ background: theme.colors.surface, borderColor: theme.colors.border }}><div><p className="text-[10px] uppercase tracking-widest" style={{ color: theme.colors.accent }}>Your top three / 0{activeSlot}</p><h4 className="mt-1 text-lg">Choose a match</h4></div><button type="button" onClick={() => dialog.current?.close()} aria-label="Close match picker" className="border p-2 focus-visible:outline-2" style={{ borderColor: theme.colors.border }}><X size={18} /></button></div>
      <div className={styles.dialogBody}>
      <p className="px-4 pt-4 text-xs" style={{ color: theme.colors.textMuted }}>Finished Barça matches from this season. A match can occupy only one spot.</p>
      <div className={styles.pickerGrid}>{entries.filter((entry) => !seasonPicks.some((pick) => pick.matchId === entry.id && pick.slot !== activeSlot)).map((entry) => <button key={entry.id} type="button" disabled={saving || activeSlot === null} onClick={() => activeSlot !== null && void save(activeSlot, entry.id)} className="border p-3 text-left transition-colors hover:border-current focus-visible:outline-2" style={{ borderColor: theme.colors.border, background: theme.colors.backgroundElevated, outlineColor: theme.colors.accent }}><Fixture entry={entry} barcaCrest={barcaCrest} compact /><p className="mt-2 text-center text-sm">vs {entry.opponent.name}</p><p className="mt-1 text-center text-[11px]" style={{ color: theme.colors.textMuted }}>{new Date(entry.kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {entry.competition.name}{entry.rating !== null ? ` · ${entry.rating.toFixed(1)} ★` : ""}</p></button>)}</div>
      {!entries.length && <p className="p-6 text-sm" style={{ color: theme.colors.textMuted }}>No finished matches are stored for this season yet.</p>}
      {error && <p role="alert" className="px-4 pb-4 text-xs" style={{ color: theme.colors.danger }}>{error}</p>}
      </div>
    </dialog></>;
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, ChevronDown, MessageSquareText, Shield } from "lucide-react";
import { useState } from "react";
import type { MyBarcaData } from "../../lib/my-barca/get-my-barca";
import type { KitTheme } from "../../lib/themes";
import styles from "./DiaryMonths.module.css";

type Entry = MyBarcaData["entries"][number];

function Crest({ src, name }: { src: string | null; name: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return <span className={styles.crest}>{src && failedSrc !== src ? <Image unoptimized src={src} alt={name} width={26} height={26} className="h-full w-full object-contain" onError={() => setFailedSrc(src)} /> : <Shield size={18} aria-label={name} />}</span>;
}

function watchLabel(entry: Entry) {
  if (!entry.watched) return "Not watched";
  if (entry.watchType === "live") return "Live";
  const kind = entry.watchType === "replay" ? "Replay" : entry.watchType === "highlights_only" ? "Highlights" : "Watched";
  if (!entry.watchedAt) return `${kind} · date not set`;
  const date = new Date(`${entry.watchedAt.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${kind} · ${date}`;
}

export default function DiaryMonths({ entries, barcaCrest, theme, groupKey }: { entries: Entry[]; barcaCrest: string | null; theme: KitTheme; groupKey: string }) {
  const months = new Map<string, Entry[]>();
  for (const entry of entries) {
    const key = new Date(entry.kickoff).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    months.set(key, [...(months.get(key) ?? []), entry]);
  }

  return <div>{[...months].map(([month, monthEntries], index) => <details key={`${groupKey}:${month}`} open={index === 0 ? true : undefined} className={styles.month} style={{ borderColor: theme.colors.border, background: theme.colors.backgroundElevated }}>
    <summary className={`${styles.monthHeader} focus-visible:outline-2`} style={{ outlineColor: theme.colors.accent }}><span><span className="text-base">{month}</span><span className={styles.monthCount} style={{ color: theme.colors.textMuted }}>{monthEntries.length} {monthEntries.length === 1 ? "match" : "matches"}</span></span><ChevronDown size={17} className={styles.chevron} style={{ color: theme.colors.accent }} /></summary>
    <div>{monthEntries.map((entry) => {
      const hasNote = Boolean(entry.notes?.trim());
      return <Link key={entry.id} href={`/matches/${entry.id}#my-match`} aria-label={`Open My Match: Barcelona ${entry.result} ${entry.opponent.name}, ${new Date(entry.kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}, ${entry.rating === null ? "unrated" : `${entry.rating.toFixed(1)} stars`}${hasNote ? ", note saved" : ""}`} className={`${styles.row} transition-colors hover:bg-white/[.04] focus-visible:outline-2`} style={{ borderColor: theme.colors.border, outlineColor: theme.colors.accent }}>
        <span className={styles.date} style={{ color: theme.colors.textMuted }}>{new Date(entry.kickoff).toLocaleDateString("en-GB", { day: "2-digit" })}</span>
        <span className={styles.fixture}><span className={styles.crests}><Crest src={barcaCrest} name="FC Barcelona" /><Crest src={entry.opponent.crestUrl} name={entry.opponent.name} /></span><span className={styles.fixtureText}><span className={styles.opponent}>vs {entry.opponent.name}</span><span className={styles.meta} style={{ color: theme.colors.textMuted }}>{entry.competition.name} · {entry.home ? "Home" : "Away"} · {watchLabel(entry)}</span></span></span>
        <span className={styles.score}>{entry.result}</span>
        <span className={styles.marks} style={{ color: theme.colors.accent }}><span>{entry.rating === null ? "—" : `${entry.rating.toFixed(1)} ★`}</span>{hasNote && <MessageSquareText size={15} aria-hidden="true" />}</span>
        <ArrowUpRight size={15} className={styles.arrow} style={{ color: theme.colors.accent }} aria-hidden="true" />
      </Link>;
    })}</div>
  </details>)}</div>;
}

"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Box, ChevronRight } from "lucide-react";
import { CLUB_CABINET, CLUB_CABINET_GROUPS } from "../../lib/club/cabinet";
import SketchfabTrophyViewer from "./SketchfabTrophyViewer";
import type { KitTheme } from "../../lib/themes";

const TrophyViewer3D = dynamic(() => import("./TrophyViewer3D"), { ssr: false, loading: () => <div className="flex h-full min-h-72 items-center justify-center text-sm" role="status">Opening the trophy…</div> });
const FEATURED = ["Spanish League Championship", "Champions League", "Copa del Rey"];

export default function ClubCabinet({ theme }: { theme: KitTheme }) {
  const [selectedName, setSelectedName] = useState("Champions League");
  const [show3D, setShow3D] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const accent = theme.colors.accent;
  const selected = CLUB_CABINET.find((item) => item.name === selectedName) ?? CLUB_CABINET[0];
  const hasModel = Boolean(selected.modelUrl || selected.embedUrl);
  const selectedGroup = CLUB_CABINET_GROUPS.find((group) => group.id === selected.group)?.label ?? selected.group;

  function select(name: string) {
    setSelectedName(name);
    setShow3D(false);
    requestAnimationFrame(() => stageRef.current?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }));
  }

  return <section id="honours" aria-labelledby="honours-heading" className="border p-4 sm:p-7" style={{ borderColor: theme.colors.border, background: theme.colors.surface, scrollMarginTop: 24 }}>
    <p className="text-[10px] uppercase tracking-[.24em]" style={{ color: accent }}>03 / The cabinet</p>
    <h2 id="honours-heading" className="mt-2 text-2xl tracking-tight sm:text-3xl">Honours, held in time</h2>
    <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: theme.colors.textMuted }}>The men’s first-team titles in the club’s published record. Choose a trophy to see every winning year and open its season.</p>

    <div className="club-featured-scene relative isolate mt-7 overflow-hidden border" style={{ borderColor: theme.colors.border }}>
      <Image src="/images/club/barca-ucl-user.png" alt="" fill sizes="(max-width: 1024px) 100vw, 80vw" className="object-cover" style={{ objectPosition: "center 20%" }} />
      <div className="club-featured-scene-shade pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="club-featured-row relative z-10 grid grid-cols-3 gap-2 p-3 sm:gap-3 sm:p-5" aria-label="Featured trophies">
      {FEATURED.map((name, index) => {
        const item = CLUB_CABINET.find((entry) => entry.name === name)!;
        const active = item.name === selectedName;
        return <button key={name} type="button" onClick={() => select(name)} aria-pressed={active} aria-controls="club-cabinet-detail" className="club-featured-card club-focus relative flex min-h-36 min-w-0 flex-col justify-between border p-3 text-left sm:min-h-44 sm:p-5" data-active={active} data-side={index === 0 ? "left" : index === 2 ? "right" : "center"} style={{ borderColor: active ? accent : theme.colors.border, background: `${theme.colors.backgroundElevated}${active ? "ac" : "80"}` }}>
          <span className="club-featured-shade pointer-events-none absolute inset-0" aria-hidden="true" />
          <span className="relative flex items-start justify-end gap-2"><span className="text-lg tabular-nums sm:text-2xl" style={{ color: accent }}>{item.count}</span></span>
          <span className="relative text-xs leading-4 sm:text-base">{item.displayName}</span>
        </button>;
      })}
      </div>
    </div>

    <div ref={stageRef} id="club-cabinet-detail" aria-live="polite" className="club-cabinet-detail mt-5 grid overflow-hidden border" style={{ borderColor: theme.colors.border, background: theme.colors.backgroundElevated, scrollMarginTop: 24 }}>
      <div className="club-trophy-stage relative flex min-h-72 flex-col justify-end overflow-hidden border-b p-5 sm:min-h-96" style={{ borderColor: theme.colors.border, background: theme.colors.background }}>
        {selected.previewUrl && (!show3D || selected.embedUrl) ? <Image src={selected.previewUrl} alt={show3D ? "" : `${selected.displayName} trophy preview`} fill sizes="(max-width: 1024px) 100vw, 45vw" className="object-cover" /> : !selected.previewUrl ? <div className="club-trophy-silhouette pointer-events-none absolute inset-0" aria-hidden="true" /> : null}
        {show3D && selected.modelUrl && <div className="absolute inset-0 z-10"><TrophyViewer3D key={selected.modelUrl} url={selected.modelUrl} name={selected.displayName} accent={accent} /></div>}
        {show3D && selected.embedUrl && selected.modelSource && <SketchfabTrophyViewer key={selected.embedUrl} modelId={selected.embedUrl.match(/models\/([^/]+)/)?.[1] ?? ""} name={selected.displayName} source={selected.modelSource} />}
        {!show3D && <><div className="club-trophy-stage-shade pointer-events-none absolute inset-0" aria-hidden="true" /><div className="relative z-10"><p className="text-[10px] uppercase tracking-[.2em] text-white/70">Selected title / {selectedGroup}</p><p className="mt-2 text-3xl font-medium tracking-tight text-white sm:text-4xl">{selected.displayName}</p><p className="mt-1 text-sm" style={{ color: accent }}>{selected.count} {selected.count === 1 ? "title" : "titles"}</p></div></>}
      </div>
      <div className="flex min-w-0 flex-col p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[.2em]" style={{ color: accent }}>The winning years</p><h3 className="mt-2 text-xl sm:text-2xl">{selected.displayName}</h3></div><strong className="text-3xl font-normal tabular-nums" style={{ color: accent }}>{selected.count}</strong></div>
        <p className="mt-3 text-xs leading-6" style={{ color: theme.colors.textMuted }}>Each season link opens its place in the archive. A year listed without a clear season remains unlinked.</p>
        <div className="mt-5 flex max-h-52 flex-wrap content-start gap-1.5 overflow-y-auto pr-1" aria-label={`${selected.displayName} winning years`}>
          {selected.wins.map((win) => win.seasonSlug
            ? <Link key={win.label} href={`/club/seasons/${win.seasonSlug}`} className="club-focus inline-flex items-center gap-1 border px-2.5 py-1.5 text-xs tabular-nums" style={{ borderColor: theme.colors.border }}>{win.label}<ChevronRight size={12} style={{ color: accent }} aria-hidden="true" /></Link>
            : <span key={win.label} className="border px-2.5 py-1.5 text-xs tabular-nums" style={{ borderColor: theme.colors.border, color: theme.colors.textMuted }} title="Calendar year only; no season has been guessed">{win.label}</span>)}
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
          {hasModel && <button type="button" onClick={() => setShow3D((current) => !current)} aria-pressed={show3D} className="club-focus inline-flex items-center gap-2 border px-3 py-2 text-xs" style={{ borderColor: accent, color: accent }}><Box size={15} aria-hidden="true" />{show3D ? "Close 3D" : "Explore in 3D"}</button>}
          <a href={selected.source} target="_blank" rel="noreferrer" className="club-focus inline-flex items-center gap-1 text-xs underline underline-offset-4" style={{ color: theme.colors.textMuted }}>Official honours source <ArrowRight size={12} aria-hidden="true" /></a>
        </div>
        {selected.modelSource && <p className="mt-3 text-[11px] leading-5" style={{ color: theme.colors.textMuted }}><a href={selected.modelSource} target="_blank" rel="noreferrer" className="club-focus underline underline-offset-2">{selected.modelCredit}</a>{selected.embedUrl ? " · Interactive view needs internet." : " · Fan-made model, not an official digital replica."}</p>}
        {selected.previewSource && <a href={selected.previewSource} target="_blank" rel="noreferrer" className="club-focus mt-1 w-fit text-[11px] underline underline-offset-2" style={{ color: theme.colors.textMuted }}>{selected.previewCredit}</a>}
      </div>
    </div>

    <div className="mt-8 grid gap-5 xl:grid-cols-3">
      {CLUB_CABINET_GROUPS.map((group) => <div key={group.id}>
        <h3 className="mb-3 border-b pb-3 text-[11px] uppercase tracking-[.19em]" style={{ borderColor: theme.colors.border, color: accent }}>{group.label}</h3>
        <div className="grid gap-px border" style={{ borderColor: theme.colors.border, background: theme.colors.border }}>
          {CLUB_CABINET.filter((item) => item.group === group.id).map((item) => <button key={item.name} type="button" onClick={() => select(item.name)} aria-pressed={selectedName === item.name} aria-controls="club-cabinet-detail" className="club-focus flex min-h-14 items-center justify-between gap-3 px-3 py-2 text-left text-sm" style={{ background: selectedName === item.name ? theme.colors.surface : theme.colors.backgroundElevated, color: selectedName === item.name ? accent : theme.colors.text }}><span className="min-w-0">{item.displayName}</span><span className="shrink-0 text-lg tabular-nums" style={{ color: selectedName === item.name ? accent : theme.colors.textMuted }}>{item.count}</span></button>)}
        </div>
      </div>)}
    </div>
  </section>;
}

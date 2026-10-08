"use client";

import { useState, type KeyboardEvent } from "react";
import Image from "next/image";
import { ArrowUpRight, GraduationCap, HeartHandshake, Palette, Shield } from "lucide-react";
import type { KitTheme } from "../../lib/themes";

const CHAPTERS = [
  { id: "crest", label: "The crest", icon: Shield, kicker: "A city and a club", title: "Barcelona in one shield", body: "The upper fields carry St George’s Cross and the Catalan flag. Below them sit the club’s blue-and-garnet colours and a football. The present crest shape began in 1910 and has since changed mainly in its details.", source: "https://www.fcbarcelona.com/en/club/identitat/escut" },
  { id: "colours", label: "Blaugrana", icon: Palette, kicker: "Worn across generations", title: "Blue beside garnet", body: "Blue and garnet have appeared together on Barça shirts for more than a century. They are why the team is known as the blaugrana: a visible thread through changing eras and kits.", source: "https://www.fcbarcelona.com/en/club/identity/colours" },
  { id: "masia", label: "La Masia", icon: GraduationCap, kicker: "More than training", title: "A school for life", body: "La Masia’s residential tradition places young athletes’ personal, social and intellectual development beside football. The original Can Planes building served that role from 1979; the newer Oriol Tort centre, pictured here, opened in 2011.", source: "https://www.fcbarcelona.com/en/club/identity/la-masia" },
  { id: "more", label: "Més que un club", icon: HeartHandshake, kicker: "The wider promise", title: "More than a club", body: "That is what “Més que un club” means in English. Barça connects the phrase to its members, Catalan roots, multiple sports, style of play and social work: a responsibility beyond the scoreboard.", source: "https://www.fcbarcelona.com/en/club/more-than-a-club", photo: "https://commons.wikimedia.org/wiki/File:Camp_Nou_Mes_Que_Un_Club.jpg", credit: "Camp Nou · Zakarie Faibis · CC BY-SA 4.0" },
] as const;

type ChapterId = (typeof CHAPTERS)[number]["id"];

function IdentityVisual({ id }: { id: ChapterId }) {
  if (id === "crest") return <div className="club-identity-crest flex h-full min-h-72 items-center justify-center p-8">
    <Image src="/textures/intro/fc-barcelona-crest.png" alt="FC Barcelona crest" width={225} height={247} className="relative z-10 h-auto w-40 drop-shadow-[0_18px_25px_rgba(0,0,0,.35)] sm:w-48" />
  </div>;
  if (id === "colours") return <div className="club-identity-colours relative flex h-full min-h-72 flex-col justify-end overflow-hidden p-5 sm:p-7">
    <span className="relative z-10 text-[10px] uppercase tracking-[.3em] text-white/75">The colours of the shirt</span>
    <strong className="relative z-10 mt-1 text-3xl uppercase tracking-[.19em] text-white sm:text-4xl">Blaugrana</strong>
  </div>;
  const isMasia = id === "masia";
  return <div className="relative h-full min-h-72 overflow-hidden">
    <Image src={isMasia ? "/images/club/la-masia-user.png" : "/images/club/mes-que-un-club.jpg"} alt={isMasia ? "The newer La Masia academy building" : "Més que un club spelled out in the Camp Nou seats"} fill sizes="(max-width: 1024px) 100vw, 45vw" className="object-cover" style={{ objectPosition: isMasia ? "center 48%" : "center 42%" }} />
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#06111f]/95 to-transparent px-5 pb-5 pt-12 text-white">
      <span className="text-[10px] uppercase tracking-[.2em]">{isMasia ? "The new home of La Masia" : "Written into the stands"}</span>
      {!isMasia && <p className="mt-1 text-lg font-medium">Més que un club <span className="text-white/65">/ More than a club</span></p>}
    </div>
  </div>;
}

export default function ClubIdentity({ theme }: { theme: KitTheme }) {
  const [activeId, setActiveId] = useState<ChapterId>("crest");
  const active = CHAPTERS.find((chapter) => chapter.id === activeId) ?? CHAPTERS[0];
  const accent = theme.colors.accent;

  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!direction && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? CHAPTERS.length - 1 : (index + direction + CHAPTERS.length) % CHAPTERS.length;
    const chapter = CHAPTERS[next];
    setActiveId(chapter.id);
    document.getElementById(`identity-tab-${chapter.id}`)?.focus();
  }

  return <section id="identity" aria-labelledby="identity-heading" className="border p-4 sm:p-7" style={{ borderColor: theme.colors.border, background: theme.colors.surface, scrollMarginTop: 24 }}>
    <p className="text-[10px] uppercase tracking-[.24em]" style={{ color: accent }}>04 / Identity</p>
    <h2 id="identity-heading" className="mt-2 text-2xl tracking-tight sm:text-3xl">What the colours carry</h2>
    <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: theme.colors.textMuted }}>Four short ways into the club’s character. Select a chapter to explore its meaning.</p>
    <div className="club-identity-layout mt-6 grid gap-px border" style={{ borderColor: theme.colors.border, background: theme.colors.border }}>
      <div className="club-identity-tabs grid grid-cols-2 gap-px sm:grid-cols-4" role="tablist" aria-label="Club identity chapters" style={{ background: theme.colors.border }}>
        {CHAPTERS.map((chapter, index) => {
          const ChapterIcon = chapter.icon;
          return <button key={chapter.id} type="button" role="tab" id={`identity-tab-${chapter.id}`} tabIndex={chapter.id === activeId ? 0 : -1} aria-selected={chapter.id === activeId} aria-controls="identity-panel" onClick={() => setActiveId(chapter.id)} onKeyDown={(event) => moveTab(event, index)} className="club-focus flex min-h-16 items-center gap-2 px-3 py-3 text-left text-xs sm:text-sm lg:px-5" style={{ background: chapter.id === activeId ? theme.colors.surface : theme.colors.backgroundElevated, color: chapter.id === activeId ? accent : theme.colors.textMuted }}><ChapterIcon size={17} className="shrink-0" aria-hidden="true" />{chapter.label}</button>;
        })}
      </div>
      <div id="identity-panel" role="tabpanel" aria-labelledby={`identity-tab-${active.id}`} tabIndex={0} className="club-focus club-identity-panel grid min-h-80 overflow-hidden" style={{ background: theme.colors.backgroundElevated }}>
        <div className="club-identity-picture relative min-h-72 overflow-hidden border-b" style={{ borderColor: theme.colors.border }}><IdentityVisual id={active.id} /></div>
        <div className="flex min-w-0 flex-col justify-center p-5 sm:p-8">
          <p className="text-[10px] uppercase tracking-[.2em]" style={{ color: accent }}>{active.kicker}</p>
          <h3 className="mt-3 text-2xl tracking-tight sm:text-3xl">{active.title}</h3>
          <p className="mt-4 text-sm leading-7" style={{ color: theme.colors.textMuted }}>{active.body}</p>
          <a href={active.source} target="_blank" rel="noreferrer" className="club-focus mt-6 inline-flex w-fit items-center gap-1 text-xs underline underline-offset-4" style={{ color: accent }}>Read the club’s account <ArrowUpRight size={14} aria-hidden="true" /></a>
          {"photo" in active && <a href={active.photo} target="_blank" rel="noreferrer" className="club-focus mt-3 inline-flex w-fit items-center gap-1 text-[10px] underline underline-offset-4" style={{ color: theme.colors.textMuted }}>{active.credit} <ArrowUpRight size={11} aria-hidden="true" /></a>}
        </div>
      </div>
    </div>
  </section>;
}

"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, GraduationCap, HeartHandshake, Palette, Shield } from "lucide-react";
import DashboardSectionShell, { useDashboardSectionTheme } from "../shell/DashboardSectionShell";
import "./club-rebuild.css";

const chapters = [
  { id: "crest", number: "01", kicker: "A CITY IN A SHIELD", title: "The crest", description: "St George’s Cross and the Catalan flag sit above the club’s blue and garnet and a football. The shield has carried that shared identity through generations.", source: "https://www.fcbarcelona.com/en/club/identitat/escut" },
  { id: "colours", number: "02", kicker: "THE THREAD THROUGH EVERY ERA", title: "Blaugrana", description: "Blue beside garnet. The shirt changes, but the colours remain a way to recognise the club across more than a century.", source: "https://www.fcbarcelona.com/en/club/identity/colours" },
  { id: "masia", number: "03", kicker: "THE NEXT GENERATION", title: "La Masia", description: "An academy built around development beyond football. The original Can Planes house began its residential role in 1979; the Oriol Tort centre opened in 2011.", source: "https://www.fcbarcelona.com/en/club/identity/la-masia" },
  { id: "more", number: "04", kicker: "THE PROMISE", title: "Més que un club", description: "More than a club. A phrase about members, Catalan roots, multiple sports and social responsibility—something larger than a result on the pitch.", source: "https://www.fcbarcelona.com/en/club/more-than-a-club" },
] as const;
const chapterIcons = [Shield, Palette, GraduationCap, HeartHandshake] as const;

export default function ClubIdentityStory() {
  const { theme } = useDashboardSectionTheme("2026/27");
  const [activeIndex, setActiveIndex] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeChapter = chapters[activeIndex];

  function selectWithKeyboard(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % chapters.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + chapters.length) % chapters.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = chapters.length - 1;
    else return;
    event.preventDefault();
    setActiveIndex(next);
    tabRefs.current[next]?.focus();
  }

  return <DashboardSectionShell title="Club / Identity" season="Més que un club" theme={theme}>
    <div className="club-new" style={{ "--club-accent": theme.colors.accent, "--club-border": theme.colors.border, "--club-panel": theme.colors.surface, "--club-muted": theme.colors.textMuted } as React.CSSProperties}>
      <nav className="club-crumb" aria-label="Breadcrumb"><Link href="/club">Museum</Link><span>/</span><span>Identity</span></nav>
      <header className="club-identity-hero"><div><p className="club-kicker">THE THINGS WE CARRY</p><h1>More than<br /><em>a club.</em></h1><p>Four symbols, one continuing idea. Choose a chapter to explore its story.</p><a href="#identity-chapters" className="club-primary-link">Explore the chapters <ArrowDown size={18} aria-hidden="true" /></a></div><Image src="/textures/intro/fc-barcelona-crest.png" alt="FC Barcelona crest" width={420} height={460} priority /></header>
      <div id="identity-chapters" className="club-identity-tabs" role="tablist" aria-label="Identity chapters">{chapters.map((chapter, index) => {
        const Icon = chapterIcons[index];
        return <button key={chapter.id} ref={(element) => { tabRefs.current[index] = element; }} id={`identity-tab-${chapter.id}`} type="button" role="tab" aria-selected={activeIndex === index} aria-controls="identity-panel" tabIndex={activeIndex === index ? 0 : -1} onClick={() => setActiveIndex(index)} onKeyDown={(event) => selectWithKeyboard(event, index)}><Icon size={19} aria-hidden="true" /><span>{chapter.title}</span><small>{chapter.number}</small></button>;
      })}</div>
      <section id="identity-panel" key={activeChapter.id} role="tabpanel" tabIndex={0} aria-labelledby={`identity-tab-${activeChapter.id}`} className={`club-identity-chapter club-identity-${activeChapter.id}`}>
        <div className="club-identity-art">{activeChapter.id === "crest" ? <Image src="/textures/intro/fc-barcelona-crest.png" alt="FC Barcelona crest" width={330} height={362} /> : activeChapter.id === "masia" ? <Image src="/images/club/la-masia-user.png" alt="La Masia Oriol Tort academy building" fill sizes="(max-width: 760px) 100vw, 55vw" className="object-cover" /> : activeChapter.id === "more" ? <Image src="/images/club/mes-que-un-club.jpg" alt="Més que un club written in Camp Nou seats" fill sizes="(max-width: 760px) 100vw, 55vw" className="object-cover" /> : <div className="club-colour-fabric" role="img" aria-label="Blue and garnet vertical shirt stripes" />}</div>
        <div className="club-identity-words"><span>{activeChapter.number} / {activeChapter.kicker}</span><h2>{activeChapter.title}</h2>{activeChapter.id === "more" && <strong>More than a club.</strong>}<p>{activeChapter.description}</p><a href={activeChapter.source} target="_blank" rel="noreferrer">The club’s account <ArrowUpRight size={15} aria-hidden="true" /></a></div>
      </section>
      <p className="club-identity-photo-credit">La Masia image: supplied locally · Camp Nou seats: Zakarie Faibis, CC BY-SA 4.0. <a href="https://commons.wikimedia.org/wiki/File:Camp_Nou_Mes_Que_Un_Club.jpg" target="_blank" rel="noreferrer">Photo source ↗</a></p>
    </div>
  </DashboardSectionShell>;
}

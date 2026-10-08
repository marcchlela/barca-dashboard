"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowDown, ArrowUpRight, Landmark, LibraryBig, Shield } from "lucide-react";
import DashboardSectionShell, { useDashboardSectionTheme } from "../shell/DashboardSectionShell";
import "./club-rebuild.css";

const DOORS = [
  { href: "/club/trophies", number: "01", title: "The trophies", detail: "Walk among the objects and the years they belong to.", icon: Landmark },
  { href: "/club/seasons", number: "02", title: "The seasons", detail: "A continuous story from 1899/00 to today.", icon: LibraryBig },
  { href: "/club/identity", number: "03", title: "The identity", detail: "The crest, the colours, La Masia, and the promise.", icon: Shield },
];

export default function ClubMuseum() {
  const { theme } = useDashboardSectionTheme("2026/27");
  return <DashboardSectionShell title="Club / The museum" season="Men's first team · 1899–present" theme={theme}>
    <div className="club-new" style={{ "--club-accent": theme.colors.accent, "--club-border": theme.colors.border, "--club-panel": theme.colors.surface, "--club-muted": theme.colors.textMuted } as React.CSSProperties}>
      <section className="club-foyer" aria-labelledby="club-foyer-title">
        <Image src="/images/club/museum/stop-1.webp" alt="" fill priority sizes="(max-width: 1024px) 100vw, 80vw" className="club-foyer-room" />
        <div className="club-foyer-light" aria-hidden="true" />
        <div className="club-foyer-copy">
          <p className="club-kicker">FC BARCELONA / THE MUSEUM</p>
          <h1 id="club-foyer-title">This is where the <em>story lives.</em></h1>
          <p>Beyond the tunnel: the silverware, the seasons, and the idea that makes Barça more than a club.</p>
          <Link href="/club/trophies" className="club-primary-link">Enter the museum <ArrowUpRight size={19} aria-hidden="true" /></Link>
        </div>
        <a href="#museum-rooms" className="club-foyer-scroll">Explore the rooms <ArrowDown size={16} aria-hidden="true" /></a>
        <span className="club-foyer-index" aria-hidden="true">MÉS QUE UN CLUB / 1899—</span>
      </section>
      <nav id="museum-rooms" aria-label="Museum rooms" className="club-doors">
        {DOORS.map(({ href, number, title, detail, icon: Icon }) => <Link key={href} href={href} className="club-door">
          <span className="club-door-top"><span>{number} / ROOM</span><Icon size={21} strokeWidth={1.3} aria-hidden="true" /></span>
          <span className="club-door-bottom"><strong>{title}</strong><span>{detail}</span></span>
          <ArrowUpRight className="club-door-arrow" size={21} aria-hidden="true" />
        </Link>)}
      </nav>
    </div>
  </DashboardSectionShell>;
}

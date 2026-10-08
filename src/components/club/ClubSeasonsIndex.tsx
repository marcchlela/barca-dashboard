"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, Trophy } from "lucide-react";
import DashboardSectionShell, { useDashboardSectionTheme } from "../shell/DashboardSectionShell";
import type { ClubArchiveData } from "../../lib/club/get-club-archive";
import { CLUB_ERAS, clubHonourDisplayName } from "../../lib/club/history";
import "./club-rebuild.css";

const DECADES = Array.from({ length: 14 }, (_, index) => 1890 + index * 10);

export default function ClubSeasonsIndex({ data }: { data: ClubArchiveData }) {
  const { theme } = useDashboardSectionTheme("2026/27");
  const [decade, setDecade] = useState(2020);
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const term = query.trim().toLowerCase();
    return data.seasons.filter((season) => term
      ? [season.label, season.era.title, ...season.honours.map((honour) => clubHonourDisplayName(honour.name)), ...season.moments.map((moment) => moment.title)].some((value) => value.toLowerCase().includes(term))
      : Math.floor(season.startYear / 10) * 10 === decade);
  }, [data.seasons, decade, query]);
  const era = CLUB_ERAS.find((item) => decade >= item.start && decade <= item.end);
  return <DashboardSectionShell title="Club / Seasons" season="Men's first team · 1899–present" theme={theme}>
    <div className="club-new" style={{ "--club-accent": theme.colors.accent, "--club-border": theme.colors.border, "--club-panel": theme.colors.surface, "--club-muted": theme.colors.textMuted } as React.CSSProperties}>
      <nav className="club-crumb" aria-label="Breadcrumb"><Link href="/club">Museum</Link><span>/</span><span>Seasons</span></nav>
      <header className="club-index-hero"><div className="club-index-light" aria-hidden="true" /><p className="club-kicker">THE COMPLETE SEASON ARCHIVE / 1899—2026</p><h1>One club.<br /><em>Every season.</em></h1><p>Move through the decades, or search for a season, title or recorded moment. Quiet years belong here too.</p><span className="club-index-year" aria-hidden="true">1899</span></header>
      <section className="club-index-body" aria-labelledby="find-season">
        <div className="club-index-heading"><div><p className="club-kicker">THE TIMELINE</p><h2 id="find-season">Find your season</h2></div><span>{data.seasons.length} seasons · no gaps</span></div>
        <div className="club-index-controls"><label className="club-index-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search seasons</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a year, title or moment" /></label><div className="club-decade-rail" aria-label="Choose decade">{DECADES.map((year) => <button type="button" key={year} aria-pressed={!query && decade === year} onClick={() => { setDecade(year); setQuery(""); }}>{year}s</button>)}</div></div>
        {!query && era && <div className="club-era-note"><span>{era.start}—{era.end}</span><strong>{era.title}</strong><p>{era.description}</p></div>}
        <p className="club-result-count" aria-live="polite">{shown.length} {shown.length === 1 ? "season" : "seasons"} in view</p>
        <div className="club-index-grid">{shown.map((season) => <Link key={season.slug} href={`/club/seasons/${season.slug}`} className="club-index-card"><span className="club-index-card-top">SEASON {String(season.startYear - 1898).padStart(3, "0")}</span><strong>{season.label}</strong><span className="club-index-card-era">{season.era.title}</span><span className="club-index-card-footer"><span>{season.honours.length ? <><Trophy size={13} aria-hidden="true" />{season.honours.length} {season.honours.length === 1 ? "title" : "titles"}</> : season.isCurrent ? "Season in progress" : "Open season"}</span><ArrowRight size={18} aria-hidden="true" /></span></Link>)}</div>
        {shown.length === 0 && <p className="club-empty">No season matches that search. Try a year such as 1991 or a competition such as La Liga.</p>}
      </section>
    </div>
  </DashboardSectionShell>;
}

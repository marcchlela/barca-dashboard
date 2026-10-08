"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronDown } from "lucide-react";
import DashboardSectionShell, { useDashboardSectionTheme } from "../shell/DashboardSectionShell";
import CompetitionLogo from "../matches/CompetitionLogo";
import type { ClubSeasonData } from "../../lib/club/get-club-archive";
import { CHRONOLOGY_SOURCE, CLUB_SEASONS, HONOURS_SOURCE } from "../../lib/club/history";
import type { KitTheme } from "../../lib/themes";
import "./club-rebuild.css";

type Honour = ClubSeasonData["honours"][number];

function HonourMark({ honour, theme }: { honour: Honour; theme: KitTheme }) {
  const [ready, setReady] = useState(false);
  const abbreviation = honour.displayName.split(/\s+/).map((word) => word[0]).join("").slice(0, 3).toUpperCase();
  return <span className="club-season-honour-mark" title={honour.displayName}>
    {!ready && <span aria-hidden="true">{abbreviation}</span>}
    {honour.logoUrl && <span style={{ display: ready ? "block" : "none" }}><CompetitionLogo src={honour.logoUrl} name={honour.displayName} code={honour.competitionCode} theme={theme} size={32} onLoad={() => setReady(true)} onError={() => setReady(false)} /></span>}
  </span>;
}

export default function ClubSeasonExhibit({ season }: { season: ClubSeasonData }) {
  const { theme } = useDashboardSectionTheme(season.label);
  const index = CLUB_SEASONS.findIndex((item) => item.slug === season.slug);
  const previous = CLUB_SEASONS[index - 1];
  const next = CLUB_SEASONS[index + 1];
  const headline = season.moments[0]?.title ?? season.era.title;
  const sources = [...new Set(season.moments.map((moment) => moment.source))];
  return <DashboardSectionShell title={`Club / ${season.label}`} season="Men's first team · season archive" theme={theme}>
    <div className="club-new" style={{ "--club-accent": theme.colors.accent, "--club-border": theme.colors.border, "--club-panel": theme.colors.surface, "--club-muted": theme.colors.textMuted } as React.CSSProperties}>
      <nav className="club-crumb" aria-label="Breadcrumb"><Link href="/club">Museum</Link><span>/</span><Link href="/club/seasons">Seasons</Link><span>/</span><span>{season.label}</span></nav>
      <header className="club-season-hero"><div className="club-season-hero-main"><p className="club-kicker">SEASON {String(index + 1).padStart(3, "0")} / 128 · {season.era.title.toUpperCase()}</p><h1>{season.label}</h1><p>{headline}</p><span className="club-season-hero-rule" /><span className="club-season-hero-count">{season.isCurrent ? "THE STORY IS STILL BEING WRITTEN" : `${season.honours.length} ${season.honours.length === 1 ? "TITLE" : "TITLES"} IN THE CLUB RECORD`}</span></div><span className="club-season-hero-ghost" aria-hidden="true">{season.startYear}</span></header>
      <nav className="club-season-adjacent" aria-label="Adjacent seasons"><div>{previous && <Link href={`/club/seasons/${previous.slug}`}><ArrowLeft size={18} /><span><small>PREVIOUS SEASON</small>{previous.label}</span></Link>}</div><div>{next && <Link href={`/club/seasons/${next.slug}`}><span><small>NEXT SEASON</small>{next.label}</span><ArrowRight size={18} /></Link>}</div></nav>
      <div className="club-season-chapters"><section aria-labelledby="season-titles-heading"><div className="club-season-chapter-heading"><span>01 / THE RECORD</span><h2 id="season-titles-heading">The titles.</h2></div>{season.honours.length ? <ul className="club-season-honours">{season.honours.map((honour) => <li key={`${honour.name}:${honour.publishedLabel}`}><HonourMark honour={honour} theme={theme} /><span>{honour.displayName}</span><small>{honour.publishedLabel}</small></li>)}</ul> : <p className="club-season-none">{season.isCurrent ? "This season is still underway. Confirmed titles will appear here when the record is complete." : "No titles were won this season. Its place in the club’s history is no less real."}</p>}</section>
        <section aria-labelledby="season-story-heading"><div className="club-season-chapter-heading"><span>02 / IN CONTEXT</span><h2 id="season-story-heading">The season story.</h2></div><p className="club-season-era-context">{season.era.description}</p>{season.moments.length ? <div className="club-season-moments">{season.moments.map((moment) => <article key={moment.id}><span>RECORDED MOMENT</span><h3>{moment.title}</h3><p>{moment.description}</p></article>)}</div> : <p className="club-season-none">No individual moment has been curated for this season yet. Explore its period and titles above; specific results or players have not been invented to fill the gap.</p>}</section></div>
      <div className="club-season-footer"><Link href="/club/seasons">Browse all seasons <ArrowUpRight size={16} /></Link>{season.isCurrent && <Link href="/matches">See current matches <ArrowUpRight size={16} /></Link>}</div>
      <details className="club-season-sources"><summary>Sources & archive notes <ChevronDown size={16} /></summary><div><p>Season chronology and honours are checked against the club’s published records. A calendar-year-only title is not assigned to an arbitrary season; unrecorded statistics remain absent.</p><a href={CHRONOLOGY_SOURCE} target="_blank" rel="noreferrer">Official chronology ↗</a><a href={HONOURS_SOURCE} target="_blank" rel="noreferrer">Official honours ↗</a>{sources.filter((source) => source !== HONOURS_SOURCE).map((source) => <a href={source} key={source} target="_blank" rel="noreferrer">Moment source ↗</a>)}</div></details>
    </div>
  </DashboardSectionShell>;
}

"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, BookHeart, CalendarDays, Film, Heart, Layers3, Play, Radio, RotateCcw, Trophy, Users } from "lucide-react";
import DashboardSectionShell, { useDashboardSectionTheme } from "../shell/DashboardSectionShell";
import CompetitionLogo from "../matches/CompetitionLogo";
import DiaryMonths from "./DiaryMonths";
import { RatingMenu, ThemedMenu } from "./MyBarcaFilters";
import TopMatches from "./TopMatches";
import { mostPickedPlayers, ratingHistogram, RATING_BINS, seasonSummary } from "../../lib/my-barca/archive-math";
import type { MyBarcaData } from "../../lib/my-barca/get-my-barca";
import type { KitTheme } from "../../lib/themes";

type Entry = MyBarcaData["entries"][number];
type WatchFilter = "ALL" | "live" | "replay" | "highlights_only";

function Section({ id, eyebrow, title, note, theme, children }: { id: string; eyebrow: string; title: string; note?: string; theme: KitTheme; children: React.ReactNode }) {
  return <section id={id} className="border p-4 md:p-7" style={{ background: theme.colors.surface, borderColor: theme.colors.border, scrollMarginTop: 88 }}>
    <p className="text-[10px] uppercase tracking-[.22em]" style={{ color: theme.colors.accent }}>{eyebrow}</p>
    <h2 className="mt-2 text-2xl tracking-tight md:text-3xl">{title}</h2>
    {note && <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: theme.colors.textMuted }}>{note}</p>}
    <div className="mt-5">{children}</div>
  </section>;
}

function Portrait({ src, name, size = 52 }: { src: string | null; name: string; size?: number }) {
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  return <span className="inline-flex shrink-0 items-center justify-center overflow-hidden border" style={{ width: size, height: size, borderColor: "#ffffff29", background: "#ffffff0b" }}>
    {src && brokenSrc !== src ? <Image unoptimized src={src} alt="" width={size} height={size} className="h-full w-full object-cover object-top" onError={() => setBrokenSrc(src)} /> : <Users size={Math.round(size * .45)} aria-label={name} />}
  </span>;
}

function matchDate(iso: string) { return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }

function RatingBars({ entries, theme }: { entries: Entry[]; theme: KitTheme }) {
  const counts = ratingHistogram(entries).map((bar) => bar.count);
  const max = Math.max(1, ...counts);
  const total = counts.reduce((sum, count) => sum + count, 0);
  return <div className="min-w-0 border p-4 md:p-5" style={{ minWidth: 0, maxWidth: "100%", borderColor: theme.colors.border, background: theme.colors.backgroundElevated }}>
    <div className="flex flex-wrap items-baseline justify-between gap-2"><div><p className="text-[10px] uppercase tracking-[.2em]" style={{ color: theme.colors.accent }}>Your ratings</p><h3 className="mt-1 text-lg">A season in stars</h3></div><span className="text-xs" style={{ color: theme.colors.textMuted }}>{total} rated {total === 1 ? "match" : "matches"}</span></div>
    <div className="mt-5"><div className="grid items-end" style={{ gridTemplateColumns: "repeat(10, minmax(0, 1fr))", columnGap: 4 }} role="group" aria-label="Season rating distribution">
      {RATING_BINS.map((rating, index) => <div key={rating} aria-label={`${rating.toFixed(1)} stars: ${counts[index]} matches`} className="flex flex-col items-center gap-2">
        <span className="text-[10px] tabular-nums" style={{ color: theme.colors.textMuted }}>{counts[index]}</span>
        <span className="flex w-full items-end border" style={{ height: 112, borderColor: theme.colors.border, background: theme.colors.surface }}><span className="block w-full" style={{ height: counts[index] ? `${Math.max(8, counts[index] / max * 100)}%` : 2, background: counts[index] ? theme.colors.accent : theme.colors.border }} /></span>
        <span className="text-[10px] tabular-nums">{rating.toFixed(1)}</span>
      </div>)}
    </div></div>
    <p className="mt-4 text-xs" style={{ color: theme.colors.textMuted }}>All ten half-star ratings remain visible, including ratings with no matches. Filter the diary below.</p>
  </div>;
}

export default function MyBarcaPageClient({ data }: { data: MyBarcaData }) {
  const currentLabel = data.seasonOptions.find((season) => season.id === data.currentSeasonId)?.label ?? "Current season";
  const { theme } = useDashboardSectionTheme(currentLabel);
  const [seasonId, setSeasonId] = useState(data.currentSeasonId);
  const [competition, setCompetition] = useState("ALL");
  const [watchFilter, setWatchFilter] = useState<WatchFilter>("ALL");
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const entries = useMemo(() => data.entries.filter((entry) => entry.seasonId === seasonId), [data.entries, seasonId]);
  const diaryEntries = entries.filter((entry) => entry.hasDiary);
  const summary = seasonSummary(entries);
  const rated = entries.filter((entry) => entry.rating !== null);
  const memory = entries.find((entry) => entry.notes);
  const competitionOptions = [...new Map(diaryEntries.map((entry) => [entry.competition.code, entry.competition])).values()];
  const visible = diaryEntries.filter((entry) => (competition === "ALL" || entry.competition.code === competition) && (watchFilter === "ALL" || (entry.watched && entry.watchType === watchFilter)) && (ratingFilter === null || entry.rating === ratingFilter));
  const topPicks = mostPickedPlayers(entries);
  const topCount = topPicks[0]?.count ?? 0;
  const goals = entries.filter((entry) => entry.favouriteGoal);
  const noteEntries = entries.filter((entry) => entry.notes).slice(0, 3);
  const topRated = [...rated].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.kickoff.localeCompare(a.kickoff))[0];
  const lowRated = rated.length > 1 ? [...rated].sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0) || b.kickoff.localeCompare(a.kickoff))[0] : undefined;
  const selectedSeason = data.seasonOptions.find((season) => season.id === seasonId)?.label ?? currentLabel;
  return <DashboardSectionShell title="My Barça" season={selectedSeason} theme={theme}><div className="mx-auto max-w-7xl space-y-4 px-4 pb-20 md:px-8">
    <header className="pt-6"><p className="text-xs uppercase tracking-[.3em]" style={{ color: theme.colors.accent }}>Personal archive</p><div className="mt-3 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-4xl tracking-tight md:text-6xl">Your Barça story.</h1><p className="mt-3 max-w-2xl text-sm leading-6" style={{ color: theme.colors.textMuted }}>The matches you lived, the players you chose, and the moments you kept.</p></div><div className="min-w-40"><ThemedMenu label="Season" value={seasonId} onChange={(next) => { setSeasonId(next); setCompetition("ALL"); setWatchFilter("ALL"); setRatingFilter(null); }} options={data.seasonOptions.map((season) => ({ value: season.id, label: season.label, mark: <CalendarDays size={17} aria-hidden="true" /> }))} theme={theme} /></div></div></header>
    <nav aria-label="My Barça sections" className="sticky top-0 z-20 -mx-4 flex overflow-x-auto border-y px-4 text-xs backdrop-blur md:mx-0 md:border" style={{ background: `${theme.colors.background}f5`, borderColor: theme.colors.border }}>{[["season", "Season", CalendarDays], ["top-matches", "Top three", Trophy], ["diary", "Diary", BookHeart], ["moments", "People & moments", Heart], ["story", "Season story", Trophy]].map(([id, label, Icon]) => <a key={id as string} href={`#${id}`} className="flex shrink-0 items-center gap-2 border-r px-3 py-3 focus-visible:outline-2" style={{ borderColor: theme.colors.border }}><Icon size={14} aria-hidden="true" />{label as string}</a>)}</nav>
    <Section id="season" eyebrow="01 / Season so far" title={`${selectedSeason}, in your eyes`} note="Personal records only. Match results and fixture counts come from the canonical season." theme={theme}>
      <div className="grid gap-px border sm:grid-cols-3" style={{ borderColor: theme.colors.border, background: theme.colors.border }}>{[[`${summary.watched}/${summary.finished}`, "Matches watched"], [String(summary.rated), "Matches rated"], [summary.average === null ? "—" : `${summary.average.toFixed(2)} ★`, `Average · ${summary.rated} rated`]].map(([value, label]) => <div key={label} className="p-5" style={{ background: theme.colors.backgroundElevated }}><p className="text-3xl tabular-nums" style={{ color: theme.colors.accent }}>{value}</p><p className="mt-2 text-xs" style={{ color: theme.colors.textMuted }}>{label}</p></div>)}</div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2"><RatingBars entries={entries} theme={theme} /><div className="flex flex-col justify-between border p-5" style={{ borderColor: theme.colors.border, background: theme.colors.backgroundElevated }}><div><p className="text-[10px] uppercase tracking-[.2em]" style={{ color: theme.colors.accent }}>A memory you kept</p>{memory ? <><blockquote className="mt-5 border-l-2 pl-4 text-lg leading-7 line-clamp-5" style={{ borderColor: theme.colors.accent }}>“{memory.notes}”</blockquote><p className="mt-4 text-xs" style={{ color: theme.colors.textMuted }}>Barça {memory.result} {memory.opponent.name} · {matchDate(memory.kickoff)}</p></> : <p className="mt-5 text-sm leading-6" style={{ color: theme.colors.textMuted }}>Your own words will appear here after you add a note in My Match.</p>}</div>{memory && <Link href={`/matches/${memory.id}#my-match`} className="mt-5 inline-flex items-center gap-1 text-xs" style={{ color: theme.colors.accent }}>Read your entry <ArrowUpRight size={13} /></Link>}</div></div>
    </Section>
    <Section id="top-matches" eyebrow="02 / Your collection" title="The top three" note="A personal podium of finished matches. Pick any game, even one you have not rated yet." theme={theme}><TopMatches entries={entries} initialPicks={data.favouriteMatches} seasonId={seasonId} barcaCrest={data.barcaCrest} theme={theme} /></Section>
    <Section id="diary" eyebrow="03 / The diary" title="Every match, your way" note="Your saved entries, grouped by month. Open a month to browse, then open any match to edit your diary." theme={theme}>
      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <ThemedMenu label="Competition" value={competition} onChange={setCompetition} theme={theme} options={[{ value: "ALL", label: "All competitions", mark: <Layers3 size={18} aria-hidden="true" /> }, ...competitionOptions.map((item) => ({ value: item.code, label: item.name, mark: <CompetitionLogo src={item.logoUrl} name={item.name} code={item.code} theme={theme} size={19} /> }))]} />
        <ThemedMenu<WatchFilter> label="Watch type" value={watchFilter} onChange={setWatchFilter} theme={theme} options={[{ value: "ALL", label: "All entries", mark: <BookHeart size={18} aria-hidden="true" /> }, { value: "live", label: "Live", mark: <Radio size={18} aria-hidden="true" /> }, { value: "replay", label: "Replay", mark: <RotateCcw size={18} aria-hidden="true" /> }, { value: "highlights_only", label: "Highlights", mark: <Play size={18} aria-hidden="true" /> }]} />
        <RatingMenu value={ratingFilter} onChange={setRatingFilter} theme={theme} />
      </div>
      <p className="mb-4 text-xs tabular-nums" style={{ color: theme.colors.textMuted }}>{visible.length} {visible.length === 1 ? "match" : "matches"} in view{ratingFilter !== null ? ` · ${ratingFilter.toFixed(1)}-star filter` : ""}</p>
      {visible.length ? <DiaryMonths entries={visible} barcaCrest={data.barcaCrest} theme={theme} groupKey={`${seasonId}:${competition}:${watchFilter}:${ratingFilter}`} /> : <div className="border border-dashed p-8 text-center text-sm" style={{ borderColor: theme.colors.border, color: theme.colors.textMuted }}>{diaryEntries.length ? "No diary entries match these filters." : entries.length ? <>No diary entries saved for this season yet. <Link href="/matches" className="underline underline-offset-4" style={{ color: theme.colors.accent }}>Open a finished match</Link> to start your diary.</> : "No finished Barça matches are stored for this season yet."}</div>}
    </Section>
    <Section id="moments" eyebrow="04 / Your people & moments" title="Who and what stayed with you" theme={theme}>
      <div className="grid gap-4 lg:grid-cols-2"><div className="border p-5" style={{ borderColor: theme.colors.border, background: theme.colors.backgroundElevated }}><div className="flex items-center gap-2"><Users size={17} style={{ color: theme.colors.accent }} /><h3 className="text-lg">Your players</h3></div><p className="mt-2 text-xs" style={{ color: theme.colors.textMuted }}>Your Squad favourites, plus the players you chose most often as Man of the Match.</p>{topPicks.length ? <p className="mt-5 text-xs" style={{ color: theme.colors.accent }}>{topPicks.length > 1 ? "Joint most-picked" : "Most-picked Man of the Match"} · {topCount} {topCount === 1 ? "pick" : "picks"}</p> : null}<div className="mt-3 flex flex-wrap gap-3">{topPicks.map(({ player }) => <div key={player.id} className="flex items-center gap-2 border p-2" style={{ borderColor: theme.colors.border }}><Portrait src={player.portraitUrl} name={player.name} size={42} /><span className="text-sm">{player.name}</span></div>)}</div>{data.favouritePlayers.length ? <><p className="mt-6 text-[10px] uppercase tracking-widest" style={{ color: theme.colors.textMuted }}>Favourite players</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{data.favouritePlayers.map((player) => <div key={player.id} className="flex items-center gap-3 border p-2" style={{ borderColor: theme.colors.border }}><Portrait src={player.portraitUrl} name={player.name} size={42} /><span className="text-sm">{player.name}</span></div>)}</div></> : <p className="mt-4 text-sm" style={{ color: theme.colors.textMuted }}>Favourite players from Squad will appear here.</p>}</div>
        <div className="border p-5" style={{ borderColor: theme.colors.border, background: theme.colors.backgroundElevated }}><div className="flex items-center gap-2"><Film size={17} style={{ color: theme.colors.accent }} /><h3 className="text-lg">Favourite goals</h3></div><p className="mt-2 text-xs" style={{ color: theme.colors.textMuted }}>Your goal picks from My Match. A match highlight is never presented as the clip of that exact goal.</p>{goals.length ? <div className="mt-5 space-y-2">{goals.map((entry) => <div key={entry.id} className="border p-3" style={{ borderColor: theme.colors.border }}><div className="flex items-start justify-between gap-2"><div><p className="text-sm">{entry.favouriteGoal?.scorer ?? "Barça goal"}{entry.favouriteGoal?.minute !== null ? ` · ${entry.favouriteGoal?.minute}′` : ""}</p><p className="mt-1 text-xs" style={{ color: theme.colors.textMuted }}>vs {entry.opponent.name} · {matchDate(entry.kickoff)}</p></div><Trophy size={16} style={{ color: theme.colors.accent }} /></div><Link href={`/matches/${entry.id}#my-match`} className="mt-3 inline-flex items-center gap-1 text-xs" style={{ color: theme.colors.accent }}>{entry.hasMatchHighlights ? "Open match & highlights" : "Open match"}<ArrowUpRight size={12} /></Link></div>)}</div> : <p className="mt-5 text-sm" style={{ color: theme.colors.textMuted }}>Pick a favourite Barça goal in My Match to start this collection.</p>}</div></div>
    </Section>
    <Section id="story" eyebrow="05 / Season story" title="The season you remember" note="A living chapter built only from your saved choices and words. The full end-of-season story comes when the season is complete." theme={theme}>
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="flex min-h-64 flex-col justify-between border p-6" style={{ borderColor: theme.colors.border, background: theme.colors.backgroundElevated }}>
          <div><p className="text-[10px] uppercase tracking-[.2em]" style={{ color: theme.colors.accent }}>Your standout match</p><p className="mt-2 text-xs" style={{ color: theme.colors.textMuted }}>Highest personal rating · newest match breaks a tie</p>{topRated ? <><p className="mt-6 text-4xl tabular-nums" style={{ color: theme.colors.accent }}>{topRated.rating?.toFixed(1)} ★</p><h3 className="mt-3 text-xl">Barça {topRated.result} {topRated.opponent.name}</h3><p className="mt-2 text-xs" style={{ color: theme.colors.textMuted }}>{matchDate(topRated.kickoff)} · {topRated.competition.name}</p>{topRated.notes && <blockquote className="mt-5 border-l-2 pl-3 text-sm leading-6 line-clamp-3" style={{ borderColor: theme.colors.accent }}>“{topRated.notes}”</blockquote>}</> : <p className="mt-6 text-sm leading-6" style={{ color: theme.colors.textMuted }}>Your standout match will emerge once you rate a game in My Match.</p>}</div>
          {topRated && <Link href={`/matches/${topRated.id}#my-match`} className="mt-5 inline-flex items-center gap-1 text-xs" style={{ color: theme.colors.accent }}>Return to that match <ArrowUpRight size={13} /></Link>}
        </article>
        <div className="grid gap-4">
          <article className="border p-5" style={{ borderColor: theme.colors.border, background: theme.colors.backgroundElevated }}><BookHeart size={18} style={{ color: theme.colors.accent }} /><p className="mt-4 text-[10px] uppercase tracking-widest" style={{ color: theme.colors.textMuted }}>Hardest watch</p><p className="mt-2 text-xl">{lowRated ? `${lowRated.rating?.toFixed(1)} ★ · vs ${lowRated.opponent.name}` : "Not enough ratings yet"}</p><p className="mt-2 text-xs" style={{ color: theme.colors.textMuted }}>{lowRated ? matchDate(lowRated.kickoff) : "This appears after you rate at least two matches."}</p></article>
          <article className="border p-5" style={{ borderColor: theme.colors.border, background: theme.colors.backgroundElevated }}><Heart size={18} style={{ color: theme.colors.accent }} /><p className="mt-4 text-[10px] uppercase tracking-widest" style={{ color: theme.colors.textMuted }}>Your recurring player pick</p><p className="mt-2 text-xl">{topPicks.length ? topPicks.map((pick) => pick.player.name).join(" & ") : "No pick yet"}</p><p className="mt-2 text-xs" style={{ color: theme.colors.textMuted }}>{topPicks.length ? `${topCount} ${topCount === 1 ? "selection" : "selections"} this season` : "Choose a player in My Match."}</p></article>
        </div>
      </div>
      <div className="mt-4 border p-5" style={{ borderColor: theme.colors.border, background: theme.colors.backgroundElevated }}><p className="text-[10px] uppercase tracking-[.2em]" style={{ color: theme.colors.accent }}>Lines from your season</p>{noteEntries.length ? <div className="mt-4 grid gap-4 md:grid-cols-3">{noteEntries.map((entry) => <blockquote key={entry.id} className="border-l-2 pl-3" style={{ borderColor: theme.colors.accent }}><p className="text-sm leading-6 line-clamp-4">“{entry.notes}”</p><cite className="mt-3 block text-[11px] not-italic" style={{ color: theme.colors.textMuted }}>vs {entry.opponent.name} · {matchDate(entry.kickoff)}</cite></blockquote>)}</div> : <p className="mt-4 text-sm" style={{ color: theme.colors.textMuted }}>Your match notes will write this part of the story.</p>}</div>
      <p className="mt-4 text-xs" style={{ color: theme.colors.textMuted }}>This chapter grows as you log matches. It will not invent a memory or a missing result.</p>
    </Section>
  </div></DashboardSectionShell>;
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, Check, Film, Heart, Layers3, Play, Search, X } from "lucide-react";
import DashboardSectionShell, { useDashboardSectionTheme } from "../shell/DashboardSectionShell";
import CompetitionLogo from "../matches/CompetitionLogo";
import { ThemedMenu } from "../my-barca/MyBarcaFilters";
import type { MediaLibraryData, MediaLibraryItem } from "../../lib/media/get-media-library";
import "./media-screening-room.css";

const TYPE_LABELS: Record<string, string> = {
  match_highlight: "Highlights", goal_clip: "Goal clip", match_feature: "Match feature", match_preview: "Preview",
  interview: "Interview", press_conference: "Press-room clip", training: "Training", historical: "Full match / archive", other: "Club film",
};
const typeLabel = (type: string) => TYPE_LABELS[type] ?? "Club film";
const itemTypeLabel = (item: MediaLibraryItem) => item.type === "goal_clip" && !item.official && !item.verifiedGoalMoments ? "Goal video lead" : typeLabel(item.type);
const dateLabel = (date: string | null) => date ? new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "Date not recorded";

export default function MediaScreeningRoom({ data }: { data: MediaLibraryData }) {
  const router = useRouter();
  const { theme } = useDashboardSectionTheme(data.currentSeasonLabel ?? "2026/27");
  const [items, setItems] = useState(data.items);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [seasonFilter, setSeasonFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [competitionFilter, setCompetitionFilter] = useState("ALL");
  const [storyMatchId, setStoryMatchId] = useState<string | null>(null);
  const [storyPage, setStoryPage] = useState(0);
  const [archiveChapter, setArchiveChapter] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const featured = items.find((item) => item.id === data.featuredId) ?? items[0] ?? null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (selectedId && !dialog.open) dialog.showModal();
    if (!selectedId && dialog.open) dialog.close();
  }, [selectedId]);

  const current = items.filter((item) => item.seasonId === data.currentSeasonId);
  const archives = items.filter((item) => item.seasonId !== data.currentSeasonId);
  const archiveChapters = [...new Set(archives.map((item) => item.archive?.chapter).filter((chapter): chapter is string => Boolean(chapter)))];
  const activeArchiveChapter = archiveChapter && archiveChapters.includes(archiveChapter) ? archiveChapter : archiveChapters[0] ?? null;
  const storyFilms = items.filter((item) => item.match);
  const goals = items.filter((item) => (item.type === "goal_clip" && item.official) || item.verifiedGoalMoments > 0);
  const saved = items.filter((item) => item.favourite || item.watchLater);
  const matchGroups = useMemo(() => {
    const groups = new Map<string, MediaLibraryItem[]>();
    for (const item of current) if (item.match) groups.set(item.match.id, [...(groups.get(item.match.id) ?? []), item]);
    return [...groups.values()].sort((a, b) => (b[0].match?.kickoff ?? "").localeCompare(a[0].match?.kickoff ?? ""));
  }, [current]);
  const seasons = [...new Map(items.filter((item) => item.seasonId).map((item) => [item.seasonId, { id: item.seasonId!, label: item.seasonLabel ?? "Unknown season", year: item.seasonYear ?? 0 }])).values()].sort((a, b) => b.year - a.year);
  const competitions = [...new Map(items.map((item) => {
    const match = item.match;
    if (match) return [match.competitionCode, { code: match.competitionCode, name: match.competition, logoUrl: match.competitionLogo }] as const;
    if (item.archive?.competition === "Champions League") return ["CL", { code: "CL", name: "Champions League", logoUrl: items.find((film) => film.match?.competitionCode === "CL")?.match?.competitionLogo ?? null }] as const;
    return null;
  }).filter((entry): entry is readonly [string, { code: string; name: string; logoUrl: string | null }] => entry !== null)).values()].sort((a, b) => a.name.localeCompare(b.name));
  const storyMatches = matchGroups;
  const activeStoryId = storyMatches.some((group) => group[0].match?.id === storyMatchId) ? storyMatchId : storyMatches[0]?.[0].match?.id ?? null;
  const selectedStoryFilms = storyFilms.filter((item) => item.match?.id === activeStoryId).sort((a, b) => (a.publishedAt ?? "").localeCompare(b.publishedAt ?? "") || typeOrder(a.type) - typeOrder(b.type));
  const storyPages = Math.max(1, Math.ceil(selectedStoryFilms.length / 3));
  const filtered = items.filter((item) => {
    if (seasonFilter !== "ALL" && item.seasonId !== seasonFilter) return false;
    if (typeFilter !== "ALL" && item.type !== typeFilter) return false;
    if (competitionFilter !== "ALL" && (item.match?.competitionCode ?? (item.archive?.competition === "Champions League" ? "CL" : null)) !== competitionFilter) return false;
    const haystack = [item.title, item.description, item.match?.opponent, item.archive?.opponent, item.player, item.seasonLabel, item.match?.competition, item.archive?.competition].filter(Boolean).join(" ").toLocaleLowerCase();
    return haystack.includes(search.trim().toLocaleLowerCase());
  });

  async function toggleSave(item: MediaLibraryItem, field: "favourite" | "watchLater") {
    if (!data.signedIn) {
      router.push("/account?next=/media");
      return;
    }
    const value = !item[field];
    setItems((previous) => previous.map((entry) => entry.id === item.id ? { ...entry, [field]: value } : entry));
    setMessage("");
    try {
      const response = await fetch("/api/media/saves", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaItemId: item.id, field, value }) });
      if (!response.ok) throw new Error("Save failed");
    } catch {
      setItems((previous) => previous.map((entry) => entry.id === item.id ? { ...entry, [field]: !value } : entry));
      setMessage("That change could not be saved. Please try again.");
    }
  }

  return <DashboardSectionShell title="Media / Screening room" season={`${data.currentSeasonLabel ?? "Archive"} · watch & relive`} theme={theme}>
    <div className="media-room" style={{ "--media-accent": theme.colors.accent, "--media-border": theme.colors.border, "--media-panel": theme.colors.surface, "--media-base": theme.colors.background, "--media-elevated": theme.colors.backgroundElevated, "--media-text": theme.colors.text, "--media-muted": theme.colors.textMuted } as React.CSSProperties}>
      <nav className="media-room-menu" aria-label="Media sections"><a href="#matchdays">Matchdays</a><a href="#moments">Goals & moments</a><a href="#stories">Around the match</a><a href="#archive">The archive</a><a href="#library">Find a film</a><a href="#saved">Your shelf</a></nav>
      <header className="media-hero" style={featured?.thumbnailUrl ? { backgroundImage: `linear-gradient(90deg, #06111ff7 10%, #06111fbd 46%, #06111f3d), url("${featured.thumbnailUrl}")` } : undefined}>
        <div className="media-hero-copy"><p className="media-kicker">BARÇA / THE SCREENING ROOM</p><h1>Watch it.<br /><em>Relive it.</em></h1><p className="media-hero-intro">The match, the moment, the story around it. Official films connected to the Barça archive.</p>
          {featured ? <div className="media-hero-feature"><span>{featured.featured ? "CURATOR'S PICK" : "NOW SHOWING"} / {typeLabel(featured.type)}</span><h2>{featured.title}</h2><p>{featured.match ? `${featured.match.competition} · ${dateLabel(featured.date)}` : `${featured.archive?.chapter ?? featured.seasonLabel ?? featured.source} · ${dateLabel(featured.date)}`}</p><button type="button" onClick={() => setSelectedId(featured.id)}><Play size={18} fill="currentColor" aria-hidden="true" /> {featured.youtubeId ? "Watch film" : "Explore film"}</button></div> : <p className="media-hero-empty">The official film archive is being prepared. Match-linked videos will appear here as they are verified.</p>}
        </div><span className="media-hero-index" aria-hidden="true">01 / SCREENING ROOM</span>
      </header>

      <section id="matchdays" className="media-section"><SectionHeading number="01" eyebrow="THIS SEASON" title="Matchday, frame by frame" note="Previews, highlights and reactions sit with their match. Scroll inside the fixture list to browse the season." />
        {matchGroups.length ? <><p className="media-timeline-count">{matchGroups.length} matchdays with stored films <span>↓ Scroll this list</span></p><div className="media-match-timeline" tabIndex={0} role="region" aria-label="This season's match films; scroll to browse fixtures">{matchGroups.map((group) => {
          const match = group[0].match!;
          return <article className="media-match-stop" key={match.id}>
            <time className="media-match-date" dateTime={match.kickoff}><span>{new Date(match.kickoff).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" })}</span><small>{new Date(match.kickoff).toLocaleDateString("en-GB", { year: "numeric", timeZone: "UTC" })}</small></time>
            <div className="media-match-heading"><div className="media-match-competition"><MediaCompetitionLogo src={match.competitionLogo} name={match.competition} code={match.competitionCode} theme={theme} /><span>{match.competition}</span></div><div className="media-match-identity"><TeamCrest src={match.barcelonaCrest} name="FC Barcelona" /><span>Barça</span><strong>{match.score ?? "vs"}</strong><TeamCrest src={match.opponentCrest} name={match.opponent} /><span>{match.opponent}</span></div><Link href={`/matches/${match.id}`} aria-label={`Open Barça against ${match.opponent} in Match Center`}>Match Center <ArrowUpRight size={15} /></Link></div>
            <div className="media-match-films">{[...group].sort((a, b) => typeOrder(a.type) - typeOrder(b.type)).slice(0, 2).map((item) => <button type="button" key={item.id} onClick={() => setSelectedId(item.id)}><Play size={13} aria-hidden="true" />{itemTypeLabel(item)}</button>)}{group.length > 2 && <button type="button" onClick={() => { setStoryMatchId(match.id); setStoryPage(0); document.getElementById("stories")?.scrollIntoView(); }}>+{group.length - 2} films <ArrowRight size={13} aria-hidden="true" /></button>}</div>
          </article>;
        })}</div></> : <EmptyText>No match films are stored for this season yet. The review worker will add official coverage when it can identify it safely.</EmptyText>}
      </section>

      <MediaRail id="moments" number="02" eyebrow="THE MOMENTS" title="Goals worth another look" note="Only an official standalone goal video or a manually verified goal-in-video moment earns this shelf." items={goals} empty="No exact current-season goal footage has been verified yet. Match highlights remain available in their matchday stories." onOpen={setSelectedId} onSave={toggleSave} />
      <section id="stories" className="media-section"><SectionHeading number="03" eyebrow="AROUND THE MATCH" title="The story around the match" note="Choose a match to see its previews, training, highlights, goal clips, reactions and features together." />
        {storyMatches.length ? <>
          <div className="media-story-selector" role="group" aria-label="Choose a match's films">{storyMatches.map((group) => { const match = group[0].match!; return <button type="button" key={match.id} className="media-story-match" aria-pressed={activeStoryId === match.id} onClick={() => { setStoryMatchId(match.id); setStoryPage(0); }}><TeamCrest src={match.opponentCrest} name={match.opponent} size={28} /><span><strong>{match.opponent}</strong><small>{dateLabel(match.kickoff)} · {match.score ?? "vs"}</small></span></button>; })}</div>
          <div className="media-story-context"><div>{activeStoryId && <><span>IN FOCUS</span><h3>{storyMatches.find((group) => group[0].match?.id === activeStoryId)?.[0].match?.opponent}</h3></>}</div><p>{selectedStoryFilms.length} {selectedStoryFilms.length === 1 ? "film" : "films"} around this match</p></div>
          {selectedStoryFilms.length ? <><div className="media-story-grid">{selectedStoryFilms.slice(storyPage * 3, storyPage * 3 + 3).map((item) => <MediaCard key={item.id} item={item} onOpen={setSelectedId} onSave={toggleSave} />)}</div>{storyPages > 1 && <div className="media-story-pagination"><button type="button" disabled={storyPage === 0} onClick={() => setStoryPage((page) => page - 1)} aria-label="Previous films"><ArrowLeft size={17} /></button><span>{storyPage + 1} / {storyPages}</span><button type="button" disabled={storyPage >= storyPages - 1} onClick={() => setStoryPage((page) => page + 1)} aria-label="Next films"><ArrowRight size={17} /></button></div>}</> : <EmptyText>No films have been verified for this match yet.</EmptyText>}
        </> : <EmptyText>No match-specific previews, interviews or reactions are stored yet. These will appear only after the source and fixture are verified.</EmptyText>}
      </section>
      <MediaRail key={activeArchiveChapter} id="archive" number="04" eyebrow="THE ARCHIVE" title="The nights that stayed" note="Choose a night to explore its official film trail. The match date and season stay distinct from a later upload date." items={activeArchiveChapter ? archives.filter((item) => item.archive?.chapter === activeArchiveChapter) : archives} empty="No historical films have been curated yet." onOpen={setSelectedId} onSave={toggleSave} headerContent={archiveChapters.length > 1 ? <div className="media-archive-chapters" role="group" aria-label="Choose an archive chapter">{archiveChapters.map((chapter) => <button key={chapter} type="button" aria-pressed={chapter === activeArchiveChapter} onClick={() => setArchiveChapter(chapter)}><span>{chapter}</span><small>{archives.filter((item) => item.archive?.chapter === chapter).length} films</small></button>)}</div> : null} />

      <section id="library" className="media-section"><SectionHeading number="05" eyebrow="FIND YOUR FILM" title="Explore the collection" note="Search stored films by title, match, opponent, competition or season. Playback and availability remain with the source." />
        <div className="media-filters"><label className="media-search"><Search size={18} aria-hidden="true" /><span className="sr-only">Search films</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search matches, people, moments…" /></label><label><span>Season</span><select value={seasonFilter} onChange={(event) => setSeasonFilter(event.target.value)}><option value="ALL">All seasons</option>{seasons.map((season) => <option key={season.id} value={season.id}>{season.label}</option>)}</select></label><ThemedMenu label="Competition" value={competitionFilter} onChange={setCompetitionFilter} theme={theme} options={[{ value: "ALL", label: "All competitions", mark: <Layers3 size={19} aria-hidden="true" /> }, ...competitions.map((competition) => ({ value: competition.code, label: competition.name, mark: <MediaCompetitionLogo src={competition.logoUrl} name={competition.name} code={competition.code} theme={theme} size={20} /> }))]} /><label><span>Film type</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="ALL">All films</option>{Object.entries(TYPE_LABELS).filter(([type]) => items.some((item) => item.type === type)).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label></div>
        <p className="media-results" aria-live="polite">{filtered.length} {filtered.length === 1 ? "film" : "films"} in view</p><div className="media-library-grid">{filtered.map((item) => <MediaCard key={item.id} item={item} onOpen={setSelectedId} onSave={toggleSave} />)}</div>{!filtered.length && <EmptyText>No stored films match those filters. Try another season, opponent or film type.</EmptyText>}
      </section>
      <MediaRail id="saved" number="06" eyebrow="PERSONAL COLLECTION" title="Your shelf" note="Favourite a film or save it for later. These choices live in your private dashboard database." items={saved} empty="Nothing saved yet. Use the heart or bookmark on any film to keep it here." onOpen={setSelectedId} onSave={toggleSave} />
      {message && <p className="media-save-error" role="alert">{message}</p>}
      <p className="media-source-note">Videos remain with their publishers. YouTube plays only after you choose a film; other video pages open at their source. Availability can change.</p>
    </div>
    <div style={{ "--media-accent": theme.colors.accent, "--media-border": theme.colors.border, "--media-muted": theme.colors.textMuted } as React.CSSProperties}>
    <dialog ref={dialogRef} className="media-player-dialog" onClose={() => setSelectedId(null)} aria-label={selected ? `Watch ${selected.title}` : "Media player"}>{selected && <div className="media-player-inner"><div className="media-player-head"><div><span>{selected.source} / {itemTypeLabel(selected)}</span><h2>{selected.title}</h2></div><button type="button" onClick={() => setSelectedId(null)} aria-label="Close film"><X size={20} /></button></div><div className="media-player-frame">{selected.youtubeId ? <iframe key={selected.id} title={selected.title} src={`https://www.youtube-nocookie.com/embed/${selected.youtubeId}?rel=0`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /> : <div><Film size={46} aria-hidden="true" /><p>This film is hosted by {selected.source}. Open its publisher page to watch it there.</p><a href={selected.url} target="_blank" rel="noopener noreferrer">Watch at {selected.source} <ArrowUpRight size={16} /></a></div>}</div><div className="media-player-meta"><p>{selected.description ?? (selected.match ? `${selected.match.competition} · Barça against ${selected.match.opponent}` : "Official Barça archive film.")}</p><div><span>{dateLabel(selected.date)} · {selected.seasonLabel ?? "Club archive"}</span>{selected.match && <Link href={`/matches/${selected.match.id}`}>Open match <ArrowUpRight size={14} /></Link>}{selected.archive && <Link href={`/club/seasons/${selected.seasonYear}-${String((selected.seasonYear ?? 0) + 1).slice(-2)}`}>Open season <ArrowUpRight size={14} /></Link>}<a href={selected.url} target="_blank" rel="noopener noreferrer">Original source <ArrowUpRight size={14} /></a></div></div><div className="media-player-actions"><SaveButton item={selected} field="favourite" onSave={toggleSave} /><SaveButton item={selected} field="watchLater" onSave={toggleSave} /></div></div>}</dialog>
    </div>
  </DashboardSectionShell>;
}

function typeOrder(type: string) { return ({ match_preview: 0, match_highlight: 1, goal_clip: 2, match_feature: 3, interview: 4, press_conference: 5 } as Record<string, number>)[type] ?? 6; }
function TeamCrest({ src, name, size = 36 }: { src: string | null; name: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const imageSrc = name === "FC Barcelona" ? "/textures/intro/fc-barcelona-crest.png" : src;
  return <span className="media-team-crest" style={{ width: size, height: size }} title={name}>{imageSrc && !broken ? <Image unoptimized src={imageSrc} alt="" width={size} height={size} onError={() => setBroken(true)} /> : <span className="media-crest-fallback" aria-hidden="true">{name.split(/\s+/).map((word) => word[0]).slice(0, 2).join("").toUpperCase()}</span>}<span className="sr-only">{name}</span></span>;
}
function MediaCompetitionLogo({ src, name, code, theme, size = 22 }: { src: string | null; name: string; code: string; theme: Parameters<typeof CompetitionLogo>[0]["theme"]; size?: number }) {
  const [broken, setBroken] = useState(false);
  return <CompetitionLogo src={broken ? null : src} name={name} code={code} theme={theme} size={size} onError={() => setBroken(true)} />;
}
function SectionHeading({ number, eyebrow, title, note }: { number: string; eyebrow: string; title: string; note: string }) { return <div className="media-section-heading"><div><span>{number} / {eyebrow}</span><h2>{title}</h2></div><p>{note}</p></div>; }
function EmptyText({ children }: { children: React.ReactNode }) { return <p className="media-empty">{children}</p>; }
function SaveButton({ item, field, onSave }: { item: MediaLibraryItem; field: "favourite" | "watchLater"; onSave: (item: MediaLibraryItem, field: "favourite" | "watchLater") => void }) { const active = item[field]; const Icon = field === "favourite" ? Heart : Bookmark; const shelf = field === "favourite" ? "favourites" : "watch later"; return <button type="button" className="media-save-button" aria-pressed={active} aria-label={`${active ? `Remove ${item.title} from` : `Add ${item.title} to`} ${shelf}`} onClick={() => onSave(item, field)}><Icon size={17} fill={active && field === "favourite" ? "currentColor" : "none"} aria-hidden="true" />{field === "favourite" ? "Favourite" : "Watch later"}{active && <Check size={13} aria-hidden="true" />}</button>; }
function MediaCard({ item, onOpen, onSave }: { item: MediaLibraryItem; onOpen: (id: string) => void; onSave: (item: MediaLibraryItem, field: "favourite" | "watchLater") => void }) {
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  return <article className="media-card">
    <button className="media-card-main" type="button" onClick={() => onOpen(item.id)} aria-label={`${item.youtubeId ? "Watch" : "Explore"} ${item.title}`}>
      <span className={`media-card-art ${posterLoaded ? "has-thumb" : ""}`}>
        {item.thumbnailUrl && !posterFailed && <Image unoptimized src={item.thumbnailUrl} alt="" fill sizes="(max-width: 680px) 100vw, 33vw" className="media-card-image" onLoad={() => setPosterLoaded(true)} onError={() => setPosterFailed(true)} />}
        <span className="media-card-poster-word">{item.archive?.chapter ?? item.seasonLabel ?? "BARÇA"}</span>
        <Play className="media-card-play" size={19} fill="currentColor" aria-hidden="true" />
      </span>
      <span className="media-card-copy"><span className="media-card-kicker">{itemTypeLabel(item)} · {item.source}</span><strong>{item.title}</strong><span>{item.match ? `${item.match.competition} · ${dateLabel(item.date)}` : `${item.archive?.competition ?? item.seasonLabel ?? "Club"} · ${dateLabel(item.date)}`}</span></span>
    </button>
    <div className="media-card-actions"><SaveButton item={item} field="favourite" onSave={onSave} /><SaveButton item={item} field="watchLater" onSave={onSave} /></div>
  </article>;
}
function MediaRail({ id, number, eyebrow, title, note, items, empty, onOpen, onSave, headerContent }: { id: string; number: string; eyebrow: string; title: string; note: string; items: MediaLibraryItem[]; empty: string; onOpen: (id: string) => void; onSave: (item: MediaLibraryItem, field: "favourite" | "watchLater") => void; headerContent?: React.ReactNode }) { const railRef = useRef<HTMLDivElement>(null); return <section id={id} className="media-section"><div className="media-rail-top"><SectionHeading number={number} eyebrow={eyebrow} title={title} note={note} />{items.length > 2 && <div className="media-rail-controls"><button type="button" onClick={() => railRef.current?.scrollBy({ left: -350, behavior: "smooth" })} aria-label={`Scroll ${title} left`}><ArrowLeft size={17} /></button><button type="button" onClick={() => railRef.current?.scrollBy({ left: 350, behavior: "smooth" })} aria-label={`Scroll ${title} right`}><ArrowRight size={17} /></button></div>}</div>{headerContent}{items.length ? <div ref={railRef} className="media-card-rail">{items.map((item) => <MediaCard key={item.id} item={item} onOpen={onOpen} onSave={onSave} />)}</div> : <EmptyText>{empty}</EmptyText>}</section>; }

"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Activity, ArrowDownLeft, ArrowUpRight, BarChart3, ChevronLeft, ChevronRight, CircleDot, Map as MapIcon, Shield, Trophy, Users } from "lucide-react";
import DashboardSectionShell, { useDashboardSectionTheme } from "../shell/DashboardSectionShell";
import CompetitionLogo from "../matches/CompetitionLogo";
import { PitchHeatmap } from "../squad/PlayerQuickView";
import { confirmedNextFixture } from "../../lib/analytics/bracket";
import { rollingAverage } from "../../lib/analytics/analytics-math";
import type { AnalyticsData } from "../../lib/analytics/get-analytics-overview";
import type { KitTheme } from "../../lib/themes";

type View = AnalyticsData["views"][string];
type Player = View["players"][number];
type Metric = { value: number | null; matches: number };
type Rank = AnalyticsData["rounds"][number]["table"][number];
const format = (value: number | null, digits = 0) => value === null ? "—" : value.toFixed(digits);
const CLUB_COLORS = ["#61B5E8", "#E77A81", "#84C996", "#B890E5", "#EBA75F", "#6CD2C7", "#E5CB73", "#BC82A4", "#86ABED", "#CCBA91", "#74C597", "#D58173", "#9CA5DC", "#E5B9A3", "#8DCEE4", "#D2B0DC", "#B9D17E", "#D7AFC4", "#94B8A8"];

function Panel({ id, eyebrow, title, note, theme, children }: { id?: string; eyebrow: string; title: string; note?: string; theme: KitTheme; children: React.ReactNode }) {
  return <section id={id} className="border p-4 md:p-7" style={{ background: theme.colors.surface, borderColor: theme.colors.border, scrollMarginTop: 92 }}>
    <p className="text-[10px] uppercase tracking-[.23em]" style={{ color: theme.colors.accent }}>{eyebrow}</p>
    <h2 className="mt-2 text-2xl tracking-tight md:text-3xl">{title}</h2>
    {note && <p className="mt-3 max-w-3xl text-sm leading-6" style={{ color: theme.colors.textMuted }}>{note}</p>}
    <div className="mt-5">{children}</div>
  </section>;
}

function Crest({ src, name, size = 24 }: { src: string | null; name: string; size?: number }) {
  return <span className="inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
    {src ? <Image unoptimized src={src} alt="" width={size} height={size} className="max-h-full max-w-full object-contain" /> : <Shield size={size - 3} aria-hidden="true" />}
    <span className="sr-only">{name}</span>
  </span>;
}

function Value({ data, suffix = "", showCoverage = true }: { data: Metric; suffix?: string; showCoverage?: boolean }) {
  return <span title={`${data.matches} contributing matches`}>{format(data.value, data.value !== null && data.value % 1 ? 1 : 0)}{data.value === null ? "" : suffix}{showCoverage && <small className="ml-1 opacity-60">/ {data.matches}m</small>}</span>;
}

function ComparisonMark({ value, other, theme, children }: { value: number | null; other: number | null; theme: KitTheme; children: React.ReactNode }) {
  const higher = value !== null && other !== null && value > other;
  return <span className="inline-block px-1 py-0.5" style={{ color: higher ? theme.colors.accent : undefined, background: higher ? `${theme.colors.accent}1a` : undefined, boxShadow: higher ? `inset 0 -2px ${theme.colors.accent}` : undefined, fontWeight: higher ? 700 : undefined }} title={higher ? "Higher observed value" : undefined}>{children}</span>;
}

function zone(position: number, code: "PD" | "CL", theme: KitTheme) {
  if (code === "CL") return position <= 8 ? { label: "Direct qualification", color: theme.colors.success } : position <= 24 ? { label: "Knockout playoff", color: theme.colors.accent } : { label: "Eliminated", color: theme.colors.danger };
  return position === 1 ? { label: "Title", color: "#D8AA45" } : position <= 4 ? { label: "Champions League", color: "#548FEA" } : position <= 6 ? { label: "Europa League (provisional)", color: "#E5914B" } : position === 7 ? { label: "Conference League (provisional)", color: "#51B985" } : position >= 18 ? { label: "Relegation", color: "#D9656B" } : { label: "", color: "transparent" };
}

function RankingTable({ teams, theme, code, selectedId, onSelect }: { teams: Rank[]; theme: KitTheme; code: "PD" | "CL"; selectedId?: string | null; onSelect?: (id: string) => void }) {
  const legendPositions = code === "PD" ? [1, 2, 5, 7, 18] : [1, 9, 25];
  return <><div className="max-h-[560px] overflow-auto border" style={{ borderColor: theme.colors.border }}>
    <table className="w-full min-w-[475px] border-collapse text-left text-xs">
      <thead className="sticky top-0 z-10" style={{ background: theme.colors.backgroundElevated }}><tr>{["#", "Club", "P", "W", "D", "L", "GD", "Pts"].map((h) => <th key={h} className="border-b px-2 py-3 font-medium" style={{ borderColor: theme.colors.border }}>{h}</th>)}</tr></thead>
      <tbody>{teams.map((team) => {
        const band = zone(team.position, code, theme);
        return <tr key={team.teamId} className="border-b" style={{ borderColor: theme.colors.border, background: team.teamId === selectedId ? theme.colors.backgroundElevated : undefined }}>
          <td className="border-l-[3px] px-2 py-2 tabular-nums" style={{ borderLeftColor: band.color }}>{team.position}</td>
          <td className="min-w-[178px] px-2 py-2"><div className="flex items-center gap-2"><Crest src={team.crestUrl} name={team.name} size={20} />{onSelect ? <button type="button" onClick={() => onSelect(team.teamId)} className="text-left hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">{team.name}</button> : <span>{team.name}</span>}</div></td>
          {[team.played, team.won, team.drawn, team.lost, team.goalDifference, team.points].map((value, index) => <td key={index} className="px-2 py-2 tabular-nums">{value}</td>)}
        </tr>;
      })}</tbody>
    </table>
  </div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px]" aria-label="Table zone legend">{legendPositions.map((position) => { const entry = zone(position, code, theme); return <span key={position} className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color, minWidth: 10, minHeight: 10 }} />{entry.label}</span>; })}</div>{code === "PD" && <p className="mt-2 text-[11px] opacity-60">European place bands are a guide, not confirmed qualification; cup winners and UEFA allocations can shift them.</p>}</>;
}

function LeagueRace({ data, theme }: { data: AnalyticsData; theme: KitTheme }) {
  const rounds = data.rounds.filter((round) => round.complete);
  const [index, setIndex] = useState(Math.max(0, rounds.length - 1));
  const [selected, setSelected] = useState<string | null>(null);
  const currentIndex = Math.min(index, rounds.length - 1);
  const round = rounds[currentIndex];
  const teams = round?.table ?? [];
  const barcaId = teams.find((team) => team.barcelona)?.teamId;
  const selectedId = selected ?? barcaId;
  const order = [...teams].sort((a, b) => a.teamId.localeCompare(b.teamId));
  const colors = new Map(order.filter((team) => !team.barcelona).map((team, i) => [team.teamId, CLUB_COLORS[i % CLUB_COLORS.length]]));
  if (barcaId) colors.set(barcaId, theme.colors.accent);
  const W = 960, H = 700, L = 42, R = 28, T = 25, B = 32;
  const y = (position: number) => T + (position - 1) * (H - T - B) / 19;
  const firstRound = rounds[0]?.matchday ?? 1;
  const lastRound = rounds[rounds.length - 1]?.matchday ?? firstRound;
  const x = (i: number) => L + (firstRound === lastRound ? (W - L - R) / 2 : (rounds[i].matchday - firstRound) * (W - L - R) / (lastRound - firstRound));
  const path = (id: string) => rounds.map((item, i) => {
    const row = item.table.find((entry) => entry.teamId === id);
    return row ? `${i && rounds[i - 1].matchday === item.matchday - 1 && rounds[i - 1].table.some((entry) => entry.teamId === id) ? "L" : "M"}${x(i)},${y(row.position)}` : "";
  }).join(" ");
  const inspected = teams.find((team) => team.teamId === selectedId);
  return <Panel id="race" eyebrow="01 / La Liga" title="League Race" note="Twenty clubs, one verified position per matchday. Select a crest or table row; inspect rounds with the slider or arrow keys." theme={theme}>
    {rounds.length < 2 ? <p className="border border-dashed p-6 text-sm" style={{ borderColor: theme.colors.border }}>Only {rounds.length} complete 20-club rounds stored. Sync more standings history in Admin to reveal the race.</p> : <>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3"><p><strong style={{ color: colors.get(selectedId ?? "") }}>{inspected?.name}</strong><span className="ml-3 text-sm opacity-70">#{inspected?.position} · {inspected?.points} pts · GD {inspected?.goalDifference}</span></p><span className="text-xs opacity-65">Matchday {round.matchday} · {round.basis === "official_current" ? "Official current" : "Results-compiled"}</span></div>
      <div className="relative overflow-x-auto"><div className="relative min-w-[760px]">
        <svg className="w-full" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`League Race at matchday ${round.matchday}, rank paths from position 1 at top to 20 at bottom`}>
          {Array.from({ length: 20 }, (_, i) => i + 1).map((position) => <g key={position}><line x1={L} x2={W - R} y1={y(position)} y2={y(position)} stroke={theme.colors.border} strokeDasharray="4 5" opacity=".75" /><text x="12" y={y(position) + 3} fill={theme.colors.textMuted} fontSize="10">{position}</text></g>)}
          {rounds.map((item, i) => <text key={item.matchday} x={x(i)} y={H - 6} textAnchor="middle" fill={theme.colors.textMuted} fontSize="11">{item.matchday}</text>)}
          {teams.filter((team) => team.teamId !== barcaId && team.teamId !== selectedId).map((team) => <path key={team.teamId} d={path(team.teamId)} fill="none" stroke={colors.get(team.teamId)} opacity=".45" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
          {selectedId && selectedId !== barcaId && <path d={path(selectedId)} fill="none" stroke={colors.get(selectedId)} strokeWidth="3.5" vectorEffect="non-scaling-stroke" />}
          {barcaId && <path d={path(barcaId)} fill="none" stroke={theme.colors.accent} strokeWidth="4" vectorEffect="non-scaling-stroke" />}
          <line x1={x(currentIndex)} x2={x(currentIndex)} y1={T} y2={H - B} stroke={theme.colors.text} opacity=".65" strokeWidth="1" />
          {inspected && <circle cx={x(currentIndex)} cy={y(inspected.position)} r="5" fill={colors.get(inspected.teamId)} />}
        </svg>
        {teams.map((team) => <button key={team.teamId} type="button" aria-label={`Select ${team.name}, position ${team.position} on matchday ${round.matchday}`} aria-pressed={selectedId === team.teamId} onClick={() => setSelected(team.teamId)}
          className="absolute flex h-[23px] w-[23px] -translate-x-1/2 -translate-y-1/2 items-center justify-center border focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ left: `${x(currentIndex) / W * 100}%`, top: `${y(team.position) / H * 100}%`, borderColor: colors.get(team.teamId), outlineColor: theme.colors.accent, background: theme.colors.backgroundElevated }}><Crest src={team.crestUrl} name={team.name} size={18} /></button>)}
      </div></div>
      <div className="mt-4 flex items-center gap-3 border p-3" style={{ borderColor: theme.colors.border, background: theme.colors.backgroundElevated }}>
        <button type="button" aria-label="Previous matchday" disabled={currentIndex === 0} onClick={() => setIndex(currentIndex - 1)} className="p-1 disabled:opacity-30 focus-visible:outline-2"><ChevronLeft size={19} /></button>
        <label className="shrink-0 text-xs" htmlFor="race-round">MD {round.matchday}</label>
        <input id="race-round" type="range" min={0} max={rounds.length - 1} value={currentIndex} onChange={(event) => setIndex(Number(event.target.value))} aria-valuetext={`Matchday ${round.matchday}`} className="h-1 w-full cursor-pointer" style={{ accentColor: theme.colors.accent }} />
        <button type="button" aria-label="Next matchday" disabled={currentIndex === rounds.length - 1} onClick={() => setIndex(currentIndex + 1)} className="p-1 disabled:opacity-30 focus-visible:outline-2"><ChevronRight size={19} /></button>
      </div>
      <div className="mt-5"><RankingTable teams={teams} code="PD" selectedId={selectedId} onSelect={setSelected} theme={theme} /></div>
      <p className="mt-3 text-xs opacity-65">Historical season+matchday tables are results-compiled and may omit point deductions; the unfiltered current table is official.</p>
    </>}
  </Panel>;
}

function CompetitionView({ data, code, theme }: { data: AnalyticsData; code: string; theme: KitTheme }) {
  const fixtures = data.fixtures.filter((fixture) => fixture.competitionCode === code);
  const table = code === "CL" ? data.championTable : [];
  const leagueFixtures = code === "CL" ? fixtures.filter((f) => /LEAGUE_STAGE|LEAGUE_PHASE|GROUP_STAGE/i.test(f.stage ?? "")) : [];
  const knockout = code === "CL" ? fixtures.filter((f) => !/LEAGUE_STAGE|LEAGUE_PHASE|GROUP_STAGE/i.test(f.stage ?? "")) : fixtures;
  const stages = [...new Set(knockout.map((f) => f.stage ?? f.round ?? "Published fixtures"))].sort((a, b) =>
    (knockout.filter((f) => (f.stage ?? f.round ?? "Published fixtures") === a).map((f) => f.kickoff ?? "").sort()[0] ?? "").localeCompare(knockout.filter((f) => (f.stage ?? f.round ?? "Published fixtures") === b).map((f) => f.kickoff ?? "").sort()[0] ?? ""));
  const stageGroups = stages.map((stage) => knockout.filter((f) => (f.stage ?? f.round ?? "Published fixtures") === stage).sort((a, b) => (a.kickoff ?? "").localeCompare(b.kickoff ?? "")));
  const bracketWidth = stages.length * 252;
  const bracketHeight = Math.max(1, ...stageGroups.map((group) => group.length)) * 156 + 48;
  const [activeStage, setActiveStage] = useState(0);
  const [leagueMatchday, setLeagueMatchday] = useState(1);
  const stageIndex = Math.min(activeStage, Math.max(0, stages.length - 1));
  const cards = (stage: string, index: number) => stageGroups[index].map((f) => {
    const next = stages[index + 1] ? confirmedNextFixture(f, knockout, stages[index + 1]) : null;
    return <article key={f.id} className="relative border p-3 text-xs" style={{ borderColor: theme.colors.border, background: theme.colors.backgroundElevated }}>
      <p className="mb-2 text-[10px] uppercase tracking-wide opacity-55">{f.round ?? f.stage ?? "Fixture"}{f.leg ? ` · leg ${f.leg}` : ""}</p>
      {[[f.homeName, f.homeCrestUrl, f.homeScore], [f.awayName, f.awayCrestUrl, f.awayScore]].map(([name, crest, score], i) => <div key={i} className="flex items-center gap-2 py-1"><Crest src={crest as string | null} name={name as string} size={18} /><span className="min-w-0 flex-1 truncate">{name}</span><strong className="tabular-nums">{score ?? "—"}</strong></div>)}
      {(f.homePenaltyScore !== null || f.awayPenaltyScore !== null) && <p className="mt-1 text-[10px] opacity-65">Penalties {f.homePenaltyScore ?? "—"}–{f.awayPenaltyScore ?? "—"}</p>}
      <p className="mt-2 text-[10px] opacity-55">{f.kickoff?.slice(0, 10) ?? "Date TBC"} · {f.status.replaceAll("_", " ")}</p>
      {next && <p className="mt-1 text-[10px]" style={{ color: theme.colors.accent }}>Confirmed path →</p>}
    </article>;
  });
  return <Panel id="race" eyebrow={`01 / ${code}`} title={code === "CL" ? "European field" : "The cup draw"} note="Full-competition coverage from stored provider fixtures. Only published ties and confirmed advancing-team links appear." theme={theme}>
    {code === "CL" && (table.length === 36 ? <><p className="mb-3 text-xs opacity-65">Official 36-club league-stage table · 1–8 direct · 9–24 playoff · 25–36 eliminated</p><RankingTable teams={table} code="CL" theme={theme} /></> : <p className="border border-dashed p-5 text-sm" style={{ borderColor: theme.colors.border }}>The 36-club table has not been synced yet.</p>)}
    {leagueFixtures.length > 0 && <div className="mt-7"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg">League-stage fixtures</h3><label className="text-xs">Matchday <select value={leagueMatchday} onChange={(event) => setLeagueMatchday(Number(event.target.value))} className="ml-2 border px-2 py-1" style={{ borderColor: theme.colors.border, background: theme.colors.backgroundElevated }}>{[...new Set(leagueFixtures.map((f) => f.matchday).filter((n): n is number => n !== null))].sort((a, b) => a - b).map((day) => <option key={day} value={day}>{day}</option>)}</select></label></div><div className="grid max-h-[430px] gap-px overflow-y-auto border sm:grid-cols-2" style={{ borderColor: theme.colors.border, background: theme.colors.border }}>{leagueFixtures.filter((f) => f.matchday === leagueMatchday).map((f) => <div key={f.id} className="flex items-center gap-2 p-3 text-xs" style={{ background: theme.colors.backgroundElevated }}><Crest src={f.homeCrestUrl} name={f.homeName} size={20} /><span className="min-w-0 flex-1 truncate">{f.homeName}</span><strong>{f.homeScore ?? "—"}–{f.awayScore ?? "—"}</strong><span className="min-w-0 flex-1 truncate text-right">{f.awayName}</span><Crest src={f.awayCrestUrl} name={f.awayName} size={20} /></div>)}</div></div>}
    <div className="mt-7"><div className="mb-4 flex items-baseline justify-between gap-3"><h3 className="text-lg">Confirmed fixtures & bracket</h3><span className="text-xs opacity-60">{knockout.length} fixtures · {stages.length} {stages.length === 1 ? "stage" : "stages"}</span></div>
      {!stages.length ? <p className="border border-dashed p-5 text-sm" style={{ borderColor: theme.colors.border }}>No knockout draw has been published in stored data yet.</p> : <>
        <div className="mb-3 flex items-center gap-2 lg:hidden"><button type="button" disabled={stageIndex === 0} onClick={() => setActiveStage(stageIndex - 1)} aria-label="Previous stage" className="border p-2 disabled:opacity-30" style={{ borderColor: theme.colors.border }}><ChevronLeft size={16} /></button><span className="flex-1 text-center text-sm">{stages[stageIndex]}</span><button type="button" disabled={stageIndex === stages.length - 1} onClick={() => setActiveStage(stageIndex + 1)} aria-label="Next stage" className="border p-2 disabled:opacity-30" style={{ borderColor: theme.colors.border }}><ChevronRight size={16} /></button></div>
        <div className="lg:hidden space-y-3">{cards(stages[stageIndex], stageIndex)}</div>
        {stages.length === 1 ? <div className="hidden max-h-[620px] overflow-y-auto border p-3 lg:block" style={{ borderColor: theme.colors.border }}><p className="mb-3 text-xs opacity-60">Only this round is published. Later pairings will connect here when the draw is confirmed.</p><div className="grid gap-3 xl:grid-cols-3">{cards(stages[0], 0)}</div></div> : <div className="hidden max-h-[620px] max-w-full overflow-auto border lg:block" style={{ borderColor: theme.colors.border }} aria-label="Scrollable confirmed bracket">
          <div className="relative" style={{ width: bracketWidth, height: bracketHeight }}>
            <svg className="pointer-events-none absolute inset-0" width={bracketWidth} height={bracketHeight} aria-hidden="true">
              {stageGroups.flatMap((group, stageIndex) => stageIndex === stages.length - 1 ? [] : group.flatMap((fixture, rowIndex) => {
                const reverse = group.find((other) => other.id !== fixture.id && other.homeProviderId === fixture.awayProviderId && other.awayProviderId === fixture.homeProviderId);
                if (reverse && fixture.kickoff && reverse.kickoff && fixture.kickoff < reverse.kickoff) return [];
                const next = confirmedNextFixture(fixture, knockout, stages[stageIndex + 1]);
                const targetIndex = stageGroups[stageIndex + 1].findIndex((item) => item.id === next?.id);
                if (targetIndex < 0) return [];
                const x1 = stageIndex * 252 + 232, x2 = (stageIndex + 1) * 252 + 12;
                const y1 = rowIndex * 156 + 112, y2 = targetIndex * 156 + 112;
                return <path key={`${fixture.id}:${next?.id}`} d={`M${x1},${y1} H${(x1 + x2) / 2} V${y2} H${x2}`} fill="none" stroke={theme.colors.accent} strokeWidth="1.5" />;
              }))}
            </svg>
            {stages.map((stage, stageIndex) => <div key={stage} className="absolute top-3 w-[220px] border-b pb-2 text-xs uppercase tracking-widest" style={{ left: stageIndex * 252 + 12, borderColor: theme.colors.border }}>{stage}</div>)}
            {stageGroups.flatMap((group, stageIndex) => cards(stages[stageIndex], stageIndex).map((card, rowIndex) => <div key={group[rowIndex].id} className="absolute w-[220px]" style={{ left: stageIndex * 252 + 12, top: rowIndex * 156 + 48 }}>{card}</div>))}
          </div>
        </div>}
      </>}
    </div>
  </Panel>;
}

function Trend({ title, values, labels, theme, color, unit = "" }: { title: string; values: (number | null)[]; labels: string[]; theme: KitTheme; color: string; unit?: string }) {
  const [inspected, setInspected] = useState(Math.max(0, values.length - 1));
  const [windowStart, setWindowStart] = useState(Math.max(0, values.length - 5));
  const swipeStart = useRef<number | null>(null);
  const swipeEnd = useRef<number | null>(null);
  const lastWheel = useRef(0);
  const maxStart = Math.max(0, values.length - 5);
  const start = Math.min(windowStart, maxStart);
  const shown = values.slice(start, start + 5);
  const trend = rollingAverage(values, 3).slice(start, start + 5);
  const valid = values.filter((value): value is number => value !== null);
  const shownValid = shown.filter((value): value is number => value !== null);
  const max = Math.max(1, ...shownValid), min = 0;
  const ticks = title === "Points per match" ? [0, 1, 2, 3] : title.startsWith("Goals ") ? Array.from({ length: Math.ceil(max) + 1 }, (_, i) => i) : unit === "%" ? [0, 25, 50, 75, 100] : Array.from({ length: 5 }, (_, i) => Math.round(max * i / 4));
  const scaleMax = Math.max(max, ticks[ticks.length - 1]);
  const W = 600, H = 190, L = 48, R = 18, T = 16, B = 37;
  const x = (i: number) => L + (shown.length === 1 ? (W - L - R) / 2 : i * (W - L - R) / Math.max(1, shown.length - 1));
  const y = (value: number) => H - B - (value - min) * (H - T - B) / (scaleMax - min || 1);
  const path = shown.map((value, i) => value === null ? "" : `${i > 0 && shown[i - 1] !== null ? "L" : "M"}${x(i)},${y(value)}`).join(" ");
  const trendPath = trend.map((value, i) => value === null ? "" : `${i > 0 && trend[i - 1] !== null ? "L" : "M"}${x(i)},${y(value)}`).join(" ");
  const inspect = Math.max(start, Math.min(inspected, start + shown.length - 1));
  const move = (direction: number) => { const next = Math.max(0, Math.min(maxStart, start + direction)); setWindowStart(next); setInspected(direction < 0 ? next : Math.min(values.length - 1, next + 4)); };
  return <div className="border p-4" style={{ borderColor: theme.colors.border }} onTouchStart={(event) => { const touches = Array.from(event.touches); swipeStart.current = touches.length ? touches.reduce((sum, touch) => sum + touch.clientX, 0) / touches.length : null; swipeEnd.current = swipeStart.current; }} onTouchMove={(event) => { const touches = Array.from(event.touches); if (touches.length) swipeEnd.current = touches.reduce((sum, touch) => sum + touch.clientX, 0) / touches.length; }} onTouchEnd={() => { if (swipeStart.current !== null && swipeEnd.current !== null) { const delta = swipeEnd.current - swipeStart.current; if (Math.abs(delta) > 40) move(delta > 0 ? -1 : 1); } swipeStart.current = null; swipeEnd.current = null; }} onWheel={(event) => { if (Math.abs(event.deltaX) > 10 && Math.abs(event.deltaX) > Math.abs(event.deltaY) * .8 && Date.now() - lastWheel.current > 220) { move(event.deltaX > 0 ? 1 : -1); lastWheel.current = Date.now(); } }}><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm">{title}</h3><div className="flex items-center gap-2"><span className="text-xs opacity-60">{valid.length}/{values.length} observed</span><button type="button" onClick={() => move(-1)} disabled={start === 0} aria-label={`Earlier ${title} matches`} className="border p-1 disabled:opacity-30 focus-visible:outline-2" style={{ borderColor: theme.colors.border }}><ChevronLeft size={16} /></button><button type="button" onClick={() => move(1)} disabled={start === maxStart} aria-label={`Later ${title} matches`} className="border p-1 disabled:opacity-30 focus-visible:outline-2" style={{ borderColor: theme.colors.border }}><ChevronRight size={16} /></button></div></div>
    {shownValid.length ? <><svg className="mt-3 w-full focus-visible:outline-2" viewBox={`0 0 ${W} ${H}`} role="group" tabIndex={0} aria-label={`${title}: matches ${start + 1} to ${start + shown.length}. Use arrow keys to inspect.`} onKeyDown={(event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); const next = Math.max(0, Math.min(values.length - 1, inspect + (event.key === "ArrowRight" ? 1 : -1))); setInspected(next); if (next < start) setWindowStart(next); if (next >= start + 5) setWindowStart(next - 4); } }}>
      {[...new Set(ticks)].map((tick) => <g key={tick}><line x1={L} x2={W - R} y1={y(tick)} y2={y(tick)} stroke={theme.colors.border} strokeDasharray={tick === 0 ? undefined : "3 5"} /><text x={L - 6} y={y(tick) + 4} textAnchor="end" fill={theme.colors.textMuted} fontSize="11">{tick}{unit}</text></g>)}
      {shown.map((_, i) => <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fill={theme.colors.textMuted} fontSize="10">{start + i + 1}</text>)}
      <path d={path} fill="none" stroke={color} strokeOpacity=".42" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <path d={trendPath} fill="none" stroke={color} strokeWidth="3.5" vectorEffect="non-scaling-stroke" />
      {shown.map((value, i) => value === null ? null : <g key={i} onClick={() => setInspected(start + i)} className="cursor-pointer"><circle cx={x(i)} cy={y(value)} r="14" fill="transparent" /><circle cx={x(i)} cy={y(value)} r={start + i === inspect ? 7 : 6} fill={theme.colors.backgroundElevated} stroke={color} strokeWidth="2.5" /><circle cx={x(i)} cy={y(value)} r="2.5" fill={color} /></g>)}
    </svg><div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] opacity-70"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border-2" style={{ borderColor: color }} />Match result</span><span className="inline-flex items-center gap-1.5"><span aria-hidden="true" style={{ display: "inline-block", width: 20, height: 3, flexShrink: 0, backgroundColor: color }} />3-match average</span></div><p className="mt-1 text-xs opacity-65">Match {inspect + 1}: {labels[inspect]} · {values[inspect] === null ? "not observed" : `${values[inspect]}${unit}`}</p></> : <p className="py-12 text-center text-sm opacity-60">No observed values yet.</p>}
  </div>;
}

function PlayerPicker({ label, players, selectedId, excludedId, onChange, theme }: { label: string; players: Player[]; selectedId: string; excludedId: string; onChange: (id: string) => void; theme: KitTheme }) {
  const details = useRef<HTMLDetailsElement>(null);
  const player = players.find((p) => p.id === selectedId);
  return <div><p className="mb-2 text-[10px] uppercase tracking-widest opacity-65">{label}</p><details ref={details} className="relative"><summary className="flex cursor-pointer list-none items-center gap-3 border p-3 focus-visible:outline-2 focus-visible:outline-offset-2" style={{ borderColor: theme.colors.border, background: theme.colors.backgroundElevated }}>
    <Portrait player={player} size={44} /><span className="flex-1 text-sm">{player?.name ?? "Select player"}</span><span className="text-xs opacity-60">Change ▾</span>
  </summary><div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto border p-1" style={{ borderColor: theme.colors.border, background: theme.colors.backgroundElevated }}>
    {players.filter((p) => p.id !== excludedId).map((p) => <button key={p.id} type="button" onClick={() => { onChange(p.id); if (details.current) details.current.open = false; }} aria-current={p.id === selectedId ? "true" : undefined}
      className="flex w-full items-center gap-3 p-2 text-left text-sm hover:opacity-75 focus-visible:outline-2" style={{ background: p.id === selectedId ? theme.colors.surface : undefined }}><Portrait player={p} size={34} /><span>{p.name}</span><span className="ml-auto text-xs opacity-50">#{p.shirt ?? "—"}</span></button>)}
  </div></details></div>;
}

function Portrait({ player, size }: { player?: Player; size: number }) {
  return <span className="inline-flex shrink-0 items-center justify-center overflow-hidden border" style={{ width: size, height: size, borderColor: "#ffffff2c", background: "#ffffff0c" }}>
    {player?.portraitUrl ? <Image unoptimized src={player.portraitUrl} alt="" width={size} height={size} className="h-full w-full object-cover object-top" /> : <Users size={Math.round(size * .45)} aria-hidden="true" />}
  </span>;
}

function Heatmap({ player, theme }: { player: Player; theme: KitTheme }) {
  const map = player.heatmap;
  return <div><h3 className="mb-2 text-sm">{player.name}</h3>{!map ? <div className="flex aspect-[1.65] items-center justify-center border border-dashed text-sm opacity-60" style={{ borderColor: theme.colors.border }}>No stored heatmap for this selection</div> : <>
    <div role="img" aria-label={`${player.name} average heatmap from ${map.matchesIncluded} stored matches, attacking right`}><PitchHeatmap heatmap={map} theme={theme} /></div>
    <p className="mt-2 text-xs opacity-60">{map.matchesIncluded} matches · {map.sampleSize} stored actions · attacking →</p>
  </>}</div>;
}
export default function AnalyticsPageClient({ data }: { data: AnalyticsData }) {
  const { theme } = useDashboardSectionTheme(data.season.label);
  const [competitionCode, setCompetitionCode] = useState("ALL");
  const view = data.views[competitionCode] ?? data.views.ALL;
  const [firstId, setFirstId] = useState(data.players[0]?.id ?? "");
  const [secondId, setSecondId] = useState(data.players[1]?.id ?? "");
  const first = view.players.find((p) => p.id === firstId) ?? view.players[0];
  const second = view.players.find((p) => p.id === secondId) ?? view.players.find((p) => p.id !== first?.id);
  const labels = view.trend.map((match) => `${match.date} v ${match.opponent}`);
  const leaders = [
    { label: "Goals", player: [...view.players].sort((a, b) => (b.goals.value ?? -1) - (a.goals.value ?? -1))[0], key: "goals" as const },
    { label: "Assists", player: [...view.players].sort((a, b) => (b.assists.value ?? -1) - (a.assists.value ?? -1))[0], key: "assists" as const },
    { label: "Minutes", player: view.players[0], key: "minutes" as const },
  ];
  const compare: { label: string; key: keyof Pick<Player, "minutes" | "goals" | "assists" | "shots" | "keyPasses" | "tackles" | "saves" | "rating"> }[] = [
    { label: "Minutes", key: "minutes" }, { label: "Goals", key: "goals" }, { label: "Assists", key: "assists" }, { label: "Shots", key: "shots" },
    { label: "Key passes", key: "keyPasses" }, { label: "Tackles", key: "tackles" }, { label: "Saves", key: "saves" }, { label: "Rating", key: "rating" },
  ];
  const roleMetrics = compare.filter(({ key }) => {
    const roles = [first?.position, second?.position];
    if (key === "saves") return roles.includes("goalkeeper");
    if (key === "tackles") return roles.includes("defender") || roles.includes("midfielder");
    if (key === "shots" || key === "keyPasses") return roles.includes("forward") || roles.includes("midfielder");
    return true;
  });
  const per90Value = (player: Player, metric: "goals" | "assists" | "shots") =>
    player.minutes.value && player[metric].value !== null ? player[metric].value * 90 / player.minutes.value : null;
  const per90 = (player: Player, metric: "goals" | "assists" | "shots") => format(per90Value(player, metric), 2);
  const sections = [["race", "Competition", Trophy], ["form", "Momentum", Activity], ["team", "Observed", BarChart3], ["splits", "Context", CircleDot], ["players", "Players", Users], ["spatial", "Spatial", MapIcon]] as const;
  return <DashboardSectionShell title="Analytics" season={data.season.label} theme={theme}><div className="mx-auto max-w-7xl space-y-4 px-4 pb-20 md:px-8">
    <header className="pt-5"><p className="text-xs uppercase tracking-[.3em]" style={{ color: theme.colors.accent }}>The Barça Performance Lab</p><h1 className="mt-2 text-4xl tracking-tight md:text-6xl">The season, under the lights.</h1><p className="mt-3 max-w-2xl text-sm leading-6" style={{ color: theme.colors.textMuted }}>A living readout of {data.season.label}. Observations only; missing values remain open.</p></header>
    <div className="flex flex-wrap gap-px border p-px" style={{ borderColor: theme.colors.border, background: theme.colors.border }} role="group" aria-label="Select competition">{data.competitionOptions.map((option) => <button key={option.code} type="button" onClick={() => setCompetitionCode(option.code)} aria-pressed={competitionCode === option.code}
      className="flex min-h-11 items-center gap-2 px-4 py-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-[-2px]" style={{ background: competitionCode === option.code ? theme.colors.backgroundElevated : theme.colors.surface, color: competitionCode === option.code ? theme.colors.accent : theme.colors.text }}>
      {option.code !== "ALL" && <CompetitionLogo src={option.logoUrl} name={option.label} code={option.code} theme={theme} size={17} />}{option.label}</button>)}</div>
    <nav aria-label="Analytics sections" className="sticky top-0 z-20 -mx-4 flex overflow-x-auto border-y px-4 text-xs backdrop-blur md:mx-0 md:border" style={{ background: `${theme.colors.background}f5`, borderColor: theme.colors.border }}>
      {sections.map(([id, label, Icon]) => <a key={id} href={`#${id}`} className="flex shrink-0 items-center gap-2 border-r px-3 py-3 focus-visible:outline-2 focus-visible:outline-offset-[-2px]" style={{ borderColor: theme.colors.border }}><Icon size={14} strokeWidth={1.7} aria-hidden="true" />{label}</a>)}
    </nav>
    <Panel eyebrow="Season pulse" title={`${competitionCode === "ALL" ? data.season.label : data.competitionOptions.find((c) => c.code === competitionCode)?.label} at a glance`} theme={theme}>
      <div className="grid grid-cols-2 gap-5 md:grid-cols-3">{[["Games played", view.coverage.finishedMatches], ["Points", view.trend.reduce((n, m) => n + m.points, 0)], ["Goals", view.trend.reduce((n, m) => n + m.goalsFor, 0)]].map(([label, value]) => <div key={label} className="border-l pl-4" style={{ borderColor: theme.colors.accent }}><p className="text-3xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs opacity-65">{label}</p></div>)}</div>
      <p className="mt-5 text-xs opacity-60">Team statistics: {view.coverage.teamStatMatches}/{view.coverage.finishedMatches} matches · Player statistics: {view.coverage.playerStatMatches}/{view.coverage.finishedMatches} matches</p>
    </Panel>
    {competitionCode === "ALL" || competitionCode === "PD" ? <LeagueRace data={data} theme={theme} /> : <CompetitionView data={data} code={competitionCode} theme={theme} />}
    <Panel key={`form:${competitionCode}`} id="form" eyebrow="02 / Momentum" title="Form & goals" note="Faint line: each finished match. Strong line: three-match average. Missing observations break both lines; zero remains zero." theme={theme}><div className="grid gap-3 lg:grid-cols-2"><Trend title="Points per match" values={view.trend.map((m) => m.points)} labels={labels} color={theme.colors.accent} theme={theme} /><Trend title="Goals for" values={view.trend.map((m) => m.goalsFor)} labels={labels} color={theme.colors.primary} theme={theme} /><Trend title="Goals against" values={view.trend.map((m) => m.goalsAgainst)} labels={labels} color={theme.colors.danger} theme={theme} /></div></Panel>
    <Panel key={`team:${competitionCode}`} id="team" eyebrow="03 / Observed match data" title="How Barça played" note="Each point is one stored observation; the stronger line is a three-match average and never bridges missing values." theme={theme}><div className="grid gap-3 lg:grid-cols-2"><Trend title="Possession" values={view.trend.map((m) => m.possession)} labels={labels} color={theme.colors.accent} theme={theme} unit="%" /><Trend title="Passes" values={view.trend.map((m) => m.passes)} labels={labels} color={theme.colors.primary} theme={theme} /><Trend title="Pass accuracy" values={view.trend.map((m) => m.passAccuracy)} labels={labels} color={theme.colors.success} theme={theme} unit="%" /><Trend title="Shots" values={view.trend.map((m) => m.shots)} labels={labels} color={theme.colors.warning} theme={theme} /></div></Panel>
    <Panel id="splits" eyebrow="04 / Context" title="Competition & venue" theme={theme}><div className="grid gap-px border sm:grid-cols-2 xl:grid-cols-3" style={{ borderColor: theme.colors.border, background: theme.colors.border }}>{view.splits.map((split) => <div key={`${split.competitionCode}:${split.label}`} className="p-4" style={{ background: theme.colors.backgroundElevated }}><div className="flex items-center gap-2">{split.venue ? split.venue === "home" ? <ArrowDownLeft size={18} aria-hidden="true" /> : <ArrowUpRight size={18} aria-hidden="true" /> : <CompetitionLogo src={split.logoUrl} name={split.label} code={split.competitionCode} theme={theme} size={20} />}<h3 className="text-base">{split.label}</h3></div><p className="mt-3 text-[10px] uppercase tracking-widest opacity-55">{split.matches} finished games</p><div className="mt-3 flex gap-4 text-lg tabular-nums"><span>{split.wins}<small className="ml-1 text-xs opacity-50">W</small></span><span>{split.draws}<small className="ml-1 text-xs opacity-50">D</small></span><span>{split.losses}<small className="ml-1 text-xs opacity-50">L</small></span></div><p className="mt-2 text-sm">Goals <strong>{split.goalsFor}–{split.goalsAgainst}</strong></p><p className="mt-3 border-t pt-3 text-xs opacity-70" style={{ borderColor: theme.colors.border }}>Possession <Value data={split.possession} suffix="%" /> · Shots <Value data={split.shots} /></p></div>)}</div>{!view.splits.length && <p className="text-sm opacity-60">No finished Barça matches in this selection yet.</p>}</Panel>
    <Panel id="players" eyebrow="05 / First team" title="Player leaders & comparison" note="Verified first-team players. Per-90 rates require recorded minutes; absent ratings and metrics stay blank." theme={theme}>
      <div className="mb-6 grid gap-px border sm:grid-cols-3" style={{ borderColor: theme.colors.border, background: theme.colors.border }}>{leaders.map(({ label, player, key }) => <div key={label} className="flex items-center gap-3 p-4" style={{ background: theme.colors.backgroundElevated }}><Portrait player={player} size={52} /><div><p className="text-[10px] uppercase tracking-widest opacity-60">{label} leader</p><p className="mt-1 text-sm">{player?.name ?? "No data"}</p><p style={{ color: theme.colors.accent }}>{player ? <Value data={player[key]} showCoverage={false} /> : "—"}</p></div></div>)}</div>
      {first && second ? <><div className="grid gap-3 sm:grid-cols-2"><PlayerPicker label="First player" players={view.players} selectedId={first.id} excludedId={second.id} onChange={setFirstId} theme={theme} /><PlayerPicker label="Second player" players={view.players} selectedId={second.id} excludedId={first.id} onChange={setSecondId} theme={theme} /></div>
        <div className="mt-4 grid grid-cols-[1fr_4rem_1fr] border text-sm" style={{ borderColor: theme.colors.border }}><div className="p-4 text-center" style={{ background: theme.colors.backgroundElevated }}><Portrait player={first} size={68} /><p className="mt-2">{first.name}</p><p className="text-xs opacity-60">{first.position}</p></div><div className="flex items-center justify-center text-xs uppercase opacity-50">vs</div><div className="p-4 text-center" style={{ background: theme.colors.backgroundElevated }}><Portrait player={second} size={68} /><p className="mt-2">{second.name}</p><p className="text-xs opacity-60">{second.position}</p></div></div>
        <div className="border-x" style={{ borderColor: theme.colors.border }}><div className="grid grid-cols-[1fr_7rem_1fr] border-b px-3 py-3 text-sm tabular-nums" style={{ borderColor: theme.colors.border }}><span><ComparisonMark value={first.appearances} other={second.appearances} theme={theme}>{first.appearances}</ComparisonMark></span><span className="text-center text-xs opacity-60">Appearances</span><span className="text-right"><ComparisonMark value={second.appearances} other={first.appearances} theme={theme}>{second.appearances}</ComparisonMark></span></div>{roleMetrics.map(({ label, key }) => <div key={key} className="grid grid-cols-[1fr_7rem_1fr] border-b px-3 py-3 text-sm tabular-nums" style={{ borderColor: theme.colors.border }}><span><ComparisonMark value={first[key].value} other={second[key].value} theme={theme}><Value data={first[key]} showCoverage={false} /></ComparisonMark></span><span className="text-center text-xs opacity-60">{label}</span><span className="text-right"><ComparisonMark value={second[key].value} other={first[key].value} theme={theme}><Value data={second[key]} showCoverage={false} /></ComparisonMark></span></div>)}{(["goals", "assists", "shots"] as const).filter((metric) => roleMetrics.some((item) => item.key === metric)).map((metric) => <div key={`${metric}-90`} className="grid grid-cols-[1fr_7rem_1fr] border-b px-3 py-3 text-sm tabular-nums" style={{ borderColor: theme.colors.border }}><span><ComparisonMark value={per90Value(first, metric)} other={per90Value(second, metric)} theme={theme}>{per90(first, metric)}</ComparisonMark></span><span className="text-center text-xs opacity-60">{metric[0].toUpperCase() + metric.slice(1)} / 90</span><span className="text-right"><ComparisonMark value={per90Value(second, metric)} other={per90Value(first, metric)} theme={theme}>{per90(second, metric)}</ComparisonMark></span></div>)}</div>
        <p className="mt-3 text-xs opacity-60">Recorded-minute coverage: {first.minutes.matches} / {second.minutes.matches} matches. Rates are blank until minutes and the metric are both observed.</p>
      </> : <p className="text-sm opacity-60">Two players are needed for comparison.</p>}
    </Panel>
    <Panel id="spatial" eyebrow="06 / Stored spatial data" title="Where they played" note="The continuous match-averaged activity map uses the same rendering as Squad. Pitch direction is normalized; only display orientation changes." theme={theme}><div className="grid gap-5 sm:grid-cols-2">{first && <Heatmap player={first} theme={theme} />}{second && <Heatmap player={second} theme={theme} />}</div></Panel>
  </div></DashboardSectionShell>;
}

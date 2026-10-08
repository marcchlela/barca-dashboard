"use client";

import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, X } from "lucide-react";
import DashboardSectionShell, { useDashboardSectionTheme } from "../shell/DashboardSectionShell";
import { CLUB_CABINET } from "../../lib/club/cabinet";
import "./club-rebuild.css";

const MuseumScene = dynamic(() => import("./ClubMuseumScene"), { ssr: false });
const FEATURED = ["Champions League", "Spanish League Championship", "Copa del Rey", "Spanish Super Cup", "FIFA Club World Cup"];
const CASES = FEATURED.map((name, index) => ({
  ...CLUB_CABINET.find((item) => item.name === name)!, index,
  eyebrow: ["EUROPE / THE BIG EARS", "SPAIN / THE LEAGUE", "SPAIN / THE CUP", "SPAIN / THE SUPER CUP", "THE WORLD / THE HISTORICAL CUP"][index],
  description: [
    "Five nights that reshaped the club's place in Europe.",
    "A title measured across a whole season, not one final.",
    "Spain's long knockout journey, won across generations.",
    "The meeting of Spanish champions, and another stage for this club.",
    "Barça's three wins belong to the original Club World Cup trophy, not the new 2025 design.",
  ][index],
  photo: ["/images/club/champions-league-photo.jpg", "/images/club/la-liga-museum-16.jpg", "/images/club/copa-del-rey.jpg", "/images/club/spanish-super-cup-museum.jpg", "/images/club/historical-club-world-cup.jpg"][index],
  photoCredit: ["Daniel · CC BY 2.0 · Barça museum", "Nicholas Gemini · CC BY-SA 4.0 · Barça museum", "3DserVision_studio · Sketchfab preview", "Nicholas Gemini · CC BY-SA 4.0 · Barça museum, 1990/91 cup", "Medullaoblongata Projekt · CC BY-SA 4.0 · 2014 trophy of the same historical design"][index],
  photoSource: ["https://commons.wikimedia.org/wiki/File:2010_-_UEFA_Champions_League_Trophy.jpg", "https://commons.wikimedia.org/wiki/File:Col%C2%B7leccions_del_Museu_del_FC_Barcelona_16.jpg", "https://sketchfab.com/3d-models/copa-del-rey-trophy-6d6d9f2985bd4e77ad34df2c5c857a41", "https://commons.wikimedia.org/wiki/File:Col%C2%B7leccions_del_Museu_del_FC_Barcelona_15.jpg", "https://commons.wikimedia.org/wiki/File:Spain_Madrid_Copa_Mundial_de_Clubes_de_la_FIFA.jpg"][index],
  assetNote: ["Locally supplied 3D model; shared builds use a CC0 substitute.", "Photograph of a league trophy in Barça's museum; no verified reusable local model is bundled.", "Locally prepared 3D model of the Copa del Rey.", "The photograph shows Barça's 1990/91 Super Cup, not a claim that every edition used this design.", "The photo documents the historical trophy design in a 2014 display, not Barça's own cup. The supplied 2025 design is intentionally not shown as a Barça win."][index],
}));

class SceneBoundary extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFail(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function ClubTrophyMuseum() {
  const { theme } = useDashboardSectionTheme("2026/27");
  const walkRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openButton = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [canRender, setCanRender] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [uclUrl, setUclUrl] = useState("/models/club/champions-league.glb");
  const active = Math.min(4, Math.max(0, Math.round(position)));

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const refresh = () => setReduced(media.matches);
    const initialFrame = requestAnimationFrame(refresh);
    media.addEventListener("change", refresh);
    const lowPower = "deviceMemory" in navigator && typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 2;
    const graphicsFrame = requestAnimationFrame(() => setCanRender(!lowPower && !!document.createElement("canvas").getContext("webgl2")));
    fetch("/models/club/private-champions-league.glb", { method: "HEAD" }).then((response) => {
      if (response.ok && response.headers.get("content-type")?.includes("model")) setUclUrl("/models/club/private-champions-league.glb");
    }).catch(() => {});
    for (const entry of CASES) {
      const preview = new window.Image();
      preview.src = entry.photo;
    }
    return () => { cancelAnimationFrame(initialFrame); cancelAnimationFrame(graphicsFrame); media.removeEventListener("change", refresh); };
  }, []);

  useEffect(() => {
    let frame = 0;
    function update() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const element = walkRef.current;
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const distance = Math.max(1, rect.height - window.innerHeight);
        setPosition(Math.min(4, Math.max(0, -rect.top / distance * 4)));
      });
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);

  useEffect(() => {
    if (selected === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [selected]);

  const jump = useCallback((stop: number) => {
    const element = walkRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const distance = Math.max(1, rect.height - window.innerHeight);
    window.scrollTo({ top: window.scrollY + rect.top + distance * Math.min(4, Math.max(0, stop)) / 4, behavior: reduced ? "instant" : "smooth" });
  }, [reduced]);

  function inspect(index: number, button: HTMLButtonElement) {
    openButton.current = button;
    setSelected(index);
    requestAnimationFrame(() => dialogRef.current?.showModal());
  }
  function close() {
    dialogRef.current?.close();
    setSelected(null);
    openButton.current?.focus();
  }
  const item = selected === null ? null : CASES[selected];
  const staticMode = !canRender || reduced || sceneFailed;

  return <DashboardSectionShell title="Club / Trophies" season="Men's first team · the honours" theme={theme}>
    <div className="club-new" style={{ "--club-accent": theme.colors.accent, "--club-border": theme.colors.border, "--club-panel": theme.colors.surface, "--club-muted": theme.colors.textMuted } as React.CSSProperties}>
      <nav className="club-crumb" aria-label="Breadcrumb"><Link href="/club">Museum</Link><span>/</span><span>Trophies</span></nav>
      <header className="club-trophy-intro"><p className="club-kicker">THE TROPHY GALLERY / FIVE CASES + THE ARCHIVE WALL</p><h1>What the years<br /><em>left behind.</em></h1><p>Scroll to walk. Select a case to see each winning season. The journey moves both ways, and every stop is reachable from the rail.</p><a href="#trophy-walk" className="club-primary-link">Begin the walk <ArrowDown size={18} aria-hidden="true" /></a></header>
      <section ref={walkRef} id="trophy-walk" className="club-walk" aria-label="Five trophy cases">
        <div className="club-walk-sticky">
          <div className="club-walk-visual" aria-hidden="true">
            {staticMode ? <Image src={`/images/club/museum/stop-${active + 1}.webp`} alt="" fill sizes="(max-width: 1024px) 100vw, 80vw" className="object-cover" /> : <SceneBoundary onFail={() => setSceneFailed(true)}><MuseumScene position={position} theme={theme} uclUrl={uclUrl} /></SceneBoundary>}
            <div className="club-walk-vignette" />
          </div>
          {staticMode && <div className="club-walk-static-trophy" aria-hidden="true"><Image src={CASES[active].photo} alt="" fill unoptimized loading="eager" sizes="250px" className="object-contain" /></div>}
          {!staticMode && [1, 3, 4].includes(active) && <div className="club-walk-photo-case"><Image src={CASES[active].photo} alt={active === 4 ? "Historical Club World Cup trophy design reference" : `${CASES[active].displayName} reference`} fill unoptimized loading="eager" sizes="(max-width: 700px) 45vw, 28vw" className="object-contain" /><span>{active === 4 ? "HISTORICAL DESIGN REFERENCE" : "ARCHIVE PHOTOGRAPH"}</span></div>}
          <div className="club-walk-header"><span>FCB / THE MUSEUM</span><span>{String(active + 1).padStart(2, "0")} / 05</span></div>
          <div className="club-walk-info" key={active}><span className="club-kicker">{CASES[active].eyebrow}</span><h2>{CASES[active].displayName}</h2><p>{CASES[active].description}</p><div className="club-walk-info-bottom"><strong>{CASES[active].count} {CASES[active].count === 1 ? "title" : "titles"}</strong><button type="button" onClick={(event) => inspect(active, event.currentTarget)}>Inspect this case <ArrowUpRight size={16} aria-hidden="true" /></button></div></div>
          <nav className="club-stop-rail" aria-label="Trophy stops">{CASES.map((entry, index) => <button key={entry.id} type="button" onClick={() => jump(index)} aria-current={active === index ? "step" : undefined} aria-label={`Go to stop ${index + 1}: ${entry.displayName}`}><span>{String(index + 1).padStart(2, "0")}</span><i /><span className="club-stop-name">{entry.displayName}</span></button>)}</nav>
          <div className="club-walk-arrows"><button type="button" onClick={() => jump(active - 1)} disabled={active === 0} aria-label="Previous case"><ArrowLeft size={19} /></button><button type="button" onClick={() => jump(active + 1)} disabled={active === 4} aria-label="Next case"><ArrowRight size={19} /></button></div>
        </div>
      </section>
      <section className="club-archive-wall" id="archive-wall"><p className="club-kicker">THE FINAL WALL</p><h2>The rest of the record.</h2><p>Every other men’s first-team honour remains here. These named entries do not reuse a trophy model from another competition.</p><div className="club-archive-groups">{["Europe & the world", "Spain", "Catalonia"].map((group) => <div key={group}><h3>{group}</h3>{CLUB_CABINET.filter((entry) => !FEATURED.includes(entry.name) && entry.group === ({ "Europe & the world": "world", Spain: "spain", Catalonia: "catalonia" } as Record<string, string>)[group]).map((entry) => <details key={entry.id}><summary><span>{entry.displayName}</span><span>{entry.count} {entry.count === 1 ? "title" : "titles"} +</span></summary><div className="club-archive-years">{entry.wins.map((win) => win.seasonSlug ? <Link key={win.label} href={`/club/seasons/${win.seasonSlug}`}>{win.label}</Link> : <span key={win.label}>{win.label} · calendar year only</span>)}</div></details>)}</div>)}</div></section>
      <div className="club-trophy-next"><Link href="/club/seasons">Follow the seasons <ArrowRight size={18} /></Link><Link href="/club/identity">Explore the identity <ArrowRight size={18} /></Link></div>
      <dialog ref={dialogRef} className="club-case-dialog" onClose={() => { setSelected(null); openButton.current?.focus(); }} aria-labelledby="case-dialog-title"><div className="club-case-dialog-inner">{item && <><button type="button" className="club-case-close" onClick={close} aria-label="Close exhibit"><X size={23} /></button><div className="club-case-visual"><Image src={item.photo} alt={`${item.displayName} visual reference`} fill sizes="(max-width: 700px) 100vw, 45vw" className="object-contain" /><a href={item.photoSource} target="_blank" rel="noreferrer" className="club-case-photo-credit">{item.photoCredit} ↗</a></div><div className="club-case-copy"><span className="club-kicker">CASE {String(item.index + 1).padStart(2, "0")} / {item.eyebrow}</span><h2 id="case-dialog-title">{item.displayName}</h2><p>{item.description}</p><p className="club-case-asset-note">{item.assetNote}</p><h3>Winning seasons</h3><div className="club-case-years">{item.wins.map((win) => win.seasonSlug ? <Link key={win.label} href={`/club/seasons/${win.seasonSlug}`}>{win.label} <ArrowUpRight size={12} /></Link> : <span key={win.label}>{win.label}</span>)}</div>{item.index === 0 && uclUrl.includes("champions-league.glb") && <a className="club-case-source" href="https://www.cadcrowd.com/3d-models/uefa-champions-league-trophy" target="_blank" rel="noreferrer">Shared 3D model: alqosamaufa · CC0 ↗</a>}{item.index === 2 && <a className="club-case-source" href="https://sketchfab.com/3d-models/copa-del-rey-3d-cup-4120bebe817c432e9a00affca0be7c14" target="_blank" rel="noreferrer">3D model: Berezgen · CC BY ↗</a>}{item.index === 1 && <a className="club-case-source" href="https://sketchfab.com/3d-models/laliga-trophy-3d-ce3b291b1d4e4468a3c159f97ae8e746" target="_blank" rel="noreferrer">Inspect external view-only model ↗</a>}{item.index === 3 && <a className="club-case-source" href="https://sketchfab.com/3d-models/spain-supercup-trophy-kiarika-cm-overhaul-b5afec9ba291463391eaa5a5ae9f8033" target="_blank" rel="noreferrer">Inspect external view-only model ↗</a>}{item.index === 4 && <a className="club-case-source" href="https://sketchfab.com/3d-models/fifa-club-world-cup-e9c627f9d5b14f3a8e53569b266cffc2" target="_blank" rel="noreferrer">Inspect historical 3D reference ↗</a>}</div></>}</div></dialog>
    </div>
  </DashboardSectionShell>;
}

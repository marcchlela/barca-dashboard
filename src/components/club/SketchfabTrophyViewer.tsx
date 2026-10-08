"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";

type ViewerApi = { start: () => void; addEventListener: (event: "viewerready", callback: () => void) => void };
type SketchfabConstructor = new (frame: HTMLIFrameElement) => { init: (id: string, options: { autostart: number; ui_infos: number; success: (api: ViewerApi) => void; error: () => void }) => void };

let scriptPromise: Promise<SketchfabConstructor> | null = null;
function loadViewerApi(): Promise<SketchfabConstructor> {
  if (scriptPromise) return scriptPromise;
  const loaded = new Promise<SketchfabConstructor>((resolve, reject) => {
    const existing = (window as Window & { Sketchfab?: SketchfabConstructor }).Sketchfab;
    if (existing) { resolve(existing); return; }
    const script = document.createElement("script");
    script.src = "https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js";
    script.async = true;
    script.onload = () => {
      const constructor = (window as Window & { Sketchfab?: SketchfabConstructor }).Sketchfab;
      if (constructor) resolve(constructor);
      else reject(new Error("Sketchfab API missing"));
    };
    script.onerror = () => reject(new Error("Sketchfab API blocked"));
    document.head.appendChild(script);
  }).catch((error) => { scriptPromise = null; throw error; });
  scriptPromise = loaded;
  return loaded;
}

export default function SketchfabTrophyViewer({ modelId, name, source }: { modelId: string; name: string; source: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => { if (!cancelled) setState("unavailable"); }, 20000);
    loadViewerApi().then((Sketchfab) => {
      if (cancelled || !frame.current) return;
      const viewer = new Sketchfab(frame.current);
      viewer.init(modelId, {
        autostart: 1,
        ui_infos: 0,
        success(api) {
          api.start();
          api.addEventListener("viewerready", () => {
            if (cancelled) return;
            window.clearTimeout(timeout);
            setState("ready");
          });
        },
        error() {
          if (cancelled) return;
          window.clearTimeout(timeout);
          setState("unavailable");
        },
      });
    }).catch(() => { if (!cancelled) { window.clearTimeout(timeout); setState("unavailable"); } });
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [modelId]);

  return <div className="absolute inset-0 z-10" data-model-id={modelId}>
    <iframe ref={frame} title={`Rotatable ${name} trophy model`} className="absolute inset-0 h-full w-full border-0" style={{ opacity: state === "ready" ? 1 : 0, pointerEvents: state === "ready" ? "auto" : "none" }} allow="autoplay; fullscreen; xr-spatial-tracking" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
    {state !== "ready" && <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#06111f]/95 to-transparent px-5 pb-5 pt-14 text-white">
      <p className="text-xs">{state === "loading" ? "Opening the interactive model…" : "The interactive model could not load here."}</p>
      {state === "unavailable" && <a href={source} target="_blank" rel="noreferrer" className="club-focus mt-2 inline-flex items-center gap-1 text-xs underline underline-offset-4">Open on Sketchfab <ArrowUpRight size={13} aria-hidden="true" /></a>}
    </div>}
  </div>;
}

"use client";

import { Component, Suspense, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { RotateCcw, RotateCw } from "lucide-react";

class ViewerBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function TrophyModel({ url, angle }: { url: string; angle: number }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} rotation={[0, angle, 0]} />;
}

export default function TrophyViewer3D({ url, name, accent }: { url: string; name: string; accent: string }) {
  const [supported] = useState(() => {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  });
  const [angle, setAngle] = useState(0);

  const fallback = <div className="flex h-full min-h-72 items-center justify-center px-6 text-center text-sm" role="status">3D is unavailable on this device. The title history below remains available.</div>;
  if (!supported) return fallback;

  return <div className="relative h-full min-h-72 bg-[#091522]" aria-label={`Rotatable ${name} trophy model`}>
    <ViewerBoundary fallback={fallback}>
      <Canvas frameloop="demand" dpr={[1, 1.5]} camera={{ position: [4.2, 2.9, 4.6], fov: 42, near: 0.1, far: 50 }} gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}>
        <ambientLight intensity={2.2} />
        <directionalLight color="#f7e4c7" intensity={4.2} position={[3, 6, 5]} />
        <directionalLight color="#7fb6ff" intensity={3.2} position={[-4, 3, -3]} />
        <pointLight color={accent} intensity={28} distance={10} position={[-3, 2.5, 3]} />
        <Suspense fallback={null}><TrophyModel url={url} angle={angle} /></Suspense>
        <OrbitControls enablePan={false} enableDamping={false} minDistance={3.3} maxDistance={8} minPolarAngle={0.35} maxPolarAngle={Math.PI / 2.05} target={[0, 1.45, 0]} />
      </Canvas>
    </ViewerBoundary>
    <div className="absolute bottom-3 left-3 flex gap-1.5">
      <button type="button" onClick={() => setAngle((current) => current - Math.PI / 6)} className="club-focus inline-flex size-9 items-center justify-center border backdrop-blur-sm" style={{ borderColor: accent, color: accent, background: "#07111fbb" }} aria-label="Rotate trophy left"><RotateCcw size={17} aria-hidden="true" /></button>
      <button type="button" onClick={() => setAngle((current) => current + Math.PI / 6)} className="club-focus inline-flex size-9 items-center justify-center border backdrop-blur-sm" style={{ borderColor: accent, color: accent, background: "#07111fbb" }} aria-label="Rotate trophy right"><RotateCw size={17} aria-hidden="true" /></button>
    </div>
    <p className="pointer-events-none absolute bottom-4 right-3 text-[10px] uppercase tracking-widest opacity-65">Drag to orbit</p>
  </div>;
}

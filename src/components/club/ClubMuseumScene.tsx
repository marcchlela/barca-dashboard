"use client";

import { Suspense, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Vector3 } from "three";
import type { KitTheme } from "../../lib/themes";

function TrophyMesh({ url, stop }: { url: string; stop: number }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene.clone(true)} position={[0, .57, -4 - stop * 8]} />;
}

function Walk({ position, theme, uclUrl }: { position: number; theme: KitTheme; uclUrl: string }) {
  const { scene } = useGLTF("/models/club/museum-room.glb");
  const { camera, invalidate } = useThree();
  useEffect(() => {
    scene.updateMatrixWorld(true);
    const first = Math.min(4, Math.floor(position));
    const second = Math.min(4, first + 1);
    const fraction = position - first;
    const name = (prefix: string, index: number) => `${prefix}_${String(index + 1).padStart(2, "0")}`;
    const start = scene.getObjectByName(name("CAMERA_STOP", first));
    const end = scene.getObjectByName(name("CAMERA_STOP", second));
    const startCase = scene.getObjectByName(name("CASE_CENTRE", first));
    const endCase = scene.getObjectByName(name("CASE_CENTRE", second));
    if (start && end && startCase && endCase) {
      camera.position.lerpVectors(start.getWorldPosition(new Vector3()), end.getWorldPosition(new Vector3()), fraction);
      camera.lookAt(startCase.getWorldPosition(new Vector3()).lerp(endCase.getWorldPosition(new Vector3()), fraction));
    } else {
      camera.position.set(Math.sin(position * .52) * .42, 2.32, 2.1 - position * 8);
      camera.lookAt(0, 1.75, -4 - position * 8);
    }
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, invalidate, position, scene]);
  const near = Math.round(position);
  return <>
    <color attach="background" args={["#07111b"]} />
    <ambientLight intensity={1.05} />
    <hemisphereLight args={["#a8caff", "#301220", 1.9]} />
    <pointLight position={[0, 4.5, -4 - near * 8]} intensity={65} color={theme.colors.accent} distance={10} />
    <pointLight position={[-3.8, 3, -4 - near * 8]} intensity={22} color={theme.colors.primary} distance={10} />
    <primitive object={scene} />
    {near === 0 && <Suspense fallback={null}><TrophyMesh url={uclUrl} stop={0} /></Suspense>}
    {near === 2 && <Suspense fallback={null}><TrophyMesh url="/models/club/copa-del-rey.glb" stop={2} /></Suspense>}
  </>;
}

export default function ClubMuseumScene({ position, theme, uclUrl }: { position: number; theme: KitTheme; uclUrl: string }) {
  return <Canvas frameloop="demand" dpr={[1, 1.5]} camera={{ fov: 64, near: .1, far: 70, position: [0, 2.32, 2.1] }} gl={{ powerPreference: "low-power", antialias: true, alpha: false }}>
    <Suspense fallback={null}><Walk position={position} theme={theme} uclUrl={uclUrl} /></Suspense>
  </Canvas>;
}

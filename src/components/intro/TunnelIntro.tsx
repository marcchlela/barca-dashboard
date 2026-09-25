"use client";

import {
  Canvas,
  useFrame,
} from "@react-three/fiber";

import {
  useGLTF,
} from "@react-three/drei";

import {
  Component,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import * as THREE from "three";

import type {
  IntroTheme,
  ViewportRect,
} from "./types";

const MODEL_URL =
  "/models/camp-nou-tunnel-final.glb?v=threshold-final-7";

const FLIGHT_DURATION_MS =
  4_500;

type TunnelIntroProps = {
  targetRect: ViewportRect;
  theme: IntroTheme;
  onComplete: () => void;
  onFailure: () => void;
};

export default function TunnelIntro({
  targetRect,
  theme,
  onComplete,
  onFailure,
}: TunnelIntroProps) {
  const [
    progress,
    setProgress,
  ] =
    useState(0);

  const [
    ready,
    setReady,
  ] =
    useState(false);

  const handleReady =
    useCallback(() => {
      setReady(true);
    }, []);

  const portalRect =
    getPortalRect(
      targetRect,
      progress,
    );

  const canvasOpacity =
    1 -
    smoothStep(
      0.79,
      0.98,
      progress,
    );

  const centerCurtainOpacity =
    1 -
    smoothStep(
      0.65,
      0.82,
      progress,
    );

  const outerCurtainOpacity =
    1 -
    smoothStep(
      0.93,
      1,
      progress,
    );

  const frameOpacity =
    Math.min(
      smoothStep(
        0.48,
        0.62,
        progress,
      ),
      1 -
        smoothStep(
          0.94,
          1,
          progress,
        ),
    );

  return (
    <TunnelErrorBoundary
      onFailure={
        onFailure
      }
    >
      <div
        className="absolute inset-0"
        data-intro-ready={
          ready
            ? "true"
            : "false"
        }
      >
        <Curtains
          centerOpacity={
            centerCurtainOpacity
          }
          outerOpacity={
            outerCurtainOpacity
          }
          portalRect={
            portalRect
          }
          theme={theme}
        />

        <div
          data-intro-canvas
          className="absolute inset-0 z-10"
          style={{
            opacity:
              canvasOpacity,
          }}
        >
          <TunnelCanvas
            onComplete={
              onComplete
            }
            onProgress={
              setProgress
            }
            onReady={
              handleReady
            }
          />
        </div>

        <div
          data-intro-grade
          className="pointer-events-none absolute inset-0 z-[15]"
          style={{
            opacity:
              canvasOpacity,
            background:
              "radial-gradient(circle at 50% 46%, transparent 30%, rgba(2, 5, 12, 0.14) 72%, rgba(2, 4, 10, 0.48) 100%), linear-gradient(180deg, rgba(0, 40, 92, 0.08), transparent 34%, rgba(165, 0, 68, 0.045))",
          }}
        />

        <div
          className="pointer-events-none absolute inset-0 z-[16] flex items-center justify-center transition-opacity duration-700"
          style={{
            opacity:
              ready
                ? 0
                : 1,
            background: `linear-gradient(110deg, ${theme.background}, ${theme.surface})`,
          }}
        >
          <div className="flex flex-col items-center gap-5">
            <span
              className="block h-20 w-px"
              style={{
                background: `linear-gradient(180deg, transparent, #EDBB00, transparent)`,
              }}
            />

            <span className="text-[9px] font-semibold uppercase tracking-[0.32em] opacity-55">
              Preparing the tunnel
            </span>
          </div>
        </div>

        <div
          data-intro-portal-frame
          className="pointer-events-none absolute z-20 border"
          style={{
            left:
              portalRect.left,
            top:
              portalRect.top,
            width:
              portalRect.width,
            height:
              portalRect.height,
            opacity:
              frameOpacity,
            borderColor:
              theme.border,
            boxShadow: `inset 0 0 0 1px ${theme.accent}66, 0 0 90px ${theme.accent}1F`,
          }}
        >
          <span
            className="absolute -left-px -top-px h-5 w-5 border-l border-t"
            style={{
              borderColor:
                theme.accent,
            }}
          />

          <span
            className="absolute -bottom-px -right-px h-5 w-5 border-b border-r"
            style={{
              borderColor:
                theme.accent,
            }}
          />
        </div>
      </div>
    </TunnelErrorBoundary>
  );
}

const TunnelCanvas =
  memo(function TunnelCanvas({
    onComplete,
    onProgress,
    onReady,
  }: {
    onComplete: () => void;
    onProgress: (
      progress: number,
    ) => void;
    onReady: () => void;
  }) {
    return (
      <Canvas
        camera={{
          position: [
            0,
            1.68,
            10.8,
          ],
          fov: 58,
          near: 0.05,
          far: 150,
        }}
        dpr={[
          1,
          1.5,
        ]}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference:
            "high-performance",
        }}
        onCreated={({
          gl,
        }) => {
          gl.toneMapping =
            THREE.ACESFilmicToneMapping;

          gl.toneMappingExposure =
            1.02;
        }}
      >
        <color
          attach="background"
          args={[
            "#05070a",
          ]}
        />

        <fog
          attach="fog"
          args={[
            "#05070a",
            18,
            112,
          ]}
        />

        <hemisphereLight
          color="#9ebff2"
          groundColor="#04070d"
          intensity={
            0.78
          }
        />

        <directionalLight
          color="#d7e6ff"
          intensity={
            1.45
          }
          position={[
            -3.5,
            7,
            5,
          ]}
        />

        <pointLight
          color="#e3f1ff"
          intensity={
            26
          }
          distance={42}
          decay={2}
          position={[
            0,
            6,
            -17,
          ]}
        />

        <pointLight
          color="#004d98"
          intensity={
            9
          }
          distance={18}
          decay={2}
          position={[
            -2.5,
            2.3,
            1.5,
          ]}
        />

        <pointLight
          color="#a50044"
          intensity={
            7
          }
          distance={16}
          decay={2}
          position={[
            2.7,
            2.1,
            -4,
          ]}
        />

        <Suspense
          fallback={null}
        >
          <TunnelModel
            onReady={
              onReady
            }
          />

          <CameraFlight
            duration={
              FLIGHT_DURATION_MS
            }
            onComplete={
              onComplete
            }
            onProgress={
              onProgress
            }
          />
        </Suspense>
      </Canvas>
    );
  });

function TunnelModel({
  onReady,
}: {
  onReady: () => void;
}) {
  const {
    scene,
  } = useGLTF(
    MODEL_URL,
    false,
  );

  const disposalTimer =
    useRef<number | null>(
      null,
    );

  useEffect(() => {
    onReady();

    if (
      disposalTimer.current !==
      null
    ) {
      window.clearTimeout(
        disposalTimer.current,
      );

      disposalTimer.current =
        null;
    }

    return () => {
      disposalTimer.current =
        window.setTimeout(
          () => {
            disposeModel(
              scene,
            );

            useGLTF.clear(
              MODEL_URL,
            );

            disposalTimer.current =
              null;
          },
          0,
        );
    };
  }, [
    onReady,
    scene,
  ]);

  return (
    <primitive
      object={scene}
    />
  );
}

useGLTF.preload(
  MODEL_URL,
  false,
);

function disposeModel(
  scene: THREE.Object3D,
) {
  scene.traverse(
    (object) => {
      if (
        !(
          object instanceof
          THREE.Mesh
        )
      ) {
        return;
      }

      object.geometry.dispose();

      const materials =
        Array.isArray(
          object.material,
        )
          ? object.material
          : [
              object.material,
            ];

      materials.forEach(
        (material) => {
          Object.values(
            material,
          ).forEach(
            (value) => {
              if (
                value instanceof
                THREE.Texture
              ) {
                value.dispose();
              }
            },
          );

          material.dispose();
        },
      );
    },
  );
}

function CameraFlight({
  duration,
  onProgress,
  onComplete,
}: {
  duration: number;
  onProgress: (
    progress: number,
  ) => void;
  onComplete: () => void;
}) {
  const elapsedMs =
    useRef(0);

  const lastReported =
    useRef(-1);

  const completed =
    useRef(false);

  const curve =
    useMemo(
      () =>
        new THREE.CatmullRomCurve3(
          [
            new THREE.Vector3(
              0,
              1.68,
              10.8,
            ),
            new THREE.Vector3(
              0,
              1.68,
              8.2,
            ),
            new THREE.Vector3(
              -0.06,
              1.7,
              2.8,
            ),
            new THREE.Vector3(
              0.03,
              1.78,
              -4.3,
            ),
            new THREE.Vector3(
              0,
              2,
              -9.2,
            ),
            new THREE.Vector3(
              0,
              2.08,
              -11.05,
            ),
          ],
          false,
          "catmullrom",
          0.38,
        ),
      [],
    );

  const lookTargetRef =
    useRef(
      new THREE.Vector3(),
    );

  useFrame(({
    camera,
  }, delta) => {
    elapsedMs.current +=
      Math.min(
        delta,
        0.12,
      ) * 1_000;

    const elapsed =
      elapsedMs.current;

    const progress =
      THREE.MathUtils.clamp(
        elapsed / duration,
        0,
        1,
      );

    const travel =
      cinematicEase(
        progress,
      );

    const position =
      curve.getPointAt(
        travel,
      );

    const tangent =
      curve.getTangentAt(
        Math.min(
          0.999,
          travel,
        ),
      );

    camera.position.copy(
      position,
    );

    const lookTarget =
      lookTargetRef.current;

    lookTarget
      .copy(position)
      .add(
        tangent.multiplyScalar(
          7,
        ),
      );

    lookTarget.y +=
      0.08 *
      smoothStep(
        0.7,
        1,
        progress,
      );

    camera.lookAt(
      lookTarget,
    );

    if (
      progress -
        lastReported.current >=
        0.0025 ||
      progress === 1
    ) {
      lastReported.current =
        progress;

      onProgress(
        progress,
      );
    }

    if (
      progress === 1 &&
      !completed.current
    ) {
      completed.current =
        true;

      onComplete();
    }
  });

  return null;
}

function Curtains({
  centerOpacity,
  outerOpacity,
  portalRect,
  theme,
}: {
  centerOpacity: number;
  outerOpacity: number;
  portalRect: ViewportRect;
  theme: IntroTheme;
}) {
  const right =
    Math.max(
      0,
      portalRect.viewportWidth -
        portalRect.left -
        portalRect.width,
    );

  const bottom =
    Math.max(
      0,
      portalRect.viewportHeight -
        portalRect.top -
        portalRect.height,
    );

  const outerStyle = {
    backgroundColor:
      theme.background,
    opacity:
      outerOpacity,
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <div
        className="absolute left-0 top-0 w-full"
        style={{
          ...outerStyle,
          height:
            portalRect.top,
        }}
      />

      <div
        className="absolute bottom-0 left-0 w-full"
        style={{
          ...outerStyle,
          height:
            bottom,
        }}
      />

      <div
        className="absolute left-0"
        style={{
          ...outerStyle,
          top:
            portalRect.top,
          width:
            portalRect.left,
          height:
            portalRect.height,
        }}
      />

      <div
        className="absolute right-0"
        style={{
          ...outerStyle,
          top:
            portalRect.top,
          width:
            right,
          height:
            portalRect.height,
        }}
      />

      <div
        className="absolute"
        style={{
          left:
            portalRect.left,
          top:
            portalRect.top,
          width:
            portalRect.width,
          height:
            portalRect.height,
          backgroundColor:
            theme.background,
          opacity:
            centerOpacity,
        }}
      />
    </div>
  );
}

class TunnelErrorBoundary extends Component<
  {
    children: ReactNode;
    onFailure: () => void;
  },
  {
    failed: boolean;
  }
> {
  state = {
    failed: false,
  };

  static getDerivedStateFromError() {
    return {
      failed: true,
    };
  }

  componentDidCatch(
    error: Error,
  ) {
    console.error(
      "[The Threshold] The WebGL intro failed and was skipped.",
      error,
    );

    this.props.onFailure();
  }

  render() {
    if (
      this.state.failed
    ) {
      return null;
    }

    return this.props.children;
  }
}

function getPortalRect(
  target: ViewportRect,
  progress: number,
): ViewportRect {
  const amount =
    smoothStep(
      0.57,
      0.9,
      progress,
    );

  const start = {
    left:
      target.viewportWidth *
      0.09,
    top:
      target.viewportHeight *
      0.08,
    width:
      target.viewportWidth *
      0.82,
    height:
      target.viewportHeight *
      0.84,
  };

  return {
    left:
      THREE.MathUtils.lerp(
        start.left,
        target.left,
        amount,
      ),
    top:
      THREE.MathUtils.lerp(
        start.top,
        target.top,
        amount,
      ),
    width:
      THREE.MathUtils.lerp(
        start.width,
        target.width,
        amount,
      ),
    height:
      THREE.MathUtils.lerp(
        start.height,
        target.height,
        amount,
      ),
    viewportWidth:
      target.viewportWidth,
    viewportHeight:
      target.viewportHeight,
  };
}

function smoothStep(
  edge0: number,
  edge1: number,
  value: number,
) {
  const x =
    THREE.MathUtils.clamp(
      (value - edge0) /
        (edge1 - edge0),
      0,
      1,
    );

  return (
    x *
    x *
    (3 - 2 * x)
  );
}

function smootherStep(
  value: number,
) {
  const x =
    THREE.MathUtils.clamp(
      value,
      0,
      1,
    );

  return (
    x *
    x *
    x *
    (x *
      (x * 6 - 15) +
      10)
  );
}

function cinematicEase(
  value: number,
) {
  const eased =
    smootherStep(
      value,
    );

  const deeperEase =
    smootherStep(
      eased,
    );

  return THREE.MathUtils.lerp(
    eased,
    deeperEase,
    0.28,
  );
}

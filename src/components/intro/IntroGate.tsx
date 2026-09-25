"use client";

import dynamic from "next/dynamic";
import Image from "next/image";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import type {
  KitTheme,
} from "../../lib/themes";

import type {
  IntroTheme,
  ViewportRect,
} from "./types";

const TunnelIntro = dynamic(
  () =>
    import(
      "./TunnelIntro"
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="absolute inset-0"
        style={{
          backgroundColor:
            "var(--intro-background)",
        }}
      />
    ),
  },
);

export const INTRO_SESSION_KEY =
  "barca-entry-v4-seen";

type IntroStatus =
  | "checking"
  | "static"
  | "playing"
  | "done";

type IntroGateProps = {
  theme: KitTheme;
  kitReady: boolean;
  replayToken: number;
  onActiveChange: (
    active: boolean,
  ) => void;
};

export default function IntroGate({
  theme,
  kitReady,
  replayToken,
  onActiveChange,
}: IntroGateProps) {
  const [
    status,
    setStatus,
  ] =
    useState<IntroStatus>(
      "checking",
    );

  const [
    targetRect,
    setTargetRect,
  ] =
    useState<ViewportRect | null>(
      null,
    );

  const completedRef =
    useRef(false);

  const finish =
    useCallback(() => {
      if (
        completedRef.current
      ) {
        return;
      }

      completedRef.current =
        true;

      try {
        window.sessionStorage.setItem(
          INTRO_SESSION_KEY,
          "1",
        );
      } catch {
        // Storage can be unavailable in hardened/private browsing contexts.
      }

      setStatus(
        "done",
      );
    }, []);

  useEffect(() => {
    if (!kitReady) {
      return;
    }

    completedRef.current =
      false;

    let hasSeenIntro =
      false;

    try {
      hasSeenIntro =
        window.sessionStorage.getItem(
          INTRO_SESSION_KEY,
        ) === "1";
    } catch {
      // Treat unavailable storage as a fresh session, then rely on local state.
    }

    if (
      replayToken === 0 &&
      hasSeenIntro
    ) {
      completedRef.current =
        true;

      const seenTimer =
        window.setTimeout(
          () => {
            setStatus(
              "done",
            );
          },
          0,
        );

      return () => {
        window.clearTimeout(
          seenTimer,
        );
      };
    }

    const prefersReducedMotion =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

    const useCompactFallback =
      window.matchMedia(
        "(max-width: 639px)",
      ).matches;

    if (
      prefersReducedMotion ||
      useCompactFallback
    ) {
      const statusTimer =
        window.setTimeout(
          () => {
            setStatus(
              "static",
            );
          },
          0,
        );

      const fallbackTimer =
        window.setTimeout(
          finish,
          prefersReducedMotion
            ? 180
            : 520,
        );

      return () => {
        window.clearTimeout(
          statusTimer,
        );

        window.clearTimeout(
          fallbackTimer,
        );
      };
    }

    const playTimer =
      window.setTimeout(
        () => {
          setStatus(
            "playing",
          );
        },
        0,
      );

    return () => {
      window.clearTimeout(
        playTimer,
      );
    };
  }, [
    finish,
    kitReady,
    replayToken,
  ]);

  useEffect(() => {
    if (
      status === "done"
    ) {
      onActiveChange(
        false,
      );

      return;
    }

    onActiveChange(
      true,
    );

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key === "Escape"
      ) {
        finish();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    finish,
    onActiveChange,
    status,
  ]);

  useEffect(() => {
    if (
      status === "done"
    ) {
      return;
    }

    function measureTarget() {
      const target =
        document.querySelector<HTMLElement>(
          "[data-match-stage]",
        );

      const viewportWidth =
        window.innerWidth;

      const viewportHeight =
        window.innerHeight;

      if (!target) {
        setTargetRect({
          left:
            viewportWidth *
            0.16,
          top:
            viewportHeight *
            0.15,
          width:
            viewportWidth *
            0.68,
          height:
            viewportHeight *
            0.7,
          viewportWidth,
          viewportHeight,
        });

        return;
      }

      const rect =
        target.getBoundingClientRect();

      setTargetRect({
        left:
          Math.max(
            0,
            rect.left,
          ),
        top:
          Math.max(
            0,
            rect.top,
          ),
        width:
          Math.min(
            viewportWidth,
            rect.width,
          ),
        height:
          Math.min(
            viewportHeight,
            rect.height,
          ),
        viewportWidth,
        viewportHeight,
      });
    }

    const measurementTimer =
      window.setTimeout(
        measureTarget,
        0,
      );

    const target =
      document.querySelector<HTMLElement>(
        "[data-match-stage]",
      );

    const observer =
      target &&
      typeof ResizeObserver !==
        "undefined"
        ? new ResizeObserver(
            measureTarget,
          )
        : null;

    if (
      observer &&
      target
    ) {
      observer.observe(
        target,
      );
    }

    window.addEventListener(
      "resize",
      measureTarget,
    );

    return () => {
      window.clearTimeout(
        measurementTimer,
      );

      observer?.disconnect();

      window.removeEventListener(
        "resize",
        measureTarget,
      );
    };
  }, [
    status,
  ]);

  useEffect(() => {
    if (
      status === "done"
    ) {
      return;
    }

    const failSafe =
      window.setTimeout(
        finish,
        status ===
          "checking"
          ? 2_500
          : 25_000,
      );

    return () => {
      window.clearTimeout(
        failSafe,
      );
    };
  }, [
    finish,
    status,
  ]);

  if (
    status === "done"
  ) {
    return null;
  }

  const introTheme:
    IntroTheme = {
      background:
        theme.colors.background,
      surface:
        theme.colors.surface,
      border:
        theme.colors.border,
      text:
        theme.colors.text,
      textMuted:
        theme.colors.textMuted,
      accent:
        theme.colors.accent,
    };

  const displayedTheme:
    IntroTheme =
      status ===
      "checking"
        ? {
            background:
              "#05070A",
            surface:
              "#0A0D12",
            border:
              "#242A32",
            text:
              "#F2F3F5",
            textMuted:
              "#8B929D",
            accent:
              "#8B929D",
          }
        : introTheme;

  return (
    <div
      data-intro-gate
      data-intro-status={
        status
      }
      data-target-ready={
        targetRect
          ? "true"
          : "false"
      }
      className="fixed inset-0 z-[100] overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Entering the Barça Command Center"
      style={{
        "--intro-background":
          displayedTheme.background,
        color:
          displayedTheme.text,
      } as CSSProperties}
    >
      {status ===
        "playing" &&
      targetRect ? (
        <TunnelIntro
          key={
            replayToken
          }
          targetRect={
            targetRect
          }
          theme={
            displayedTheme
          }
          onComplete={
            finish
          }
          onFailure={
            finish
          }
        />
      ) : (
        <StaticThreshold
          targetRect={
            targetRect
          }
          theme={
            displayedTheme
          }
        />
      )}

      <button
        type="button"
        onClick={finish}
        className="absolute right-4 top-4 z-30 border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] backdrop-blur-sm sm:right-6 sm:top-6"
        style={{
          backgroundColor: `${displayedTheme.background}CC`,
          borderColor:
            displayedTheme.border,
          color:
            displayedTheme.text,
        }}
      >
        Skip
        <span className="ml-2 opacity-50">
          Esc
        </span>
      </button>

      <div className="pointer-events-none absolute bottom-5 left-5 z-30 flex items-center gap-3 sm:bottom-7 sm:left-7">
        <Image
          src="/textures/intro/fc-barcelona-crest.png"
          alt=""
          width={
            42
          }
          height={
            42
          }
          className="h-[42px] w-[42px] object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.45)]"
          priority
        />

        <div
          className="border-l pl-3"
          style={{
            borderColor: `${displayedTheme.border}B8`,
          }}
        >
          <p className="text-[9px] font-semibold uppercase tracking-[0.3em] opacity-55">
            FC Barcelona
          </p>

          <p className="mt-1.5 text-[11px] uppercase tracking-[0.2em]">
            The Threshold
          </p>
        </div>
      </div>
    </div>
  );
}

function StaticThreshold({
  targetRect,
  theme,
}: {
  targetRect:
    ViewportRect | null;
  theme: IntroTheme;
}) {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        background: `linear-gradient(110deg, ${theme.background}, ${theme.surface})`,
      }}
    >
      {targetRect ? (
        <div
          className="absolute border"
          style={{
            left:
              targetRect.left,
            top:
              targetRect.top,
            width:
              targetRect.width,
            height:
              targetRect.height,
            borderColor:
              theme.border,
            boxShadow: `inset 0 0 0 1px ${theme.accent}33, 0 0 80px ${theme.accent}12`,
          }}
        />
      ) : null}
    </div>
  );
}

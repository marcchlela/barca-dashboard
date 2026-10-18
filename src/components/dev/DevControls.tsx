"use client";

import { useState } from "react";
import { Minus, SlidersHorizontal } from "lucide-react";

import type {
  KitType,
} from "../../lib/themes";

export type MatchState =
  | "normal"
  | "matchday"
  | "live"
  | "fulltime";

type DevControlsProps = {
  kit: KitType;

  matchState: MatchState;

  isAuto: boolean;

  onKitChange: (
    kit: KitType,
  ) => void;

  onMatchStateChange: (
    state: MatchState,
  ) => void;

  onAutoMatchState: () => void;

  onReplayIntro: () => void;
};

export default function DevControls({
  kit,
  matchState,
  isAuto,
  onKitChange,
  onMatchStateChange,
  onAutoMatchState,
  onReplayIntro,
}: DevControlsProps) {
  const [minimized, setMinimized] = useState(false);

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        aria-label="Open Dev Controls"
        title="Open Dev Controls"
        className="fixed right-3 z-50 flex h-11 w-11 items-center justify-center border border-white/15 bg-[#05080c] text-white shadow-xl active:scale-95 max-lg:bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-5 lg:right-5"
      >
        <SlidersHorizontal size={19} aria-hidden="true" />
      </button>
    );
  }

  return (
    <aside className="fixed right-3 z-50 w-[min(250px,calc(100vw-1.5rem))] border border-white/10 bg-[#05080c] p-4 text-white shadow-2xl max-lg:bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-5 lg:right-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
          Dev Controls
        </p>
        <button
          type="button"
          onClick={() => setMinimized(true)}
          aria-label="Minimize Dev Controls"
          title="Minimize Dev Controls"
          className="flex h-8 w-8 items-center justify-center border border-white/10 text-white/65 transition hover:border-white/30 hover:text-white active:scale-95"
        >
          <Minus size={17} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
          Match State
        </p>

        <button
          type="button"
          onClick={
            onAutoMatchState
          }
          className="mb-2 w-full px-3 py-2 text-xs transition"
          style={{
            backgroundColor:
              isAuto
                ? "#FFFFFF"
                : "#11151B",

            color:
              isAuto
                ? "#0A0D12"
                : "#A7ABB2",
          }}
        >
          Auto
        </button>

        <div className="grid grid-cols-2 gap-2">
          <StateButton
            label="Normal"
            active={
              !isAuto &&
              matchState ===
                "normal"
            }
            onClick={() =>
              onMatchStateChange(
                "normal",
              )
            }
          />

          <StateButton
            label="Matchday"
            active={
              !isAuto &&
              matchState ===
                "matchday"
            }
            onClick={() =>
              onMatchStateChange(
                "matchday",
              )
            }
          />

          <StateButton
            label="Live"
            active={
              !isAuto &&
              matchState ===
                "live"
            }
            onClick={() =>
              onMatchStateChange(
                "live",
              )
            }
          />

          <StateButton
            label="Full Time"
            active={
              !isAuto &&
              matchState ===
                "fulltime"
            }
            onClick={() =>
              onMatchStateChange(
                "fulltime",
              )
            }
          />
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
          Kit Theme
        </p>

        <div className="grid grid-cols-3 gap-2">
          <ThemeButton
            label="Home"
            active={
              kit === "home"
            }
            onClick={() =>
              onKitChange(
                "home",
              )
            }
          />

          <ThemeButton
            label="Away"
            active={
              kit === "away"
            }
            onClick={() =>
              onKitChange(
                "away",
              )
            }
          />

          <ThemeButton
            label="Third"
            active={
              kit === "third"
            }
            onClick={() =>
              onKitChange(
                "third",
              )
            }
          />
        </div>
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
          Signature Entry
        </p>

        <button
          type="button"
          onClick={
            onReplayIntro
          }
          className="w-full border border-white/15 bg-[#11151B] px-3 py-2 text-xs text-[#D9DCE1] transition hover:border-white/35 hover:text-white"
        >
          Replay Tunnel
        </button>
      </div>
    </aside>
  );
}

function StateButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-2 text-xs transition"
      style={{
        backgroundColor:
          active
            ? "#FFFFFF"
            : "#11151B",

        color:
          active
            ? "#0A0D12"
            : "#A7ABB2",
      }}
    >
      {label}
    </button>
  );
}

function ThemeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2 py-2 text-xs transition"
      style={{
        backgroundColor:
          active
            ? "#FFFFFF"
            : "#11151B",

        color:
          active
            ? "#0A0D12"
            : "#A7ABB2",
      }}
    >
      {label}
    </button>
  );
}

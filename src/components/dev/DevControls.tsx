"use client";

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
  return (
    <aside className="fixed bottom-5 right-5 z-50 w-[250px] border border-white/10 bg-[#05080c] p-4 text-white">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
        Dev Controls
      </p>

      <div className="mt-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
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
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
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
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
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

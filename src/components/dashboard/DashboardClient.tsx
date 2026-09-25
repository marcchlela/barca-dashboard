"use client";

import {
  useEffect,
  useState,
} from "react";

import DashboardSyncController from "./DashboardSyncController";

import DevControls, {
  type MatchState,
} from "../dev/DevControls";

import IntroGate, {
  INTRO_SESSION_KEY,
} from "../intro/IntroGate";
import MatchStage from "../match/MatchStage";
import SeasonStory from "../season/SeasonStory";
import BarcaPulse from "../shell/BarcaPulse";
import StadiumRail from "../shell/StadiumRail";

import type {
  DashboardOverview,
} from "../../lib/dashboard/overview";

import {
  getTheme,
  isKitType,
  type KitType,
} from "../../lib/themes";

type DashboardClientProps = {
  overview:
    DashboardOverview;
};

const KIT_STORAGE_KEY =
  "barca-dashboard-kit";

export default function DashboardClient({
  overview,
}: DashboardClientProps) {
  /*
  |--------------------------------------------------------------------------
  | Kit
  |--------------------------------------------------------------------------
  */

  const [
    kit,
    setKit,
  ] =
    useState<KitType>(
      "home",
    );

  const [
    kitLoaded,
    setKitLoaded,
  ] =
    useState(false);

  /*
  |--------------------------------------------------------------------------
  | Restore persisted kit
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const frame =
      window.requestAnimationFrame(
        () => {
          const savedKit =
            window.localStorage.getItem(
              KIT_STORAGE_KEY,
            );

          if (
            isKitType(
              savedKit,
            )
          ) {
            setKit(
              savedKit,
            );
          }

          setKitLoaded(
            true,
          );
        },
      );

    return () => {
      window.cancelAnimationFrame(
        frame,
      );
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Persist kit
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (!kitLoaded) {
      return;
    }

    window.localStorage.setItem(
      KIT_STORAGE_KEY,
      kit,
    );
  }, [
    kit,
    kitLoaded,
  ]);

  /*
  |--------------------------------------------------------------------------
  | Automatic match state
  |--------------------------------------------------------------------------
  */

  const [
    automaticMatchState,
    setAutomaticMatchState,
  ] =
    useState<MatchState>(
      () =>
        getAutomaticMatchState(
          overview,
        ),
    );

  /*
   * null:
   * use real automatic state.
   *
   * MatchState:
   * developer visually forced a state.
   */

  const [
    devMatchStateOverride,
    setDevMatchStateOverride,
  ] =
    useState<
      MatchState | null
    >(null);

  /*
  |--------------------------------------------------------------------------
  | Re-evaluate clock-based match state
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    function updateState() {
      setAutomaticMatchState(
        getAutomaticMatchState(
          overview,
        ),
      );
    }

    const interval =
      window.setInterval(
        updateState,
        30_000,
      );

    return () => {
      window.clearInterval(
        interval,
      );
    };
  }, [
    overview,
  ]);

  const matchState =
    devMatchStateOverride ??
    automaticMatchState;

  /*
  |--------------------------------------------------------------------------
  | Theme
  |--------------------------------------------------------------------------
  */

  const season =
    overview.season.label;

  const theme =
    getTheme(
      season,
      kit,
    );

  const [
    introActive,
    setIntroActive,
  ] =
    useState(true);

  const [
    introReplayToken,
    setIntroReplayToken,
  ] =
    useState(0);

  const showDevControls =
    process.env.NODE_ENV ===
    "development";

  return (
    <main
      className="
        theme-environment
        relative
        min-h-screen
        overflow-hidden

        px-3
        py-4

        sm:px-4

        lg:px-5
        lg:py-5
      "
      style={{
        backgroundColor:
          theme.colors.background,

        color:
          theme.colors.text,
      }}
    >
      {/*
      |--------------------------------------------------------------------------
      | Background data freshness
      |--------------------------------------------------------------------------
      |
      | IMPORTANT:
      |
      | This receives automaticMatchState,
      | not matchState.
      |
      | Therefore manually clicking "Live"
      | in Dev Controls does NOT switch the
      | provider polling cadence to live mode.
      |--------------------------------------------------------------------------
      */}

      <DashboardSyncController
        matchState={
          automaticMatchState
        }
      />

      <div
        data-dashboard-content
        inert={
          introActive
        }
        aria-hidden={
          introActive
        }
        className={
          introActive
            ? "pointer-events-none select-none"
            : undefined
        }
      >

      {/* ENVIRONMENT */}

      <div
        className="pointer-events-none fixed inset-0 transition-all duration-700"
        style={{
          background: `
            linear-gradient(
              90deg,
              ${theme.colors.background} 0%,
              ${theme.colors.backgroundElevated} 48%,
              ${theme.colors.background} 100%
            )
          `,
        }}
      />

      {/* GRID TEXTURE */}

      <div
        className="pointer-events-none fixed inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `
            linear-gradient(
              to right,
              ${theme.colors.pitchLine} 1px,
              transparent 1px
            ),
            linear-gradient(
              to bottom,
              ${theme.colors.pitchLine} 1px,
              transparent 1px
            )
          `,

          backgroundSize:
            "72px 72px",
        }}
      />

      {/* KIT STRIPE */}

      <div className="pointer-events-none fixed left-0 top-0 h-full w-1.25">
        <div
          className="h-1/2 w-full"
          style={{
            backgroundColor:
              theme.colors.primary,
          }}
        />

        <div
          className="h-1/2 w-full"
          style={{
            backgroundColor:
              theme.colors.secondary,
          }}
        />
      </div>

      {/* PAGE */}

      <div className="relative mx-auto max-w-[1700px]">
        {/* HEADER */}

        <header
          className="
            mb-5
            flex
            flex-col
            gap-3
            px-1

            sm:flex-row
            sm:items-end
            sm:justify-between
          "
        >
          <div>
            <p
              className="
                text-[10px]
                uppercase
                tracking-[0.28em]

                sm:text-xs
                sm:tracking-[0.32em]
              "
              style={{
                color:
                  theme.colors.textMuted,
              }}
            >
              FC Barcelona
            </p>

            <h1
              className="
                mt-2
                text-2xl
                font-medium
                tracking-[-0.03em]

                sm:text-3xl
              "
            >
              Barça Command Center
            </h1>
          </div>

          <div
            className="
              text-[10px]
              uppercase
              tracking-[0.16em]

              sm:text-xs
            "
            style={{
              color:
                theme.colors.textMuted,
            }}
          >
            {season}
            {" • "}
            {kit}
          </div>
        </header>

        {/* COMPACT NAV */}

        <div className="mb-5 lg:hidden">
          <StadiumRail
            theme={theme}
            variant="compact"
          />
        </div>

        {/* DASHBOARD GRID */}

        <div
          className="
            grid
            grid-cols-1
            gap-x-5
            gap-y-7

            lg:grid-cols-[150px_minmax(0,1fr)]

            xl:grid-cols-[160px_minmax(0,1fr)_300px]
          "
        >
          {/* DESKTOP NAV */}

          <div
            className="
              hidden

              lg:row-span-3
              lg:block
            "
          >
            <StadiumRail
              theme={theme}
              variant="desktop"
            />
          </div>

          {/* MATCH */}

          <div
            className="
              min-w-0

              lg:col-start-2
              lg:row-start-1

              xl:col-start-2
              xl:row-start-1
            "
          >
            <MatchStage
              matchState={
                matchState
              }
              theme={theme}
              overview={
                overview
              }
            />
          </div>

          {/* PULSE */}

          <div
            className="
              min-w-0

              lg:col-start-2

              xl:col-start-3
              xl:row-start-1
            "
          >
            <BarcaPulse
              matchState={
                matchState
              }
              theme={theme}
              overview={
                overview
              }
            />
          </div>

          {/* STORY */}

          <div
            className="
              min-w-0

              lg:col-start-2

              xl:col-span-2
              xl:col-start-2
            "
          >
            <SeasonStory
              theme={theme}
              overview={
                overview
              }
            />
          </div>
        </div>
      </div>

      {/* DEV CONTROLS */}

      {showDevControls ? (
        <DevControls
          kit={kit}

          matchState={
            matchState
          }

          isAuto={
            devMatchStateOverride ===
            null
          }

          onKitChange={
            setKit
          }

          onMatchStateChange={(
            state,
          ) => {
            setDevMatchStateOverride(
              state,
            );
          }}

          onAutoMatchState={() => {
            setDevMatchStateOverride(
              null,
            );
          }}

          onReplayIntro={() => {
            try {
              window.sessionStorage.removeItem(
                INTRO_SESSION_KEY,
              );
            } catch {
              // The replay still works through the in-memory token.
            }

            setIntroActive(
              true,
            );

            setIntroReplayToken(
              (value) =>
                value + 1,
            );
          }}
        />
      ) : null}
      </div>

      <IntroGate
        theme={theme}
        kitReady={
          kitLoaded
        }
        replayToken={
          introReplayToken
        }
        onActiveChange={
          setIntroActive
        }
      />
    </main>
  );
}

/*
|--------------------------------------------------------------------------
| Automatic match-state engine
|--------------------------------------------------------------------------
*/

function getAutomaticMatchState(
  overview:
    DashboardOverview,

  now =
    new Date(),
): MatchState {
  const nextMatch =
    overview.nextMatch;

  const previousMatch =
    overview.previousMatch;

  /*
  |--------------------------------------------------------------------------
  | LIVE
  |--------------------------------------------------------------------------
  */

  if (
    nextMatch?.status ===
      "live" ||
    nextMatch?.status ===
      "halftime"
  ) {
    return "live";
  }

  /*
  |--------------------------------------------------------------------------
  | FULL TIME
  |--------------------------------------------------------------------------
  */

  if (
    previousMatch?.status ===
    "finished"
  ) {
    const previousKickoff =
      new Date(
        previousMatch.kickoff,
      );

    const hoursSinceKickoff =
      (now.getTime() -
        previousKickoff.getTime()) /
      3_600_000;

    if (
      hoursSinceKickoff >=
        0 &&
      hoursSinceKickoff <=
        5
    ) {
      return "fulltime";
    }
  }

  /*
  |--------------------------------------------------------------------------
  | MATCHDAY
  |--------------------------------------------------------------------------
  */

  if (nextMatch) {
    const kickoff =
      new Date(
        nextMatch.kickoff,
      );

    if (
      isSameCalendarDay(
        now,
        kickoff,
      )
    ) {
      return "matchday";
    }
  }

  /*
  |--------------------------------------------------------------------------
  | NORMAL
  |--------------------------------------------------------------------------
  */

  return "normal";
}

function isSameCalendarDay(
  first:
    Date,

  second:
    Date,
) {
  return (
    first.getFullYear() ===
      second.getFullYear() &&
    first.getMonth() ===
      second.getMonth() &&
    first.getDate() ===
      second.getDate()
  );
}

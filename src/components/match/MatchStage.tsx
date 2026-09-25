"use client";

import Link from "next/link";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  AnimatePresence,
  motion,
} from "motion/react";

import {
  ArrowRight,
  CalendarDays,
  MapPin,
  Plane,
  Play,
  Trophy,
} from "lucide-react";

import type {
  MatchState,
} from "../dev/DevControls";

import type {
  DashboardOverview,
} from "../../lib/dashboard/overview";

import type {
  KitTheme,
} from "../../lib/themes";

type MatchStageProps = {
  matchState: MatchState;
  theme: KitTheme;
  overview: DashboardOverview;
};

type OverviewMatch =
  NonNullable<
    DashboardOverview["nextMatch"]
  >;

type PreviousOverviewMatch =
  NonNullable<
    DashboardOverview["previousMatch"]
  >;

type AnyOverviewMatch =
  | OverviewMatch
  | PreviousOverviewMatch;

type OverviewTeam =
  OverviewMatch["homeTeam"];

export default function MatchStage({
  matchState,
  theme,
  overview,
}: MatchStageProps) {
  const contextMatch =
    matchState === "fulltime"
      ? overview.previousMatch
      : overview.nextMatch;

  return (
    <section
      data-match-stage
      className="relative min-h-[520px] overflow-hidden border"
      style={{
        backgroundColor:
          theme.colors.surface,

        borderColor:
          theme.colors.border,
      }}
    >
      <StageArchitecture
        theme={theme}
      />

      {/* HEADER */}

      <div
        className="relative z-10 flex items-start justify-between gap-6 border-b px-5 py-5 sm:px-7"
        style={{
          borderColor:
            theme.colors.border,
        }}
      >
        <div>
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.28em]"
            style={{
              color:
                theme.colors.textMuted,
            }}
          >
            {getEyebrow(
              matchState,
            )}
          </p>

          <div className="mt-2 flex items-center gap-2">
            {contextMatch
              ?.competition
              .logoUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    contextMatch
                      .competition
                      .logoUrl
                  }
                  alt={
                    contextMatch
                      .competition
                      .name
                  }
                  className="h-4 w-4 object-contain"
                />
              </>
            ) : (
              <Trophy
                size={14}
                style={{
                  color:
                    theme.colors.accent,
                }}
              />
            )}

            <span className="text-sm font-medium">
              {contextMatch
                ?.competition
                .shortName ??
                contextMatch
                  ?.competition
                  .name ??
                "FC Barcelona"}
            </span>

            {contextMatch
              ?.matchday ? (
              <span
                className="text-sm"
                style={{
                  color:
                    theme.colors.textMuted,
                }}
              >
                / Matchday{" "}
                {
                  contextMatch.matchday
                }
              </span>
            ) : null}
          </div>
        </div>

        {contextMatch ? (
          <MatchLocation
            match={
              contextMatch
            }
            theme={theme}
          />
        ) : null}
      </div>

      {/* MAIN STAGE */}

      <div className="relative z-10 flex min-h-[445px] items-center justify-center px-3 py-7 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait">
          {matchState ===
            "normal" && (
            <NormalState
              key="normal"
              theme={theme}
              overview={overview}
            />
          )}

          {matchState ===
            "matchday" && (
            <MatchdayState
              key="matchday"
              theme={theme}
              overview={overview}
            />
          )}

          {matchState ===
            "live" && (
            <LiveState
              key="live"
              theme={theme}
              overview={overview}
            />
          )}

          {matchState ===
            "fulltime" && (
            <FullTimeState
              key="fulltime"
              theme={theme}
              overview={overview}
            />
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

/*
|--------------------------------------------------------------------------
| NORMAL
|--------------------------------------------------------------------------
*/

function NormalState({
  theme,
  overview,
}: {
  theme: KitTheme;
  overview: DashboardOverview;
}) {
  const match =
    overview.nextMatch;

  if (!match) {
    return (
      <StateWrapper>
        <EmptyState
          theme={theme}
          title="No upcoming fixture"
          text="There is currently no scheduled Barça match in the local season data."
        />
      </StateWrapper>
    );
  }

  const kickoff =
    new Date(
      match.kickoff,
    );

  return (
    <StateWrapper>
      <MatchupHero
        homeTeam={
          match.homeTeam
        }
        awayTeam={
          match.awayTeam
        }
        theme={theme}
      />

      <MatchCountdown
        kickoff={
          match.kickoff
        }
        theme={theme}
      />

      <MatchMeta
        kickoff={kickoff}
        competition={
          match.competition
        }
        matchday={
          match.matchday
        }
        theme={theme}
      />

      <PrimaryButton
        theme={theme}
        href={`/matches/${match.id}`}
      >
        Match Center

        <ArrowRight
          size={16}
        />
      </PrimaryButton>
    </StateWrapper>
  );
}

/*
|--------------------------------------------------------------------------
| MATCHDAY
|--------------------------------------------------------------------------
*/

function MatchdayState({
  theme,
  overview,
}: {
  theme: KitTheme;
  overview: DashboardOverview;
}) {
  const match =
    overview.nextMatch;

  if (!match) {
    return (
      <StateWrapper>
        <EmptyState
          theme={theme}
          title="No match today"
          text="There is no upcoming Barça fixture available."
        />
      </StateWrapper>
    );
  }

  const kickoff =
    new Date(
      match.kickoff,
    );

  return (
    <StateWrapper>
      <StatusLabel
        label="Matchday"
        color={
          theme.colors.accent
        }
        animated
      />

      <MatchupHero
        homeTeam={
          match.homeTeam
        }
        awayTeam={
          match.awayTeam
        }
        theme={theme}
      />

      <MatchCountdown
        kickoff={
          match.kickoff
        }
        theme={theme}
      />

      <MatchMeta
        kickoff={kickoff}
        competition={
          match.competition
        }
        matchday={
          match.matchday
        }
        theme={theme}
      />

      <PrimaryButton
        theme={theme}
        href={`/matches/${match.id}`}
      >
        Match Center

        <ArrowRight
          size={16}
        />
      </PrimaryButton>
    </StateWrapper>
  );
}

/*
|--------------------------------------------------------------------------
| LIVE
|--------------------------------------------------------------------------
*/

function LiveState({
  theme,
  overview,
}: {
  theme: KitTheme;
  overview: DashboardOverview;
}) {
  const match =
    overview.nextMatch;

  if (!match) {
    return (
      <StateWrapper>
        <EmptyState
          theme={theme}
          title="No live fixture"
          text="There is currently no live Barça match in the local data."
        />
      </StateWrapper>
    );
  }

  return (
    <StateWrapper>
      <StatusLabel
        label={
          match.status ===
          "halftime"
            ? "Half Time"
            : "Live"
        }
        color={
          theme.colors.danger
        }
        animated={
          match.status !==
          "halftime"
        }
      />

      <Scoreboard
        homeTeam={
          match.homeTeam
        }
        awayTeam={
          match.awayTeam
        }
        homeScore={
          match.score.home
        }
        awayScore={
          match.score.away
        }
        theme={theme}
      />

      <MatchStatusStrip
        match={match}
        theme={theme}
      />

      <PrimaryButton
        theme={theme}
        href={`/matches/${match.id}`}
      >
        <Play
          size={15}
        />

        Live Match Center
      </PrimaryButton>
    </StateWrapper>
  );
}

/*
|--------------------------------------------------------------------------
| FULL TIME
|--------------------------------------------------------------------------
*/

function FullTimeState({
  theme,
  overview,
}: {
  theme: KitTheme;
  overview: DashboardOverview;
}) {
  const match =
    overview.previousMatch;

  if (!match) {
    return (
      <StateWrapper>
        <EmptyState
          theme={theme}
          title="No completed fixture"
          text="There is currently no completed Barça match in the local data."
        />
      </StateWrapper>
    );
  }

  const kickoff =
    new Date(
      match.kickoff,
    );

  return (
    <StateWrapper>
      <StatusLabel
        label="Full Time"
        color={
          theme.colors.textMuted
        }
      />

      <Scoreboard
        homeTeam={
          match.homeTeam
        }
        awayTeam={
          match.awayTeam
        }
        homeScore={
          match.score.home
        }
        awayScore={
          match.score.away
        }
        theme={theme}
      />

      <MatchMeta
        kickoff={kickoff}
        competition={
          match.competition
        }
        matchday={
          match.matchday
        }
        theme={theme}
      />

      <PrimaryButton
        theme={theme}
        href={`/matches/${match.id}`}
      >
        Match Report

        <ArrowRight
          size={16}
        />
      </PrimaryButton>
    </StateWrapper>
  );
}

/*
|--------------------------------------------------------------------------
| LOCATION
|--------------------------------------------------------------------------
|
| We only display a venue when it looks like genuine venue data.
|
| Values such as:
|
| Venue TBC
| TBC
| TBD
| Unknown
|
| are treated as missing.
|
| If venue data is missing:
|
| Barça at home → Home fixture
| Barça away    → Away fixture
|--------------------------------------------------------------------------
*/

function MatchLocation({
  match,
  theme,
}: {
  match: AnyOverviewMatch;
  theme: KitTheme;
}) {
  const venue =
    normalizeVenue(
      match.venue,
    );

  if (venue) {
    return (
      <div
        className="flex shrink-0 items-center gap-2 text-xs"
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        <MapPin
          size={14}
        />

        <span>
          {venue}
        </span>
      </div>
    );
  }

if (match.barcaAtHome) {
  return (
    <div
      className="flex shrink-0 items-center gap-2 text-xs"
      style={{
        color:
          theme.colors.textMuted,
      }}
    >
      <MapPin
        size={14}
      />

      <span>
        Spotify Camp Nou
      </span>
    </div>
  );
}

return (
  <div
    className="flex shrink-0 items-center gap-2 text-xs"
    style={{
      color:
        theme.colors.textMuted,
    }}
  >
    <Plane
      size={14}
    />

    <span>
      Away fixture
    </span>
  </div>
);
}

function normalizeVenue(
  value:
    string | null,
) {
  if (!value) {
    return null;
  }

  const venue =
    value.trim();

  if (!venue) {
    return null;
  }

  const normalized =
    venue.toLowerCase();

  const placeholderValues =
    new Set([
      "venue tbc",
      "venue tbd",
      "tbc",
      "tbd",
      "unknown",
      "unknown venue",
      "n/a",
      "na",
      "-",
      "null",
      "undefined",
    ]);

  if (
    placeholderValues.has(
      normalized,
    )
  ) {
    return null;
  }

  return venue;
}

/*
|--------------------------------------------------------------------------
| MATCHUP HERO
|--------------------------------------------------------------------------
*/

function MatchupHero({
  homeTeam,
  awayTeam,
  theme,
}: {
  homeTeam: OverviewTeam;
  awayTeam: OverviewTeam;
  theme: KitTheme;
}) {
  return (
    <div className="relative w-full max-w-3xl">
      <div
        className="pointer-events-none absolute bottom-3 left-1/2 top-3 w-px"
        style={{
          backgroundColor:
            theme.colors.border,
        }}
      />

      <div className="relative grid grid-cols-[1fr_54px_1fr] items-center gap-2 sm:grid-cols-[1fr_72px_1fr] sm:gap-4 lg:grid-cols-[1fr_90px_1fr] lg:gap-5">
        <TeamHero
          team={homeTeam}
          align="right"
          theme={theme}
        />

        <div className="flex flex-col items-center">
          <span
            className="text-[9px] font-semibold uppercase tracking-[0.4em]"
            style={{
              color:
                theme.colors.textMuted,
            }}
          >
            VS
          </span>

          <div
            className="mt-3 h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor:
                theme.colors.accent,
            }}
          />
        </div>

        <TeamHero
          team={awayTeam}
          align="left"
          theme={theme}
        />
      </div>
    </div>
  );
}

function TeamHero({
  team,
  align,
  theme,
}: {
  team: OverviewTeam;

  align:
    | "left"
    | "right";

  theme: KitTheme;
}) {
  const isBarcelona =
    team.code === "FCB";

  return (
    <div
      className={`flex flex-col ${
        align === "right"
          ? "items-end text-right"
          : "items-start text-left"
      }`}
    >
      <motion.div
        whileHover={{
          y: -3,
        }}
        transition={{
          duration: 0.18,
        }}
        className="relative flex h-20 w-20 items-center justify-center sm:h-24 sm:w-24 lg:h-28 lg:w-28"
      >
        {isBarcelona ? (
          <div
            className="absolute inset-x-4 bottom-0 h-0.5"
            style={{
              backgroundColor:
                theme.colors.primary,
            }}
          />
        ) : null}

        {team.crestUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}

            <img
              src={
                team.crestUrl
              }
              alt={
                team.name
              }
              className={
                isBarcelona
                  ? "max-h-[68px] max-w-[68px] object-contain sm:max-h-[80px] sm:max-w-[80px] lg:max-h-[92px] lg:max-w-[92px]"
                  : "max-h-[60px] max-w-[60px] object-contain sm:max-h-[72px] sm:max-w-[72px] lg:max-h-[82px] lg:max-w-[82px]"
              }
            />
          </>
        ) : (
          <span className="text-lg font-bold">
            {team.code}
          </span>
        )}
      </motion.div>

      <p
        className={`mt-3 font-medium tracking-[-0.025em] ${
          isBarcelona
            ? "text-base sm:text-xl lg:text-[22px]"
            : "text-base sm:text-lg lg:text-xl"
        }`}
      >
        {team.shortName ??
          team.name}
      </p>

      <p
        className="mt-1 text-[9px] uppercase tracking-[0.18em]"
        style={{
          color:
            isBarcelona
              ? theme.colors.accent
              : theme.colors.textMuted,
        }}
      >
        {isBarcelona
          ? "FC Barcelona"
          : team.code}
      </p>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| SCOREBOARD
|--------------------------------------------------------------------------
*/

function Scoreboard({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  theme,
}: {
  homeTeam: OverviewTeam;
  awayTeam: OverviewTeam;

  homeScore:
    number | null;

  awayScore:
    number | null;

  theme: KitTheme;
}) {
  return (
    <div className="grid w-full max-w-3xl grid-cols-[1fr_48px_1fr] items-end sm:grid-cols-[1fr_72px_1fr]">
      <ScoreTeam
        team={homeTeam}
        score={homeScore}
        align="right"
        theme={theme}
      />

      <div
        className="pb-6 text-center text-xl"
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        —
      </div>

      <ScoreTeam
        team={awayTeam}
        score={awayScore}
        align="left"
        theme={theme}
      />
    </div>
  );
}

function ScoreTeam({
  team,
  score,
  align,
  theme,
}: {
  team: OverviewTeam;

  score:
    number | null;

  align:
    | "left"
    | "right";

  theme: KitTheme;
}) {
  const isBarcelona =
    team.code === "FCB";

  return (
    <div
      className={
        align === "right"
          ? "text-right"
          : "text-left"
      }
    >
      <div
        className={`mb-3 flex ${
          align === "right"
            ? "justify-end"
            : "justify-start"
        }`}
      >
        {team.crestUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}

            <img
              src={
                team.crestUrl
              }
              alt={
                team.name
              }
              className={
                isBarcelona
                  ? "h-14 w-14 object-contain sm:h-16 sm:w-16"
                  : "h-12 w-12 object-contain sm:h-14 sm:w-14"
              }
            />
          </>
        ) : null}
      </div>

      <p
        className="text-xs uppercase tracking-[0.12em] sm:text-sm"
        style={{
          color:
            isBarcelona
              ? theme.colors.text
              : theme.colors.textMuted,
        }}
      >
        {team.shortName ??
          team.name}
      </p>

      <p className="mt-1 text-5xl font-medium tabular-nums tracking-[-0.05em] sm:text-7xl">
        {score ?? "—"}
      </p>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| COUNTDOWN
|--------------------------------------------------------------------------
*/

function MatchCountdown({
  kickoff,
  theme,
}: {
  kickoff: string;
  theme: KitTheme;
}) {
  const [
    remaining,
    setRemaining,
  ] =
    useState<number | null>(
      null,
    );

  useEffect(() => {
    const kickoffTime =
      new Date(
        kickoff,
      ).getTime();

    function update() {
      const difference =
        kickoffTime -
        Date.now();

      setRemaining(
        Math.max(
          0,
          difference,
        ),
      );
    }

    update();

    const interval =
      window.setInterval(
        update,
        1000,
      );

    return () => {
      window.clearInterval(
        interval,
      );
    };
  }, [
    kickoff,
  ]);

  if (
    remaining === null
  ) {
    return (
      <div className="mt-6 flex items-center justify-center gap-4 sm:gap-5">
        <CountdownUnit
          value="--"
          label="Days"
        />

        <CountdownDivider
          theme={theme}
        />

        <CountdownUnit
          value="--"
          label="Hours"
        />

        <CountdownDivider
          theme={theme}
        />

        <CountdownUnit
          value="--"
          label="Min"
        />
      </div>
    );
  }

  if (
    remaining <= 0
  ) {
    return (
      <div
        className="mt-6 border-y px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.25em]"
        style={{
          borderColor:
            theme.colors.border,

          color:
            theme.colors.accent,
        }}
      >
        Kickoff
      </div>
    );
  }

  const totalSeconds =
    Math.floor(
      remaining / 1000,
    );

  const days =
    Math.floor(
      totalSeconds /
        86_400,
    );

  const hours =
    Math.floor(
      (totalSeconds %
        86_400) /
        3_600,
    );

  const minutes =
    Math.floor(
      (totalSeconds %
        3_600) /
        60,
    );

  const seconds =
    totalSeconds % 60;

  const closeToKickoff =
    days === 0;

  return (
    <div className="mt-6">
      <p
        className="mb-3 text-center text-[8px] uppercase tracking-[0.24em]"
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        Kickoff in
      </p>

      <div className="flex items-center justify-center gap-4 sm:gap-5">
        {closeToKickoff ? (
          <>
            <CountdownUnit
              value={pad(
                hours,
              )}
              label="Hours"
            />

            <CountdownDivider
              theme={theme}
            />

            <CountdownUnit
              value={pad(
                minutes,
              )}
              label="Min"
            />

            <CountdownDivider
              theme={theme}
            />

            <CountdownUnit
              value={pad(
                seconds,
              )}
              label="Sec"
            />
          </>
        ) : (
          <>
            <CountdownUnit
              value={pad(
                days,
              )}
              label="Days"
            />

            <CountdownDivider
              theme={theme}
            />

            <CountdownUnit
              value={pad(
                hours,
              )}
              label="Hours"
            />

            <CountdownDivider
              theme={theme}
            />

            <CountdownUnit
              value={pad(
                minutes,
              )}
              label="Min"
            />
          </>
        )}
      </div>
    </div>
  );
}

function CountdownUnit({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="min-w-[48px] text-center sm:min-w-[54px]">
      <p className="text-xl font-medium tabular-nums tracking-[-0.03em]">
        {value}
      </p>

      <p className="mt-1 text-[8px] uppercase tracking-[0.17em] opacity-45">
        {label}
      </p>
    </div>
  );
}

function CountdownDivider({
  theme,
}: {
  theme: KitTheme;
}) {
  return (
    <div
      className="h-6 w-px"
      style={{
        backgroundColor:
          theme.colors.border,
      }}
    />
  );
}

/*
|--------------------------------------------------------------------------
| MATCH META
|--------------------------------------------------------------------------
*/

function MatchMeta({
  kickoff,
  competition,
  matchday,
  theme,
}: {
  kickoff: Date;

  competition:
    OverviewMatch["competition"];

  matchday:
    number | null;

  theme: KitTheme;
}) {
  return (
    <div
      className="mt-6 grid w-full max-w-xl grid-cols-[1fr_auto_1fr] items-center border-y"
      style={{
        borderColor:
          theme.colors.border,
      }}
    >
      <div className="px-3 py-4 text-right sm:px-5">
        <div
          className="flex items-center justify-end gap-2 text-[9px] uppercase tracking-[0.18em]"
          style={{
            color:
              theme.colors.textMuted,
          }}
        >
          <CalendarDays
            size={13}
          />

          Date
        </div>

        <p className="mt-1 text-sm font-medium">
          {kickoff.toLocaleDateString(
            "en-GB",
            {
              weekday:
                "short",

              day:
                "2-digit",

              month:
                "short",
            },
          )}
        </p>
      </div>

      <div
        className="h-10 w-px"
        style={{
          backgroundColor:
            theme.colors.border,
        }}
      />

      <div className="px-3 py-4 text-left sm:px-5">
        <p
          className="text-[9px] uppercase tracking-[0.18em]"
          style={{
            color:
              theme.colors.textMuted,
          }}
        >
          Kickoff
        </p>

        <p className="mt-1 text-sm font-medium tabular-nums">
          {formatTime(
            kickoff,
          )}
        </p>
      </div>

      <div
        className="col-span-3 border-t px-5 py-3 text-center text-[10px] uppercase tracking-[0.16em]"
        style={{
          borderColor:
            theme.colors.border,

          color:
            theme.colors.textMuted,
        }}
      >
        {competition.shortName ??
          competition.name}

        {matchday
          ? ` • Matchday ${matchday}`
          : ""}
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| LIVE STATUS
|--------------------------------------------------------------------------
*/

function MatchStatusStrip({
  match,
  theme,
}: {
  match: OverviewMatch;
  theme: KitTheme;
}) {
  return (
    <div
      className="mt-7 grid w-full max-w-xl grid-cols-2 border-y"
      style={{
        borderColor:
          theme.colors.border,
      }}
    >
      <div
        className="border-r px-4 py-4"
        style={{
          borderColor:
            theme.colors.border,
        }}
      >
        <p
          className="text-[9px] uppercase tracking-[0.17em]"
          style={{
            color:
              theme.colors.textMuted,
          }}
        >
          Competition
        </p>

        <p className="mt-2 text-sm font-medium">
          {match.competition
            .shortName ??
            match.competition
              .name}
        </p>
      </div>

      <div className="px-4 py-4">
        <p
          className="text-[9px] uppercase tracking-[0.17em]"
          style={{
            color:
              theme.colors.textMuted,
          }}
        >
          Matchday
        </p>

        <p className="mt-2 text-sm font-medium">
          {match.matchday
            ? String(
                match.matchday,
              )
            : "—"}
        </p>
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| STATUS LABEL
|--------------------------------------------------------------------------
*/

function StatusLabel({
  label,
  color,
  animated = false,
}: {
  label: string;
  color: string;
  animated?: boolean;
}) {
  return (
    <div
      className="mb-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.24em]"
      style={{
        color,
      }}
    >
      <motion.span
        className="h-1.5 w-1.5 rounded-full"
        style={{
          backgroundColor:
            color,
        }}
        animate={
          animated
            ? {
                opacity: [
                  1,
                  0.3,
                  1,
                ],
              }
            : undefined
        }
        transition={
          animated
            ? {
                duration: 1.4,
                repeat:
                  Infinity,
              }
            : undefined
        }
      />

      {label}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| BACKGROUND ARCHITECTURE
|--------------------------------------------------------------------------
*/

function StageArchitecture({
  theme,
}: {
  theme: KitTheme;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute left-1/2 top-0 h-full w-px opacity-60"
        style={{
          backgroundColor:
            theme.colors.border,
        }}
      />

      <div
        className="absolute left-[22%] top-[38%] h-[46%] w-px opacity-30"
        style={{
          backgroundColor:
            theme.colors.pitchLine,
        }}
      />

      <div
        className="absolute right-[22%] top-[38%] h-[46%] w-px opacity-30"
        style={{
          backgroundColor:
            theme.colors.pitchLine,
        }}
      />

      <div
        className="absolute left-1/2 top-[58%] h-[350px] w-[740px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border opacity-[0.13]"
        style={{
          borderColor:
            theme.colors.pitchLine,
        }}
      />

      <div
        className="absolute left-1/2 top-[58%] h-[265px] w-[575px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border opacity-[0.1]"
        style={{
          borderColor:
            theme.colors.pitchLine,
        }}
      />

      <div
        className="absolute left-1/2 top-[59%] h-[135px] w-[135px] -translate-x-1/2 -translate-y-1/2 rounded-full border opacity-[0.12]"
        style={{
          borderColor:
            theme.colors.pitchLine,
        }}
      />

      <div
        className="absolute left-1/2 top-[59%] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30"
        style={{
          backgroundColor:
            theme.colors.pitchLine,
        }}
      />

      <div
        className="absolute left-[12%] right-[12%] top-[59%] h-px opacity-[0.11]"
        style={{
          backgroundColor:
            theme.colors.pitchLine,
        }}
      />
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| SHARED
|--------------------------------------------------------------------------
*/

function StateWrapper({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 8,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      exit={{
        opacity: 0,
        y: -6,
      }}
      transition={{
        duration: 0.26,
        ease: "easeOut",
      }}
      className="flex w-full flex-col items-center text-center"
    >
      {children}
    </motion.div>
  );
}

function PrimaryButton({
  children,
  theme,
  href,
}: {
  children: ReactNode;
  theme: KitTheme;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="mt-7 flex items-center gap-3 border px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] transition-transform hover:translate-x-1"
      style={{
        backgroundColor:
          theme.colors.primary,

        borderColor:
          theme.colors.primary,

        color:
          theme.colors.text,
      }}
    >
      {children}
    </Link>
  );
}

function EmptyState({
  title,
  text,
  theme,
}: {
  title: string;
  text: string;
  theme: KitTheme;
}) {
  return (
    <div className="max-w-md py-12">
      <p
        className="text-[10px] uppercase tracking-[0.22em]"
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        Match Stage
      </p>

      <h3 className="mt-3 text-xl font-medium">
        {title}
      </h3>

      <p
        className="mt-3 text-sm leading-6"
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        {text}
      </p>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function formatTime(
  value: Date,
) {
  return value.toLocaleTimeString(
    "en-US",
    {
      hour:
        "numeric",

      minute:
        "2-digit",

      hour12:
        true,
    },
  );
}

function pad(
  value: number,
) {
  return String(
    value,
  ).padStart(
    2,
    "0",
  );
}

function getEyebrow(
  state: MatchState,
) {
  switch (state) {
    case "matchday":
      return "Today";

    case "live":
      return "Match In Progress";

    case "fulltime":
      return "Match Complete";

    default:
      return "Next Match";
  }
}

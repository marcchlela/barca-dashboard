"use client";

import Link from "next/link";

import {
  useEffect,
  useState,
} from "react";

import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  MapPin,
  Trophy,
} from "lucide-react";

import FormationPitch from "./FormationPitch";
import MatchCenterTabs from "./MatchCenterTabs";
import MatchNavigation from "./MatchNavigation";
import MatchTimeline from "./MatchTimeline";
import MyMatchDiary from "./MyMatchDiary";
import MatchMedia from "./MatchMedia";

import type {
  MatchMediaItem,
} from "../../lib/matches/get-match-media";

import {
  usePlayerPerformance,
} from "./PlayerPerformanceContext";

import StadiumRail from "../shell/StadiumRail";

import ThemeScrollbarSync from "../theme/ThemeScrollbarSync";

import type {
  MatchCenterData,
} from "../../lib/matches/get-match-center";

import type {
  MatchNavigation as MatchNavigationData,
} from "../../lib/matches/get-match-navigation";

import {
  getTheme,
  isKitType,
  type KitType,
  type KitTheme,
} from "../../lib/themes";

type MatchCenterClientProps = {
  data:
    MatchCenterData;

  navigation:
    MatchNavigationData;

  media:
    MatchMediaItem[];
};

const KIT_STORAGE_KEY =
  "barca-dashboard-kit";

export default function MatchCenterClient({
  data,
  navigation,
  media,
}: MatchCenterClientProps) {
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

  useEffect(() => {
    const frame =
      window.requestAnimationFrame(
        () => {
          const saved =
            window.localStorage.getItem(
              KIT_STORAGE_KEY,
            );

          if (
            isKitType(
              saved,
            )
          ) {
            setKit(
              saved,
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

  const [
    lineupSide,
    setLineupSide,
  ] =
    useState<
      "home" | "away"
    >(
      () =>
        data.match
          .barcelona
          .side ===
        "away"
          ? "away"
          : "home",
    );

  const theme =
    getTheme(
      data.match
        .season.label,
      kit,
    );

  const activeLineup =
    data.lineups[
      lineupSide
    ];

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
          theme.colors
            .background,

        color:
          theme.colors.text,
      }}
    >
      <ThemeScrollbarSync
        theme={theme}
      />

      <Environment
        theme={theme}
      />

      <div className="relative mx-auto max-w-[1700px]">
        <header
          className="
            mb-5
            flex
            flex-col
            gap-4
            px-1
            sm:flex-row
            sm:items-end
            sm:justify-between
          "
        >
          <div>
            <Link
              href="/matches"
              className="
                inline-flex
                items-center
                gap-2
                text-[10px]
                uppercase
                tracking-[0.2em]
              "
              style={{
                color:
                  theme.colors
                    .textMuted,
              }}
            >
              <ArrowLeft
                size={13}
              />

              Matches
            </Link>

            <p
              className="
                mt-5
                text-[10px]
                uppercase
                tracking-[0.3em]
              "
              style={{
                color:
                  theme.colors
                    .textMuted,
              }}
            >
              FC Barcelona
            </p>

            <h1
              className="
                mt-2
                text-2xl
                font-medium
                tracking-[-0.04em]
                sm:text-3xl
              "
            >
              Match Center
            </h1>
          </div>

          <KitSelector
            kit={kit}
            setKit={
              setKit
            }
            theme={theme}
          />
        </header>

        <div className="mb-5 lg:hidden">
          <StadiumRail
            theme={theme}
            variant="compact"
          />
        </div>

        <div
          className="
            grid
            grid-cols-1
            gap-x-5
            gap-y-6
            lg:grid-cols-[150px_minmax(0,1fr)]
            xl:grid-cols-[160px_minmax(0,1fr)]
          "
        >
          <div className="hidden lg:block">
            <StadiumRail
              theme={theme}
              variant="desktop"
            />
          </div>

          <div className="min-w-0">
            <div
              id="overview"
              className="scroll-mt-24"
            >
              <ScoreHero
                data={data}
                theme={theme}
              />

              <MatchNavigation
                navigation={
                  navigation
                }
                theme={theme}
              />
            </div>

            <MatchCenterTabs
              theme={theme}
            />

            <div
              id="lineups"
              className="
                scroll-mt-24
                mt-6
                grid
                items-start
                gap-6
                xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]
              "
            >
              <section
                className="border"
                style={{
                  borderColor:
                    theme.colors
                      .border,

                  backgroundColor:
                    theme.colors
                      .surface,
                }}
              >
                <SectionHeader
                  eyebrow="Tactical View"
                  title="Starting XI"
                  right={
                    activeLineup
                      ?.formation ??
                    "—"
                  }
                  theme={theme}
                />

                <div className="flex border-b">
                  {(
                    [
                      "home",
                      "away",
                    ] as const
                  ).map(
                    (
                      side,
                    ) => {
                      const team =
                        side ===
                        "home"
                          ? data
                              .match
                              .homeTeam
                          : data
                              .match
                              .awayTeam;

                      const active =
                        lineupSide ===
                        side;

                      return (
                        <button
                          key={side}
                          type="button"
                          onClick={() =>
                            setLineupSide(
                              side,
                            )
                          }
                          className="
                            relative
                            flex-1
                            px-4
                            py-3
                            text-[10px]
                            uppercase
                            tracking-[0.16em]
                          "
                          style={{
                            color:
                              active
                                ? theme
                                    .colors
                                    .text
                                : theme
                                    .colors
                                    .textMuted,

                            borderColor:
                              theme
                                .colors
                                .border,
                          }}
                        >
                          {
                            team.shortName ??
                            team.name
                          }

                          {active ? (
                            <span
                              className="
                                absolute
                                bottom-0
                                left-4
                                right-4
                                h-0.5
                              "
                              style={{
                                backgroundColor:
                                  theme
                                    .colors
                                    .accent,
                              }}
                            />
                          ) : null}
                        </button>
                      );
                    },
                  )}
                </div>

                <div className="p-4 sm:p-5">
                  <FormationPitch
                    lineup={
                      activeLineup
                    }
                    theme={theme}
                  />
                </div>
              </section>

              <section
                className="self-start border"
                style={{
                  borderColor:
                    theme.colors
                      .border,

                  backgroundColor:
                    theme.colors
                      .surface,
                }}
              >
                <SectionHeader
                  eyebrow="Match Flow"
                  title="Match Timeline"
                  right={`${data.events.length} events`}
                  theme={theme}
                />

                <MatchTimeline
                  data={data}
                  theme={theme}
                  media={media}
                />
              </section>
            </div>

            <section
              id="stats"
              className="
                scroll-mt-24
                mt-6
                border
              "
              style={{
                borderColor:
                  theme.colors
                    .border,

                backgroundColor:
                  theme.colors
                    .surface,
              }}
            >
              <SectionHeader
                eyebrow="Match Data"
                title="Team Comparison"
                right={
                  data.coverage
                    .teamStatistics
                    .complete
                    ? "Complete"
                    : "Partial"
                }
                theme={theme}
              />

              <TeamComparison
                data={data}
                theme={theme}
              />
            </section>

            <section
              id="players"
              className="
                scroll-mt-24
                mt-6
                border
              "
              style={{
                borderColor:
                  theme.colors
                    .border,

                backgroundColor:
                  theme.colors
                    .surface,
              }}
            >
              <SectionHeader
                eyebrow="Barcelona"
                title="Player Performances"
                right={`${data.performances.barcelona.length} players`}
                theme={theme}
              />

              <PlayerPerformances
                data={data}
                theme={theme}
              />
              </section>

              <MatchMedia
                items={media}
                theme={theme}
              />

              <MyMatchDiary
                key={
                  data.match.id
                }
                data={data}
                theme={theme}
              />
          </div>
        </div>
      </div>
    </main>
  );
}

function Environment({
  theme,
}: {
  theme:
    KitTheme;
}) {
  return (
    <>
      <div
        className="
          pointer-events-none
          fixed
          inset-0
        "
        style={{
          background:
            `linear-gradient(
              90deg,
              ${theme.colors.background} 0%,
              ${theme.colors.backgroundElevated} 52%,
              ${theme.colors.background} 100%
            )`,
        }}
      />

      <div
        className="
          pointer-events-none
          fixed
          inset-0
          opacity-[0.03]
        "
        style={{
          backgroundImage:
            `
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

      <div
        className="
          pointer-events-none
          fixed
          left-0
          top-0
          h-full
          w-1.25
        "
      >
        <div
          className="h-1/2"
          style={{
            backgroundColor:
              theme.colors
                .primary,
          }}
        />

        <div
          className="h-1/2"
          style={{
            backgroundColor:
              theme.colors
                .secondary,
          }}
        />
      </div>
    </>
  );
}

function ScoreHero({
  data,
  theme,
}: {
  data:
    MatchCenterData;

  theme:
    KitTheme;
}) {
  const kickoff =
    new Date(
      data.match
        .kickoff,
    );

  const finished =
    data.match.status ===
    "finished";

  return (
    <section
      className="
        relative
        overflow-hidden
        border
      "
      style={{
        borderColor:
          theme.colors.border,

        backgroundColor:
          theme.colors.surface,
      }}
    >
      <div
        className="
          absolute
          left-0
          top-0
          h-0.75
          w-full
        "
        style={{
          background:
            `linear-gradient(
              90deg,
              ${theme.colors.primary},
              ${theme.colors.accent},
              ${theme.colors.secondary}
            )`,
        }}
      />

      <div
        className="
          flex
          flex-col
          gap-4
          border-b
          px-5
          py-4
          sm:flex-row
          sm:items-center
          sm:justify-between
          sm:px-7
        "
        style={{
          borderColor:
            theme.colors.border,
        }}
      >
        <div className="flex items-center gap-3">
          {data.match
            .competition
            .logoUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  data.match
                    .competition
                    .logoUrl
                }
                alt=""
                className="
                  h-5
                  w-5
                  object-contain
                "
              />
            </>
          ) : (
            <Trophy
              size={15}
              style={{
                color:
                  theme.colors
                    .accent,
              }}
            />
          )}

          <div>
            <p className="text-xs font-medium">
              {data.match
                .competition
                .shortName ??
                data.match
                  .competition
                  .name}
            </p>

            <p
              className="
                mt-1
                text-[9px]
                uppercase
                tracking-[0.18em]
              "
              style={{
                color:
                  theme.colors
                    .textMuted,
              }}
            >
              {competitionContext(
                data,
              )}
            </p>
          </div>
        </div>

        <div
          className="
            text-[9px]
            uppercase
            tracking-[0.2em]
          "
          style={{
            color:
              theme.colors
                .textMuted,
          }}
        >
          {statusLabel(
            data.match.status,
          )}
        </div>
      </div>

      <div
        className="
          grid
          grid-cols-[1fr_auto_1fr]
          items-center
          gap-3
          px-4
          py-10
          sm:gap-8
          sm:px-8
          sm:py-14
        "
      >
        <HeroTeam
          team={
            data.match
              .homeTeam
          }
          align="right"
          theme={theme}
        />

        <div
          className="
            min-w-23.75
            text-center
            sm:min-w-37.5
          "
        >
          {finished ? (
            <>
              <div
                className="
                  font-mono
                  text-4xl
                  font-medium
                  tracking-[-0.07em]
                  tabular-nums
                  sm:text-6xl
                "
              >
                {
                  data.match
                    .score
                    .home
                }

                <span
                  className="mx-2"
                  style={{
                    color:
                      theme.colors
                        .textMuted,
                  }}
                >
                  –
                </span>

                {
                  data.match
                    .score
                    .away
                }
              </div>

              <p
                className="
                  mt-3
                  text-[9px]
                  uppercase
                  tracking-[0.25em]
                "
                style={{
                  color:
                    theme.colors
                      .textMuted,
                }}
              >
                Full Time
              </p>
            </>
          ) : (
            <p
              className="
                text-xs
                uppercase
                tracking-[0.3em]
              "
              style={{
                color:
                  theme.colors
                    .textMuted,
              }}
            >
              VS
            </p>
          )}
        </div>

        <HeroTeam
          team={
            data.match
              .awayTeam
          }
          align="left"
          theme={theme}
        />
      </div>

      <div
        className="
          grid
          gap-0
          border-t
          sm:grid-cols-3
        "
        style={{
          borderColor:
            theme.colors.border,
        }}
      >
        <MetaItem
          icon={
            CalendarDays
          }
          label="Date"
          value={
            kickoff.toLocaleDateString(
              "en-GB",
              {
                day:
                  "numeric",

                month:
                  "short",

                year:
                  "numeric",
              },
            )
          }
          theme={theme}
        />

        <MetaItem
          icon={Clock3}
          label="Kickoff"
          value={
            kickoff.toLocaleTimeString(
              "en-US",
              {
                hour:
                  "numeric",

                minute:
                  "2-digit",

                hour12:
                  true,
              },
            )
          }
          theme={theme}
        />

        <MetaItem
          icon={MapPin}
          label="Venue"
          value={
            data.match
              .venue ??
            (
              data.match
                .homeTeam
                .isBarcelona
                ? "Home fixture"
                : "Away fixture"
            )
          }
          theme={theme}
        />
      </div>
    </section>
  );
}

function HeroTeam({
  team,
  align,
  theme,
}: {
  team:
    MatchCenterData[
      "match"
    ]["homeTeam"];

  align:
    "left" | "right";

  theme:
    KitTheme;
}) {
  return (
    <div
      className={
        align ===
        "right"
          ? "flex min-w-0 flex-col items-end text-right"
          : "flex min-w-0 flex-col items-start text-left"
      }
    >
      <div
        className="
          flex
          h-16
          w-16
          items-center
          justify-center
          sm:h-24
          sm:w-24
        "
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
              className="
                max-h-full
                max-w-full
                object-contain
              "
            />
          </>
        ) : (
          <div
            className="
              h-12
              w-12
              border
            "
            style={{
              borderColor:
                theme.colors
                  .border,
            }}
          />
        )}
      </div>

      <p
        className="
          mt-4
          max-w-47.5
          truncate
          text-base
          font-medium
          sm:text-xl
        "
      >
        {team.shortName ??
          team.name}
      </p>

      <p
        className="
          mt-1
          text-[9px]
          uppercase
          tracking-[0.16em]
        "
        style={{
          color:
            team.isBarcelona
              ? theme.colors
                  .accent
              : theme.colors
                  .textMuted,
        }}
      >
        {team.isBarcelona
          ? "FC Barcelona"
          : team.code}
      </p>
    </div>
  );
}

function MetaItem({
  icon: Icon,
  label,
  value,
  theme,
}: {
  icon:
    typeof CalendarDays;

  label:
    string;

  value:
    string;

  theme:
    KitTheme;
}) {
  return (
    <div
      className="
        flex
        items-center
        gap-3
        border-b
        px-5
        py-4
        last:border-b-0
        sm:border-b-0
        sm:border-r
        sm:last:border-r-0
      "
      style={{
        borderColor:
          theme.colors.border,
      }}
    >
      <Icon
        size={15}
        style={{
          color:
            theme.colors
              .accent,
        }}
      />

      <div>
        <p
          className="
            text-[8px]
            uppercase
            tracking-[0.2em]
          "
          style={{
            color:
              theme.colors
                .textMuted,
          }}
        >
          {label}
        </p>

        <p className="mt-1 text-xs">
          {value}
        </p>
      </div>
    </div>
  );
}

function TeamComparison({
  data,
  theme,
}: {
  data:
    MatchCenterData;

  theme:
    KitTheme;
}) {
  const home =
    data.teamStatistics
      .home?.statistics;

  const away =
    data.teamStatistics
      .away?.statistics;

  if (
    !home ||
    !away
  ) {
    return (
      <p
        className="p-6 text-xs"
        style={{
          color:
            theme.colors
              .textMuted,
        }}
      >
        Team statistics are not available for this match.
      </p>
    );
  }

  const metrics = [
    {
      label:
        "Possession",

      home:
        home.possession,

      away:
        away.possession,

      percent:
        true,
    },

    {
      label:
        "Shots",

      home:
        home.shooting
          .shots,

      away:
        away.shooting
          .shots,
    },

    {
      label:
        "On target",

      home:
        home.shooting
          .onTarget,

      away:
        away.shooting
          .onTarget,
    },

    {
      label:
        "Passes",

      home:
        home.passing
          .passes,

      away:
        away.passing
          .passes,
    },

    {
      label:
        "Pass accuracy",

      home:
        home.passing
          .accuracy,

      away:
        away.passing
          .accuracy,

      percent:
        true,
    },

    {
      label:
        "Corners",

      home:
        home.corners,

      away:
        away.corners,
    },

    {
      label:
        "Fouls",

      home:
        home.fouls,

      away:
        away.fouls,
    },

    {
      label:
        "Saves",

      home:
        home.saves,

      away:
        away.saves,
    },
  ];

  return (
    <div className="px-5 py-6 sm:px-7">
      <div
        className="
          mb-7
          grid
          grid-cols-[64px_minmax(0,1fr)_64px]
          items-center
          gap-5
          text-[9px]
          uppercase
          tracking-[0.16em]
        "
        style={{
          color:
            theme.colors
              .textMuted,
        }}
      >
        <span>
          {data.match
            .homeTeam
            .shortName ??
            data.match
              .homeTeam
              .name}
        </span>

        <span className="text-center">
          Metric
        </span>

        <span className="text-right">
          {data.match
            .awayTeam
            .shortName ??
            data.match
              .awayTeam
              .name}
        </span>
      </div>

      <div className="space-y-6">
        {metrics.map(
          (
            metric,
          ) => (
            <ComparisonRow
              key={
                metric.label
              }
              label={
                metric.label
              }
              home={
                metric.home
              }
              away={
                metric.away
              }
              percent={
                metric.percent ??
                false
              }
              theme={theme}
            />
          ),
        )}
      </div>
    </div>
  );
}

function ComparisonRow({
  label,
  home,
  away,
  percent,
  theme,
}: {
  label:
    string;

  home:
    number | null;

  away:
    number | null;

  percent:
    boolean;

  theme:
    KitTheme;
}) {
  const left =
    home ?? 0;

  const right =
    away ?? 0;

  const total =
    left +
    right;

  const leftShare =
    total > 0
      ? (
          left /
          total
        ) *
        100
      : 50;

  const rightShare =
    100 -
    leftShare;

  return (
    <div
      className="
        grid
        grid-cols-[64px_minmax(0,1fr)_64px]
        items-center
        gap-5
      "
    >
      <span
        className="
          font-mono
          text-sm
          tabular-nums
        "
      >
        {formatStat(
          home,
          percent,
        )}
      </span>

      <div className="min-w-0">
        <p
          className="
            text-center
            text-[9px]
            uppercase
            tracking-[0.16em]
          "
          style={{
            color:
              theme.colors
                .textMuted,
          }}
        >
          {label}
        </p>

        <div
          className="
            mt-2
            grid
            grid-cols-2
            gap-1.5
          "
        >
          <div
            className="
              flex
              h-0.75
              justify-end
              overflow-hidden
            "
          >
            <div
              className="h-full"
              style={{
                width:
                  `${leftShare}%`,

                backgroundColor:
                  theme.colors
                    .primary,
              }}
            />
          </div>

          <div
            className="
              h-0.75
              overflow-hidden
            "
          >
            <div
              className="h-full"
              style={{
                width:
                  `${rightShare}%`,

                backgroundColor:
                  theme.colors
                    .accent,
              }}
            />
          </div>
        </div>
      </div>

      <span
        className="
          text-right
          font-mono
          text-sm
          tabular-nums
        "
      >
        {formatStat(
          away,
          percent,
        )}
      </span>
    </div>
  );
}

function PlayerPerformances({
  data,
  theme,
}: {
  data:
    MatchCenterData;

  theme:
    KitTheme;
}) {
  const {
    openPlayer,
  } =
    usePlayerPerformance();

  return (
    <div
      className="
        overflow-x-auto
        scrollbar-subtle
      "
    >
      <div className="min-w-225">
        <div
          className="
            grid
            grid-cols-[minmax(210px,1fr)_78px_62px_66px_66px_66px_80px_70px]
            border-b
            px-5
            py-3
            text-[8px]
            uppercase
            tracking-[0.16em]
          "
          style={{
            borderColor:
              theme.colors
                .border,

            color:
              theme.colors
                .textMuted,
          }}
        >
          <span>
            Player
          </span>

          <span className="text-right">
            Rating
          </span>

          <span className="text-right">
            Min
          </span>

          <span className="text-right">
            Goals
          </span>

          <span className="text-right">
            Assists
          </span>

          <span className="text-right">
            Shots
          </span>

          <span className="text-right">
            Pass %
          </span>

          <span className="text-right">
            Tackles
          </span>
        </div>

        {data.performances
          .barcelona.map(
            (
              performance,
            ) => (
              <button
                key={
                  performance
                    .player.id
                }
                type="button"
                onClick={() =>
                  openPlayer(
                    performance
                      .player.id,
                  )
                }
                className="
                  grid
                  w-full
                  cursor-pointer
                  grid-cols-[minmax(210px,1fr)_78px_62px_66px_66px_66px_80px_70px]
                  items-center
                  border-b
                  px-5
                  py-3
                  text-left
                  transition-colors
                  last:border-b-0
                  hover:bg-white/2.5
                "
                style={{
                  borderColor:
                    theme.colors
                      .border,
                }}
              >
                <div
                  className="
                    flex
                    min-w-0
                    items-center
                    gap-3
                  "
                >
                  <PlayerPortrait
                    performance={
                      performance
                    }
                    theme={theme}
                  />

                  <div className="min-w-0">
                    <p
                      className="
                        truncate
                        text-xs
                        font-medium
                      "
                    >
                      {
                        performance
                          .player
                          .name
                      }
                    </p>

                    <p
                      className="
                        mt-0.5
                        text-[8px]
                        uppercase
                        tracking-[0.13em]
                      "
                      style={{
                        color:
                          theme.colors
                            .textMuted,
                      }}
                    >
                      {
                        performance
                          .player
                          .primaryPosition
                      }
                    </p>
                  </div>
                </div>

                <RatingCell
                  value={
                    performance
                      .statistics
                      .rating
                  }
                />

                <StatCell
                  value={
                    performance
                      .statistics
                      .minutes
                  }
                  theme={theme}
                />

                <StatCell
                  value={
                    performance
                      .statistics
                      .goals
                  }
                  theme={theme}
                />

                <StatCell
                  value={
                    performance
                      .statistics
                      .assists
                  }
                  theme={theme}
                />

                <StatCell
                  value={
                    performance
                      .statistics
                      .shooting
                      .shots
                  }
                  theme={theme}
                />

                <StatCell
                  value={
                    performance
                      .statistics
                      .passing
                      .accuracy !==
                    null
                      ? Math.round(
                          performance
                            .statistics
                            .passing
                            .accuracy *
                            100,
                        )
                      : null
                  }
                  suffix="%"
                  theme={theme}
                />

                <StatCell
                  value={
                    performance
                      .statistics
                      .defending
                      .tackles
                  }
                  theme={theme}
                />
              </button>
            ),
          )}
      </div>
    </div>
  );
}

function PlayerPortrait({
  performance,
  theme,
}: {
  performance:
    MatchCenterData[
      "performances"
    ]["barcelona"][number];

  theme:
    KitTheme;
}) {
  if (
    performance.player
      .portraitUrl
  ) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={
            performance
              .player
              .portraitUrl
          }
          alt=""
          className="
            h-9
            w-9
            shrink-0
            object-cover
          "
        />
      </>
    );
  }

  return (
    <div
      className="
        flex
        h-9
        w-9
        shrink-0
        items-center
        justify-center
        border
        text-[9px]
      "
      style={{
        borderColor:
          theme.colors.border,

        color:
          theme.colors
            .textMuted,
      }}
    >
      {
        performance.player
          .name[0]
      }
    </div>
  );
}

function RatingCell({
  value,
}: {
  value:
    number | null;
}) {
  if (
    value === null
  ) {
    return (
      <span
        className="
          text-right
          font-mono
          text-xs
          text-white/40
        "
      >
        —
      </span>
    );
  }

  const palette =
    ratingPalette(
      value,
    );

  return (
    <div className="flex justify-end">
      <span
        className="
          min-w-12
          border
          px-2
          py-1
          text-center
          font-mono
          text-[11px]
          font-semibold
          tabular-nums
        "
        style={{
          color:
            palette.text,

          borderColor:
            palette.border,

          backgroundColor:
            palette.background,
        }}
      >
        {formatNumber(
          value,
        )}
      </span>
    </div>
  );
}

function StatCell({
  value,
  suffix = "",
  theme,
}: {
  value:
    number | null;

  suffix?:
    string;

  theme:
    KitTheme;
}) {
  return (
    <span
      className="
        text-right
        font-mono
        text-xs
        tabular-nums
      "
      style={{
        color:
          theme.colors.text,
      }}
    >
      {value === null
        ? "—"
        : `${formatNumber(
            value,
          )}${suffix}`}
    </span>
  );
}

function SectionHeader({
  eyebrow,
  title,
  right,
  theme,
}: {
  eyebrow:
    string;

  title:
    string;

  right:
    string;

  theme:
    KitTheme;
}) {
  return (
    <div
      className="
        flex
        items-end
        justify-between
        gap-4
        border-b
        px-5
        py-4
      "
      style={{
        borderColor:
          theme.colors.border,
      }}
    >
      <div>
        <p
          className="
            text-[8px]
            uppercase
            tracking-[0.24em]
          "
          style={{
            color:
              theme.colors
                .textMuted,
          }}
        >
          {eyebrow}
        </p>

        <h2 className="mt-1 text-base font-medium">
          {title}
        </h2>
      </div>

      <span
        className="
          text-[9px]
          uppercase
          tracking-[0.16em]
        "
        style={{
          color:
            theme.colors
              .textMuted,
        }}
      >
        {right}
      </span>
    </div>
  );
}

function KitSelector({
  kit,
  setKit,
  theme,
}: {
  kit:
    KitType;

  setKit:
    (
      kit:
        KitType,
    ) => void;

  theme:
    KitTheme;
}) {
  return (
    <div
      className="flex border"
      style={{
        borderColor:
          theme.colors.border,
      }}
    >
      {(
        [
          "home",
          "away",
          "third",
        ] as KitType[]
      ).map(
        (
          item,
        ) => (
          <button
            key={item}
            type="button"
            onClick={() =>
              setKit(
                item,
              )
            }
            className="
              border-r
              px-3
              py-2
              text-[8px]
              uppercase
              tracking-[0.16em]
              last:border-r-0
            "
            style={{
              borderColor:
                theme.colors
                  .border,

              color:
                kit ===
                item
                  ? theme.colors
                      .accent
                  : theme.colors
                      .textMuted,

              backgroundColor:
                kit ===
                item
                  ? theme.colors
                      .backgroundElevated
                  : "transparent",
            }}
          >
            {item}
          </button>
        ),
      )}
    </div>
  );
}

function competitionContext(
  data:
    MatchCenterData,
) {
  if (
    data.match
      .matchday
  ) {
    return `Matchday ${data.match.matchday}`;
  }

  if (
    data.match.stage
  ) {
    return data.match
      .stage
      .replaceAll(
        "_",
        " ",
      );
  }

  return data.match
    .season.label;
}

function statusLabel(
  status:
    string,
) {
  switch (
    status
  ) {
    case "finished":
      return "Full Time";

    case "live":
      return "Live";

    case "halftime":
      return "Half Time";

    case "scheduled":
      return "Upcoming";

    default:
      return status
        .replaceAll(
          "_",
          " ",
        );
  }
}

function ratingPalette(
  rating:
    number,
) {
  if (
    rating >= 9
  ) {
    return {
      text:
        "#7CE3A8",

      border:
        "rgba(124,227,168,0.35)",

      background:
        "rgba(124,227,168,0.08)",
    };
  }

  if (
    rating >= 8
  ) {
    return {
      text:
        "#A6E7D2",

      border:
        "rgba(166,231,210,0.32)",

      background:
        "rgba(166,231,210,0.07)",
    };
  }

  if (
    rating >= 7
  ) {
    return {
      text:
        "#D9B35A",

      border:
        "rgba(217,179,90,0.34)",

      background:
        "rgba(217,179,90,0.08)",
    };
  }

  if (
    rating >= 6
  ) {
    return {
      text:
        "#E38C5C",

      border:
        "rgba(227,140,92,0.34)",

      background:
        "rgba(227,140,92,0.08)",
    };
  }

  return {
    text:
      "#E96573",

    border:
      "rgba(233,101,115,0.34)",

    background:
      "rgba(233,101,115,0.08)",
  };
}

function formatStat(
  value:
    number | null,

  percent:
    boolean,
) {
  if (
    value === null
  ) {
    return "—";
  }

  if (
    percent
  ) {
    return `${Math.round(
      value *
        100,
    )}%`;
  }

  return formatNumber(
    value,
  );
}

function formatNumber(
  value:
    number,
) {
  if (
    Number.isInteger(
      value,
    )
  ) {
    return String(
      value,
    );
  }

  return value
    .toFixed(2)
    .replace(
      /\.?0+$/,
      "",
    );
}

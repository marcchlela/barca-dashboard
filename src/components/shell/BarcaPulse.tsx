"use client";

import Link from "next/link";

import {
  Activity,
  ArrowRight,
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

type BarcaPulseProps = {
  matchState: MatchState;
  theme: KitTheme;
  overview: DashboardOverview;
};

export default function BarcaPulse({
  matchState,
  theme,
  overview,
}: BarcaPulseProps) {
  return (
    <aside
      className="
        relative

        min-h-[420px]

        border-t
        pt-6

        xl:min-h-[520px]
        xl:border-l
        xl:border-t-0
        xl:pl-6
        xl:pt-0
      "
      style={{
        borderColor:
          theme.colors.border,
      }}
    >
      {/* responsive accent marker */}

      <div
        className="
          absolute
          left-0
          top-0

          h-0.5
          w-16

          xl:h-16
          xl:w-0.5
        "
        style={{
          backgroundColor:
            theme.colors.accent,
        }}
      />

      {/* HEADER */}

      <header className="flex items-start justify-between pb-6">
        <div>
          <p
            className="text-[10px] uppercase tracking-[0.24em]"
            style={{
              color:
                theme.colors.textMuted,
            }}
          >
            Barça Pulse
          </p>

          <h2 className="mt-2 text-2xl font-medium tracking-[-0.025em]">
            {getPulseTitle(
              matchState,
            )}
          </h2>
        </div>

        <Activity
          size={18}
          strokeWidth={1.6}
          style={{
            color:
              theme.colors.accent,
          }}
        />
      </header>

      <div
        className="border-t pt-6"
        style={{
          borderColor:
            theme.colors.border,
        }}
      >
        {matchState ===
          "normal" && (
          <NormalPulse
            theme={theme}
            overview={
              overview
            }
          />
        )}

        {matchState ===
          "matchday" && (
          <MatchdayPulse
            theme={theme}
            overview={
              overview
            }
          />
        )}

        {matchState ===
          "live" && (
          <LivePulse
            theme={theme}
            overview={
              overview
            }
          />
        )}

        {matchState ===
          "fulltime" && (
          <FullTimePulse
            theme={theme}
            overview={
              overview
            }
          />
        )}
      </div>
    </aside>
  );
}

/*
|--------------------------------------------------------------------------
| NORMAL
|--------------------------------------------------------------------------
*/

function NormalPulse({
  theme,
  overview,
}: {
  theme: KitTheme;
  overview: DashboardOverview;
}) {
  const standing =
    overview.standing;

  const previous =
    overview.previousMatch;

  return (
    <div className="space-y-8">
      {/* LEAGUE */}

      <Section title="La Liga">
        <div
          className="grid grid-cols-2 border-y"
          style={{
            borderColor:
              theme.colors.border,
          }}
        >
          <Metric
            label="Position"
            value={
              standing
                ? `${standing.position}${ordinalSuffix(
                    standing.position,
                  )}`
                : "—"
            }
            theme={theme}
          />

          <Metric
            label="Points"
            value={
              standing
                ? String(
                    standing.points,
                  )
                : "—"
            }
            theme={theme}
          />
        </div>
      </Section>

      {/* FORM */}

      <Section title="Recent Form">
        <div className="flex gap-3">
          {overview.recentForm.map(
            (
              result,
              index,
            ) => (
              <div
                key={`${result}-${index}`}
                className="flex h-7 w-7 items-center justify-center text-xs font-semibold"
                style={{
                  color:
                    result === "W"
                      ? theme.colors.success
                      : result === "L"
                        ? theme.colors.danger
                        : theme.colors.textMuted,

                  borderBottom: `2px solid ${
                    result === "W"
                      ? theme.colors.success
                      : result === "L"
                        ? theme.colors.danger
                        : theme.colors.border
                  }`,
                }}
              >
                {result}
              </div>
            ),
          )}
        </div>
      </Section>

      {/* LAST MATCH */}

      <Section title="Last Match">
        {previous ? (
          <Link
            href={`/matches/${previous.id}`}
            className="group block border-y py-3 transition-opacity hover:opacity-80"
            style={{
              borderColor:
                theme.colors.border,
            }}
          >
            <TeamResultRow
              name={
                previous.homeTeam
                  .shortName ??
                previous.homeTeam
                  .name
              }

              crestUrl={
                previous.homeTeam
                  .crestUrl
              }

              score={
                previous.score.home
              }
            />

            <div
              className="my-2 h-px"
              style={{
                backgroundColor:
                  theme.colors.border,
              }}
            />

            <TeamResultRow
              name={
                previous.awayTeam
                  .shortName ??
                previous.awayTeam
                  .name
              }

              crestUrl={
                previous.awayTeam
                  .crestUrl
              }

              score={
                previous.score.away
              }
            />

            <div
              className="mt-3 flex items-center justify-between text-[9px] uppercase tracking-[0.15em]"
              style={{
                color:
                  theme.colors.textMuted,
              }}
            >
              <span>
                {previous.competition
                  .shortName ??
                  previous.competition
                    .name}
              </span>

              <span>
                {formatMatchDate(
                  previous.kickoff,
                )}
              </span>
            </div>
          </Link>
        ) : (
          <EmptyText
            theme={theme}
          >
            No completed match yet.
          </EmptyText>
        )}
      </Section>

      {/* SNAPSHOT */}

      <Section title="Season Snapshot">
        {standing ? (
          <div
            className="grid grid-cols-3 border-y"
            style={{
              borderColor:
                theme.colors.border,
            }}
          >
            <MiniMetric
              label="Played"
              value={String(
                standing.played,
              )}
              theme={theme}
            />

            <MiniMetric
              label="Record"
              value={`${standing.won}–${standing.drawn}–${standing.lost}`}
              theme={theme}
            />

            <MiniMetric
              label="GD"
              value={
                standing.goalDifference >
                0
                  ? `+${standing.goalDifference}`
                  : String(
                      standing.goalDifference,
                    )
              }
              theme={theme}
            />
          </div>
        ) : (
          <EmptyText
            theme={theme}
          >
            League snapshot unavailable.
          </EmptyText>
        )}
      </Section>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| MATCHDAY
|--------------------------------------------------------------------------
*/

function MatchdayPulse({
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
      <EmptyText
        theme={theme}
      >
        No match scheduled.
      </EmptyText>
    );
  }

  const kickoff =
    new Date(
      match.kickoff,
    );

  return (
    <div className="space-y-8">
      <Section title="Tonight">
        <TeamVsRow
          homeTeam={
            match.homeTeam
          }
          awayTeam={
            match.awayTeam
          }
        />

        <div
          className="mt-4 border-y py-4"
          style={{
            borderColor:
              theme.colors.border,
          }}
        >
          <InfoRow
            label="Competition"
            value={
              match.competition
                .shortName ??
              match.competition
                .name
            }
            theme={theme}
          />

          <InfoRow
            label="Kickoff"
            value={
              formatTime(
                kickoff,
              )
            }
            theme={theme}
          />

          <InfoRow
            label="Date"
            value={
              kickoff.toLocaleDateString(
                "en-GB",
                {
                  weekday:
                    "short",

                  day:
                    "2-digit",

                  month:
                    "short",
                },
              )
            }
            theme={theme}
          />
        </div>
      </Section>

      <MatchCenterLink
        id={match.id}
        theme={theme}
        label="Open Pre-Match"
      />
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| LIVE
|--------------------------------------------------------------------------
*/

function LivePulse({
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
      <EmptyText
        theme={theme}
      >
        No live match available.
      </EmptyText>
    );
  }

  return (
    <div className="space-y-8">
      <Section title="Live Match">
        <TeamVsRow
          homeTeam={
            match.homeTeam
          }
          awayTeam={
            match.awayTeam
          }
        />

        <div
          className="mt-4 border-y py-4"
          style={{
            borderColor:
              theme.colors.border,
          }}
        >
          <InfoRow
            label="Competition"
            value={
              match.competition
                .shortName ??
              match.competition
                .name
            }
            theme={theme}
          />

          <InfoRow
            label="Status"
            value={
              match.status ===
              "halftime"
                ? "Half Time"
                : "Live"
            }
            theme={theme}
          />
        </div>
      </Section>

      <MatchCenterLink
        id={match.id}
        theme={theme}
        label="Open Live Match"
      />
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| FULL TIME
|--------------------------------------------------------------------------
*/

function FullTimePulse({
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
      <EmptyText
        theme={theme}
      >
        No completed match found.
      </EmptyText>
    );
  }

  return (
    <div className="space-y-8">
      <Section title="Final Score">
        <div
          className="border-y py-3"
          style={{
            borderColor:
              theme.colors.border,
          }}
        >
          <TeamResultRow
            name={
              match.homeTeam
                .shortName ??
              match.homeTeam.name
            }

            crestUrl={
              match.homeTeam
                .crestUrl
            }

            score={
              match.score.home
            }
          />

          <div
            className="my-2 h-px"
            style={{
              backgroundColor:
                theme.colors.border,
            }}
          />

          <TeamResultRow
            name={
              match.awayTeam
                .shortName ??
              match.awayTeam.name
            }

            crestUrl={
              match.awayTeam
                .crestUrl
            }

            score={
              match.score.away
            }
          />
        </div>

        <div className="mt-3">
          <InfoRow
            label="Competition"
            value={
              match.competition
                .shortName ??
              match.competition
                .name
            }
            theme={theme}
          />

          <InfoRow
            label="Date"
            value={
              formatMatchDate(
                match.kickoff,
              )
            }
            theme={theme}
          />
        </div>
      </Section>

      <MatchCenterLink
        id={match.id}
        theme={theme}
        label="Match Report"
      />
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Shared
|--------------------------------------------------------------------------
*/

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="mb-4 text-[10px] uppercase tracking-[0.22em] opacity-45">
        {title}
      </p>

      {children}
    </section>
  );
}

function Metric({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: KitTheme;
}) {
  return (
    <div
      className="border-r px-1 py-4 last:border-r-0"
      style={{
        borderColor:
          theme.colors.border,
      }}
    >
      <p className="text-2xl font-medium">
        {value}
      </p>

      <p
        className="mt-2 text-[9px] uppercase tracking-[0.17em]"
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        {label}
      </p>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: KitTheme;
}) {
  return (
    <div
      className="border-r px-2 py-3 text-center last:border-r-0"
      style={{
        borderColor:
          theme.colors.border,
      }}
    >
      <p className="text-sm font-medium tabular-nums">
        {value}
      </p>

      <p
        className="mt-1 text-[8px] uppercase tracking-[0.15em]"
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        {label}
      </p>
    </div>
  );
}

function TeamResultRow({
  name,
  crestUrl,
  score,
}: {
  name: string;

  crestUrl:
    string | null;

  score:
    number | null;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center">
          {crestUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}

              <img
                src={crestUrl}
                alt={name}
                className="max-h-7 max-w-7 object-contain"
              />
            </>
          ) : (
            <div className="h-4 w-4 border opacity-40" />
          )}
        </div>

        <span className="truncate text-sm">
          {name}
        </span>
      </div>

      <span className="text-xl font-medium tabular-nums">
        {score ?? "—"}
      </span>
    </div>
  );
}

function TeamVsRow({
  homeTeam,
  awayTeam,
}: {
  homeTeam: {
    name: string;

    shortName:
      string | null;

    crestUrl:
      string | null;
  };

  awayTeam: {
    name: string;

    shortName:
      string | null;

    crestUrl:
      string | null;
  };
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
      <MiniTeam
        team={homeTeam}
        align="right"
      />

      <span className="text-[9px] uppercase tracking-[0.2em] opacity-40">
        VS
      </span>

      <MiniTeam
        team={awayTeam}
        align="left"
      />
    </div>
  );
}

function MiniTeam({
  team,
  align,
}: {
  team: {
    name: string;

    shortName:
      string | null;

    crestUrl:
      string | null;
  };

  align:
    | "left"
    | "right";
}) {
  return (
    <div
      className={`flex items-center gap-2 ${
        align === "right"
          ? "justify-end"
          : "justify-start"
      }`}
    >
      {align === "left" &&
      team.crestUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}

          <img
            src={team.crestUrl}
            alt={team.name}
            className="h-7 w-7 object-contain"
          />
        </>
      ) : null}

      <span className="text-sm font-medium">
        {team.shortName ??
          team.name}
      </span>

      {align === "right" &&
      team.crestUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}

          <img
            src={team.crestUrl}
            alt={team.name}
            className="h-7 w-7 object-contain"
          />
        </>
      ) : null}
    </div>
  );
}

function InfoRow({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: KitTheme;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span
        className="text-[9px] uppercase tracking-[0.15em]"
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        {label}
      </span>

      <span className="text-right text-xs">
        {value}
      </span>
    </div>
  );
}

function MatchCenterLink({
  id,
  label,
  theme,
}: {
  id: string;
  label: string;
  theme: KitTheme;
}) {
  return (
    <Link
      href={`/matches/${id}`}
      className="group flex items-center justify-between border-y py-4 text-sm"
      style={{
        borderColor:
          theme.colors.border,
      }}
    >
      <span>
        {label}
      </span>

      <ArrowRight
        size={14}
        className="transition-transform duration-150 group-hover:translate-x-1"
      />
    </Link>
  );
}

function EmptyText({
  children,
  theme,
}: {
  children:
    React.ReactNode;

  theme:
    KitTheme;
}) {
  return (
    <p
      className="text-sm"
      style={{
        color:
          theme.colors.textMuted,
      }}
    >
      {children}
    </p>
  );
}

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function ordinalSuffix(
  value: number,
) {
  const mod10 =
    value % 10;

  const mod100 =
    value % 100;

  if (
    mod10 === 1 &&
    mod100 !== 11
  ) {
    return "st";
  }

  if (
    mod10 === 2 &&
    mod100 !== 12
  ) {
    return "nd";
  }

  if (
    mod10 === 3 &&
    mod100 !== 13
  ) {
    return "rd";
  }

  return "th";
}

function formatMatchDate(
  value: string,
) {
  return new Date(
    value,
  )
    .toLocaleDateString(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
      },
    )
    .toUpperCase();
}

function formatTime(
  value: Date,
) {
  return value.toLocaleTimeString(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    },
  );
}

function getPulseTitle(
  state: MatchState,
) {
  switch (state) {
    case "matchday":
      return "Matchday";

    case "live":
      return "Live";

    case "fulltime":
      return "Post-Match";

    default:
      return "Right Now";
  }
}
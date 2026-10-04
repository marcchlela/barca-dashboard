"use client";

import {
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  CalendarDays,
  CalendarRange,
  Check,
  ChevronRight,
  CircleDot,
  Rows3,
  Search,
  Star,
  Trophy,
} from "lucide-react";

import CompetitionLogo from "./CompetitionLogo";
import CurrentMatchWindow from "./CurrentMatchWindow";
import MatchesCalendarView from "./MatchesCalendarView";

import type {
  KitTheme,
} from "../../lib/themes";

import type {
  MatchesOverviewData,
} from "../../lib/matches/get-matches-overview";

type Scope =
  | "all"
  | "results"
  | "upcoming"
  | "live";

type MatchView =
  | "timeline"
  | "calendar";

export default function MatchesOverview({
  data,
  theme,
}: {
  data:
    MatchesOverviewData;

  theme:
    KitTheme;
}) {
  const [
    scope,
    setScope,
  ] =
    useState<Scope>(
      "all",
    );

  const [
    competition,
    setCompetition,
  ] =
    useState(
      "all",
    );

  const [
    query,
    setQuery,
  ] =
    useState(
      "",
    );

  const [
    view,
    setView,
  ] =
    useState<MatchView>(
      "timeline",
    );

  /*
  |--------------------------------------------------------------------------
  | Filtered matches
  |--------------------------------------------------------------------------
  */

  const filtered =
    useMemo(
      () => {
        const normalizedQuery =
          query
            .trim()
            .toLowerCase();

        return data.matches.filter(
          (
            match,
          ) => {
            if (
              competition !==
                "all" &&
              match.competition
                .code !==
                competition
            ) {
              return false;
            }

            if (
              scope ===
                "results" &&
              match.status !==
                "finished"
            ) {
              return false;
            }

            if (
              scope ===
                "upcoming" &&
              match.status !==
                "scheduled"
            ) {
              return false;
            }

            if (
              scope ===
                "live" &&
              ![
                "live",
                "halftime",
                "extra_time",
                "penalties",
              ].includes(
                match.status,
              )
            ) {
              return false;
            }

            if (
              !normalizedQuery
            ) {
              return true;
            }

            const haystack =
              [
                match.homeTeam
                  .name,

                match.homeTeam
                  .shortName,

                match.awayTeam
                  .name,

                match.awayTeam
                  .shortName,

                match.opponent
                  .name,

                match.competition
                  .name,

                match.competition
                  .shortName,

                match.venue,
              ]
                .filter(
                  Boolean,
                )
                .join(
                  " ",
                )
                .toLowerCase();

            return haystack.includes(
              normalizedQuery,
            );
          },
        );
      },
      [
        data.matches,
        competition,
        scope,
        query,
      ],
    );

  /*
  |--------------------------------------------------------------------------
  | Month groups
  |--------------------------------------------------------------------------
  */

  const groups =
    useMemo(
      () =>
        groupByMonth(
          filtered,
        ),
      [
        filtered,
      ],
    );

  return (
    <div>
      {/* SEASON COMMAND STRIP */}

      <section
        className="
          relative
          overflow-hidden
          border
        "
        style={{
          borderColor:
            theme.colors.border,

          background: `
            linear-gradient(
              135deg,
              ${theme.colors.surface} 0%,
              ${theme.colors.backgroundElevated} 100%
            )
          `,
        }}
      >
        {/* KIT IDENTITY */}

        <div
          className="
            absolute
            left-0
            right-0
            top-0
            flex
            h-[3px]
          "
        >
          <div
            className="
              h-full
              flex-1
            "
            style={{
              backgroundColor:
                theme.colors.primary,
            }}
          />

          <div
            className="
              h-full
              flex-1
            "
            style={{
              backgroundColor:
                theme.colors.secondary,
            }}
          />
        </div>

        <div
          className="
            grid

            xl:grid-cols-[minmax(0,1fr)_auto]
          "
        >
          {/* IDENTITY */}

          <div
            className="
              flex
              items-center
              gap-4
              px-5
              py-5

              sm:px-6
            "
          >
            <div
              className="
                flex
                h-10
                w-10
                shrink-0
                items-center
                justify-center
                border
              "
              style={{
                borderColor:
                  theme.colors.border,

                color:
                  theme.colors.accent,

                backgroundColor:
                  theme.colors.backgroundElevated,
              }}
            >
              <CalendarDays
                size={17}
                strokeWidth={
                  1.6
                }
              />
            </div>

            <div>
              <p
                className="
                  text-[8px]
                  uppercase
                  tracking-[0.2em]
                "
                style={{
                  color:
                    theme.colors.accent,
                }}
              >
                Season{" "}
                {
                  data.season
                    .label
                }
              </p>

              <h2
                className="
                  mt-1
                  text-lg
                  font-medium
                  tracking-[-0.025em]

                  sm:text-xl
                "
              >
                Season Schedule
              </h2>

              <p
                className="
                  mt-1
                  text-[9px]
                  leading-4
                "
                style={{
                  color:
                    theme.colors.textMuted,
                }}
              >
                Every Barça fixture,
                result and personal
                match entry across all
                competitions.
              </p>
            </div>
          </div>

          {/* METRICS */}

          <div
            className="
              grid
              grid-cols-2
              gap-px
              border-t

              sm:grid-cols-4

              xl:min-w-[520px]
              xl:border-l
              xl:border-t-0
            "
            style={{
              borderColor:
                theme.colors.border,

              backgroundColor:
                theme.colors.border,
            }}
          >
            <HeaderMetric
              label="Matches"
              value={
                data.summary
                  .total
              }
              theme={
                theme
              }
            />

            <HeaderMetric
              label="Finished"
              value={
                data.summary
                  .finished
              }
              theme={
                theme
              }
            />

            <HeaderMetric
              label="Upcoming"
              value={
                data.summary
                  .upcoming
              }
              theme={
                theme
              }
            />

            <HeaderMetric
              label="Watched"
              value={
                data.summary
                  .watched
              }
              tone="success"
              theme={
                theme
              }
            />
          </div>
        </div>
      </section>

      {/* CURRENT WINDOW */}

      <CurrentMatchWindow
        data={
          data
        }
        theme={
          theme
        }
      />

      {/* FILTER CONTROL */}

      <section
        className="
          mt-5
          border
        "
        style={{
          borderColor:
            theme.colors.border,

          backgroundColor:
            `${theme.colors.surface}72`,
        }}
      >
        <div
          className="
            flex
            flex-col
            gap-4
            p-4

            lg:flex-row
            lg:items-center
            lg:justify-between
          "
        >
          {/* SEARCH */}

          <div
            className="
              relative
              w-full

              lg:max-w-[420px]
            "
          >
            <Search
              size={13}
              className="
                pointer-events-none
                absolute
                left-3
                top-1/2
                -translate-y-1/2
              "
              style={{
                color:
                  theme.colors.textMuted,
              }}
            />

            <input
              value={
                query
              }
              onChange={
                (
                  event,
                ) =>
                  setQuery(
                    event
                      .target
                      .value,
                  )
              }
              placeholder="Search opponent, competition or venue..."
              className="
                h-10
                w-full
                border
                bg-transparent
                pl-9
                pr-3
                text-[10px]
                outline-none
              "
              style={{
                borderColor:
                  theme.colors.border,

                color:
                  theme.colors.text,

                backgroundColor:
                  theme.colors.backgroundElevated,
              }}
            />
          </div>

          {/* STATUS FILTERS */}

          <div
            className="
              flex
              flex-wrap
              gap-2
            "
          >
            <ScopeButton
              active={
                scope ===
                "all"
              }
              label="All"
              onClick={
                () =>
                  setScope(
                    "all",
                  )
              }
              theme={
                theme
              }
            />

            <ScopeButton
              active={
                scope ===
                "results"
              }
              label="Results"
              onClick={
                () =>
                  setScope(
                    "results",
                  )
              }
              theme={
                theme
              }
            />

            <ScopeButton
              active={
                scope ===
                "upcoming"
              }
              label="Upcoming"
              onClick={
                () =>
                  setScope(
                    "upcoming",
                  )
              }
              theme={
                theme
              }
            />

            <ScopeButton
              active={
                scope ===
                "live"
              }
              label="Live"
              onClick={
                () =>
                  setScope(
                    "live",
                  )
              }
              theme={
                theme
              }
            />
          </div>
        </div>

        {/* COMPETITIONS */}

        <div
          className="
            scrollbar-subtle
            flex
            gap-2
            overflow-x-auto
            border-t
            px-4
            py-3
          "
          style={{
            borderColor:
              theme.colors.border,
          }}
        >
          <CompetitionButton
            active={
              competition ===
              "all"
            }
            label="All Competitions"
            logoUrl={
              null
            }
            competitionCode={
              null
            }
            generic
            onClick={
              () =>
                setCompetition(
                  "all",
                )
            }
            theme={
              theme
            }
          />

          {data.competitions.map(
            (
              item,
            ) => (
              <CompetitionButton
                key={
                  item.id
                }
                active={
                  competition ===
                  item.code
                }
                label={
                  item.shortName ??
                  item.name
                }
                logoUrl={
                  item.logoUrl
                }
                competitionCode={
                  item.code
                }
                onClick={
                  () =>
                    setCompetition(
                      item.code,
                    )
                }
                theme={
                  theme
                }
              />
            ),
          )}
        </div>
      </section>

      {/* SCHEDULE */}

      <section className="mt-7">
        <div
          className="
            flex
            flex-col
            gap-3
            border-b
            pb-3

            sm:flex-row
            sm:items-end
            sm:justify-between
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
                tracking-[0.18em]
              "
              style={{
                color:
                  theme.colors.textMuted,
              }}
            >
              {
                view ===
                "timeline"
                  ? "Season Timeline"
                  : "Season Calendar"
              }
            </p>

            <h2
              className="
                mt-1
                text-lg
                font-medium
                tracking-[-0.02em]
              "
            >
              Schedule & results
            </h2>
          </div>

          <div
            className="
              flex
              flex-col
              gap-2

              sm:items-end
            "
          >
            {/* VIEW SWITCH */}

            <div
              className="
                flex
                border
              "
              style={{
                borderColor:
                  theme.colors.border,
              }}
            >
              <ViewButton
                active={
                  view ===
                  "timeline"
                }
                label="Timeline"
                icon={
                  Rows3
                }
                onClick={
                  () =>
                    setView(
                      "timeline",
                    )
                }
                theme={
                  theme
                }
              />

              <ViewButton
                active={
                  view ===
                  "calendar"
                }
                label="Calendar"
                icon={
                  CalendarRange
                }
                onClick={
                  () =>
                    setView(
                      "calendar",
                    )
                }
                theme={
                  theme
                }
              />
            </div>

            <p
              className="
                text-[8px]
                tabular-nums
              "
              style={{
                color:
                  theme.colors.textMuted,
              }}
            >
              {
                filtered.length
              }{" "}
              of{" "}
              {
                data.matches
                  .length
              }{" "}
              fixtures
            </p>
          </div>
        </div>

        {/* TIMELINE */}

        {view ===
        "timeline" ? (
          groups.length >
          0 ? (
            <div className="mt-5">
              {groups.map(
                (
                  group,
                ) => (
                  <MonthGroup
                    key={
                      group.key
                    }
                    group={
                      group
                    }
                    theme={
                      theme
                    }
                  />
                ),
              )}
            </div>
          ) : (
            <EmptyState
              theme={
                theme
              }
            />
          )
        ) : (
          <MatchesCalendarView
            matches={
              filtered
            }
            allMatches={
              data.matches
            }
            generatedAt={
              data.generatedAt
            }
            theme={
              theme
            }
          />
        )}
      </section>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Month
|--------------------------------------------------------------------------
*/

function MonthGroup({
  group,
  theme,
}: {
  group: {
    key:
      string;

    label:
      string;

    matches:
      MatchesOverviewData[
        "matches"
      ];
  };

  theme:
    KitTheme;
}) {
  return (
    <section
      className="
        mb-7
        last:mb-0
      "
    >
      <div
        className="
          flex
          items-center
          gap-3
        "
      >
        <span
          className="
            text-[9px]
            font-medium
            uppercase
            tracking-[0.17em]
          "
          style={{
            color:
              theme.colors.accent,
          }}
        >
          {
            group.label
          }
        </span>

        <span
          className="
            text-[7px]
            tabular-nums
          "
          style={{
            color:
              theme.colors.textMuted,
          }}
        >
          {
            group.matches
              .length
          }{" "}
          {
            group.matches
              .length ===
            1
              ? "match"
              : "matches"
          }
        </span>

        <div
          className="
            h-px
            flex-1
          "
          style={{
            backgroundColor:
              theme.colors.border,
          }}
        />
      </div>

      <div
        className="
          mt-3
          overflow-hidden
          border
        "
        style={{
          borderColor:
            theme.colors.border,
        }}
      >
        {group.matches.map(
          (
            match,
          ) => (
            <MatchRow
              key={
                match.id
              }
              match={
                match
              }
              theme={
                theme
              }
            />
          ),
        )}
      </div>
    </section>
  );
}

/*
|--------------------------------------------------------------------------
| Match row
|--------------------------------------------------------------------------
*/

function MatchRow({
  match,
  theme,
}: {
  match:
    MatchesOverviewData[
      "matches"
    ][number];

  theme:
    KitTheme;
}) {
  const finished =
    match.status ===
    "finished";

  const live =
    [
      "live",
      "halftime",
      "extra_time",
      "penalties",
    ].includes(
      match.status,
    );

  const diary =
    match.diary;

  const resultColor =
    match.result ===
    "W"
      ? theme.colors.success
      : match.result ===
          "L"
        ? theme.colors.danger
        : match.result ===
            "D"
          ? theme.colors.warning
          : theme.colors.textMuted;

  return (
    <Link
      href={`/matches/${match.id}`}
      className="
        group
        relative
        grid
        cursor-pointer
        border-b
        transition-colors
        last:border-b-0

        lg:grid-cols-[112px_150px_minmax(0,1fr)_155px_42px]
      "
      style={{
        borderColor:
          theme.colors.border,

        backgroundColor:
          `${theme.colors.surface}60`,
      }}
    >
      {/* RESULT ACCENT */}

      {match.result ? (
        <div
          className="
            absolute
            bottom-0
            left-0
            top-0
            w-[2px]
          "
          style={{
            backgroundColor:
              resultColor,
          }}
        />
      ) : live ? (
        <div
          className="
            absolute
            bottom-0
            left-0
            top-0
            w-[2px]
          "
          style={{
            backgroundColor:
              theme.colors.success,
          }}
        />
      ) : null}

      {/* DATE */}

      <div
        className="
          border-b
          px-4
          py-4

          lg:border-b-0
          lg:border-r
        "
        style={{
          borderColor:
            theme.colors.border,
        }}
      >
        <p
          className="
            text-[11px]
            font-medium
            tabular-nums
          "
        >
          {
            formatDay(
              match.kickoff,
            )
          }
        </p>

        <p
          className="
            mt-1.5
            text-[7px]
            uppercase
            tracking-[0.1em]
          "
          style={{
            color:
              live
                ? theme.colors.success
                : theme.colors.textMuted,
          }}
        >
          {
            finished
              ? "Full Time"
              : live
                ? humanize(
                    match.status,
                  )
                : formatTime(
                    match.kickoff,
                  )
          }
        </p>
      </div>

      {/* COMPETITION */}

      <div
        className="
          hidden
          px-4
          py-4

          lg:block
          lg:border-r
        "
        style={{
          borderColor:
            theme.colors.border,
        }}
      >
        <div
          className="
            flex
            items-start
            gap-2.5
          "
        >
          <CompetitionLogo
            src={
              match.competition
                .logoUrl
            }
            name={
              match.competition
                .name
            }
            code={
              match.competition
                .code
            }
            theme={
              theme
            }
            size={
              18
            }
          />

          <div className="min-w-0">
            <p
              className="
                truncate
                text-[9px]
                font-medium
              "
            >
              {
                match.competition
                  .shortName ??
                match.competition
                  .name
              }
            </p>

            <p
              className="
                mt-1.5
                text-[7px]
              "
              style={{
                color:
                  theme.colors.textMuted,
              }}
            >
              {match.matchday
                ? `Matchday ${match.matchday}`
                : match.round ??
                  match.stage ??
                  "Fixture"}
            </p>
          </div>
        </div>
      </div>

      {/* FIXTURE */}

      <div
        className="
          px-4
          py-4

          sm:px-5
        "
      >
        <div
          className="
            flex
            items-center
            gap-5
          "
        >
          <div
            className="
              min-w-0
              flex-1
            "
          >
            <TeamLine
              team={
                match.homeTeam
              }
              barca={
                match.barcaAtHome
              }
              score={
                match.homeScore
              }
              showScore={
                finished ||
                live
              }
              theme={
                theme
              }
            />

            <div className="mt-2.5">
              <TeamLine
                team={
                  match.awayTeam
                }
                barca={
                  !match.barcaAtHome
                }
                score={
                  match.awayScore
                }
                showScore={
                  finished ||
                  live
                }
                theme={
                  theme
                }
              />
            </div>
          </div>

          {match.result ? (
            <span
              className="
                flex
                h-8
                w-8
                shrink-0
                items-center
                justify-center
                border
                text-[10px]
                font-semibold
              "
              style={{
                borderColor:
                  `${resultColor}55`,

                color:
                  resultColor,

                backgroundColor:
                  `${resultColor}08`,
              }}
            >
              {
                match.result
              }
            </span>
          ) : live ? (
            <span
              className="
                inline-flex
                shrink-0
                items-center
                gap-1.5
                text-[7px]
                uppercase
                tracking-[0.1em]
              "
              style={{
                color:
                  theme.colors.success,
              }}
            >
              <CircleDot
                size={9}
              />

              Live
            </span>
          ) : null}
        </div>

        {/* MOBILE COMPETITION */}

        <div
          className="
            mt-3
            flex
            flex-wrap
            items-center
            gap-x-3
            gap-y-1

            lg:hidden
          "
        >
          <span
            className="
              inline-flex
              items-center
              gap-1.5
              text-[7px]
              uppercase
              tracking-[0.09em]
            "
            style={{
              color:
                theme.colors.textMuted,
            }}
          >
            <CompetitionLogo
              src={
                match.competition
                  .logoUrl
              }
              name={
                match.competition
                  .name
              }
              code={
                match.competition
                  .code
              }
              theme={
                theme
              }
              size={
                11
              }
            />

            {
              match.competition
                .shortName ??
              match.competition
                .name
            }
          </span>

          {match.matchday ? (
            <span
              className="
                text-[7px]
              "
              style={{
                color:
                  theme.colors.textMuted,
              }}
            >
              MD
              {
                match.matchday
              }
            </span>
          ) : null}
        </div>
      </div>

      {/* PERSONAL */}

      <div
        className="
          hidden
          px-4
          py-4

          lg:block
          lg:border-l
        "
        style={{
          borderColor:
            theme.colors.border,
        }}
      >
        {diary?.watched ? (
          <>
            <div
              className="
                flex
                items-center
                gap-1.5
                text-[7px]
                uppercase
                tracking-[0.1em]
              "
              style={{
                color:
                  theme.colors.success,
              }}
            >
              <Check
                size={10}
              />

              Watched
            </div>

            {diary.rating !==
            null ? (
              <div
                className="
                  mt-2.5
                  flex
                  items-center
                  gap-1.5
                "
              >
                <Star
                  size={10}
                  style={{
                    color:
                      theme.colors.accent,
                  }}
                />

                <span
                  className="
                    text-[9px]
                    font-medium
                    tabular-nums
                  "
                >
                  {
                    diary.rating
                  }
                  /5
                </span>
              </div>
            ) : null}
          </>
        ) : finished ? (
          <p
            className="
              text-[7px]
              uppercase
              tracking-[0.1em]
            "
            style={{
              color:
                theme.colors.textMuted,
            }}
          >
            Not logged
          </p>
        ) : (
          <p
            className="
              text-[7px]
              uppercase
              tracking-[0.1em]
            "
            style={{
              color:
                theme.colors.textMuted,
            }}
          >
            Upcoming
          </p>
        )}

        {match.venue ? (
          <p
            className="
              mt-3
              truncate
              text-[7px]
            "
            style={{
              color:
                theme.colors.textMuted,
            }}
          >
            {
              match.venue
            }
          </p>
        ) : null}
      </div>

      {/* OPEN */}

      <div
        className="
          hidden
          items-center
          justify-center
          border-l

          lg:flex
        "
        style={{
          borderColor:
            theme.colors.border,

          color:
            theme.colors.textMuted,
        }}
      >
        <ChevronRight
          size={14}
          className="
            transition-all
            duration-150

            group-hover:translate-x-0.5
          "
        />
      </div>
    </Link>
  );
}

/*
|--------------------------------------------------------------------------
| Team
|--------------------------------------------------------------------------
*/

function TeamLine({
  team,
  barca,
  score,
  showScore,
  theme,
}: {
  team: {
    name:
      string;

    shortName:
      string | null;

    crestUrl:
      string | null;
  };

  barca:
    boolean;

  score:
    number | null;

  showScore:
    boolean;

  theme:
    KitTheme;
}) {
  return (
    <div
      className="
        flex
        items-center
        gap-3
      "
    >
      <TeamCrest
        name={
          team.shortName ??
          team.name
        }
        src={
          team.crestUrl
        }
        theme={
          theme
        }
      />

      <span
        className="
          min-w-0
          flex-1
          truncate
          text-[11px]
        "
        style={{
          fontWeight:
            barca
              ? 600
              : 400,

          color:
            barca
              ? theme.colors.text
              : theme.colors.textMuted,
        }}
      >
        {
          team.shortName ??
          team.name
        }
      </span>

      {showScore ? (
        <span
          className="
            w-6
            text-right
            text-[13px]
            font-semibold
            tabular-nums
          "
        >
          {
            score ??
            "—"
          }
        </span>
      ) : null}
    </div>
  );
}

function TeamCrest({
  name,
  src,
  theme,
}: {
  name:
    string;

  src:
    string | null;

  theme:
    KitTheme;
}) {
  if (!src) {
    return (
      <div
        className="
          flex
          h-7
          w-7
          shrink-0
          items-center
          justify-center
          border
          text-[7px]
          font-medium
          uppercase
        "
        style={{
          borderColor:
            theme.colors.border,

          color:
            theme.colors.textMuted,

          backgroundColor:
            theme.colors.backgroundElevated,
        }}
      >
        {name
          .slice(
            0,
            2,
          )
          .toUpperCase()}
      </div>
    );
  }

  return (
    <div
      className="
        flex
        h-7
        w-7
        shrink-0
        items-center
        justify-center
      "
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={
          src
        }
        alt=""
        className="
          max-h-full
          max-w-full
          object-contain
        "
      />
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Scope button
|--------------------------------------------------------------------------
*/

function ScopeButton({
  active,
  label,
  onClick,
  theme,
}: {
  active:
    boolean;

  label:
    string;

  onClick:
    () => void;

  theme:
    KitTheme;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className="
        cursor-pointer
        border
        px-3
        py-2
        text-[7px]
        uppercase
        tracking-[0.1em]
        transition-colors
      "
      style={{
        borderColor:
          active
            ? `${theme.colors.accent}77`
            : theme.colors.border,

        color:
          active
            ? theme.colors.accent
            : theme.colors.textMuted,

        backgroundColor:
          active
            ? `${theme.colors.accent}0B`
            : theme.colors.backgroundElevated,
      }}
    >
      {label}
    </button>
  );
}

/*
|--------------------------------------------------------------------------
| Competition button
|--------------------------------------------------------------------------
*/

function CompetitionButton({
  active,
  label,
  logoUrl,
  competitionCode,
  generic =
    false,
  onClick,
  theme,
}: {
  active:
    boolean;

  label:
    string;

  logoUrl:
    string | null;

  competitionCode:
    string | null;

  generic?:
    boolean;

  onClick:
    () => void;

  theme:
    KitTheme;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className="
        flex
        shrink-0
        cursor-pointer
        items-center
        gap-2
        border
        px-3
        py-1.5
        text-[7px]
        uppercase
        tracking-[0.1em]
        transition-colors
      "
      style={{
        borderColor:
          active
            ? `${theme.colors.accent}77`
            : theme.colors.border,

        color:
          active
            ? theme.colors.accent
            : theme.colors.textMuted,

        backgroundColor:
          active
            ? `${theme.colors.accent}0B`
            : "transparent",
      }}
    >
      {generic ? (
        <Trophy
          size={11}
          strokeWidth={
            1.6
          }
        />
      ) : (
        <CompetitionLogo
          src={
            logoUrl
          }
          name={
            label
          }
          code={
            competitionCode
          }
          theme={
            theme
          }
          size={
            13
          }
        />
      )}

      <span>
        {label}
      </span>
    </button>
  );
}

/*
|--------------------------------------------------------------------------
| View button
|--------------------------------------------------------------------------
*/

function ViewButton({
  active,
  label,
  icon:
    Icon,
  onClick,
  theme,
}: {
  active:
    boolean;

  label:
    string;

  icon:
    typeof Rows3;

  onClick:
    () => void;

  theme:
    KitTheme;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className="
        flex
        h-9
        cursor-pointer
        items-center
        gap-2
        border-r
        px-3
        text-[7px]
        uppercase
        tracking-[0.1em]
        last:border-r-0
      "
      style={{
        borderColor:
          theme.colors.border,

        color:
          active
            ? theme.colors.accent
            : theme.colors.textMuted,

        backgroundColor:
          active
            ? `${theme.colors.accent}0B`
            : theme.colors.backgroundElevated,
      }}
    >
      <Icon
        size={11}
      />

      {label}
    </button>
  );
}

/*
|--------------------------------------------------------------------------
| Metrics
|--------------------------------------------------------------------------
*/

function HeaderMetric({
  label,
  value,
  theme,
  tone =
    "normal",
}: {
  label:
    string;

  value:
    number;

  theme:
    KitTheme;

  tone?:
    | "normal"
    | "success";
}) {
  return (
    <div
      className="
        min-w-[105px]
        px-4
        py-4
      "
      style={{
        backgroundColor:
          theme.colors.surface,
      }}
    >
      <p
        className="
          text-[7px]
          uppercase
          tracking-[0.14em]
        "
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        {label}
      </p>

      <p
        className="
          mt-1.5
          text-lg
          font-medium
          tabular-nums
        "
        style={{
          color:
            tone ===
              "success"
              ? theme.colors.success
              : theme.colors.text,
        }}
      >
        {value}
      </p>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Empty
|--------------------------------------------------------------------------
*/

function EmptyState({
  theme,
}: {
  theme:
    KitTheme;
}) {
  return (
    <div
      className="
        mt-5
        flex
        min-h-52
        flex-col
        items-center
        justify-center
        border
        px-6
        text-center
      "
      style={{
        borderColor:
          theme.colors.border,

        backgroundColor:
          `${theme.colors.surface}58`,
      }}
    >
      <Trophy
        size={20}
        style={{
          color:
            theme.colors.textMuted,
        }}
      />

      <p
        className="
          mt-3
          text-[11px]
          font-medium
        "
      >
        No matches found
      </p>

      <p
        className="
          mt-1
          max-w-sm
          text-[8px]
          leading-4
        "
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        Try changing the
        competition, status or
        search filter.
      </p>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Grouping
|--------------------------------------------------------------------------
*/

function groupByMonth(
  matches:
    MatchesOverviewData[
      "matches"
    ],
) {
  const groups =
    new Map<
      string,
      {
        key:
          string;

        label:
          string;

        matches:
          MatchesOverviewData[
            "matches"
          ];
      }
    >();

  for (
    const match
    of matches
  ) {
    const date =
      new Date(
        match.kickoff,
      );

    const key =
      `${date.getFullYear()}-${String(
        date.getMonth() +
          1,
      ).padStart(
        2,
        "0",
      )}`;

    const label =
      date.toLocaleDateString(
        "en-GB",
        {
          month:
            "long",

          year:
            "numeric",
        },
      );

    if (
      !groups.has(
        key,
      )
    ) {
      groups.set(
        key,
        {
          key,
          label,
          matches:
            [],
        },
      );
    }

    groups
      .get(
        key,
      )!
      .matches.push(
        match,
      );
  }

  return Array.from(
    groups.values(),
  );
}

/*
|--------------------------------------------------------------------------
| Formatting
|--------------------------------------------------------------------------
*/

function formatDay(
  value:
    string,
) {
  return new Date(
    value,
  ).toLocaleDateString(
    "en-GB",
    {
      day:
        "2-digit",

      month:
        "short",
    },
  );
}

function formatTime(
  value:
    string,
) {
  return new Date(
    value,
  ).toLocaleTimeString(
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

function humanize(
  value:
    string,
) {
  return value
    .replaceAll(
      "_",
      " ",
    )
    .replace(
      /\b\w/g,
      (
        character,
      ) =>
        character.toUpperCase(),
    );
}
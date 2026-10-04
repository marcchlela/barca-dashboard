"use client";

import {
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Home,
  MapPin,
  Star,
} from "lucide-react";

import CompetitionLogo from "./CompetitionLogo";

import type {
  KitTheme,
} from "../../lib/themes";

import type {
  MatchesOverviewData,
} from "../../lib/matches/get-matches-overview";

type Match =
  MatchesOverviewData[
    "matches"
  ][number];

type MatchesCalendarViewProps = {
  matches:
    MatchesOverviewData[
      "matches"
    ];

  allMatches:
    MatchesOverviewData[
      "matches"
    ];

  generatedAt:
    string;

  theme:
    KitTheme;
};

const WEEKDAYS = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
] as const;

export default function MatchesCalendarView({
  matches,
  allMatches,
  generatedAt,
  theme,
}: MatchesCalendarViewProps) {
  /*
  |--------------------------------------------------------------------------
  | Stable reference time
  |--------------------------------------------------------------------------
  */

  const referenceDate =
    useMemo(
      () =>
        new Date(
          generatedAt,
        ),
      [
        generatedAt,
      ],
    );

  /*
  |--------------------------------------------------------------------------
  | Season bounds
  |--------------------------------------------------------------------------
  */

  const seasonBounds =
    useMemo(
      () =>
        getSeasonBounds(
          allMatches,
          referenceDate,
        ),
      [
        allMatches,
        referenceDate,
      ],
    );

  /*
  |--------------------------------------------------------------------------
  | Initial month
  |--------------------------------------------------------------------------
  */

  const [
    visibleMonthKey,
    setVisibleMonthKey,
  ] =
    useState(
      () =>
        monthKeyFromIndex(
          clamp(
            monthIndexFromDate(
              referenceDate,
            ),
            seasonBounds.min,
            seasonBounds.max,
          ),
        ),
    );

  /*
  |--------------------------------------------------------------------------
  | Initial selected match
  |--------------------------------------------------------------------------
  */

  const [
    selectedMatchId,
    setSelectedMatchId,
  ] =
    useState<
      string | null
    >(
      () =>
        getInitialFocusMatch(
          allMatches,
          generatedAt,
        )?.id ??
        null,
    );

  const visibleMonth =
    useMemo(
      () =>
        monthDateFromKey(
          visibleMonthKey,
        ),
      [
        visibleMonthKey,
      ],
    );

  const visibleMonthIndex =
    monthIndexFromDate(
      visibleMonth,
    );

  const canGoPrevious =
    visibleMonthIndex >
    seasonBounds.min;

  const canGoNext =
    visibleMonthIndex <
    seasonBounds.max;

  /*
  |--------------------------------------------------------------------------
  | Calendar cells
  |--------------------------------------------------------------------------
  */

  const calendarDays =
    useMemo(
      () =>
        buildCalendarDays(
          visibleMonth,
        ),
      [
        visibleMonth,
      ],
    );

  /*
  |--------------------------------------------------------------------------
  | Matches inside visible month
  |--------------------------------------------------------------------------
  */

  const visibleMonthMatches =
    useMemo(
      () =>
        matches
          .filter(
            (
              match,
            ) =>
              monthKeyFromDate(
                new Date(
                  match.kickoff,
                ),
              ) ===
              visibleMonthKey,
          )
          .sort(
            (
              left,
              right,
            ) =>
              new Date(
                left.kickoff,
              ).getTime() -
              new Date(
                right.kickoff,
              ).getTime(),
          ),
      [
        matches,
        visibleMonthKey,
      ],
    );

  const matchesByDay =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            Match[]
          >();

        for (
          const match
          of visibleMonthMatches
        ) {
          const key =
            dayKey(
              new Date(
                match.kickoff,
              ),
            );

          const current =
            map.get(
              key,
            ) ??
            [];

          current.push(
            match,
          );

          map.set(
            key,
            current,
          );
        }

        return map;
      },
      [
        visibleMonthMatches,
      ],
    );

  /*
  |--------------------------------------------------------------------------
  | Selected match
  |--------------------------------------------------------------------------
  |
  | If the previously selected match is not
  | in the current month/filter state, focus
  | the first visible fixture instead.
  |--------------------------------------------------------------------------
  */

  const selectedMatch =
    visibleMonthMatches.find(
      (
        match,
      ) =>
        match.id ===
        selectedMatchId,
    ) ??
    visibleMonthMatches[0] ??
    null;

  const selectedDay =
    selectedMatch
      ? dayKey(
          new Date(
            selectedMatch.kickoff,
          ),
        )
      : null;

  /*
  |--------------------------------------------------------------------------
  | Navigation
  |--------------------------------------------------------------------------
  */

  function moveMonth(
    difference:
      number,
  ) {
    const nextIndex =
      clamp(
        visibleMonthIndex +
          difference,
        seasonBounds.min,
        seasonBounds.max,
      );

    setVisibleMonthKey(
      monthKeyFromIndex(
        nextIndex,
      ),
    );
  }

  function jumpToCurrentMonth() {
    const index =
      clamp(
        monthIndexFromDate(
          referenceDate,
        ),
        seasonBounds.min,
        seasonBounds.max,
      );

    setVisibleMonthKey(
      monthKeyFromIndex(
        index,
      ),
    );
  }

  return (
    <div
      className="
        mt-5
      "
    >
      {/* CALENDAR TOOLBAR */}

      <div
        className="
          flex
          flex-col
          gap-3
          border
          px-4
          py-3

          sm:flex-row
          sm:items-center
          sm:justify-between
        "
        style={{
          borderColor:
            theme.colors.border,

          backgroundColor:
            `${theme.colors.surface}70`,
        }}
      >
        <div>
          <p
            className="
              text-[7px]
              uppercase
              tracking-[0.16em]
            "
            style={{
              color:
                theme.colors.textMuted,
            }}
          >
            Season Calendar
          </p>

          <h3
            className="
              mt-1
              text-[16px]
              font-medium
              tracking-[-0.02em]
            "
          >
            {
              visibleMonth.toLocaleDateString(
                "en-GB",
                {
                  month:
                    "long",

                  year:
                    "numeric",
                },
              )
            }
          </h3>
        </div>

        <div
          className="
            flex
            items-center
            gap-2
          "
        >
          <button
            type="button"
            onClick={
              jumpToCurrentMonth
            }
            className="
              h-9
              cursor-pointer
              border
              px-3
              text-[7px]
              uppercase
              tracking-[0.11em]
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
            Current
          </button>

          <button
            type="button"
            disabled={
              !canGoPrevious
            }
            onClick={
              () =>
                moveMonth(
                  -1,
                )
            }
            aria-label="Previous month"
            className="
              flex
              h-9
              w-9
              cursor-pointer
              items-center
              justify-center
              border

              disabled:cursor-not-allowed
              disabled:opacity-30
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
            <ChevronLeft
              size={14}
            />
          </button>

          <button
            type="button"
            disabled={
              !canGoNext
            }
            onClick={
              () =>
                moveMonth(
                  1,
                )
            }
            aria-label="Next month"
            className="
              flex
              h-9
              w-9
              cursor-pointer
              items-center
              justify-center
              border

              disabled:cursor-not-allowed
              disabled:opacity-30
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
            <ChevronRight
              size={14}
            />
          </button>
        </div>
      </div>

      {/* CALENDAR + MATCH FOCUS */}

      <div
        className="
          mt-3
          grid
          gap-3

          xl:grid-cols-[minmax(0,1fr)_310px]
        "
      >
        {/* CALENDAR */}

        <div
          className="
            min-w-0
            border
          "
          style={{
            borderColor:
              theme.colors.border,

            backgroundColor:
              `${theme.colors.surface}52`,
          }}
        >
          {/* WEEK DAYS */}

          <div
            className="
              grid
              grid-cols-7
              gap-px
              border-b
            "
            style={{
              borderColor:
                theme.colors.border,

              backgroundColor:
                theme.colors.border,
            }}
          >
            {WEEKDAYS.map(
              (
                weekday,
              ) => (
                <div
                  key={
                    weekday
                  }
                  className="
                    px-2
                    py-2.5
                    text-center
                    text-[7px]
                    font-medium
                    uppercase
                    tracking-[0.12em]
                  "
                  style={{
                    color:
                      theme.colors.textMuted,

                    backgroundColor:
                      theme.colors.backgroundElevated,
                  }}
                >
                  {
                    weekday
                  }
                </div>
              ),
            )}
          </div>

          {/* DAYS */}

          <div
            className="
              grid
              grid-cols-7
              gap-px
            "
            style={{
              backgroundColor:
                theme.colors.border,
            }}
          >
            {calendarDays.map(
              (
                day,
              ) => {
                const dateKey =
                  dayKey(
                    day,
                  );

                const inMonth =
                  day.getMonth() ===
                    visibleMonth.getMonth() &&
                  day.getFullYear() ===
                    visibleMonth.getFullYear();

                const dayMatches =
                  inMonth
                    ? (
                        matchesByDay.get(
                          dateKey,
                        ) ??
                        []
                      )
                    : [];

                const primaryMatch =
                  dayMatches[0] ??
                  null;

                const isCurrentDay =
                  dateKey ===
                  dayKey(
                    referenceDate,
                  );

                const isSelected =
                  dateKey ===
                  selectedDay;

                if (
                  !primaryMatch
                ) {
                  return (
                    <div
                      key={
                        dateKey
                      }
                      className="
                        relative
                        min-h-[102px]
                        p-2

                        sm:min-h-[116px]

                        2xl:min-h-[126px]
                      "
                      style={{
                        backgroundColor:
                          inMonth
                            ? `${theme.colors.surface}72`
                            : `${theme.colors.background}88`,

                        opacity:
                          inMonth
                            ? 1
                            : 0.42,
                      }}
                    >
                      <DayNumber
                        day={
                          day
                        }
                        current={
                          isCurrentDay
                        }
                        theme={
                          theme
                        }
                      />
                    </div>
                  );
                }

                return (
                  <button
                    key={
                      dateKey
                    }
                    type="button"
                    onClick={
                      () =>
                        setSelectedMatchId(
                          primaryMatch.id,
                        )
                    }
                    className="
                      relative
                      min-h-[102px]
                      cursor-pointer
                      overflow-hidden
                      p-2
                      text-left

                      sm:min-h-[116px]

                      2xl:min-h-[126px]
                    "
                    style={{
                      backgroundColor:
                        isSelected
                          ? theme.colors.backgroundElevated
                          : `${theme.colors.surface}86`,

                      boxShadow:
                        isSelected
                          ? `inset 0 0 0 1px ${theme.colors.accent}`
                          : undefined,
                    }}
                  >
                    <DayNumber
                      day={
                        day
                      }
                      current={
                        isCurrentDay
                      }
                      theme={
                        theme
                      }
                    />

                    <CalendarMatchTile
                      match={
                        primaryMatch
                      }
                      theme={
                        theme
                      }
                    />

                    {dayMatches.length >
                    1 ? (
                      <span
                        className="
                          absolute
                          bottom-1.5
                          right-2
                          text-[6px]
                          uppercase
                          tracking-[0.08em]
                        "
                        style={{
                          color:
                            theme.colors.textMuted,
                        }}
                      >
                        +
                        {
                          dayMatches.length -
                          1
                        }{" "}
                        more
                      </span>
                    ) : null}
                  </button>
                );
              },
            )}
          </div>
        </div>

        {/* SELECTED MATCH */}

        <SelectedMatchPanel
          match={
            selectedMatch
          }
          theme={
            theme
          }
        />
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Calendar fixture tile
|--------------------------------------------------------------------------
*/

function CalendarMatchTile({
  match,
  theme,
}: {
  match:
    Match;

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
          : theme.colors.accent;

  return (
    <div
      className="
        relative
        mt-2
        border
        px-2
        py-2
      "
      style={{
        borderColor:
          theme.colors.border,

        backgroundColor:
          theme.colors.backgroundElevated,
      }}
    >
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
            live
              ? theme.colors.success
              : finished
                ? resultColor
                : theme.colors.accent,
        }}
      />

      {/* COMPETITION */}

      <div
        className="
          flex
          items-center
          justify-between
          gap-2
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
            11
          }
        />

        <span
          className="
            text-[6px]
            uppercase
            tracking-[0.08em]
          "
          style={{
            color:
              theme.colors.textMuted,
          }}
        >
          {match.barcaAtHome
            ? "H"
            : "A"}
        </span>
      </div>

      {/* OPPONENT */}

      <div
        className="
          mt-2
          flex
          items-center
          gap-2
        "
      >
        <SmallCrest
          src={
            match.opponent
              .crestUrl
          }
          name={
            match.opponent
              .shortName ??
            match.opponent
              .name
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
            text-[8px]
            font-medium
          "
        >
          {
            match.opponent
              .shortName ??
            match.opponent
              .name
          }
        </span>
      </div>

      {/* STATE */}

      <div
        className="
          mt-2
          flex
          items-center
          justify-between
          gap-2
        "
      >
        {live ? (
          <span
            className="
              flex
              items-center
              gap-1
              text-[6px]
              font-medium
              uppercase
              tracking-[0.08em]
            "
            style={{
              color:
                theme.colors.success,
            }}
          >
            <CircleDot
              size={7}
            />

            Live
          </span>
        ) : finished ? (
          <span
            className="
              text-[7px]
              font-semibold
            "
            style={{
              color:
                resultColor,
            }}
          >
            {
              match.result
            }
          </span>
        ) : (
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
              formatTime(
                match.kickoff,
              )
            }
          </span>
        )}

        {(finished ||
          live) &&
        match.homeScore !==
          null &&
        match.awayScore !==
          null ? (
          <span
            className="
              text-[8px]
              font-semibold
              tabular-nums
            "
          >
            {
              match.homeScore
            }
            –
            {
              match.awayScore
            }
          </span>
        ) : null}
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Selected match panel
|--------------------------------------------------------------------------
*/

function SelectedMatchPanel({
  match,
  theme,
}: {
  match:
    Match | null;

  theme:
    KitTheme;
}) {
  if (!match) {
    return (
      <aside
        className="
          flex
          min-h-[340px]
          items-center
          justify-center
          border
          px-5
          text-center
        "
        style={{
          borderColor:
            theme.colors.border,

          backgroundColor:
            `${theme.colors.surface}62`,
        }}
      >
        <div>
          <Clock3
            size={18}
            className="mx-auto"
            style={{
              color:
                theme.colors.textMuted,
            }}
          />

          <p
            className="
              mt-3
              text-[10px]
              font-medium
            "
          >
            No fixture selected
          </p>

          <p
            className="
              mt-1
              text-[7px]
              leading-4
            "
            style={{
              color:
                theme.colors.textMuted,
            }}
          >
            Select a match from the
            calendar to inspect it.
          </p>
        </div>
      </aside>
    );
  }

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
          : theme.colors.accent;

  return (
    <aside
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
            145deg,
            ${theme.colors.surface} 0%,
            ${theme.colors.backgroundElevated} 100%
          )
        `,
      }}
    >
      {/* TOP STRIPE */}

      <div
        className="
          absolute
          left-0
          right-0
          top-0
          h-[2px]
        "
        style={{
          backgroundColor:
            live
              ? theme.colors.success
              : finished
                ? resultColor
                : theme.colors.accent,
        }}
      />

      <div className="p-4">
        {/* COMPETITION */}

        <div
          className="
            flex
            items-center
            justify-between
            gap-3
          "
        >
          <div
            className="
              flex
              min-w-0
              items-center
              gap-2
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
                17
              }
            />

            <span
              className="
                truncate
                text-[8px]
                uppercase
                tracking-[0.1em]
              "
              style={{
                color:
                  theme.colors.textMuted,
              }}
            >
              {
                match.competition
                  .shortName ??
                match.competition
                  .name
              }
            </span>
          </div>

          {live ? (
            <span
              className="
                flex
                items-center
                gap-1
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
                size={8}
              />

              Live
            </span>
          ) : match.result ? (
            <span
              className="
                flex
                h-7
                w-7
                items-center
                justify-center
                border
                text-[9px]
                font-semibold
              "
              style={{
                borderColor:
                  `${resultColor}66`,

                color:
                  resultColor,
              }}
            >
              {
                match.result
              }
            </span>
          ) : null}
        </div>

        {/* DATE */}

        <div
          className="
            mt-4
            border-y
            py-3
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
            "
          >
            {
              formatLongDate(
                match.kickoff,
              )
            }
          </p>

          <p
            className="
              mt-1
              text-[8px]
            "
            style={{
              color:
                theme.colors.textMuted,
            }}
          >
            {finished
              ? "Full Time"
              : live
                ? humanize(
                    match.status,
                  )
                : formatTime(
                    match.kickoff,
                  )}
          </p>
        </div>

        {/* TEAMS */}

        <div
          className="
            mt-5
            space-y-3
          "
        >
          <DetailTeam
            team={
              match.homeTeam
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

          <DetailTeam
            team={
              match.awayTeam
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

        {/* CONTEXT */}

        <div
          className="
            mt-5
            grid
            gap-3
            border-t
            pt-4
          "
          style={{
            borderColor:
              theme.colors.border,
          }}
        >
          <ContextLine
            label="Fixture"
            value={
              match.matchday
                ? `Matchday ${match.matchday}`
                : match.round ??
                  match.stage ??
                  "Fixture"
            }
            theme={
              theme
            }
          />

          <ContextLine
            icon={
              Home
            }
            label="Barça"
            value={
              match.barcaAtHome
                ? "Home"
                : "Away"
            }
            theme={
              theme
            }
          />

          {match.venue ? (
            <ContextLine
              icon={
                MapPin
              }
              label="Venue"
              value={
                match.venue
              }
              theme={
                theme
              }
            />
          ) : null}
        </div>

        {/* PERSONAL */}

        {finished ? (
          <div
            className="
              mt-5
              border-t
              pt-4
            "
            style={{
              borderColor:
                theme.colors.border,
            }}
          >
            <p
              className="
                text-[7px]
                uppercase
                tracking-[0.12em]
              "
              style={{
                color:
                  theme.colors.textMuted,
              }}
            >
              My Barça
            </p>

            {diary?.watched ? (
              <div
                className="
                  mt-2
                  flex
                  flex-wrap
                  items-center
                  gap-3
                "
              >
                <span
                  className="
                    flex
                    items-center
                    gap-1.5
                    text-[7px]
                    uppercase
                    tracking-[0.08em]
                  "
                  style={{
                    color:
                      theme.colors.success,
                  }}
                >
                  <Check
                    size={9}
                  />

                  Watched
                </span>

                {diary.rating !==
                null ? (
                  <span
                    className="
                      flex
                      items-center
                      gap-1.5
                      text-[8px]
                      font-medium
                    "
                  >
                    <Star
                      size={9}
                      style={{
                        color:
                          theme.colors.accent,
                      }}
                    />

                    {
                      diary.rating
                    }
                    /5
                  </span>
                ) : null}
              </div>
            ) : (
              <p
                className="
                  mt-2
                  text-[8px]
                "
                style={{
                  color:
                    theme.colors.textMuted,
                }}
              >
                Not logged yet
              </p>
            )}
          </div>
        ) : null}

        {/* OPEN */}

        <Link
          href={`/matches/${match.id}`}
          className="
            mt-5
            flex
            h-10
            cursor-pointer
            items-center
            justify-between
            border
            px-3
            text-[7px]
            uppercase
            tracking-[0.11em]
          "
          style={{
            borderColor:
              `${theme.colors.accent}66`,

            color:
              theme.colors.accent,
          }}
        >
          Open Match Center

          <ArrowUpRight
            size={11}
          />
        </Link>
      </div>
    </aside>
  );
}

/*
|--------------------------------------------------------------------------
| Detail team
|--------------------------------------------------------------------------
*/

function DetailTeam({
  team,
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
      <LargeCrest
        src={
          team.crestUrl
        }
        name={
          team.shortName ??
          team.name
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
          font-medium
        "
      >
        {
          team.shortName ??
          team.name
        }
      </span>

      {showScore ? (
        <span
          className="
            text-[18px]
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

/*
|--------------------------------------------------------------------------
| Context line
|--------------------------------------------------------------------------
*/

function ContextLine({
  icon:
    Icon,
  label,
  value,
  theme,
}: {
  icon?:
    typeof Home;

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
        items-start
        gap-2
      "
    >
      {Icon ? (
        <Icon
          size={11}
          className="
            mt-0.5
            shrink-0
          "
          style={{
            color:
              theme.colors.textMuted,
          }}
        />
      ) : null}

      <div
        className="
          min-w-0
        "
      >
        <p
          className="
            text-[6px]
            uppercase
            tracking-[0.11em]
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
            mt-1
            truncate
            text-[8px]
          "
        >
          {value}
        </p>
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Day number
|--------------------------------------------------------------------------
*/

function DayNumber({
  day,
  current,
  theme,
}: {
  day:
    Date;

  current:
    boolean;

  theme:
    KitTheme;
}) {
  return (
    <div
      className="
        flex
        items-center
        justify-between
      "
    >
      <span
        className="
          flex
          h-6
          min-w-6
          items-center
          justify-center
          px-1
          text-[8px]
          font-medium
          tabular-nums
        "
        style={{
          backgroundColor:
            current
              ? theme.colors.accent
              : "transparent",

          color:
            current
              ? theme.colors.background
              : theme.colors.textMuted,
        }}
      >
        {
          day.getDate()
        }
      </span>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Crests
|--------------------------------------------------------------------------
*/

function SmallCrest({
  src,
  name,
  theme,
}: {
  src:
    string | null;

  name:
    string;

  theme:
    KitTheme;
}) {
  return (
    <Crest
      src={
        src
      }
      name={
        name
      }
      theme={
        theme
      }
      size={
        20
      }
    />
  );
}

function LargeCrest({
  src,
  name,
  theme,
}: {
  src:
    string | null;

  name:
    string;

  theme:
    KitTheme;
}) {
  return (
    <Crest
      src={
        src
      }
      name={
        name
      }
      theme={
        theme
      }
      size={
        30
      }
    />
  );
}

function Crest({
  src,
  name,
  theme,
  size,
}: {
  src:
    string | null;

  name:
    string;

  theme:
    KitTheme;

  size:
    number;
}) {
  if (!src) {
    return (
      <span
        className="
          flex
          shrink-0
          items-center
          justify-center
          border
          text-[6px]
          font-medium
          uppercase
        "
        style={{
          width:
            size,

          height:
            size,

          borderColor:
            theme.colors.border,

          color:
            theme.colors.textMuted,
        }}
      >
        {name
          .slice(
            0,
            2,
          )
          .toUpperCase()}
      </span>
    );
  }

  return (
    <span
      className="
        flex
        shrink-0
        items-center
        justify-center
      "
      style={{
        width:
          size,

        height:
          size,
      }}
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
    </span>
  );
}

/*
|--------------------------------------------------------------------------
| Calendar helpers
|--------------------------------------------------------------------------
*/

function buildCalendarDays(
  month:
    Date,
) {
  const year =
    month.getFullYear();

  const monthIndex =
    month.getMonth();

  const firstDay =
    new Date(
      year,
      monthIndex,
      1,
    );

  /*
   * Convert JS Sunday-first index
   * into Monday-first calendar.
   *
   * Mon = 0
   * Tue = 1
   * ...
   * Sun = 6
   */

  const offset =
    (
      firstDay.getDay() +
      6
    ) %
    7;

  const start =
    new Date(
      year,
      monthIndex,
      1 -
        offset,
    );

  return Array.from(
    {
      length:
        42,
    },
    (
      _,
      index,
    ) => {
      const day =
        new Date(
          start,
        );

      day.setDate(
        start.getDate() +
          index,
      );

      return day;
    },
  );
}

function getSeasonBounds(
  matches:
    Match[],

  fallback:
    Date,
) {
  if (
    matches.length ===
    0
  ) {
    const value =
      monthIndexFromDate(
        fallback,
      );

    return {
      min:
        value,

      max:
        value,
    };
  }

  const indexes =
    matches.map(
      (
        match,
      ) =>
        monthIndexFromDate(
          new Date(
            match.kickoff,
          ),
        ),
    );

  return {
    min:
      Math.min(
        ...indexes,
      ),

    max:
      Math.max(
        ...indexes,
      ),
  };
}

function getInitialFocusMatch(
  matches:
    Match[],

  generatedAt:
    string,
) {
  const now =
    new Date(
      generatedAt,
    ).getTime();

  const live =
    matches.find(
      (
        match,
      ) =>
        [
          "live",
          "halftime",
          "extra_time",
          "penalties",
        ].includes(
          match.status,
        ),
    );

  if (live) {
    return live;
  }

  const next =
    matches.find(
      (
        match,
      ) =>
        match.status ===
          "scheduled" &&
        new Date(
          match.kickoff,
        ).getTime() >=
          now,
    );

  if (next) {
    return next;
  }

  return matches
    .filter(
      (
        match,
      ) =>
        match.status ===
          "finished" &&
        new Date(
          match.kickoff,
        ).getTime() <=
          now,
    )
    .sort(
      (
        left,
        right,
      ) =>
        new Date(
          right.kickoff,
        ).getTime() -
        new Date(
          left.kickoff,
        ).getTime(),
    )[0] ??
    null;
}

function monthIndexFromDate(
  date:
    Date,
) {
  return (
    date.getFullYear() *
      12 +
    date.getMonth()
  );
}

function monthKeyFromDate(
  date:
    Date,
) {
  return monthKeyFromIndex(
    monthIndexFromDate(
      date,
    ),
  );
}

function monthKeyFromIndex(
  value:
    number,
) {
  const year =
    Math.floor(
      value /
        12,
    );

  const month =
    value %
    12;

  return `${year}-${String(
    month +
      1,
  ).padStart(
    2,
    "0",
  )}`;
}

function monthDateFromKey(
  key:
    string,
) {
  const [
    yearText,
    monthText,
  ] =
    key.split(
      "-",
    );

  return new Date(
    Number(
      yearText,
    ),
    Number(
      monthText,
    ) -
      1,
    1,
  );
}

function dayKey(
  date:
    Date,
) {
  return [
    date.getFullYear(),
    String(
      date.getMonth() +
        1,
    ).padStart(
      2,
      "0",
    ),
    String(
      date.getDate(),
    ).padStart(
      2,
      "0",
    ),
  ].join(
    "-",
  );
}

function clamp(
  value:
    number,

  min:
    number,

  max:
    number,
) {
  return Math.min(
    Math.max(
      value,
      min,
    ),
    max,
  );
}

/*
|--------------------------------------------------------------------------
| Formatting
|--------------------------------------------------------------------------
*/

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

function formatLongDate(
  value:
    string,
) {
  return new Date(
    value,
  ).toLocaleDateString(
    "en-GB",
    {
      weekday:
        "short",

      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",
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
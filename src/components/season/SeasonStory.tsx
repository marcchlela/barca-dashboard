"use client";

import Link from "next/link";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  CSSProperties,
  ReactNode,
} from "react";

import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleX,
  Cross,
  Flag,
  FlagTriangleRight,
  History,
  Sparkles,
  Star,
  Trophy,
  Zap,
} from "lucide-react";

import type {
  DashboardOverview,
} from "../../lib/dashboard/overview";

import type {
  KitTheme,
} from "../../lib/themes";

type SeasonStoryProps = {
  theme: KitTheme;
  overview: DashboardOverview;
};

type StoryEvent =
  DashboardOverview["seasonStory"][number];

type PositionedEvent =
  StoryEvent & {
    idealPosition: number;
    displayPosition: number;
  };

/*
|--------------------------------------------------------------------------
| Timeline dimensions
|--------------------------------------------------------------------------
*/

const TRACK_MIN_WIDTH = 1540;

const TRACK_HEIGHT = 245;

const TIMELINE_Y = 58;

const CARD_TOP = 96;

const CARD_WIDTH = 154;

/*
 * A 154px card on a 1540px timeline
 * occupies about 10% of the width.
 *
 * 10.75% gives every card its own
 * boundary plus a small visual gap.
 *
 * This also still allows up to 9
 * curated events to fit in one row.
 */
const MIN_EVENT_GAP = 10.75;

const LEFT_BOUNDARY = 6;
const RIGHT_BOUNDARY = 94;

export default function SeasonStory({
  theme,
  overview,
}: SeasonStoryProps) {
  const scrollRef =
    useRef<HTMLDivElement>(null);

  const [
    canScrollLeft,
    setCanScrollLeft,
  ] = useState(false);

  const [
    canScrollRight,
    setCanScrollRight,
  ] = useState(false);

  /*
  |--------------------------------------------------------------------------
  | Season dates
  |--------------------------------------------------------------------------
  */

  const seasonStart =
    useMemo(
      () =>
        overview.season.startDate
          ? new Date(
              overview.season.startDate,
            )
          : new Date(
              `${overview.season.startYear}-08-01T00:00:00Z`,
            ),
      [
        overview.season.startDate,
        overview.season.startYear,
      ],
    );

  const seasonEnd =
    useMemo(
      () =>
        overview.season.endDate
          ? new Date(
              overview.season.endDate,
            )
          : new Date(
              `${overview.season.endYear}-05-31T23:59:59Z`,
            ),
      [
        overview.season.endDate,
        overview.season.endYear,
      ],
    );

  /*
  |--------------------------------------------------------------------------
  | Collision-free event layout
  |--------------------------------------------------------------------------
  */

  const events =
    useMemo(
      () =>
        layoutEvents(
          overview.seasonStory,
          seasonStart,
          seasonEnd,
        ),
      [
        overview.seasonStory,
        seasonStart,
        seasonEnd,
      ],
    );

  const months =
    useMemo(
      () =>
        buildMonths(
          overview.season.startYear,
          overview.season.endYear,
          seasonStart,
          seasonEnd,
        ),
      [
        overview.season.startYear,
        overview.season.endYear,
        seasonStart,
        seasonEnd,
      ],
    );

  /*
  |--------------------------------------------------------------------------
  | Arrow state
  |--------------------------------------------------------------------------
  */

  const updateScrollState =
    useCallback(() => {
      const element =
        scrollRef.current;

      if (!element) {
        return;
      }

      setCanScrollLeft(
        element.scrollLeft > 4,
      );

      setCanScrollRight(
        element.scrollLeft +
          element.clientWidth <
          element.scrollWidth - 4,
      );
    }, []);

  useEffect(() => {
    const element =
      scrollRef.current;

    if (!element) {
      return;
    }

    updateScrollState();

    element.addEventListener(
      "scroll",
      updateScrollState,
    );

    window.addEventListener(
      "resize",
      updateScrollState,
    );

    return () => {
      element.removeEventListener(
        "scroll",
        updateScrollState,
      );

      window.removeEventListener(
        "resize",
        updateScrollState,
      );
    };
  }, [
    updateScrollState,
  ]);

  function scrollTimeline(
    direction: -1 | 1,
  ) {
    const element =
      scrollRef.current;

    if (!element) {
      return;
    }

    element.scrollBy({
      left:
        direction *
        Math.max(
          450,
          element.clientWidth * 0.72,
        ),

      behavior: "smooth",
    });
  }

  return (
    <section
      className="border-t pt-5"
      style={{
        borderColor:
          theme.colors.border,
      }}
    >
      {/* HEADER */}

      <div className="flex items-end justify-between gap-6">
        <div>
          <p
            className="text-[10px] uppercase tracking-[0.26em]"
            style={{
              color:
                theme.colors.textMuted,
            }}
          >
            Season Story
          </p>

          <h2 className="mt-1 text-xl font-medium tracking-[-0.02em]">
            {overview.season.label}
          </h2>
        </div>

        <div
          className="text-right text-[9px] uppercase tracking-[0.18em]"
          style={{
            color:
              theme.colors.textMuted,
          }}
        >
          Curated moments

          <span
            className="ml-3"
            style={{
              color:
                theme.colors.text,
            }}
          >
            {events.length}
          </span>
        </div>
      </div>

      {/* TIMELINE */}

      <div className="relative mt-7">

        {/* LEFT ARROW */}

        <button
          type="button"
          aria-label="Scroll timeline left"
          disabled={!canScrollLeft}
          onClick={() =>
            scrollTimeline(-1)
          }
          className="absolute left-1 top-[112px] z-30 flex h-9 w-9 items-center justify-center border transition disabled:cursor-default disabled:opacity-20"
          style={{
            backgroundColor:
              theme.colors.background,

            borderColor:
              theme.colors.border,

            color:
              theme.colors.text,
          }}
        >
          <ChevronLeft
            size={17}
          />
        </button>

        {/* RIGHT ARROW */}

        <button
          type="button"
          aria-label="Scroll timeline right"
          disabled={!canScrollRight}
          onClick={() =>
            scrollTimeline(1)
          }
          className="absolute right-1 top-[112px] z-30 flex h-9 w-9 items-center justify-center border transition disabled:cursor-default disabled:opacity-20"
          style={{
            backgroundColor:
              theme.colors.background,

            borderColor:
              theme.colors.border,

            color:
              theme.colors.text,
          }}
        >
          <ChevronRight
            size={17}
          />
        </button>

        {/* SCROLL VIEWPORT */}

        <div
          ref={scrollRef}
          className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{
            scrollbarWidth: "none",
          }}
        >
          <div
            className="relative"
            style={{
              minWidth:
                `${TRACK_MIN_WIDTH}px`,

              height:
                `${TRACK_HEIGHT}px`,
            }}
          >
            {/* MAIN TIMELINE LINE */}

            <div
              className="absolute left-5 right-5 h-px"
              style={{
                top:
                  `${TIMELINE_Y}px`,

                backgroundColor:
                  theme.colors.border,
              }}
            />

            {/* MONTHS */}

            {months.map(
              (month) => (
                <div
                  key={
                    month.key
                  }
                  className="absolute -translate-x-1/2 text-[9px] uppercase tracking-[0.18em]"
                  style={{
                    left:
                      `${month.position}%`,

                    top: "8px",

                    color:
                      theme.colors.textMuted,
                  }}
                >
                  {month.label}
                </div>
              ),
            )}

            {/* EVENTS */}

            {events.map(
              (event) => {
                const color =
                  eventColor(
                    event.kind,
                    theme,
                  );

                const connectorTop =
                  TIMELINE_Y + 7;

                const connectorHeight =
                  CARD_TOP -
                  connectorTop -
                  6;

                return (
                  <div
                    key={
                      event.id
                    }
                    className="absolute top-0 -translate-x-1/2"
                    style={{
                      left:
                        `${event.displayPosition}%`,
                    }}
                  >
                    {/* EVENT MARKER */}

                    <div
                      className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 border-2"
                      style={{
                        left: 0,

                        top:
                          `${TIMELINE_Y}px`,

                        borderColor:
                          theme.colors.background,

                        backgroundColor:
                          color,
                      }}
                    />

                    {/* VERTICAL CONNECTOR */}

                    <div
                      className="absolute w-px -translate-x-1/2"
                      style={{
                        left: 0,

                        top:
                          `${connectorTop}px`,

                        height:
                          `${connectorHeight}px`,

                        backgroundColor:
                          theme.colors.border,
                      }}
                    />

                    {/* EVENT CARD */}

                    <EventCardLink
                      event={event}
                      className="absolute -translate-x-1/2 text-center"
                      style={{
                        width:
                          `${CARD_WIDTH}px`,

                        left: 0,

                        top:
                          `${CARD_TOP}px`,
                      }}
                    >
                      <div className="flex h-8 items-center justify-center">
                        <EventVisual
                          event={event}
                          color={color}
                          theme={theme}
                        />
                      </div>

                      <p
                        className="mt-1 text-[8px] uppercase tracking-[0.16em]"
                        style={{
                          color:
                            theme.colors.textMuted,
                        }}
                      >
                        {formatDate(
                          event.date,
                        )}
                      </p>

                      <p className="mt-1 text-[10px] font-medium leading-4">
                        {event.title}
                      </p>

                      {event.subtitle ? (
                        <p
                          className="mx-auto mt-1 line-clamp-2 text-[8px] leading-3.5"
                          style={{
                            color:
                              theme.colors.textMuted,
                          }}
                        >
                          {event.subtitle}
                        </p>
                      ) : null}
                    </EventCardLink>
                  </div>
                );
              },
            )}
          </div>
        </div>
      </div>

      {/* FOOTER */}

      <div
        className="flex items-center justify-between border-t pt-4"
        style={{
          borderColor:
            theme.colors.border,
        }}
      >
        <p
          className="text-[9px] uppercase tracking-[0.2em]"
          style={{
            color:
              theme.colors.textMuted,
          }}
        >
          Only the moments that shape the season
        </p>

        <div className="flex items-center gap-4">
          <Legend
            label="W"
            color={
              theme.colors.success
            }
          />

          <Legend
            label="D"
            color={
              theme.colors.textMuted
            }
          />

          <Legend
            label="L"
            color={
              theme.colors.danger
            }
          />

          <Legend
            label="KEY"
            color={
              theme.colors.accent
            }
          />
        </div>
      </div>
    </section>
  );
}

/*
|--------------------------------------------------------------------------
| Event card link
|--------------------------------------------------------------------------
|
| Match-derived events:
|
| match:UUID
|
| → clickable
|
| Manual SeasonMoment events:
|
| moment:UUID
|
| → non-clickable for now.
|--------------------------------------------------------------------------
*/

function EventCardLink({
  event,
  children,
  className,
  style,
}: {
  event: StoryEvent;

  children: ReactNode;

  className: string;

  style: CSSProperties;
}) {
  if (
    event.id.startsWith(
      "match:",
    )
  ) {
    const matchId =
      event.id.slice(
        "match:".length,
      );

    return (
      <Link
        href={`/matches/${matchId}`}
        className={`${className} cursor-pointer transition-transform duration-150 hover:-translate-x-1/2 hover:-translate-y-1`}
        style={style}
      >
        {children}
      </Link>
    );
  }

  return (
    <div
      className={className}
      style={style}
    >
      {children}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Event visuals
|--------------------------------------------------------------------------
*/

function EventVisual({
  event,
  color,
  theme,
}: {
  event: StoryEvent;

  color: string;

  theme: KitTheme;
}) {
  /*
  |--------------------------------------------------------------------------
  | EL CLÁSICO
  |--------------------------------------------------------------------------
  */

  if (
    event.icon ===
      "clasico" &&
    event.teams
  ) {
    const barca =
      event.teams.find(
        (team) =>
          team.code ===
          "FCB",
      );

    const madrid =
      event.teams.find(
        (team) =>
          team.code ===
            "RMA" ||
          team.name
            .toLowerCase()
            .includes(
              "real madrid",
            ),
      );

    return (
      <div className="flex items-center">
        <TeamMiniCrest
          team={barca}
        />

        <span
          className="mx-1 text-[8px] font-semibold"
          style={{
            color:
              theme.colors.textMuted,
          }}
        >
          VS
        </span>

        <TeamMiniCrest
          team={madrid}
        />
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | CHAMPIONS LEAGUE
  |--------------------------------------------------------------------------
  |
  | Logo only.
  |--------------------------------------------------------------------------
  */

  if (
    event.icon ===
      "champions-league" &&
    event.competition
      ?.logoUrl
  ) {
    return (
      <div
        className="flex h-8 w-10 items-center justify-center"
        style={{
          backgroundColor:
            "#F3F1EB",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}

        <img
          src={
            event.competition.logoUrl
          }
          alt="UEFA Champions League"
          className="h-6 w-6 object-contain"
        />
      </div>
    );
  }

  const iconProps = {
    size: 15,

    strokeWidth: 1.7,

    style: {
      color,
    },
  };

  switch (
    event.icon
  ) {
    /*
     * First game of season
     */
    case "season-opener":
      return (
        <Flag
          {...iconProps}
        />
      );

    /*
     * Big dominant win
     */
    case "statement-win":
      return (
        <Zap
          {...iconProps}
        />
      );

    /*
     * Most recent result
     */
    case "latest-result":
      return (
        <History
          {...iconProps}
        />
      );

    /*
     * Next scheduled match
     */
    case "next-match":
      return (
        <CalendarClock
          {...iconProps}
        />
      );

    /*
     * Last league fixture
     */
    case "league-finale":
      return (
        <FlagTriangleRight
          {...iconProps}
        />
      );

    /*
     * First defeat of season
     */
    case "first-loss":
      return (
        <CircleX
          {...iconProps}
        />
      );

    case "trophy":
      return (
        <Trophy
          {...iconProps}
        />
      );

    case "injury":
      return (
        <Cross
          {...iconProps}
        />
      );

    case "key":
      return (
        <Star
          {...iconProps}
        />
      );

    default:
      return (
        <Sparkles
          {...iconProps}
        />
      );
  }
}

/*
|--------------------------------------------------------------------------
| Team crest
|--------------------------------------------------------------------------
*/

function TeamMiniCrest({
  team,
}: {
  team:
    | {
        name: string;

        crestUrl:
          string | null;
      }
    | undefined;
}) {
  if (
    !team?.crestUrl
  ) {
    return (
      <div className="h-6 w-6 border opacity-40" />
    );
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}

      <img
        src={
          team.crestUrl
        }
        alt={
          team.name
        }
        className="h-7 w-7 object-contain"
      />
    </>
  );
}

/*
|--------------------------------------------------------------------------
| Collision-free horizontal placement
|--------------------------------------------------------------------------
|
| EVERYTHING stays on one row.
|
| 1. Each event gets its ideal chronological position.
|
| 2. If the next event would overlap the previous card,
|    it gets pushed horizontally to the right.
|
| 3. If that causes the end of the timeline to overflow,
|    we work backwards from the right side.
|
| Result:
|
| event      gap      event      gap      event
|
| No vertical lanes.
|--------------------------------------------------------------------------
*/

function layoutEvents(
  events:
    DashboardOverview["seasonStory"],

  seasonStart:
    Date,

  seasonEnd:
    Date,
): PositionedEvent[] {
  const positioned =
    [...events]
      .sort(
        (a, b) =>
          new Date(
            a.date,
          ).getTime() -
          new Date(
            b.date,
          ).getTime(),
      )
      .map(
        (event) => {
          const ideal =
            eventPosition(
              event.date,
              seasonStart,
              seasonEnd,
            );

          return {
            ...event,

            idealPosition:
              ideal,

            displayPosition:
              clamp(
                ideal,
                LEFT_BOUNDARY,
                RIGHT_BOUNDARY,
              ),
          };
        },
      );

  if (
    positioned.length <=
    1
  ) {
    return positioned;
  }

  /*
  |--------------------------------------------------------------------------
  | Forward pass
  |--------------------------------------------------------------------------
  */

  for (
    let index = 1;
    index <
    positioned.length;
    index++
  ) {
    const previous =
      positioned[
        index - 1
      ];

    const current =
      positioned[index];

    const minimum =
      previous.displayPosition +
      MIN_EVENT_GAP;

    if (
      current.displayPosition <
      minimum
    ) {
      current.displayPosition =
        minimum;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Right boundary correction
  |--------------------------------------------------------------------------
  */

  const last =
    positioned[
      positioned.length - 1
    ];

  if (
    last.displayPosition >
    RIGHT_BOUNDARY
  ) {
    last.displayPosition =
      RIGHT_BOUNDARY;

    for (
      let index =
        positioned.length -
        2;
      index >= 0;
      index--
    ) {
      const current =
        positioned[index];

      const next =
        positioned[
          index + 1
        ];

      const maximum =
        next.displayPosition -
        MIN_EVENT_GAP;

      current.displayPosition =
        Math.min(
          current.displayPosition,
          maximum,
        );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Left boundary correction
  |--------------------------------------------------------------------------
  */

  const first =
    positioned[0];

  if (
    first.displayPosition <
    LEFT_BOUNDARY
  ) {
    const shift =
      LEFT_BOUNDARY -
      first.displayPosition;

    for (
      const event of
        positioned
    ) {
      event.displayPosition +=
        shift;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Final safety pass
  |--------------------------------------------------------------------------
  */

  for (
    let index = 1;
    index <
    positioned.length;
    index++
  ) {
    const previous =
      positioned[
        index - 1
      ];

    const current =
      positioned[index];

    current.displayPosition =
      Math.max(
        current.displayPosition,

        previous.displayPosition +
          MIN_EVENT_GAP,
      );
  }

  return positioned;
}

/*
|--------------------------------------------------------------------------
| Month markers
|--------------------------------------------------------------------------
*/

function buildMonths(
  startYear:
    number,

  endYear:
    number,

  seasonStart:
    Date,

  seasonEnd:
    Date,
) {
  const values = [
    [
      `${startYear}-08`,
      "AUG",
      `${startYear}-08-01`,
    ],

    [
      `${startYear}-09`,
      "SEP",
      `${startYear}-09-01`,
    ],

    [
      `${startYear}-10`,
      "OCT",
      `${startYear}-10-01`,
    ],

    [
      `${startYear}-11`,
      "NOV",
      `${startYear}-11-01`,
    ],

    [
      `${startYear}-12`,
      "DEC",
      `${startYear}-12-01`,
    ],

    [
      `${endYear}-01`,
      "JAN",
      `${endYear}-01-01`,
    ],

    [
      `${endYear}-02`,
      "FEB",
      `${endYear}-02-01`,
    ],

    [
      `${endYear}-03`,
      "MAR",
      `${endYear}-03-01`,
    ],

    [
      `${endYear}-04`,
      "APR",
      `${endYear}-04-01`,
    ],

    [
      `${endYear}-05`,
      "MAY",
      `${endYear}-05-01`,
    ],
  ] as const;

  return values.map(
    ([
      key,
      label,
      date,
    ]) => ({
      key,

      label,

      position:
        eventPosition(
          `${date}T00:00:00Z`,

          seasonStart,

          seasonEnd,
        ),
    }),
  );
}

/*
|--------------------------------------------------------------------------
| Timeline date → percentage
|--------------------------------------------------------------------------
*/

function eventPosition(
  value: string,

  start: Date,

  end: Date,
) {
  const date =
    new Date(value);

  const total =
    end.getTime() -
    start.getTime();

  if (
    total <= 0
  ) {
    return 50;
  }

  const elapsed =
    date.getTime() -
    start.getTime();

  return (
    (elapsed / total) *
    100
  );
}

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function clamp(
  value: number,

  minimum: number,

  maximum: number,
) {
  return Math.min(
    maximum,

    Math.max(
      minimum,
      value,
    ),
  );
}

function eventColor(
  kind:
    StoryEvent["kind"],

  theme:
    KitTheme,
) {
  switch (kind) {
    case "win":
      return theme.colors.success;

    case "draw":
      return theme.colors.textMuted;

    case "loss":
    case "injury":
      return theme.colors.danger;

    default:
      return theme.colors.accent;
  }
}

function Legend({
  label,
  color,
}: {
  label: string;

  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-1.5 w-1.5"
        style={{
          backgroundColor:
            color,
        }}
      />

      <span className="text-[9px] uppercase tracking-[0.14em]">
        {label}
      </span>
    </div>
  );
}

function formatDate(
  value: string,
) {
  return new Date(
    value,
  )
    .toLocaleDateString(
      "en-GB",
      {
        day:
          "2-digit",

        month:
          "short",
      },
    )
    .toUpperCase();
}
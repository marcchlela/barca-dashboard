"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  ReactNode,
} from "react";

import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  ShieldCheck,
  Star,
  UserRound,
  X,
} from "lucide-react";

import CountryFlag from "./CountryFlag";
import { displayHeatmapRow, displayHeatmapY, heatmapColor, heatmapStrength } from "../../lib/squad/heatmap-display";

import type {
  KitTheme,
} from "../../lib/themes";

import type {
  SquadOverviewData,
} from "../../lib/squad/get-squad-overview";

type SquadPlayer =
  SquadOverviewData[
    "players"
  ][number];

type RecentMatch =
  SquadPlayer[
    "recentMatches"
  ][number];

type HeatCell = {
  column:
    number;

  row:
    number;

  count:
    number;

  intensity:
    number;
};

type RenderableHeatmap = {
  sampleSize:
    number;

  columns:
    number;

  rows:
    number;

  cells:
    HeatCell[];
};

type Props = {
  player:
    SquadPlayer;

  favourite:
    boolean;

  favouriteBusy:
    boolean;

  previousPlayerName:
    string | null;

  nextPlayerName:
    string | null;

  onPrevious:
    () => void;

  onNext:
    () => void;

  onToggleFavourite:
    (
      playerId:
        string,
    ) => void;

  onClose:
    () => void;

  theme:
    KitTheme;
};

export default function PlayerQuickView({
  player,
  favourite,
  favouriteBusy,
  previousPlayerName,
  nextPlayerName,
  onPrevious,
  onNext,
  onToggleFavourite,
  onClose,
  theme,
}: Props) {
  useEffect(
    () => {
      const previousBodyOverflow =
        document.body.style
          .overflow;

      const previousHtmlOverflow =
        document.documentElement
          .style
          .overflow;

      document.body.style.overflow =
        "hidden";

      document.documentElement
        .style
        .overflow =
        "hidden";

      function handleKeyDown(
        event:
          KeyboardEvent,
      ) {
        if (
          event.key ===
          "Escape"
        ) {
          onClose();

          return;
        }

        if (
          event.key ===
            "ArrowLeft" &&
          previousPlayerName
        ) {
          onPrevious();

          return;
        }

        if (
          event.key ===
            "ArrowRight" &&
          nextPlayerName
        ) {
          onNext();
        }
      }

      window.addEventListener(
        "keydown",
        handleKeyDown,
      );

      return () => {
        document.body.style.overflow =
          previousBodyOverflow;

        document.documentElement
          .style
          .overflow =
          previousHtmlOverflow;

        window.removeEventListener(
          "keydown",
          handleKeyDown,
        );
      };
    },
    [
      nextPlayerName,
      onClose,
      onNext,
      onPrevious,
      previousPlayerName,
    ],
  );

  return (
    <div
      className="
        fixed
        inset-0
        z-[100]
        flex
        items-center
        justify-center
        overscroll-none
        bg-black/72
        p-4
        backdrop-blur-[5px]

        sm:p-6
        lg:p-8
      "
      onMouseDown={
        (
          event,
        ) => {
          if (
            event.currentTarget ===
            event.target
          ) {
            onClose();
          }
        }
      }
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${player.displayName} player profile`}
        className="
          relative
          flex
          w-full
          max-w-[1320px]
          flex-col
          overflow-hidden
          border
          shadow-2xl
        "
        style={{
          height:
            "min(820px, calc(100dvh - 48px))",

          borderColor:
            theme.colors.border,

          backgroundColor:
            theme.colors.background,
        }}
      >
        <div
          className="
            absolute
            left-0
            right-0
            top-0
            z-50
            flex
            h-[3px]
          "
        >
          <div
            className="flex-1"
            style={{
              backgroundColor:
                theme.colors.primary,
            }}
          />

          <div
            className="flex-1"
            style={{
              backgroundColor:
                theme.colors.secondary,
            }}
          />
        </div>

        <header
          className="
            flex
            h-[58px]
            shrink-0
            items-center
            justify-between
            gap-4
            border-b
            px-4

            sm:px-5
          "
          style={{
            borderColor:
              theme.colors.border,

            backgroundColor:
              theme.colors.backgroundElevated,
          }}
        >
          <div className="min-w-0">
            <p
              className="
                text-[8px]
                uppercase
                tracking-[0.19em]
              "
              style={{
                color:
                  theme.colors.accent,
              }}
            >
              Player Profile
            </p>

            <p
              className="
                mt-0.5
                truncate
                text-[11px]
                font-medium
              "
            >
              {player.displayName} · #
              {player.shirtNumber ??
                "—"}
            </p>
          </div>

          <div
            className="
              flex
              shrink-0
              items-center
              gap-2
            "
          >
            <NavButton
              disabled={
                !previousPlayerName
              }
              title={
                previousPlayerName
                  ? `Previous: ${previousPlayerName}`
                  : "No previous player"
              }
              onClick={
                onPrevious
              }
              theme={
                theme
              }
            >
              <ChevronLeft
                size={16}
              />
            </NavButton>

            <NavButton
              disabled={
                !nextPlayerName
              }
              title={
                nextPlayerName
                  ? `Next: ${nextPlayerName}`
                  : "No next player"
              }
              onClick={
                onNext
              }
              theme={
                theme
              }
            >
              <ChevronRight
                size={16}
              />
            </NavButton>

            <NavButton
              title="Close"
              onClick={
                onClose
              }
              theme={
                theme
              }
            >
              <X
                size={16}
              />
            </NavButton>
          </div>
        </header>

        <div
          className="
            min-h-0
            flex-1
            overflow-x-hidden
            overflow-y-auto
            overscroll-contain
          "
        >
          <div
            className="
              grid
              min-h-full

              xl:grid-cols-[310px_minmax(0,1fr)]
            "
          >
            <div
              className="
                xl:sticky
                xl:top-0
                xl:self-start
              "
            >
              <PlayerRail
                player={
                  player
                }
                theme={
                  theme
                }
              />
            </div>

            <main
              className="
                min-w-0
                p-5

                sm:p-6
                xl:p-7
              "
            >
              <div
                className="
                  flex
                  flex-wrap
                  items-center
                  justify-between
                  gap-4
                "
              >
                <div>
                  <p
                    className="
                      text-[8px]
                      uppercase
                      tracking-[0.17em]
                    "
                    style={{
                      color:
                        theme.colors.accent,
                    }}
                  >
                    Squad Intelligence
                  </p>

                  <p
                    className="
                      mt-1
                      text-[10px]
                    "
                    style={{
                      color:
                        theme.colors.textMuted,
                    }}
                  >
                    Canonical season
                    profile and tracked
                    performance
                  </p>
                </div>

                <div
                  className="
                    flex
                    flex-wrap
                    items-center
                    gap-2
                  "
                >
                  {player.isCaptain ? (
                    <CaptainBadge
                      theme={
                        theme
                      }
                    />
                  ) : null}

                  <FavouriteButton
                    player={
                      player
                    }
                    favourite={
                      favourite
                    }
                    favouriteBusy={
                      favouriteBusy
                    }
                    onToggleFavourite={
                      onToggleFavourite
                    }
                    theme={
                      theme
                    }
                  />
                </div>
              </div>

              <PlayerDetails
                player={
                  player
                }
                theme={
                  theme
                }
              />

              <SeasonOutput
                player={
                  player
                }
                theme={
                  theme
                }
              />

              <PerformanceBlock
                player={
                  player
                }
                theme={
                  theme
                }
              />

              <RatingTrend
                player={
                  player
                }
                theme={
                  theme
                }
              />

              <RecentForm
                player={
                  player
                }
                theme={
                  theme
                }
              />

              <PlayerHeatmap
                player={
                  player
                }
                theme={
                  theme
                }
              />

              <CoveragePanel
                player={
                  player
                }
                theme={
                  theme
                }
              />

              <div
                className="
                  mt-6
                  border-t
                  pt-4
                  text-[7px]
                  leading-4
                "
                style={{
                  borderColor:
                    theme.colors.border,

                  color:
                    theme.colors.textMuted,
                }}
              >
                ← / → browse players ·
                Esc closes player profile
              </div>
            </main>
          </div>
        </div>
      </section>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Sticky player rail
|--------------------------------------------------------------------------
*/

function PlayerRail({
  player,
  theme,
}: {
  player:
    SquadPlayer;

  theme:
    KitTheme;
}) {
  return (
    <aside
      className="
        border-b

        xl:min-h-[762px]
        xl:border-b-0
        xl:border-r
      "
      style={{
        borderColor:
          theme.colors.border,

        background: `
          radial-gradient(
            circle at 50% 33%,
            ${theme.colors.primary}22,
            transparent 45%
          ),
          ${theme.colors.surface}
        `,
      }}
    >
      <div
        className="
          relative
          flex
          h-[82px]
          items-center
          justify-between
          overflow-hidden
          border-b
          px-5
        "
        style={{
          borderColor:
            theme.colors.border,
        }}
      >
        <div
          className="
            relative
            z-10
          "
        >
          <p
            className="
              text-[8px]
              uppercase
              tracking-[0.16em]
            "
            style={{
              color:
                theme.colors.accent,
            }}
          >
            First Team
          </p>

          <p
            className="
              mt-1
              text-[10px]
              font-medium
            "
          >
            {
              positionTitle(
                player.position,
              )
            }
          </p>
        </div>

        <div
          className="
            text-[70px]
            font-semibold
            leading-none
            tracking-[-0.1em]
            opacity-[0.10]
          "
        >
          {
            player.shirtNumber ??
            "—"
          }
        </div>
      </div>

      <div
        className="
          relative
          mx-auto
          mt-4
          aspect-[4/5]
          w-[calc(100%-32px)]
          max-h-[360px]
          overflow-hidden
          border
        "
        style={{
          borderColor:
            theme.colors.border,

          backgroundColor:
            "#ffffff",
        }}
      >
        {player.portraitUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={
              player.portraitUrl
            }
            alt={
              player.displayName
            }
            draggable={
              false
            }
            className="
              h-full
              w-full
              object-cover
              object-top
            "
          />
        ) : (
          <div
            className="
              flex
              h-full
              w-full
              items-center
              justify-center
            "
          >
            <UserRound
              size={70}
              strokeWidth={
                0.8
              }
              style={{
                color:
                  theme.colors.textMuted,
              }}
            />
          </div>
        )}
      </div>

      <div
        className="
          px-5
          pb-5
          pt-4
        "
      >
        <p
          className="
            text-[8px]
            uppercase
            tracking-[0.13em]
          "
          style={{
            color:
              theme.colors.accent,
          }}
        >
          #
          {
            player.shirtNumber ??
            "—"
          }{" "}
          ·{" "}
          {
            positionShort(
              player.position,
            )
          }
        </p>

        <h3
          className="
            mt-1
            text-[21px]
            font-medium
            tracking-[-0.03em]
          "
        >
          {
            player.displayName
          }
        </h3>

        <div
          className="
            mt-3
            text-[10px]
          "
          style={{
            color:
              theme.colors.textMuted,
          }}
        >
          <CountryFlag
            nationality={
              player.nationality
            }
          />
        </div>

        <div className="mt-4">
          <AvailabilityStrip
            player={
              player
            }
            theme={
              theme
            }
          />
        </div>
      </div>
    </aside>
  );
}

/*
|--------------------------------------------------------------------------
| Details
|--------------------------------------------------------------------------
*/

function PlayerDetails({
  player,
  theme,
}: {
  player:
    SquadPlayer;

  theme:
    KitTheme;
}) {
  const details:
    Array<{
      label:
        string;

      value:
        ReactNode;
    }> = [
      {
        label:
          "Nationality",

        value: (
          <CountryFlag
            nationality={
              player.nationality
            }
          />
        ),
      },

      {
        label:
          "Age",

        value:
          formatAge(
            player,
          ),
      },

      {
        label:
          "Position",

        value:
          positionTitle(
            player.position,
          ),
      },

      {
        label:
          "Shirt Number",

        value:
          player.shirtNumber !==
          null
            ? `#${player.shirtNumber}`
            : "—",
      },
    ];

  if (
    player.preferredFoot
  ) {
    details.push({
      label:
        "Preferred Foot",

      value:
        humanize(
          player.preferredFoot,
        ),
    });
  }

  if (
    player.joinedAt
  ) {
    details.push({
      label:
        "Squad Since",

      value:
        formatDate(
          player.joinedAt,
        ),
    });
  }

  return (
    <section className="mt-6">
      <SectionHeading
        label="Player Details"
        theme={
          theme
        }
      />

      <div
        className="
          mt-3
          grid
          grid-cols-2
          gap-px
          border

          lg:grid-cols-4
        "
        style={{
          borderColor:
            theme.colors.border,

          backgroundColor:
            theme.colors.border,
        }}
      >
        {details.map(
          (
            detail,
          ) => (
            <DetailBox
              key={
                detail.label
              }
              label={
                detail.label
              }
              theme={
                theme
              }
            >
              {
                detail.value
              }
            </DetailBox>
          ),
        )}
      </div>
    </section>
  );
}

/*
|--------------------------------------------------------------------------
| Season output
|--------------------------------------------------------------------------
*/

function SeasonOutput({
  player,
  theme,
}: {
  player:
    SquadPlayer;

  theme:
    KitTheme;
}) {
  return (
    <section className="mt-6">
      <SectionHeading
        label="Season Output"
        theme={
          theme
        }
      />

      <div
        className="
          mt-3
          grid
          grid-cols-5
          gap-px
          border
        "
        style={{
          borderColor:
            theme.colors.border,

          backgroundColor:
            theme.colors.border,
        }}
      >
        <StatBox
          label="Apps"
          value={
            player.stats
              .appearances
          }
          theme={
            theme
          }
        />

        <StatBox
          label="Minutes"
          value={
            player.stats
              .minutes
          }
          theme={
            theme
          }
        />

        <StatBox
          label="Goals"
          value={
            player.stats
              .goals
          }
          theme={
            theme
          }
        />

        <StatBox
          label="Assists"
          value={
            player.stats
              .assists
          }
          theme={
            theme
          }
        />

        <StatBox
          label="Rating"
          value={
            player.stats
              .averageRating ??
            "—"
          }
          accent
          theme={
            theme
          }
        />
      </div>
    </section>
  );
}

/*
|--------------------------------------------------------------------------
| Performance
|--------------------------------------------------------------------------
*/

function PerformanceBlock({
  player,
  theme,
}: {
  player:
    SquadPlayer;

  theme:
    KitTheme;
}) {
  const advanced =
    player.stats
      .advanced;

  const metrics = [
    {
      label:
        "G+A",

      value:
        player.stats
          .goalContributions,

      accent:
        true,
    },

    {
      label:
        "G+A / 90",

      value:
        player.stats
          .contributionsPer90,

      accent:
        true,
    },

    {
      label:
        "xG",

      value:
        advanced.xG,
    },

    {
      label:
        "xA",

      value:
        advanced.xA,
    },

    {
      label:
        "Key Passes",

      value:
        advanced.keyPasses,
    },

    {
      label:
        "Pass Accuracy",

      value:
        percentage(
          advanced.passAccuracy,
        ),
    },

    {
      label:
        "Duels Won",

      value:
        percentage(
          advanced.duelWinRate,
        ),
    },

    {
      label:
        "Dribble Success",

      value:
        percentage(
          advanced.dribbleSuccessRate,
        ),
    },
  ];

  return (
    <section className="mt-6">
      <SectionHeading
        label="Performance"
        theme={
          theme
        }
      />

      <div
        className="
          mt-3
          grid
          grid-cols-2
          gap-px
          border

          md:grid-cols-4
        "
        style={{
          borderColor:
            theme.colors.border,

          backgroundColor:
            theme.colors.border,
        }}
      >
        {metrics.map(
          (
            metric,
          ) => (
            <PerformanceMetric
              key={
                metric.label
              }
              label={
                metric.label
              }
              value={
                metric.value
              }
              accent={
                metric.accent ??
                false
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
| Rating trend
|--------------------------------------------------------------------------
*/

function RatingTrend({
  player,
  theme,
}: {
  player:
    SquadPlayer;

  theme:
    KitTheme;
}) {
  const points =
    player.ratingHistory;

  return (
    <section className="mt-7">
      <SectionHeading
        label="Rating Trend"
        theme={
          theme
        }
      />

      <div
        className="
          mt-3
          border
          p-4
        "
        style={{
          borderColor:
            theme.colors.border,

          backgroundColor:
            theme.colors.backgroundElevated,
        }}
      >
        {points.length >=
        2 ? (
          <>
            <div
              className="
                flex
                items-start
                justify-between
                gap-5
              "
            >
              <div>
                <p
                  className="
                    text-[8px]
                    font-medium
                    uppercase
                    tracking-[0.11em]
                  "
                >
                  Match Rating
                </p>

                <p
                  className="
                    mt-1
                    text-[7px]
                  "
                  style={{
                    color:
                      theme.colors.textMuted,
                  }}
                >
                  Last{" "}
                  {
                    points.length
                  }{" "}
                  rated appearances
                </p>
              </div>

              <div className="text-right">
                <p
                  className="
                    text-[18px]
                    font-medium
                    tabular-nums
                  "
                  style={{
                    color:
                      theme.colors.accent,
                  }}
                >
                  {
                    points[
                      points.length -
                        1
                    ].rating
                  }
                </p>

                <p
                  className="
                    text-[6px]
                    uppercase
                  "
                  style={{
                    color:
                      theme.colors.textMuted,
                  }}
                >
                  latest
                </p>
              </div>
            </div>

            <RatingChart
              points={
                points
              }
              theme={
                theme
              }
            />
          </>
        ) : (
          <EmptyAnalysis
            text="Not enough rated appearances yet."
            theme={
              theme
            }
          />
        )}
      </div>
    </section>
  );
}

function RatingChart({
  points,
  theme,
}: {
  points:
    SquadPlayer[
      "ratingHistory"
    ];

  theme:
    KitTheme;
}) {
  const width =
    840;

  const height =
    210;

  const padding = {
    left:
      30,

    right:
      20,

    top:
      22,

    bottom:
      38,
  };

  const ratings =
    points.map(
      (
        point,
      ) =>
        point.rating,
    );

  const lowest =
    Math.min(
      ...ratings,
    );

  const highest =
    Math.max(
      ...ratings,
    );

  let minimum =
    Math.max(
      0,
      Math.floor(
        lowest -
          0.5,
      ),
    );

  let maximum =
    Math.min(
      10,
      Math.ceil(
        highest +
          0.5,
      ),
    );

  if (
    maximum -
      minimum <
    2
  ) {
    minimum =
      Math.max(
        0,
        minimum -
          1,
      );

    maximum =
      Math.min(
        10,
        maximum +
          1,
      );
  }

  const chartWidth =
    width -
    padding.left -
    padding.right;

  const chartHeight =
    height -
    padding.top -
    padding.bottom;

  const range =
    Math.max(
      1,
      maximum -
        minimum,
    );

  const coordinates =
    points.map(
      (
        point,
        index,
      ) => {
        const x =
          points.length ===
          1
            ? padding.left +
              chartWidth /
                2
            : padding.left +
              (
                index /
                (
                  points.length -
                  1
                )
              ) *
                chartWidth;

        const normalized =
          (
            point.rating -
            minimum
          ) /
          range;

        const y =
          padding.top +
          chartHeight -
          normalized *
            chartHeight;

        return {
          ...point,

          x,

          y,
        };
      },
    );

  const polyline =
    coordinates
      .map(
        (
          point,
        ) =>
          `${point.x},${point.y}`,
      )
      .join(
        " ",
      );

  const areaPath =
    coordinates.length >
    0
      ? [
          `M ${coordinates[0].x} ${
            padding.top +
            chartHeight
          }`,

          ...coordinates.map(
            (
              point,
            ) =>
              `L ${point.x} ${point.y}`,
          ),

          `L ${
            coordinates[
              coordinates.length -
                1
            ].x
          } ${
            padding.top +
            chartHeight
          }`,

          "Z",
        ].join(
          " ",
        )
      : "";

  const gridRatings =
    Array.from(
      {
        length:
          4,
      },
      (
        _,
        index,
      ) =>
        minimum +
        (
          (
            maximum -
            minimum
          ) /
          3
        ) *
          index,
    );

  const gradientId =
    `rating-gradient-${safeSvgId(
      points[0]
        ?.matchId ??
        "player",
    )}`;

  return (
    <div
      className="
        mt-4
        overflow-hidden
      "
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="
          block
          h-auto
          w-full
          overflow-visible
        "
        role="img"
        aria-label="Player rating over time"
      >
        <defs>
          <linearGradient
            id={
              gradientId
            }
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor={
                theme.colors.accent
              }
              stopOpacity="0.28"
            />

            <stop
              offset="100%"
              stopColor={
                theme.colors.accent
              }
              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        {gridRatings.map(
          (
            rating,
          ) => {
            const normalized =
              (
                rating -
                minimum
              ) /
              range;

            const y =
              padding.top +
              chartHeight -
              normalized *
                chartHeight;

            return (
              <g
                key={
                  rating
                }
              >
                <line
                  x1={
                    padding.left
                  }
                  x2={
                    width -
                    padding.right
                  }
                  y1={
                    y
                  }
                  y2={
                    y
                  }
                  stroke={
                    theme.colors.border
                  }
                  strokeWidth="1"
                />

                <text
                  x="0"
                  y={
                    y +
                    3
                  }
                  fill={
                    theme.colors.textMuted
                  }
                  fontSize="8"
                >
                  {
                    rating.toFixed(
                      1,
                    )
                  }
                </text>
              </g>
            );
          },
        )}

        <path
          d={
            areaPath
          }
          fill={`url(#${gradientId})`}
        />

        <polyline
          points={
            polyline
          }
          fill="none"
          stroke={
            theme.colors.accent
          }
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {coordinates.map(
          (
            point,
            index,
          ) => (
            <g
              key={
                point.matchId
              }
            >
              <circle
                cx={
                  point.x
                }
                cy={
                  point.y
                }
                r="4"
                fill={
                  theme.colors.background
                }
                stroke={
                  theme.colors.accent
                }
                strokeWidth="2"
              >
                <title>
                  {`${point.opponent.name} · ${point.rating} · ${formatShortDate(
                    point.kickoff,
                  )}`}
                </title>
              </circle>

              {(
                index ===
                  0 ||
                index ===
                  coordinates.length -
                    1 ||
                coordinates.length <=
                  7 ||
                index %
                    2 ===
                  0
              ) ? (
                <text
                  x={
                    point.x
                  }
                  y={
                    height -
                    12
                  }
                  textAnchor="middle"
                  fill={
                    theme.colors.textMuted
                  }
                  fontSize="7"
                >
                  {
                    abbreviateOpponent(
                      point.opponent
                        .name,
                    )
                  }
                </text>
              ) : null}
            </g>
          ),
        )}
      </svg>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Recent form
|--------------------------------------------------------------------------
*/

function RecentForm({
  player,
  theme,
}: {
  player:
    SquadPlayer;

  theme:
    KitTheme;
}) {
  return (
    <section className="mt-7">
      <div
        className="
          flex
          items-center
          justify-between
          gap-4
        "
      >
        <SectionHeading
          label="Recent Form"
          theme={
            theme
          }
          grow
        />

        <span
          className="
            shrink-0
            text-[6px]
            uppercase
            tracking-[0.09em]
          "
          style={{
            color:
              theme.colors.textMuted,
          }}
        >
          Appearances only
        </span>
      </div>

      {player.recentMatches
        .length >
      0 ? (
        <div
          className="
            mt-3
            flex
            snap-x
            gap-2.5
            overflow-x-auto
            overscroll-x-contain
            pb-2
          "
        >
          {player.recentMatches.map(
            (
              match,
            ) => (
              <RecentMatchCard
                key={
                  match.matchId
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
      ) : (
        <EmptyAnalysis
          text="No tracked appearances yet."
          theme={
            theme
          }
        />
      )}
    </section>
  );
}

function RecentMatchCard({
  match,
  theme,
}: {
  match:
    RecentMatch;

  theme:
    KitTheme;
}) {
  return (
    <article
      className="
        min-w-[218px]
        max-w-[218px]
        snap-start
        border
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
          flex
          min-h-[68px]
          items-start
          justify-between
          gap-3
          border-b
          p-3
        "
        style={{
          borderColor:
            theme.colors.border,
        }}
      >
        <div
          className="
            flex
            min-w-0
            items-center
            gap-2.5
          "
        >
          <OpponentCrest
            name={
              match.opponent
                .name
            }
            crestUrl={
              match.opponent
                .crestUrl
            }
            theme={
              theme
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
                match.opponent
                  .name
              }
            </p>

            <p
              className="
                mt-1
                truncate
                text-[6px]
                uppercase
                tracking-[0.08em]
              "
              style={{
                color:
                  theme.colors.textMuted,
              }}
            >
              {
                match.competition
              }
            </p>

            <p
              className="
                mt-0.5
                text-[6px]
              "
              style={{
                color:
                  theme.colors.textMuted,
              }}
            >
              {
                formatShortDate(
                  match.kickoff,
                )
              }
            </p>
          </div>
        </div>

        <ResultBadge
          result={
            match.result
          }
          score={
            match.score
          }
          theme={
            theme
          }
        />
      </div>

      <div
        className="
          grid
          grid-cols-4
          gap-px
        "
        style={{
          backgroundColor:
            theme.colors.border,
        }}
      >
        <TinyMetric
          label="MIN"
          value={
            match.minutes
          }
          theme={
            theme
          }
        />

        <TinyMetric
          label="G"
          value={
            match.goals
          }
          theme={
            theme
          }
        />

        <TinyMetric
          label="A"
          value={
            match.assists
          }
          theme={
            theme
          }
        />

        <TinyMetric
          label="RTG"
          value={
            match.rating ??
            "—"
          }
          accent={
            match.rating !==
            null
          }
          theme={
            theme
          }
        />
      </div>
    </article>
  );
}

/*
|--------------------------------------------------------------------------
| Heatmap
|--------------------------------------------------------------------------
*/

function PlayerHeatmap({
  player,
  theme,
}: {
  player:
    SquadPlayer;

  theme:
    KitTheme;
}) {
  const [
    selection,
    setSelection,
  ] =
    useState<{
      playerId:
        string;

      value:
        string;
    }>({
      playerId:
        player.id,

      value:
        "season",
    });

  const selected =
    selection.playerId ===
    player.id
      ? selection.value
      : "season";

  const selectedCompetitionAverage =
    selected.startsWith(
      "competition:",
    )
      ? player.heatmap
          .competitionAverages
          .find(
            (
              average,
            ) =>
              `competition:${average.key}` ===
              selected,
          ) ??
        null
      : null;

  const selectedMatch =
    selected !==
        "season" &&
      !selectedCompetitionAverage
      ? player.heatmap
          .matches
          .find(
            (
              match,
            ) =>
              match.matchId ===
              selected,
          ) ??
        null
      : null;

  const displayedHeatmap:
    RenderableHeatmap =
    selectedCompetitionAverage ??
    selectedMatch ??
    player.heatmap;

  const aggregateMode =
    selectedMatch ===
    null;

  const aggregateMatchCount =
    selectedCompetitionAverage
      ?.matchesIncluded ??
    player.heatmap
      .matchesIncluded;

  const aggregateActions =
    selectedCompetitionAverage
      ?.sampleSize ??
    player.heatmap
      .sampleSize;

  const title =
    selectedMatch
      ? selectedMatch
          .opponent
          ?.name ??
        "Match Heatmap"
      : selectedCompetitionAverage
        ? `${selectedCompetitionAverage.label} Position Profile`
        : "Season Position Profile";

  const subtitle =
    selectedMatch
      ? [
          selectedMatch
            .competition,

          selectedMatch
            .kickoff
            ? formatShortDate(
                selectedMatch
                  .kickoff,
              )
            : null,

          selectedMatch
            .score,
        ]
          .filter(
            Boolean,
          )
          .join(
            " · ",
          )
      : selectedCompetitionAverage
        ? `${selectedCompetitionAverage.matchesIncluded} ${
            selectedCompetitionAverage
              .matchesIncluded ===
            1
              ? "match"
              : "matches"
          } · normalized and minutes-weighted`
        : "Normalized per-match activity · minutes-weighted season average";

  const hasData =
    displayedHeatmap
      .sampleSize >
    0;

  return (
    <section className="mt-7">
      <SectionHeading
        label="Heatmap"
        theme={
          theme
        }
      />

      <div
        className="
          mt-3
          border
          p-4
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
            flex
            flex-wrap
            items-start
            justify-between
            gap-5
          "
        >
          <div>
            <p
              className="
                text-[8px]
                font-medium
                uppercase
                tracking-[0.1em]
              "
            >
              {title}
            </p>

            <p
              className="
                mt-1
                text-[6px]
                leading-4
              "
              style={{
                color:
                  theme.colors.textMuted,
              }}
            >
              {subtitle}
            </p>
          </div>

          <div
            className="
              flex
              shrink-0
              items-start
              gap-6
            "
          >
            {aggregateMode ? (
              <>
                <HeatmapHeaderStat
                  value={
                    aggregateMatchCount
                  }
                  label={
                    aggregateMatchCount ===
                    1
                      ? "match"
                      : "matches"
                  }
                  theme={
                    theme
                  }
                />

                <HeatmapHeaderStat
                  value={
                    aggregateActions
                  }
                  label="actions"
                  theme={
                    theme
                  }
                />
              </>
            ) : (
              <>
                <HeatmapHeaderStat
                  value={
                    selectedMatch
                      ?.actions ??
                    0
                  }
                  label="actions"
                  theme={
                    theme
                  }
                />

                <HeatmapHeaderStat
                  value={
                    selectedMatch
                      ?.minutes ??
                    0
                  }
                  label="minutes"
                  theme={
                    theme
                  }
                />
              </>
            )}
          </div>
        </div>

        <div className="mt-4">
          {hasData ? (
            <PitchHeatmap
              heatmap={
                displayedHeatmap
              }
              theme={
                theme
              }
            />
          ) : (
            <div
              className="
                flex
                min-h-[300px]
                items-center
                justify-center
                border
              "
              style={{
                borderColor:
                  `${theme.colors.pitchLine}38`,

                color:
                  theme.colors.textMuted,

                backgroundColor:
                  `${theme.colors.surface}60`,
              }}
            >
              <div
                className="
                  max-w-[320px]
                  text-center
                "
              >
                <Activity
                  size={18}
                  className="mx-auto"
                />

                <p
                  className="
                    mt-3
                    text-[8px]
                    font-medium
                  "
                >
                  No spatial data
                  available
                </p>
              </div>
            </div>
          )}
        </div>

        {player.heatmap
          .matches.length >
        0 ? (
          <div
            className="
              mt-4
              flex
              snap-x
              gap-2
              overflow-x-auto
              overscroll-x-contain
              border-t
              pt-3
            "
            style={{
              borderColor:
                theme.colors.border,
            }}
          >
            <HeatmapAggregateButton
              active={
                selected ===
                "season"
              }
              label="Season Avg"
              secondary={`${player.heatmap.matchesIncluded} matches`}
              logoUrl={
                null
              }
              onClick={
                () =>
                  setSelection({
                    playerId:
                      player.id,

                    value:
                      "season",
                  })
              }
              theme={
                theme
              }
            />

            {player.heatmap
              .competitionAverages
              .map(
                (
                  average,
                ) => (
                  <HeatmapAggregateButton
                    key={
                      average.key
                    }
                    active={
                      selected ===
                      `competition:${average.key}`
                    }
                    label={`${average.label} Avg`}
                    secondary={`${average.matchesIncluded} ${
                      average.matchesIncluded ===
                      1
                        ? "match"
                        : "matches"
                    }`}
                    logoUrl={
                      average.logoUrl
                    }
                    onClick={
                      () =>
                        setSelection({
                          playerId:
                            player.id,

                          value:
                            `competition:${average.key}`,
                        })
                    }
                    theme={
                      theme
                    }
                  />
                ),
              )}

            {player.heatmap
              .matches.map(
                (
                  match,
                ) => (
                  <HeatmapMatchButton
                    key={
                      match.matchId
                    }
                    active={
                      selected ===
                      match.matchId
                    }
                    label={
                      match.opponent
                        ?.name ??
                      "Match"
                    }
                    date={
                      match.kickoff
                        ? formatShortDate(
                            match.kickoff,
                          )
                        : "—"
                    }
                    opponentCrestUrl={
                      match.opponent
                        ?.crestUrl ??
                      null
                    }
                    competitionLogoUrl={
                      match.competitionLogoUrl
                    }
                    competition={
                      match.competition
                    }
                    onClick={
                      () =>
                        setSelection({
                          playerId:
                            player.id,

                          value:
                            match.matchId,
                        })
                    }
                    theme={
                      theme
                    }
                  />
                ),
              )}
          </div>
        ) : null}

        <div
          className="
            mt-3
            flex
            flex-wrap
            items-center
            justify-between
            gap-3
            text-[6px]
            leading-4
          "
          style={{
            color:
              theme.colors.textMuted,
          }}
        >
          <span>
            PitchAPI 16×12 spatial
            density · attacking
            direction normalized
          </span>

          <span>
            Player attacks left → right
          </span>
        </div>
      </div>
    </section>
  );
}

function HeatmapHeaderStat({
  value,
  label,
  theme,
}: {
  value:
    number;

  label:
    string;

  theme:
    KitTheme;
}) {
  return (
    <div className="text-right">
      <p
        className="
          text-[15px]
          font-medium
          tabular-nums
        "
      >
        {value}
      </p>

      <p
        className="
          mt-0.5
          text-[5px]
          uppercase
          tracking-[0.1em]
        "
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

function HeatmapAggregateButton({
  active,
  label,
  secondary,
  logoUrl,
  onClick,
  theme,
}: {
  active:
    boolean;

  label:
    string;

  secondary:
    string;

  logoUrl:
    string | null;

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
        min-w-[145px]
        snap-start
        cursor-pointer
        items-center
        gap-2.5
        border
        px-3
        py-2.5
        text-left
        transition-colors
        duration-150
      "
      style={{
        borderColor:
          active
            ? `${theme.colors.accent}88`
            : theme.colors.border,

        backgroundColor:
          active
            ? `${theme.colors.accent}0B`
            : theme.colors.surface,

        color:
          active
            ? theme.colors.accent
            : theme.colors.text,
      }}
    >
      <HeatmapCompetitionLogo
        logoUrl={
          logoUrl
        }
        fallback={
          logoUrl
            ? null
            : (
              <Activity
                size={11}
              />
            )
        }
        theme={
          theme
        }
      />

      <div className="min-w-0">
        <p
          className="
            truncate
            text-[7px]
            font-medium
            uppercase
            tracking-[0.08em]
          "
        >
          {label}
        </p>

        <p
          className="
            mt-1
            truncate
            text-[6px]
          "
          style={{
            color:
              active
                ? theme.colors.accent
                : theme.colors.textMuted,
          }}
        >
          {secondary}
        </p>
      </div>
    </button>
  );
}

function HeatmapMatchButton({
  active,
  label,
  date,
  opponentCrestUrl,
  competitionLogoUrl,
  competition,
  onClick,
  theme,
}: {
  active:
    boolean;

  label:
    string;

  date:
    string;

  opponentCrestUrl:
    string | null;

  competitionLogoUrl:
    string | null;

  competition:
    string | null;

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
        min-w-[185px]
        snap-start
        cursor-pointer
        border
        px-3
        py-2.5
        text-left
        transition-colors
        duration-150
      "
      style={{
        borderColor:
          active
            ? `${theme.colors.accent}88`
            : theme.colors.border,

        backgroundColor:
          active
            ? `${theme.colors.accent}0B`
            : theme.colors.surface,

        color:
          active
            ? theme.colors.accent
            : theme.colors.text,
      }}
    >
      <div
        className="
          flex
          items-center
          gap-2.5
        "
      >
        <HeatmapTeamLogo
          name={
            label
          }
          url={
            opponentCrestUrl
          }
          theme={
            theme
          }
        />

        <div className="min-w-0 flex-1">
          <p
            className="
              truncate
              text-[7px]
              font-medium
              uppercase
              tracking-[0.07em]
            "
          >
            {label}
          </p>

          <div
            className="
              mt-1
              flex
              min-w-0
              items-center
              gap-1.5
            "
          >
            <HeatmapCompetitionLogo
              logoUrl={
                competitionLogoUrl
              }
              compact
              theme={
                theme
              }
            />

            <span
              className="
                truncate
                text-[5px]
              "
              style={{
                color:
                  theme.colors.textMuted,
              }}
            >
              {competition ??
                "Competition"}{" "}
              · {date}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function HeatmapTeamLogo({
  name,
  url,
  theme,
}: {
  name:
    string;

  url:
    string | null;

  theme:
    KitTheme;
}) {
  return (
    <div
      className="
        flex
        h-8
        w-8
        shrink-0
        items-center
        justify-center
        overflow-hidden
        border
      "
      style={{
        borderColor:
          theme.colors.border,

        backgroundColor:
          theme.colors.backgroundElevated,
      }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={
            url
          }
          alt=""
          className="
            h-6
            w-6
            object-contain
          "
        />
      ) : (
        <span
          className="
            text-[7px]
            font-semibold
          "
        >
          {
            name
              .slice(
                0,
                1,
              )
              .toUpperCase()
          }
        </span>
      )}
    </div>
  );
}

function HeatmapCompetitionLogo({
  logoUrl,
  fallback =
    null,
  compact =
    false,
  theme,
}: {
  logoUrl:
    string | null;

  fallback?:
    ReactNode;

  compact?:
    boolean;

  theme:
    KitTheme;
}) {
  const size =
    compact
      ? "h-[17px] w-[17px]"
      : "h-7 w-7";

  return (
    <div
      className={`
        ${size}
        flex
        shrink-0
        items-center
        justify-center
        overflow-hidden
        border
      `}
      style={{
        borderColor:
          logoUrl
            ? "rgba(255,255,255,0.20)"
            : theme.colors.border,

        /*
         * Deliberately light:
         * the UCL logo is too dark on
         * the dashboard background.
         */
        backgroundColor:
          logoUrl
            ? "rgba(255,255,255,0.92)"
            : theme.colors.backgroundElevated,

        color:
          theme.colors.textMuted,
      }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={
            logoUrl
          }
          alt=""
          className={
            compact
              ? "h-[12px] w-[12px] object-contain"
              : "h-5 w-5 object-contain"
          }
        />
      ) : (
        fallback
      )}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Continuous heatmap
|--------------------------------------------------------------------------
*/

export function PitchHeatmap({
  heatmap,
  theme,
}: {
  heatmap:
    RenderableHeatmap;

  theme:
    KitTheme;
}) {
  const canvasRef =
    useRef<HTMLCanvasElement>(
      null,
    );

  useEffect(
    () => {
      const canvas =
        canvasRef.current;

      if (!canvas) {
        return;
      }

      drawBroadcastHeatmap(
        canvas,
        heatmap,
      );
    },
    [
      heatmap,
    ],
  );

  const centroid =
    getHeatmapCentroid(
      heatmap,
    );

  return (
    <div className="w-full">
      <div
        className="
          relative
          mx-auto
          aspect-[105/68]
          w-full
          max-w-[820px]
          overflow-hidden
          border
        "
        style={{
          borderColor:
            `${theme.colors.pitchLine}58`,

          background: `
            radial-gradient(
              circle at 50% 50%,
              ${theme.colors.backgroundElevated},
              ${theme.colors.surface}
            )
          `,
        }}
      >
        <canvas
          ref={
            canvasRef
          }
          className="
            pointer-events-none
            absolute
            inset-0
            h-full
            w-full
          "
        />

        <svg
          viewBox="0 0 105 68"
          className="
            pointer-events-none
            absolute
            inset-0
            h-full
            w-full
          "
          aria-hidden="true"
        >
          <g
            fill="none"
            stroke={
              theme.colors
                .pitchLine
            }
            strokeOpacity="0.42"
            strokeWidth="0.52"
          >
            <rect
              x="1.5"
              y="1.5"
              width="102"
              height="65"
            />

            <line
              x1="52.5"
              y1="1.5"
              x2="52.5"
              y2="66.5"
            />

            <circle
              cx="52.5"
              cy="34"
              r="9.15"
            />

            <rect
              x="1.5"
              y="13.85"
              width="16.5"
              height="40.3"
            />

            <rect
              x="1.5"
              y="24.84"
              width="5.5"
              height="18.32"
            />

            <rect
              x="87"
              y="13.85"
              width="16.5"
              height="40.3"
            />

            <rect
              x="98"
              y="24.84"
              width="5.5"
              height="18.32"
            />

            <path
              d="
                M18 27.5
                A9.15 9.15
                0 0 1
                18 40.5
              "
            />

            <path
              d="
                M87 27.5
                A9.15 9.15
                0 0 0
                87 40.5
              "
            />
          </g>

          <g
            fill={
              theme.colors
                .pitchLine
            }
            fillOpacity="0.55"
          >
            <circle
              cx="52.5"
              cy="34"
              r="0.34"
            />

            <circle
              cx="11"
              cy="34"
              r="0.31"
            />

            <circle
              cx="94"
              cy="34"
              r="0.31"
            />
          </g>

          {centroid ? (
            <g>
              <title>
                Weighted average
                activity position
              </title>

              <circle
                cx={
                  centroid.x
                }
                cy={
                  1.5 + displayHeatmapY((centroid.y - 1.5) / 65) * 65
                }
                r="1.38"
                fill={
                  theme.colors.background
                }
                fillOpacity="0.78"
                stroke={
                  theme.colors.accent
                }
                strokeWidth="0.46"
              />

              <circle
                cx={
                  centroid.x
                }
                cy={
                  1.5 + displayHeatmapY((centroid.y - 1.5) / 65) * 65
                }
                r="0.33"
                fill={
                  theme.colors.accent
                }
              />
            </g>
          ) : null}
        </svg>

        <div
          className="
            pointer-events-none
            absolute
            bottom-3
            right-3
            flex
            items-center
            gap-1.5
            text-[6px]
            uppercase
            tracking-[0.1em]
          "
          style={{
            color:
              theme.colors.textMuted,
          }}
        >
          Attack

          <ArrowRight
            size={10}
          />
        </div>
      </div>

      <div
        className="
          mx-auto
          mt-3
          flex
          w-full
          max-w-[820px]
          flex-wrap
          items-center
          justify-between
          gap-3
        "
      >
        <div
          className="
            flex
            items-center
            gap-2
          "
        >
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
            Low
          </span>

          <div
            className="
              h-[5px]
              w-[185px]
              overflow-hidden
              rounded-full
            "
            style={{
              background: `
                linear-gradient(
                  90deg,
                  #0F766E 0%,
                  #22A699 24%,
                  #D39C43 52%,
                  #F08A24 76%,
                  #C72C48 100%
                )
              `,
            }}
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
            High
          </span>
        </div>

        <div
          className="
            flex
            flex-wrap
            items-center
            gap-4
            text-[6px]
            uppercase
            tracking-[0.08em]
          "
          style={{
            color:
              theme.colors.textMuted,
          }}
        >
          <span
            className="
              inline-flex
              items-center
              gap-1.5
            "
          >
            <span
              className="
                relative
                inline-flex
                h-[9px]
                w-[9px]
                items-center
                justify-center
                rounded-full
                border
              "
              style={{
                borderColor:
                  theme.colors.accent,
              }}
            >
              <span
                className="
                  h-[2px]
                  w-[2px]
                  rounded-full
                "
                style={{
                  backgroundColor:
                    theme.colors.accent,
                }}
              />
            </span>

            Avg activity position
          </span>

          <span>
            Density
          </span>
        </div>
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Broadcast heat renderer
|--------------------------------------------------------------------------
*/

function drawBroadcastHeatmap(
  canvas:
    HTMLCanvasElement,

  heatmap:
    RenderableHeatmap,
) {
  const width =
    900;

  const height =
    Math.round(
      width *
      (
        68 /
        105
      ),
    );

  canvas.width =
    width;

  canvas.height =
    height;

  const context =
    canvas.getContext(
      "2d",
    );

  if (!context) {
    return;
  }

  context.clearRect(
    0,
    0,
    width,
    height,
  );

  if (
    heatmap.cells.length ===
    0
  ) {
    return;
  }

  const fieldLeft =
    width *
    (
      1.5 /
      105
    );

  const fieldRight =
    width *
    (
      103.5 /
      105
    );

  const fieldTop =
    height *
    (
      1.5 /
      68
    );

  const fieldBottom =
    height *
    (
      66.5 /
      68
    );

  const fieldWidth =
    fieldRight -
    fieldLeft;

  const fieldHeight =
    fieldBottom -
    fieldTop;

  const density =
    new Float32Array(
      width *
      height,
    );

  const cellPixelWidth =
    fieldWidth /
    heatmap.columns;

  const cellPixelHeight =
    fieldHeight /
    heatmap.rows;

  /*
   * A little wider than before.
   *
   * This reconnects weak neighbouring
   * zones without reverting to the giant
   * full-pitch wash.
   */

  const sigmaX =
    cellPixelWidth *
    0.92;

  const sigmaY =
    cellPixelHeight *
    0.92;

  const radiusX =
    Math.ceil(
      sigmaX *
      2.8,
    );

  const radiusY =
    Math.ceil(
      sigmaY *
      2.8,
    );

  for (
    const cell
    of heatmap.cells
  ) {
    const intensity =
      clamp01(
        cell.intensity,
      );

    /*
     * Slightly lift low/medium cells.
     *
     * Previous renderer punished these
     * too aggressively.
     */

    const weight =
      Math.pow(
        intensity,
        0.9,
      );

    if (
      weight <
      0.018
    ) {
      continue;
    }

    const centerX =
      fieldLeft +
      (
        (
          cell.column +
          0.5
        ) /
        heatmap.columns
      ) *
        fieldWidth;

    const centerY =
      fieldTop +
      (
        (
          displayHeatmapRow(cell.row, heatmap.rows) +
          0.5
        ) /
        heatmap.rows
      ) *
        fieldHeight;

    const minX =
      Math.max(
        Math.floor(
          fieldLeft,
        ),
        Math.floor(
          centerX -
          radiusX,
        ),
      );

    const maxX =
      Math.min(
        Math.ceil(
          fieldRight,
        ),
        Math.ceil(
          centerX +
          radiusX,
        ),
      );

    const minY =
      Math.max(
        Math.floor(
          fieldTop,
        ),
        Math.floor(
          centerY -
          radiusY,
        ),
      );

    const maxY =
      Math.min(
        Math.ceil(
          fieldBottom,
        ),
        Math.ceil(
          centerY +
          radiusY,
        ),
      );

    for (
      let y =
        minY;
      y <=
      maxY;
      y +=
        1
    ) {
      const dy =
        (
          y -
          centerY
        ) /
        sigmaY;

      const dySquared =
        dy *
        dy;

      for (
        let x =
          minX;
        x <=
        maxX;
        x +=
          1
      ) {
        const dx =
          (
            x -
            centerX
          ) /
          sigmaX;

        const distanceSquared =
          dx *
            dx +
          dySquared;

        if (
          distanceSquared >
          7.8
        ) {
          continue;
        }

        const gaussian =
          Math.exp(
            -0.5 *
            distanceSquared,
          );

        density[
          y *
            width +
          x
        ] +=
          weight *
          gaussian;
      }
    }
  }

  let maximum =
    0;

  for (
    let index =
      0;
    index <
    density.length;
    index +=
      1
  ) {
    maximum =
      Math.max(
        maximum,
        density[
          index
        ],
      );
  }

  if (
    maximum <=
    0
  ) {
    return;
  }

  const image =
    context.createImageData(
      width,
      height,
    );

  const pixels =
    image.data;

  for (
    let y =
      0;
    y <
    height;
    y +=
      1
  ) {
    for (
      let x =
        0;
      x <
      width;
      x +=
        1
    ) {
      const fieldIndex =
        y *
          width +
        x;

      const pixelIndex =
        fieldIndex *
        4;

      const raw =
        density[
          fieldIndex
        ] /
        maximum;

      const strength =
        heatmapStrength(raw);

      if (
        strength ===
        null
      ) {
        pixels[
          pixelIndex +
            3
        ] =
          0;

        continue;
      }

      const [
        red,
        green,
        blue,
      ] =
        heatmapColor(
          strength,
        );

      const alpha =
        Math.min(
          0.84,
          0.035 +
            strength *
              0.76,
        );

      pixels[
        pixelIndex
      ] =
        red;

      pixels[
        pixelIndex +
          1
      ] =
        green;

      pixels[
        pixelIndex +
          2
      ] =
        blue;

      pixels[
        pixelIndex +
          3
      ] =
        Math.round(
          alpha *
          255,
        );
    }
  }

  context.putImageData(
    image,
    0,
    0,
  );
}

/*
|--------------------------------------------------------------------------
| Weighted average activity position
|--------------------------------------------------------------------------
*/

function getHeatmapCentroid(
  heatmap:
    RenderableHeatmap,
) {
  if (
    heatmap.cells.length ===
    0
  ) {
    return null;
  }

  let totalWeight =
    0;

  let weightedX =
    0;

  let weightedY =
    0;

  for (
    const cell
    of heatmap.cells
  ) {
    const weight =
      cell.count >
      0
        ? cell.count
        : cell.intensity;

    if (
      weight <=
      0
    ) {
      continue;
    }

    const normalizedX =
      (
        cell.column +
        0.5
      ) /
      heatmap.columns;

    const normalizedY =
      (
        cell.row +
        0.5
      ) /
      heatmap.rows;

    weightedX +=
      normalizedX *
      weight;

    weightedY +=
      normalizedY *
      weight;

    totalWeight +=
      weight;
  }

  if (
    totalWeight <=
    0
  ) {
    return null;
  }

  return {
    x:
      1.5 +
      (
        weightedX /
        totalWeight
      ) *
        102,

    y:
      1.5 +
      (
        weightedY /
        totalWeight
      ) *
        65,
  };
}

/*
|--------------------------------------------------------------------------
| Coverage
|--------------------------------------------------------------------------
*/

function CoveragePanel({
  player,
  theme,
}: {
  player:
    SquadPlayer;

  theme:
    KitTheme;
}) {
  return (
    <section className="mt-7">
      <SectionHeading
        label="Tracked Data"
        theme={
          theme
        }
      />

      <div
        className="
          mt-3
          flex
          items-start
          justify-between
          gap-6
          border
          p-4
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
            flex
            items-start
            gap-3
          "
        >
          <ShieldCheck
            size={14}
            className="
              mt-0.5
              shrink-0
            "
            style={{
              color:
                theme.colors.success,
            }}
          />

          <div>
            <p
              className="
                text-[8px]
                font-medium
                uppercase
                tracking-[0.1em]
              "
            >
              Canonical Match Coverage
            </p>

            <p
              className="
                mt-2
                max-w-[600px]
                text-[7px]
                leading-4
              "
              style={{
                color:
                  theme.colors.textMuted,
              }}
            >
              Player output, recent
              form, rating history and
              cached spatial data are
              generated from tracked
              match records for the
              current season.
            </p>
          </div>
        </div>

        <div className="text-right">
          <p
            className="
              text-[20px]
              font-medium
              tabular-nums
            "
          >
            {
              player.stats
                .trackedMatches
            }
          </p>

          <p
            className="
              mt-1
              text-[6px]
              uppercase
            "
            style={{
              color:
                theme.colors.textMuted,
            }}
          >
            appearances
          </p>
        </div>
      </div>
    </section>
  );
}

/*
|--------------------------------------------------------------------------
| Captain
|--------------------------------------------------------------------------
*/

function CaptainBadge({
  theme,
}: {
  theme:
    KitTheme;
}) {
  return (
    <div
      className="
        inline-flex
        h-9
        items-center
        gap-2
        border
        px-3
      "
      style={{
        borderColor:
          `${theme.colors.accent}66`,

        color:
          theme.colors.accent,

        backgroundColor:
          `${theme.colors.accent}09`,
      }}
    >
      <CaptainArmbandIcon
        size={19}
      />

      <span
        className="
          text-[7px]
          font-medium
          uppercase
          tracking-[0.1em]
        "
      >
        Captain
      </span>
    </div>
  );
}

function CaptainArmbandIcon({
  size =
    20,
}: {
  size?:
    number;
}) {
  return (
    <svg
      width={
        size
      }
      height={
        size
      }
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="
          M5.2 4.25
          H18.8
          L20.75 7.1
          L19.15 19.75
          H4.85
          L3.25 7.1
          Z
        "
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />

      <path
        d="M4.2 8.25H19.8"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.55"
      />

      <path
        d="M4.55 15.75H19.45"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.55"
      />

      <text
        x="12"
        y="13.55"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="currentColor"
        fontSize="7.2"
        fontWeight="700"
        fontFamily="Arial, sans-serif"
      >
        C
      </text>
    </svg>
  );
}

/*
|--------------------------------------------------------------------------
| Availability
|--------------------------------------------------------------------------
*/

function AvailabilityStrip({
  player,
  theme,
}: {
  player:
    SquadPlayer;

  theme:
    KitTheme;
}) {
  const available =
    player.availability ===
    "available";

  return (
    <div
      className="
        flex
        items-center
        gap-2
        border
        px-3
        py-2.5
      "
      style={{
        borderColor:
          available
            ? `${theme.colors.success}55`
            : `${theme.colors.danger}66`,

        color:
          available
            ? theme.colors.success
            : theme.colors.danger,

        backgroundColor:
          available
            ? `${theme.colors.success}06`
            : `${theme.colors.danger}06`,
      }}
    >
      {available ? (
        <Check
          size={11}
        />
      ) : (
        <AlertTriangle
          size={11}
        />
      )}

      <span
        className="
          truncate
          text-[7px]
          font-medium
          uppercase
          tracking-[0.1em]
        "
      >
        {available
          ? "Available"
          : player.absence
              ?.reason ??
            humanize(
              player.absence
                ?.type ??
                "Unavailable",
            )}
      </span>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Favourite
|--------------------------------------------------------------------------
*/

function FavouriteButton({
  player,
  favourite,
  favouriteBusy,
  onToggleFavourite,
  theme,
}: {
  player:
    SquadPlayer;

  favourite:
    boolean;

  favouriteBusy:
    boolean;

  onToggleFavourite:
    (
      playerId:
        string,
    ) => void;

  theme:
    KitTheme;
}) {
  return (
    <button
      type="button"
      disabled={
        favouriteBusy
      }
      onClick={
        () =>
          onToggleFavourite(
            player.id,
          )
      }
      className="
        flex
        h-9
        cursor-pointer
        items-center
        gap-2
        border
        px-3
        text-[7px]
        font-medium
        uppercase
        tracking-[0.1em]

        disabled:cursor-wait
        disabled:opacity-60
      "
      style={{
        borderColor:
          favourite
            ? `${theme.colors.accent}77`
            : theme.colors.border,

        color:
          favourite
            ? theme.colors.accent
            : theme.colors.textMuted,

        backgroundColor:
          favourite
            ? `${theme.colors.accent}0B`
            : theme.colors.backgroundElevated,
      }}
    >
      {favouriteBusy ? (
        <LoaderCircle
          size={11}
          className="animate-spin"
        />
      ) : (
        <Star
          size={11}
          fill={
            favourite
              ? "currentColor"
              : "none"
          }
        />
      )}

      {favourite
        ? "Favourite Player"
        : "Add to Favourites"}
    </button>
  );
}

/*
|--------------------------------------------------------------------------
| Match UI
|--------------------------------------------------------------------------
*/

function ResultBadge({
  result,
  score,
  theme,
}: {
  result:
    "W"
    | "D"
    | "L"
    | null;

  score:
    string | null;

  theme:
    KitTheme;
}) {
  const color =
    result ===
    "W"
      ? theme.colors.success
      : result ===
          "L"
        ? theme.colors.danger
        : result ===
            "D"
          ? theme.colors.accent
          : theme.colors.textMuted;

  return (
    <div
      className="
        flex
        shrink-0
        items-center
        gap-1.5
      "
      style={{
        color,
      }}
    >
      {result ===
      "W" ? (
        <ArrowUpRight
          size={10}
        />
      ) : result ===
        "L" ? (
        <ArrowDownRight
          size={10}
        />
      ) : null}

      <span
        className="
          text-[8px]
          font-medium
          tabular-nums
        "
      >
        {result ??
          "—"}

        {score
          ? ` ${score}`
          : ""}
      </span>
    </div>
  );
}

function OpponentCrest({
  name,
  crestUrl,
  theme,
}: {
  name:
    string;

  crestUrl:
    string | null;

  theme:
    KitTheme;
}) {
  return (
    <div
      className="
        flex
        h-8
        w-8
        shrink-0
        items-center
        justify-center
        overflow-hidden
        border
      "
      style={{
        borderColor:
          theme.colors.border,
      }}
    >
      {crestUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={
            crestUrl
          }
          alt={
            name
          }
          className="
            h-6
            w-6
            object-contain
          "
        />
      ) : (
        <span
          className="
            text-[7px]
            font-semibold
          "
        >
          {
            name
              .slice(
                0,
                1,
              )
              .toUpperCase()
          }
        </span>
      )}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Shared UI
|--------------------------------------------------------------------------
*/

function SectionHeading({
  label,
  theme,
  grow =
    false,
}: {
  label:
    string;

  theme:
    KitTheme;

  grow?:
    boolean;
}) {
  return (
    <div
      className={`
        flex
        items-center
        gap-3

        ${
          grow
            ? "flex-1"
            : ""
        }
      `}
    >
      <p
        className="
          shrink-0
          text-[7px]
          font-medium
          uppercase
          tracking-[0.15em]
        "
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        {label}
      </p>

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
  );
}

function DetailBox({
  label,
  children,
  theme,
}: {
  label:
    string;

  children:
    ReactNode;

  theme:
    KitTheme;
}) {
  return (
    <div
      className="
        min-h-[64px]
        px-3
        py-3
      "
      style={{
        backgroundColor:
          theme.colors.backgroundElevated,
      }}
    >
      <p
        className="
          text-[6px]
          uppercase
          tracking-[0.1em]
        "
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        {label}
      </p>

      <div
        className="
          mt-1.5
          text-[10px]
          font-medium
        "
      >
        {children}
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  accent =
    false,
  theme,
}: {
  label:
    string;

  value:
    string | number;

  accent?:
    boolean;

  theme:
    KitTheme;
}) {
  return (
    <div
      className="
        min-h-[76px]
        px-3
        py-3
      "
      style={{
        backgroundColor:
          theme.colors.backgroundElevated,
      }}
    >
      <p
        className="
          text-[6px]
          uppercase
          tracking-[0.09em]
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
          mt-2
          text-[17px]
          font-medium
          tabular-nums
        "
        style={{
          color:
            accent
              ? theme.colors.accent
              : theme.colors.text,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function PerformanceMetric({
  label,
  value,
  accent =
    false,
  theme,
}: {
  label:
    string;

  value:
    string
    | number
    | null;

  accent?:
    boolean;

  theme:
    KitTheme;
}) {
  return (
    <div
      className="
        min-h-[62px]
        px-3
        py-2.5
      "
      style={{
        backgroundColor:
          theme.colors.backgroundElevated,
      }}
    >
      <p
        className="
          truncate
          text-[6px]
          uppercase
          tracking-[0.08em]
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
          text-[11px]
          font-medium
          tabular-nums
        "
        style={{
          color:
            accent &&
            value !==
              null
              ? theme.colors.accent
              : theme.colors.text,
        }}
      >
        {value ??
          "—"}
      </p>
    </div>
  );
}

function TinyMetric({
  label,
  value,
  accent =
    false,
  theme,
}: {
  label:
    string;

  value:
    string | number;

  accent?:
    boolean;

  theme:
    KitTheme;
}) {
  return (
    <div
      className="
        px-1.5
        py-2
        text-center
      "
      style={{
        backgroundColor:
          theme.colors.surface,
      }}
    >
      <p
        className="text-[5px]"
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        {label}
      </p>

      <p
        className="
          mt-0.5
          text-[8px]
          font-medium
          tabular-nums
        "
        style={{
          color:
            accent
              ? theme.colors.accent
              : theme.colors.text,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function EmptyAnalysis({
  text,
  theme,
}: {
  text:
    string;

  theme:
    KitTheme;
}) {
  return (
    <div
      className="
        mt-3
        border
        px-5
        py-8
        text-center
      "
      style={{
        borderColor:
          theme.colors.border,

        color:
          theme.colors.textMuted,
      }}
    >
      <Activity
        size={17}
        className="mx-auto"
      />

      <p
        className="
          mt-2
          text-[7px]
        "
      >
        {text}
      </p>
    </div>
  );
}

function NavButton({
  children,
  disabled =
    false,
  title,
  onClick,
  theme,
}: {
  children:
    ReactNode;

  disabled?:
    boolean;

  title:
    string;

  onClick:
    () => void;

  theme:
    KitTheme;
}) {
  return (
    <button
      type="button"
      disabled={
        disabled
      }
      onClick={
        onClick
      }
      title={
        title
      }
      aria-label={
        title
      }
      className="
        flex
        h-8
        w-8
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
          theme.colors.background,
      }}
    >
      {children}
    </button>
  );
}

/*
|--------------------------------------------------------------------------
| Formatting
|--------------------------------------------------------------------------
*/

function positionTitle(
  position:
    SquadPlayer[
      "position"
    ],
) {
  switch (
    position
  ) {
    case "goalkeeper":
      return "Goalkeeper";

    case "defender":
      return "Defender";

    case "midfielder":
      return "Midfielder";

    case "forward":
      return "Forward";

    default:
      return "Unknown";
  }
}

function positionShort(
  position:
    SquadPlayer[
      "position"
    ],
) {
  switch (
    position
  ) {
    case "goalkeeper":
      return "GK";

    case "defender":
      return "DEF";

    case "midfielder":
      return "MID";

    case "forward":
      return "FWD";

    default:
      return "—";
  }
}

function formatAge(
  player:
    SquadPlayer,
) {
  if (
    player.age ===
    null
  ) {
    return "Unknown";
  }

  if (
    !player.birthDate
  ) {
    return String(
      player.age,
    );
  }

  return `${player.age} (${formatBirthDate(
    player.birthDate,
  )})`;
}

function formatBirthDate(
  value:
    string,
) {
  const date =
    new Date(
      value,
    );

  if (
    !Number.isFinite(
      date.getTime(),
    )
  ) {
    return "Unknown";
  }

  return [
    String(
      date.getUTCDate(),
    ).padStart(
      2,
      "0",
    ),

    String(
      date.getUTCMonth() +
        1,
    ).padStart(
      2,
      "0",
    ),

    date.getUTCFullYear(),
  ].join(
    "/",
  );
}

function formatDate(
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

      year:
        "numeric",
    },
  );
}

function formatShortDate(
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

function percentage(
  value:
    number | null,
) {
  if (
    value ===
    null
  ) {
    return null;
  }

  return `${value}%`;
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

function abbreviateOpponent(
  value:
    string,
) {
  const words =
    value
      .replace(
        /\b(fc|cf|club|deportivo)\b/gi,
        "",
      )
      .trim()
      .split(
        /\s+/,
      )
      .filter(
        Boolean,
      );

  const text =
    words.length >
    1
      ? words
          .map(
            (
              word,
            ) =>
              word[0],
          )
          .join(
            "",
          )
      : words[0]
          ?.slice(
            0,
            5,
          ) ??
        "";

  return text
    .slice(
      0,
      5,
    )
    .toUpperCase();
}

function safeSvgId(
  value:
    string,
) {
  return value.replace(
    /[^a-zA-Z0-9_-]/g,
    "",
  );
}

/*
|--------------------------------------------------------------------------
| Maths
|--------------------------------------------------------------------------
*/

function clamp01(
  value:
    number,
) {
  return Math.max(
    0,
    Math.min(
      1,
      value,
    ),
  );
}


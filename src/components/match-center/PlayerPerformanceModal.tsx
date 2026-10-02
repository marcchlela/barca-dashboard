"use client";

import {
  useEffect,
} from "react";

import {
  X,
} from "lucide-react";

import type {
  MatchCenterData,
} from "../../lib/matches/get-match-center";

import type {
  KitTheme,
} from "../../lib/themes";

type Lineup =
  NonNullable<
    MatchCenterData[
      "lineups"
    ]["home"]
  >;

type LineupEntry =
  Lineup[
    "starters"
  ][number];

export type MatchPlayerDetail = {
  player:
    LineupEntry["player"];

  team:
    Lineup["team"];

  statistics:
    LineupEntry["statistics"];

  shirtNumber:
    number | null;

  role:
    string | null;
};

type PlayerPerformanceModalProps = {
  player:
    MatchPlayerDetail | null;

  theme:
    KitTheme;

  onClose:
    () => void;
};

export default function PlayerPerformanceModal({
  player,
  theme,
  onClose,
}: PlayerPerformanceModalProps) {
  useEffect(() => {
    if (!player) {
      return;
    }

    function handleKeyDown(
      event:
        KeyboardEvent,
    ) {
      if (
        event.key ===
        "Escape"
      ) {
        onClose();
      }
    }

    const previousOverflow =
      document.body
        .style
        .overflow;

    document.body
      .style
      .overflow =
      "hidden";

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body
        .style
        .overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    player,
    onClose,
  ]);

  if (!player) {
    return null;
  }

  const stats =
    player.statistics;

  const rating =
    stats?.rating ??
    null;

  return (
    <div
      className="
        fixed
        inset-0
        z-[100]
        flex
        items-center
        justify-center
        p-3
        sm:p-6
      "
    >
      <button
        type="button"
        aria-label="Close player performance"
        onClick={
          onClose
        }
        className="
          absolute
          inset-0
          bg-black/70
          backdrop-blur-[3px]
        "
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${player.player.name} match performance`}
        className="
          relative
          z-10
          max-h-[94vh]
          w-full
          max-w-[760px]
          overflow-y-auto
          scrollbar-subtle
          border
          shadow-[0_30px_90px_rgba(0,0,0,0.55)]
          sm:max-h-[88vh]
        "
        style={{
          borderColor:
            theme.colors
              .border,

          backgroundColor:
            theme.colors
              .backgroundElevated,

          color:
            theme.colors
              .text,
        }}
      >
        <div
          className="
            sticky
            top-0
            z-20
            flex
            items-center
            justify-between
            border-b
            px-5
            py-4
            backdrop-blur-xl
          "
          style={{
            borderColor:
              theme.colors
                .border,

            backgroundColor:
              `${theme.colors.backgroundElevated}F2`,
          }}
        >
          <div>
            <p
              className="
                text-[8px]
                uppercase
                tracking-[0.22em]
              "
              style={{
                color:
                  theme.colors
                    .textMuted,
              }}
            >
              Match Performance
            </p>

            <p className="mt-1 text-sm font-medium">
              {
                player.team
                  .shortName ??
                player.team
                  .name
              }
            </p>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              border
              transition-opacity
              hover:opacity-70
            "
            style={{
              borderColor:
                theme.colors
                  .border,

              color:
                theme.colors
                  .textMuted,
            }}
            aria-label="Close"
          >
            <X
              size={16}
            />
          </button>
        </div>

        <div className="px-5 pb-10 pt-7 sm:px-7">
          <div className="flex items-end gap-5">
            <PlayerImage
              player={
                player
              }
              theme={theme}
            />

            <div className="min-w-0 flex-1 pb-1">
              <div className="flex items-center gap-2">
                {player.shirtNumber !==
                null ? (
                  <span
                    className="
                      font-mono
                      text-xs
                    "
                    style={{
                      color:
                        theme.colors
                          .accent,
                    }}
                  >
                    #
                    {
                      player.shirtNumber
                    }
                  </span>
                ) : null}

                {player.role ? (
                  <span
                    className="
                      text-[8px]
                      uppercase
                      tracking-[0.16em]
                    "
                    style={{
                      color:
                        theme.colors
                          .textMuted,
                    }}
                  >
                    {
                      player.role
                    }
                  </span>
                ) : null}
              </div>

              <h2 className="mt-2 truncate text-2xl font-medium tracking-[-0.04em]">
                {
                  player.player
                    .name
                }
              </h2>

              <p
                className="
                  mt-2
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
                {
                  player.player
                    .primaryPosition
                }
              </p>
            </div>

            <RatingBadge
              value={
                rating
              }
            />
          </div>

          {!stats ? (
            <div
              className="
                mt-8
                border
                p-6
              "
              style={{
                borderColor:
                  theme.colors
                    .border,
              }}
            >
              <p className="text-sm font-medium">
                Did not play
              </p>

              <p
                className="mt-2 text-xs leading-5"
                style={{
                  color:
                    theme.colors
                      .textMuted,
                }}
              >
                There is no match-stat row for this player in this fixture.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-8 grid grid-cols-4 gap-px">
                <HeroMetric
                  label="Minutes"
                  value={
                    stats.minutes
                  }
                  theme={theme}
                />

                <HeroMetric
                  label="Goals"
                  value={
                    stats.goals
                  }
                  theme={theme}
                />

                <HeroMetric
                  label="Assists"
                  value={
                    stats.assists
                  }
                  theme={theme}
                />

                <HeroMetric
                  label="Rating"
                  value={
                    stats.rating
                  }
                  theme={theme}
                  rating
                />
              </div>

              <StatSection
                title="Shooting"
                theme={theme}
              >
                <DataRow
                  label="Shots"
                  value={
                    stats
                      .shooting
                      .shots
                  }
                  theme={theme}
                />

                <DataRow
                  label="Shots on target"
                  value={
                    stats
                      .shooting
                      .shotsOnTarget
                  }
                  theme={theme}
                />

                <DataRow
                  label="Expected goals"
                  value={
                    stats
                      .shooting
                      .xG
                  }
                  theme={theme}
                />
              </StatSection>

              <StatSection
                title="Passing & Creation"
                theme={theme}
              >
                <DataRow
                  label="Passes"
                  value={
                    stats
                      .passing
                      .passes
                  }
                  theme={theme}
                />

                <DataRow
                  label="Completed passes"
                  value={
                    stats
                      .passing
                      .completed
                  }
                  theme={theme}
                />

                <DataRow
                  label="Pass accuracy"
                  value={
                    stats
                      .passing
                      .accuracy
                  }
                  percent
                  theme={theme}
                />

                <DataRow
                  label="Key passes"
                  value={
                    stats
                      .passing
                      .keyPasses
                  }
                  theme={theme}
                />

                <DataRow
                  label="Progressive passes"
                  value={
                    stats
                      .passing
                      .progressivePasses
                  }
                  theme={theme}
                />

                <DataRow
                  label="Expected assists"
                  value={
                    stats.xA
                  }
                  theme={theme}
                />
              </StatSection>

              <StatSection
                title="Carrying & Dribbling"
                theme={theme}
              >
                <DataRow
                  label="Carries"
                  value={
                    stats
                      .carrying
                      .carries
                  }
                  theme={theme}
                />

                <DataRow
                  label="Progressive carries"
                  value={
                    stats
                      .carrying
                      .progressiveCarries
                  }
                  theme={theme}
                />

                <DataRow
                  label="Dribbles attempted"
                  value={
                    stats
                      .carrying
                      .dribblesAttempted
                  }
                  theme={theme}
                />

                <DataRow
                  label="Successful dribbles"
                  value={
                    stats
                      .carrying
                      .successfulDribbles
                  }
                  theme={theme}
                />
              </StatSection>

              <StatSection
                title="Defending"
                theme={theme}
              >
                <DataRow
                  label="Tackles"
                  value={
                    stats
                      .defending
                      .tackles
                  }
                  theme={theme}
                />

                <DataRow
                  label="Interceptions"
                  value={
                    stats
                      .defending
                      .interceptions
                  }
                  theme={theme}
                />

                <DataRow
                  label="Blocks"
                  value={
                    stats
                      .defending
                      .blocks
                  }
                  theme={theme}
                />

                <DataRow
                  label="Recoveries"
                  value={
                    stats
                      .defending
                      .recoveries
                  }
                  theme={theme}
                />

                <DataRow
                  label="Duels won"
                  value={
                    stats
                      .defending
                      .duelsWon
                  }
                  theme={theme}
                />

                <DataRow
                  label="Duels total"
                  value={
                    stats
                      .defending
                      .duelsTotal
                  }
                  theme={theme}
                />
              </StatSection>

              <StatSection
                title="Discipline"
                theme={theme}
              >
                <DataRow
                  label="Fouls"
                  value={
                    stats
                      .discipline
                      .fouls
                  }
                  theme={theme}
                />

                <DataRow
                  label="Yellow cards"
                  value={
                    stats
                      .discipline
                      .yellowCards
                  }
                  theme={theme}
                />

                <DataRow
                  label="Red cards"
                  value={
                    stats
                      .discipline
                      .redCards
                  }
                  theme={theme}
                />
              </StatSection>

              {hasGoalkeepingData(
                stats,
              ) ? (
                <StatSection
                  title="Goalkeeping"
                  theme={theme}
                >
                  <DataRow
                    label="Saves"
                    value={
                      stats
                        .goalkeeping
                        .saves
                    }
                    theme={theme}
                  />

                  <DataRow
                    label="Goals conceded"
                    value={
                      stats
                        .goalkeeping
                        .goalsConceded
                    }
                    theme={theme}
                  />

                  <DataRow
                    label="Clean sheet"
                    value={
                      stats
                        .goalkeeping
                        .cleanSheet ===
                      null
                        ? null
                        : stats
                            .goalkeeping
                            .cleanSheet
                          ? "Yes"
                          : "No"
                    }
                    theme={theme}
                  />
                </StatSection>
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function PlayerImage({
  player,
  theme,
}: {
  player:
    MatchPlayerDetail;

  theme:
    KitTheme;
}) {
  if (
    player.player
      .portraitUrl
  ) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={
            player.player
              .portraitUrl
          }
          alt=""
          className="
            h-24
            w-24
            shrink-0
            object-cover
            object-top
          "
        />
      </>
    );
  }

  return (
    <div
      className="
        flex
        h-24
        w-24
        shrink-0
        items-center
        justify-center
        border
        text-2xl
        font-medium
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
      {
        player.player
          .name[0]
      }
    </div>
  );
}

function HeroMetric({
  label,
  value,
  theme,
  rating = false,
}: {
  label:
    string;

  value:
    number | null;

  theme:
    KitTheme;

  rating?:
    boolean;
}) {
  return (
    <div
      className="
        border
        px-3
        py-4
      "
      style={{
        borderColor:
          theme.colors
            .border,
      }}
    >
      <p
        className="
          text-[7px]
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

      <p
        className="
          mt-2
          font-mono
          text-lg
          font-medium
          tabular-nums
        "
        style={{
          color:
            rating &&
            value !== null
              ? ratingPalette(
                  value,
                ).text
              : theme.colors
                  .text,
        }}
      >
        {value === null
          ? "—"
          : formatNumber(
              value,
            )}
      </p>
    </div>
  );
}

function RatingBadge({
  value,
}: {
  value:
    number | null;
}) {
  if (
    value === null
  ) {
    return null;
  }

  const palette =
    ratingPalette(
      value,
    );

  return (
    <div
      className="
        shrink-0
        border
        px-3
        py-2
        text-center
      "
      style={{
        borderColor:
          palette.border,

        backgroundColor:
          palette.background,
      }}
    >
      <p
        className="
          font-mono
          text-xl
          font-semibold
          tabular-nums
        "
        style={{
          color:
            palette.text,
        }}
      >
        {formatNumber(
          value,
        )}
      </p>

      <p
        className="
          mt-1
          text-[7px]
          uppercase
          tracking-[0.18em]
        "
        style={{
          color:
            palette.text,
        }}
      >
        Rating
      </p>
    </div>
  );
}

function StatSection({
  title,
  theme,
  children,
}: {
  title:
    string;

  theme:
    KitTheme;

  children:
    React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div
        className="
          border-b
          pb-2
        "
        style={{
          borderColor:
            theme.colors
              .border,
        }}
      >
        <p
          className="
            text-[8px]
            font-semibold
            uppercase
            tracking-[0.22em]
          "
          style={{
            color:
              theme.colors
                .accent,
          }}
        >
          {title}
        </p>
      </div>

      <div>
        {children}
      </div>
    </section>
  );
}

function DataRow({
  label,
  value,
  percent = false,
  theme,
}: {
  label:
    string;

  value:
    number |
    string |
    null;

  percent?:
    boolean;

  theme:
    KitTheme;
}) {
  if (
    value === null
  ) {
    return null;
  }

  let displayValue:
    string;

  if (
    typeof value ===
    "string"
  ) {
    displayValue =
      value;
  } else if (
    percent
  ) {
    displayValue =
      `${Math.round(
        value *
          100,
      )}%`;
  } else {
    displayValue =
      formatNumber(
        value,
      );
  }

  return (
    <div
      className="
        flex
        items-center
        justify-between
        gap-5
        border-b
        py-3
      "
      style={{
        borderColor:
          theme.colors
            .border,
      }}
    >
      <span
        className="text-[11px]"
        style={{
          color:
            theme.colors
              .textMuted,
        }}
      >
        {label}
      </span>

      <span className="font-mono text-xs font-medium tabular-nums">
        {displayValue}
      </span>
    </div>
  );
}

function hasGoalkeepingData(
  stats:
    NonNullable<
      MatchPlayerDetail[
        "statistics"
      ]
    >,
) {
  return (
    stats.goalkeeping
      .saves !==
      null ||
    stats.goalkeeping
      .goalsConceded !==
      null ||
    stats.goalkeeping
      .cleanSheet !==
      null
  );
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
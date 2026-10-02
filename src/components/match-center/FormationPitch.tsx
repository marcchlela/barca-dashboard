"use client";

import {
  ArrowDown,
  ArrowUp,
} from "lucide-react";

import {
  usePlayerPerformance,
} from "./PlayerPerformanceContext";

import type {
  MatchCenterData,
} from "../../lib/matches/get-match-center";

import type {
  KitTheme,
} from "../../lib/themes";

type Lineup =
  MatchCenterData["lineups"]["home"];

type LineupEntry =
  NonNullable<
    Lineup
  >["starters"][number];

type FormationPitchProps = {
  lineup:
    Lineup;

  theme:
    KitTheme;
};

type PositionedPlayer = {
  player:
    LineupEntry;

  x:
    number;

  y:
    number;
};

export default function FormationPitch({
  
  lineup,
  theme,
}: FormationPitchProps) {
  const {
  openPlayer,
} =
  usePlayerPerformance();

  if (!lineup) {
    return (
      <EmptyLineup
        theme={theme}
        text="Lineup unavailable"
      />
    );
  }

  const formation =
    parseFormation(
      lineup.formation,
    );

  if (
    !formation ||
    lineup.starters.length !==
      11
  ) {
    return (
      <UnknownFormation
        lineup={lineup}
        theme={theme}
      />
    );
  }

  const positioned =
    positionPlayers(
      lineup.starters,
      formation,
    );

  return (
    <div>
      <div
        className="
          relative
          mx-auto
          aspect-[68/105]
          w-full
          max-w-[620px]
          overflow-hidden
          border
        "
        style={{
          backgroundColor:
            "#102D24",

          borderColor:
            theme.colors.border,
        }}
      >
        <PitchTexture
          theme={theme}
        />

        <PitchMarkings />

        {positioned.map(
          ({
            player,
            x,
            y,
          }) => (
          <div
            key={
              player.player.id
            }
            className="
              absolute
              z-10
              -translate-x-1/2
              -translate-y-1/2
            "
            style={{
              left:
                `${x}%`,

              top:
                `${y}%`,
            }}
          >
            <button
              type="button"
              onClick={() =>
                openPlayer(
                  player.player
                    .id,
                )
              }
              className="
                cursor-pointer
                transition-transform
                hover:scale-105
                focus-visible:outline-none
                focus-visible:ring-1
              "
              style={{
                color:
                  theme.colors
                    .accent,
              }}
              aria-label={`View ${player.player.name} match performance`}
            >
              <PlayerMarker
                player={
                  player
                }
                isBarcelona={
                  lineup.team
                    .isBarcelona
                }
                theme={theme}
              />
            </button>
          </div>
          ),
        )}
      </div>

      <Bench
        lineup={lineup}
        theme={theme}
      />
    </div>
  );
}

function PitchTexture({
  theme,
}: {
  theme:
    KitTheme;
}) {
  return (
    <>
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            `
            repeating-linear-gradient(
              0deg,
              rgba(255,255,255,0.025) 0px,
              rgba(255,255,255,0.025) 58px,
              rgba(0,0,0,0.04) 58px,
              rgba(0,0,0,0.04) 116px
            )
          `,
        }}
      />

      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          background:
            `linear-gradient(
              135deg,
              transparent,
              ${theme.colors.accent}
            )`,
        }}
      />
    </>
  );
}

function PitchMarkings() {
  const line =
    "rgba(255,255,255,0.48)";

  return (
    <div
      className="pointer-events-none absolute inset-[4%]"
      style={{
        border:
          `1px solid ${line}`,
      }}
    >
      <div
        className="
          absolute
          left-0
          right-0
          top-1/2
          border-t
        "
        style={{
          borderColor:
            line,
        }}
      />

      <div
        className="
          absolute
          left-1/2
          top-1/2
          h-[15%]
          aspect-square
          -translate-x-1/2
          -translate-y-1/2
          rounded-full
          border
        "
        style={{
          borderColor:
            line,
        }}
      />

      <div
        className="
          absolute
          left-1/2
          top-1/2
          h-1.5
          w-1.5
          -translate-x-1/2
          -translate-y-1/2
          rounded-full
        "
        style={{
          backgroundColor:
            line,
        }}
      />

      <div
        className="
          absolute
          left-1/2
          top-0
          h-[16%]
          w-[58%]
          -translate-x-1/2
          border-x
          border-b
        "
        style={{
          borderColor:
            line,
        }}
      />

      <div
        className="
          absolute
          left-1/2
          top-0
          h-[7%]
          w-[28%]
          -translate-x-1/2
          border-x
          border-b
        "
        style={{
          borderColor:
            line,
        }}
      />

      <div
        className="
          absolute
          bottom-0
          left-1/2
          h-[16%]
          w-[58%]
          -translate-x-1/2
          border-x
          border-t
        "
        style={{
          borderColor:
            line,
        }}
      />

      <div
        className="
          absolute
          bottom-0
          left-1/2
          h-[7%]
          w-[28%]
          -translate-x-1/2
          border-x
          border-t
        "
        style={{
          borderColor:
            line,
        }}
      />
    </div>
  );
}

function PlayerMarker({
  player,
  isBarcelona,
  theme,
}: {
  player:
    LineupEntry;

  isBarcelona:
    boolean;

  theme:
    KitTheme;
}) {
  const yellowCards =
    player.statistics
      ?.discipline
      .yellowCards ?? 0;

  const redCards =
    player.statistics
      ?.discipline
      .redCards ?? 0;

  const minutes =
    player.statistics
      ?.minutes ?? null;

  const subbedOut =
    player.leftMinute !==
      null ||
    (
      minutes !== null &&
      minutes > 0 &&
      minutes < 90 &&
      redCards === 0
    );

  return (
    <div className="flex w-[92px] flex-col items-center">
      <div
        className="
          relative
          flex
          h-[42px]
          w-[46px]
          items-center
          justify-center
          text-[12px]
          font-bold
          shadow-[0_8px_18px_rgba(0,0,0,0.34)]
        "
        style={{
          clipPath:
            `polygon(
              20% 0%,
              36% 8%,
              64% 8%,
              80% 0%,
              100% 18%,
              86% 36%,
              76% 29%,
              76% 100%,
              24% 100%,
              24% 29%,
              14% 36%,
              0% 18%
            )`,

          background:
            isBarcelona
              ? `linear-gradient(
                  90deg,
                  ${theme.colors.primary} 0%,
                  ${theme.colors.primary} 32%,
                  ${theme.colors.secondary} 32%,
                  ${theme.colors.secondary} 67%,
                  ${theme.colors.primary} 67%,
                  ${theme.colors.primary} 100%
                )`
              : "#E7E9EB",

          color:
            isBarcelona
              ? "#F5EAD2"
              : "#101820",
        }}
      >
        {player.shirtNumber ??
          "—"}
      </div>

      <div
        className="
          mt-1.5
          max-w-[92px]
          truncate
          bg-[#07111F]/90
          px-1.5
          py-0.5
          text-center
          text-[9px]
          font-medium
          leading-4
          text-white
          backdrop-blur-sm
        "
        title={
          player.player.name
        }
      >
        {shortPlayerName(
          player.player.name,
        )}
      </div>

      <PlayerStatus
        yellowCards={
          yellowCards
        }
        redCards={
          redCards
        }
        subbedOut={
          subbedOut
        }
        subMinute={
          player.leftMinute
        }
      />
    </div>
  );
}

function PlayerStatus({
  yellowCards,
  redCards,
  subbedOut,
  subMinute,
}: {
  yellowCards:
    number;

  redCards:
    number;

  subbedOut:
    boolean;

  subMinute:
    number | null;
}) {
  if (
    yellowCards <= 0 &&
    redCards <= 0 &&
    !subbedOut
  ) {
    return null;
  }

  return (
    <div className="mt-1 flex h-4 items-center gap-1">
      {yellowCards > 0 ? (
        <span
          title={
            yellowCards > 1
              ? `${yellowCards} yellow cards`
              : "Yellow card"
          }
          className="flex items-center gap-0.5"
        >
          <span className="h-2.5 w-1.5 rounded-[1px] bg-[#F2CA45]" />

          {yellowCards > 1 ? (
            <span className="text-[7px] text-white/70">
              ×{yellowCards}
            </span>
          ) : null}
        </span>
      ) : null}

      {redCards > 0 ? (
        <span
          title="Red card"
          className="h-2.5 w-1.5 rounded-[1px] bg-[#E84C5B]"
        />
      ) : null}

      {subbedOut ? (
        <span
          className="
            flex
            items-center
            gap-0.5
            text-[7px]
            font-semibold
            text-[#E56B73]
          "
          title="Substituted out"
        >
          <ArrowDown
            size={10}
            strokeWidth={2.2}
          />

          {subMinute !==
          null
            ? `${subMinute}'`
            : null}
        </span>
      ) : null}
    </div>
  );
}

function Bench({
  lineup,
  theme,
}: 
{
  lineup:
    NonNullable<
      Lineup
    >;

  theme:
    KitTheme;
}) {
    const {
    openPlayer,
  } =
  usePlayerPerformance();
  return (
    <div
      className="mt-5 border-t pt-4"
      style={{
        borderColor:
          theme.colors.border,
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p
            className="text-[9px] uppercase tracking-[0.24em]"
            style={{
              color:
                theme.colors
                  .textMuted,
            }}
          >
            Bench
          </p>

          <p className="mt-1 text-xs">
            {
              lineup.bench
                .length
            }{" "}
            players
          </p>
        </div>

        {lineup.coachName ? (
          <div className="text-right">
            <p
              className="text-[9px] uppercase tracking-[0.22em]"
              style={{
                color:
                  theme.colors
                    .textMuted,
              }}
            >
              Coach
            </p>

            <p className="mt-1 text-xs">
              {
                lineup.coachName
              }
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {lineup.bench.map(
          (
            player,
          ) => {
            const minutes =
              player.statistics
                ?.minutes ??
              0;

            const subbedIn =
              player.enteredMinute !==
                null ||
              minutes > 0;

            const yellowCards =
              player.statistics
                ?.discipline
                .yellowCards ??
              0;

            const redCards =
              player.statistics
                ?.discipline
                .redCards ??
              0;

            return (
              <button
                key={
                  player.player.id
                }
                type="button"
                onClick={() =>
                  openPlayer(
                    player.player
                      .id,
                  )
                }
                className="
                  flex
                  w-full
                  min-w-0
                  cursor-pointer
                  items-center
                  gap-2
                  border-b
                  py-2
                  text-left
                  transition-colors
                  hover:bg-white/[0.025]
                "
                style={{
                  borderColor:
                    theme.colors
                      .border,
                }}
              >
                <span
                  className="
                    w-6
                    shrink-0
                    text-right
                    font-mono
                    text-[10px]
                  "
                  style={{
                    color:
                      theme.colors
                        .accent,
                  }}
                >
                  {player.shirtNumber ??
                    "—"}
                </span>

                <span className="min-w-0 flex-1 truncate text-[11px]">
                  {
                    player.player
                      .name
                  }
                </span>

                <div className="flex shrink-0 items-center gap-1">
                  {yellowCards >
                  0 ? (
                    <span className="h-2.5 w-1.5 rounded-[1px] bg-[#F2CA45]" />
                  ) : null}

                  {redCards >
                  0 ? (
                    <span className="h-2.5 w-1.5 rounded-[1px] bg-[#E84C5B]" />
                  ) : null}

                  {subbedIn ? (
                    <span
                      className="
                        flex
                        items-center
                        gap-0.5
                        text-[8px]
                        font-semibold
                        text-[#58C98D]
                      "
                      title="Substituted in"
                    >
                      <ArrowUp
                        size={11}
                        strokeWidth={2.2}
                      />

                      {player.enteredMinute !==
                      null
                        ? `${player.enteredMinute}'`
                        : null}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          },
        )}
      </div>
    </div>
  );
}

function UnknownFormation({
  lineup,
  theme,
}: {
  lineup:
    NonNullable<
      Lineup
    >;

  theme:
    KitTheme;
}) {
  return (
    <div>
      <div
        className="border px-5 py-5"
        style={{
          borderColor:
            theme.colors.border,

          backgroundColor:
            theme.colors.surface,
        }}
      >
        <p
          className="text-[9px] uppercase tracking-[0.24em]"
          style={{
            color:
              theme.colors
                .textMuted,
          }}
        >
          Formation unavailable
        </p>

        <p className="mt-2 text-sm">
          Starting XI
        </p>

        <div className="mt-5 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          {lineup.starters.map(
            (
              player,
              index,
            ) => (
              <div
                key={
                  player.player.id
                }
                className="flex items-center gap-3 border-b py-3"
                style={{
                  borderColor:
                    theme.colors
                      .border,
                }}
              >
                <span
                  className="w-5 font-mono text-[10px]"
                  style={{
                    color:
                      theme.colors
                        .textMuted,
                  }}
                >
                  {index + 1}
                </span>

                <span
                  className="w-6 text-right font-mono text-[10px]"
                  style={{
                    color:
                      theme.colors
                        .accent,
                  }}
                >
                  {player.shirtNumber ??
                    "—"}
                </span>

                <span className="min-w-0 flex-1 truncate text-xs">
                  {
                    player.player
                      .name
                  }
                </span>

                <span
                  className="text-[9px] uppercase tracking-[0.12em]"
                  style={{
                    color:
                      theme.colors
                        .textMuted,
                  }}
                >
                  {player.position ??
                    player.player
                      .primaryPosition}
                </span>
              </div>
            ),
          )}
        </div>
      </div>

      <Bench
        lineup={lineup}
        theme={theme}
      />
    </div>
  );
}

function EmptyLineup({
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
      className="border p-8 text-center"
      style={{
        borderColor:
          theme.colors.border,

        color:
          theme.colors
            .textMuted,
      }}
    >
      <p className="text-xs uppercase tracking-[0.18em]">
        {text}
      </p>
    </div>
  );
}

function parseFormation(
  formation:
    string | null,
) {
  if (!formation) {
    return null;
  }

  const numbers =
    formation
      .split("-")
      .map(
        (value) =>
          Number(
            value,
          ),
      );

  if (
    numbers.some(
      (value) =>
        !Number.isInteger(
          value,
        ) ||
        value <= 0,
    )
  ) {
    return null;
  }

  if (
    numbers.reduce(
      (
        sum,
        value,
      ) =>
        sum +
        value,
      0,
    ) !== 10
  ) {
    return null;
  }

  return [
    1,
    ...numbers,
  ];
}

function positionPlayers(
  players:
    LineupEntry[],

  lines:
    number[],
): PositionedPlayer[] {
  const positioned:
    PositionedPlayer[] =
    [];

  let playerIndex =
    0;

  for (
    let lineIndex = 0;
    lineIndex <
    lines.length;
    lineIndex += 1
  ) {
    const count =
      lines[
        lineIndex
      ];

    const y =
      lines.length === 1
        ? 50
        : 88 -
          (
            lineIndex /
            (
              lines.length -
              1
            )
          ) *
            68;

    for (
      let slot = 0;
      slot < count;
      slot += 1
    ) {
      const player =
        players[
          playerIndex
        ];

      if (!player) {
        break;
      }

      const x =
        count === 1
          ? 50
          : 15 +
            (
              slot /
              (
                count -
                1
              )
            ) *
              70;

      positioned.push({
        player,
        x,
        y,
      });

      playerIndex +=
        1;
    }
  }

  return positioned;
}

function shortPlayerName(
  name:
    string,
) {
  const parts =
    name
      .trim()
      .split(/\s+/);

  if (
    parts.length <= 2
  ) {
    return name;
  }

  return parts[
    parts.length - 1
  ];
}
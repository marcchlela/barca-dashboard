"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  Activity,
  AlertTriangle,
  Crown,
  Grid2X2,
  LoaderCircle,
  Search,
  ShieldCheck,
  Star,
  UserRound,
  Users,
} from "lucide-react";

import PlayerQuickView from "./PlayerQuickView";

import {
  nationalityDisplay,
} from "../../lib/countries";

import type {
  KitTheme,
} from "../../lib/themes";

import type {
  SquadOverviewData,
  SquadPosition,
} from "../../lib/squad/get-squad-overview";

type SquadPlayer =
  SquadOverviewData[
    "players"
  ][number];

type ViewMode =
  | "grid"
  | "pitch";

type AvailabilityFilter =
  | "all"
  | "available"
  | "unavailable"
  | "favourites";

type PositionFilter =
  | "all"
  | SquadPosition;

const POSITION_ORDER:
  SquadPosition[] = [
    "goalkeeper",
    "defender",
    "midfielder",
    "forward",
    "unknown",
  ];

export default function SquadOverview({
  data,
  theme,
}: {
  data:
    SquadOverviewData;

  theme:
    KitTheme;
}) {
  const [
    query,
    setQuery,
  ] =
    useState(
      "",
    );

  const [
    position,
    setPosition,
  ] =
    useState<PositionFilter>(
      "all",
    );

  const [
    availability,
    setAvailability,
  ] =
    useState<AvailabilityFilter>(
      "all",
    );

  const [
    view,
    setView,
  ] =
    useState<ViewMode>(
      "grid",
    );

  const [
    selectedPlayerId,
    setSelectedPlayerId,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    hoveredPlayerId,
    setHoveredPlayerId,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    favouriteIds,
    setFavouriteIds,
  ] =
    useState<
      Set<string>
    >(
      () =>
        new Set(
          data.players
            .filter(
              (
                player,
              ) =>
                player.isFavourite,
            )
            .map(
              (
                player,
              ) =>
                player.id,
            ),
        ),
    );

  const [
    favouriteBusy,
    setFavouriteBusy,
  ] =
    useState<
      Set<string>
    >(
      new Set(),
    );

  const [
    favouriteError,
    setFavouriteError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const filteredPlayers =
    useMemo(
      () => {
        const normalized =
          query
            .trim()
            .toLowerCase();

        return data.players.filter(
          (
            player,
          ) => {
            if (
              position !==
                "all" &&
              player.position !==
                position
            ) {
              return false;
            }

            if (
              availability ===
                "available" &&
              player.availability !==
                "available"
            ) {
              return false;
            }

            if (
              availability ===
                "unavailable" &&
              player.availability !==
                "unavailable"
            ) {
              return false;
            }

            if (
              availability ===
                "favourites" &&
              !favouriteIds.has(
                player.id,
              )
            ) {
              return false;
            }

            if (
              !normalized
            ) {
              return true;
            }

            return [
              player.displayName,
              player.firstName,
              player.lastName,
              player.nationality,
              player.preferredFoot,
              player.position,
              player.shirtNumber,
            ]
              .filter(
                (
                  value,
                ) =>
                  value !==
                    null &&
                  value !==
                    undefined,
              )
              .join(
                " ",
              )
              .toLowerCase()
              .includes(
                normalized,
              );
          },
        );
      },
      [
        availability,
        data.players,
        favouriteIds,
        position,
        query,
      ],
    );

  const grouped =
    useMemo(
      () =>
        POSITION_ORDER
          .map(
            (
              groupPosition,
            ) => ({
              position:
                groupPosition,

              players:
                filteredPlayers.filter(
                  (
                    player,
                  ) =>
                    player.position ===
                    groupPosition,
                ),
            }),
          )
          .filter(
            (
              group,
            ) =>
              group.players
                .length >
              0,
          ),
      [
        filteredPlayers,
      ],
    );

  /*
  |--------------------------------------------------------------------------
  | Modal player order
  |--------------------------------------------------------------------------
  */

  const selectedPlayer =
    data.players.find(
      (
        player,
      ) =>
        player.id ===
        selectedPlayerId,
    ) ??
    null;

  const modalPlayers =
    filteredPlayers.length >
    0
      ? filteredPlayers
      : data.players;

  const selectedIndex =
    selectedPlayer
      ? modalPlayers.findIndex(
          (
            player,
          ) =>
            player.id ===
            selectedPlayer.id,
        )
      : -1;

  const previousPlayer =
    selectedIndex >
    0
      ? modalPlayers[
          selectedIndex -
            1
        ]
      : null;

  const nextPlayer =
    selectedIndex >=
        0 &&
      selectedIndex <
        modalPlayers.length -
          1
      ? modalPlayers[
          selectedIndex +
            1
        ]
      : null;

  /*
  |--------------------------------------------------------------------------
  | Favourite
  |--------------------------------------------------------------------------
  */

  async function toggleFavourite(
    playerId:
      string,
  ) {
    if (
      favouriteBusy.has(
        playerId,
      )
    ) {
      return;
    }

    const wasFavourite =
      favouriteIds.has(
        playerId,
      );

    const nextValue =
      !wasFavourite;

    setFavouriteError(
      null,
    );

    setFavouriteBusy(
      (
        current,
      ) => {
        const next =
          new Set(
            current,
          );

        next.add(
          playerId,
        );

        return next;
      },
    );

    setFavouriteIds(
      (
        current,
      ) => {
        const next =
          new Set(
            current,
          );

        if (nextValue) {
          next.add(
            playerId,
          );
        } else {
          next.delete(
            playerId,
          );
        }

        return next;
      },
    );

    try {
      const response =
        await fetch(
          "/api/favourites/player",
          {
            method:
              nextValue
                ? "PUT"
                : "DELETE",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                playerId,
              }),
          },
        );

      const payload =
        (
          await response.json()
        ) as {
          ok?:
            boolean;

          error?:
            string;
        };

      if (
        !response.ok ||
        payload.ok !==
          true
      ) {
        throw new Error(
          payload.error ??
          "Favourite could not be updated.",
        );
      }
    } catch (
      error
    ) {
      setFavouriteIds(
        (
          current,
        ) => {
          const next =
            new Set(
              current,
            );

          if (wasFavourite) {
            next.add(
              playerId,
            );
          } else {
            next.delete(
              playerId,
            );
          }

          return next;
        },
      );

      setFavouriteError(
        error instanceof Error
          ? error.message
          : String(
              error,
            ),
      );
    } finally {
      setFavouriteBusy(
        (
          current,
        ) => {
          const next =
            new Set(
              current,
            );

          next.delete(
            playerId,
          );

          return next;
        },
      );
    }
  }

  return (
    <>
      <div>
        {/* HEADER */}

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
                ${theme.colors.surface},
                ${theme.colors.backgroundElevated}
              )
            `,
          }}
        >
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

          <div
            className="
              grid

              xl:grid-cols-[minmax(0,1fr)_auto]
            "
          >
            <div
              className="
                flex
                items-center
                gap-4
                px-6
                py-5
              "
            >
              <div
                className="
                  flex
                  h-10
                  w-10
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
                <Users
                  size={17}
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
                  First Team
                </p>

                <h2
                  className="
                    mt-1
                    text-xl
                    font-medium
                  "
                >
                  Current Squad
                </h2>

                <p
                  className="
                    mt-1
                    text-[9px]
                  "
                  style={{
                    color:
                      theme.colors.textMuted,
                  }}
                >
                  Squad identity,
                  availability, tracked
                  season output and your
                  favourite players.
                </p>
              </div>
            </div>

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
                label="Players"
                value={
                  data.summary
                    .players
                }
                theme={
                  theme
                }
              />

              <HeaderMetric
                label="Available"
                value={
                  data.summary
                    .available
                }
                tone="success"
                theme={
                  theme
                }
              />

              <HeaderMetric
                label="Out"
                value={
                  data.summary
                    .unavailable
                }
                tone={
                  data.summary
                    .unavailable >
                  0
                    ? "danger"
                    : "normal"
                }
                theme={
                  theme
                }
              />

              <HeaderMetric
                label="Favourites"
                value={
                  favouriteIds.size
                }
                tone="accent"
                theme={
                  theme
                }
              />
            </div>
          </div>
        </section>

        {/* NOTE */}

        <section
          className="
            mt-4
            flex
            items-start
            gap-3
            border
            px-4
            py-3
          "
          style={{
            borderColor:
              theme.colors.border,

            backgroundColor:
              `${theme.colors.surface}58`,
          }}
        >
          <Activity
            size={13}
            style={{
              color:
                theme.colors.accent,
            }}
          />

          <p
            className="
              text-[8px]
              leading-4
            "
            style={{
              color:
                theme.colors.textMuted,
            }}
          >
            Season numbers reflect
            canonical player-match
            statistics currently stored
            for Barça.
          </p>
        </section>

        {favouriteError ? (
          <section
            className="
              mt-4
              flex
              items-center
              gap-2
              border
              px-4
              py-3
              text-[8px]
            "
            style={{
              borderColor:
                `${theme.colors.danger}66`,

              color:
                theme.colors.danger,
            }}
          >
            <AlertTriangle
              size={12}
            />

            {
              favouriteError
            }
          </section>
        ) : null}

        {/* CONTROLS */}

        <section
          className="
            mt-5
            border
          "
          style={{
            borderColor:
              theme.colors.border,

            backgroundColor:
              `${theme.colors.surface}70`,
          }}
        >
          <div
            className="
              flex
              flex-col
              gap-4
              p-4

              xl:flex-row
              xl:items-center
              xl:justify-between
            "
          >
            <div
              className="
                relative
                w-full

                xl:max-w-[380px]
              "
            >
              <Search
                size={13}
                className="
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
                placeholder="Search player, nationality or number..."
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
                  "grid"
                }
                label="Grid"
                icon={
                  Grid2X2
                }
                onClick={
                  () =>
                    setView(
                      "grid",
                    )
                }
                theme={
                  theme
                }
              />

              <ViewButton
                active={
                  view ===
                  "pitch"
                }
                label="Pitch"
                icon={
                  ShieldCheck
                }
                onClick={
                  () =>
                    setView(
                      "pitch",
                    )
                }
                theme={
                  theme
                }
              />
            </div>
          </div>

          <div
            className="
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
            <FilterButton
              active={
                position ===
                "all"
              }
              label="All Positions"
              count={
                data.summary
                  .players
              }
              onClick={
                () =>
                  setPosition(
                    "all",
                  )
              }
              theme={
                theme
              }
            />

            <FilterButton
              active={
                position ===
                "goalkeeper"
              }
              label="Goalkeepers"
              count={
                data.summary
                  .goalkeepers
              }
              onClick={
                () =>
                  setPosition(
                    "goalkeeper",
                  )
              }
              theme={
                theme
              }
            />

            <FilterButton
              active={
                position ===
                "defender"
              }
              label="Defenders"
              count={
                data.summary
                  .defenders
              }
              onClick={
                () =>
                  setPosition(
                    "defender",
                  )
              }
              theme={
                theme
              }
            />

            <FilterButton
              active={
                position ===
                "midfielder"
              }
              label="Midfielders"
              count={
                data.summary
                  .midfielders
              }
              onClick={
                () =>
                  setPosition(
                    "midfielder",
                  )
              }
              theme={
                theme
              }
            />

            <FilterButton
              active={
                position ===
                "forward"
              }
              label="Forwards"
              count={
                data.summary
                  .forwards
              }
              onClick={
                () =>
                  setPosition(
                    "forward",
                  )
              }
              theme={
                theme
              }
            />
          </div>

          <div
            className="
              flex
              flex-wrap
              gap-2
              border-t
              px-4
              py-3
            "
            style={{
              borderColor:
                theme.colors.border,
            }}
          >
            {(
              [
                [
                  "all",
                  "Everyone",
                ],
                [
                  "available",
                  "Available",
                ],
                [
                  "unavailable",
                  "Unavailable",
                ],
                [
                  "favourites",
                  "Favourites",
                ],
              ] as const
            ).map(
              (
                [
                  value,
                  label,
                ],
              ) => (
                <AvailabilityFilterButton
                  key={
                    value
                  }
                  active={
                    availability ===
                    value
                  }
                  label={
                    label
                  }
                  icon={
                    value ===
                    "favourites"
                      ? Star
                      : undefined
                  }
                  onClick={
                    () =>
                      setAvailability(
                        value,
                      )
                  }
                  theme={
                    theme
                  }
                />
              ),
            )}

            <span
              className="
                ml-auto
                self-center
                text-[7px]
              "
              style={{
                color:
                  theme.colors.textMuted,
              }}
            >
              {
                filteredPlayers.length
              }{" "}
              shown
            </span>
          </div>
        </section>

        {/* GRID */}

        {view ===
        "grid" ? (
          <section
            className="
              mt-7
            "
          >
            {grouped.map(
              (
                group,
              ) => (
                <section
                  key={
                    group.position
                  }
                  className="
                    mb-8
                  "
                >
                  <div
                    className="
                      flex
                      items-center
                      gap-3
                    "
                  >
                    <p
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
                        positionTitle(
                          group.position,
                        )
                      }
                    </p>

                    <span
                      className="
                        text-[7px]
                      "
                      style={{
                        color:
                          theme.colors.textMuted,
                      }}
                    >
                      {
                        group.players
                          .length
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
                      grid
                      gap-3

                      sm:grid-cols-2
                      xl:grid-cols-3
                      2xl:grid-cols-4
                    "
                  >
                    {group.players.map(
                      (
                        player,
                      ) => (
                        <PlayerCard
                          key={
                            player.id
                          }
                          player={
                            player
                          }
                          hovered={
                            hoveredPlayerId ===
                            player.id
                          }
                          favourite={
                            favouriteIds.has(
                              player.id,
                            )
                          }
                          favouriteBusy={
                            favouriteBusy.has(
                              player.id,
                            )
                          }
                          onMouseEnter={
                            () =>
                              setHoveredPlayerId(
                                player.id,
                              )
                          }
                          onMouseLeave={
                            () =>
                              setHoveredPlayerId(
                                (
                                  current,
                                ) =>
                                  current ===
                                  player.id
                                    ? null
                                    : current,
                              )
                          }
                          onOpen={
                            () =>
                              setSelectedPlayerId(
                                player.id,
                              )
                          }
                          onToggleFavourite={
                            toggleFavourite
                          }
                          theme={
                            theme
                          }
                        />
                      ),
                    )}
                  </div>
                </section>
              ),
            )}
          </section>
        ) : (
          <PitchView
            players={
              filteredPlayers
            }
            favouriteIds={
              favouriteIds
            }
            favouriteBusy={
              favouriteBusy
            }
            onOpenPlayer={
              setSelectedPlayerId
            }
            onToggleFavourite={
              toggleFavourite
            }
            theme={
              theme
            }
          />
        )}
      </div>

      {selectedPlayer ? (
        <PlayerQuickView
          player={
            selectedPlayer
          }
          favourite={
            favouriteIds.has(
              selectedPlayer.id,
            )
          }
          favouriteBusy={
            favouriteBusy.has(
              selectedPlayer.id,
            )
          }
          previousPlayerName={
            previousPlayer
              ?.displayName ??
            null
          }
          nextPlayerName={
            nextPlayer
              ?.displayName ??
            null
          }
          onPrevious={
            () => {
              if (
                previousPlayer
              ) {
                setSelectedPlayerId(
                  previousPlayer.id,
                );
              }
            }
          }
          onNext={
            () => {
              if (
                nextPlayer
              ) {
                setSelectedPlayerId(
                  nextPlayer.id,
                );
              }
            }
          }
          onToggleFavourite={
            toggleFavourite
          }
          onClose={
            () =>
              setSelectedPlayerId(
                null,
              )
          }
          theme={
            theme
          }
        />
      ) : null}
    </>
  );
}

/*
|--------------------------------------------------------------------------
| Player card
|--------------------------------------------------------------------------
*/

function PlayerCard({
  player,
  hovered,
  favourite,
  favouriteBusy,
  onMouseEnter,
  onMouseLeave,
  onOpen,
  onToggleFavourite,
  theme,
}: {
  player:
    SquadPlayer;

  hovered:
    boolean;

  favourite:
    boolean;

  favouriteBusy:
    boolean;

  onMouseEnter:
    () => void;

  onMouseLeave:
    () => void;

  onOpen:
    () => void;

  onToggleFavourite:
    (
      playerId:
        string,
    ) =>
      void;

  theme:
    KitTheme;
}) {
  const nationality =
    nationalityDisplay(
      player.nationality,
    );

  return (
    <article
      onMouseEnter={
        onMouseEnter
      }
      onMouseLeave={
        onMouseLeave
      }
      className="
        group
        relative
        cursor-pointer
        overflow-hidden
        border
      "
      style={{
        borderColor:
          hovered
            ? `${theme.colors.accent}88`
            : theme.colors.border,

        backgroundColor:
          `${theme.colors.surface}72`,

        transition:
          "border-color 300ms ease",
      }}
    >
      <button
        type="button"
        onClick={
          onOpen
        }
        aria-label={`Open ${player.displayName}`}
        className="
          absolute
          inset-0
          z-40
          cursor-pointer
        "
      />

      <div
        className="
          absolute
          left-0
          right-0
          top-0
          z-20
          h-[2px]
        "
        style={{
          backgroundColor:
            player.availability ===
            "available"
              ? theme.colors.success
              : theme.colors.danger,
        }}
      />

      <div
        className="
          relative
          h-[230px]
          overflow-hidden
        "
        style={{
          background: `
            linear-gradient(
              160deg,
              ${theme.colors.backgroundElevated},
              ${theme.colors.surface}
            )
          `,
        }}
      >
        <div
          className="
            absolute
            left-3
            top-2
            text-[64px]
            font-semibold
            leading-none
            opacity-[0.07]
          "
        >
          {
            player.shirtNumber ??
            "—"
          }
        </div>

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
            absolute
            right-3
            top-3
            z-50
            flex
            h-8
            w-8
            cursor-pointer
            items-center
            justify-center
            border

            disabled:cursor-wait
          "
          style={{
            borderColor:
              favourite
                ? `${theme.colors.accent}88`
                : theme.colors.border,

            color:
              favourite
                ? theme.colors.accent
                : theme.colors.textMuted,

            backgroundColor:
              `${theme.colors.background}E5`,
          }}
        >
          {favouriteBusy ? (
            <LoaderCircle
              size={13}
              className="animate-spin"
            />
          ) : (
            <Star
              size={13}
              fill={
                favourite
                  ? "currentColor"
                  : "none"
              }
            />
          )}
        </button>

        {player.isCaptain ? (
          <div
            className="
              absolute
              left-3
              top-3
              z-30
              flex
              items-center
              gap-1.5
              border
              px-2
              py-1.5
              text-[6px]
              uppercase
            "
            style={{
              borderColor:
                `${theme.colors.accent}66`,

              color:
                theme.colors.accent,
            }}
          >
            <Crown
              size={9}
            />

            Captain
          </div>
        ) : null}

        {player.portraitUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
                absolute
                inset-0
                h-full
                w-full
                origin-bottom
                object-contain
                object-bottom
                will-change-transform
              "
              style={{
                transform:
                  hovered
                    ? "translate3d(0,-2px,0) scale(1.018)"
                    : "translate3d(0,0,0) scale(1)",

                transition:
                  "transform 1100ms cubic-bezier(0.16, 1, 0.3, 1)",

                backfaceVisibility:
                  "hidden",

                imageRendering:
                  "auto",
              }}
            />

            <div
              className="
                pointer-events-none
                absolute
                inset-x-0
                bottom-0
                h-24
              "
              style={{
                background: `
                  linear-gradient(
                    transparent,
                    ${theme.colors.surface}
                  )
                `,
              }}
            />
          </>
        ) : (
          <div
            className="
              absolute
              inset-0
              flex
              items-center
              justify-center
            "
          >
            <UserRound
              size={64}
              style={{
                color:
                  theme.colors.textMuted,
              }}
            />
          </div>
        )}

        <div
          className="
            absolute
            bottom-3
            left-3
            z-30
          "
        >
          <AvailabilityBadge
            player={
              player
            }
            theme={
              theme
            }
          />
        </div>
      </div>

      <div
        className="
          border-t
          px-4
          py-4
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
            mt-1.5
            truncate
            text-[14px]
            font-medium
          "
        >
          {
            player.displayName
          }
        </h3>

        <div
          className="
            mt-3
            flex
            flex-wrap
            gap-x-3
            text-[7px]
          "
          style={{
            color:
              theme.colors.textMuted,
          }}
        >
          {nationality ? (
            <span>
              {
                nationality.text
              }
            </span>
          ) : null}

          {player.age !==
          null ? (
            <span>
              {
                player.age
              }{" "}
              yrs
            </span>
          ) : null}

          {player.preferredFoot ? (
            <span>
              {
                humanize(
                  player.preferredFoot,
                )
              }{" "}
              foot
            </span>
          ) : null}
        </div>

        <div
          className="
            mt-4
            grid
            grid-cols-4
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
          <PlayerMetric
            label="Apps"
            value={
              player.stats
                .appearances
            }
            theme={
              theme
            }
          />

          <PlayerMetric
            label="Min"
            value={
              player.stats
                .minutes
            }
            theme={
              theme
            }
          />

          <PlayerMetric
            label="Goals"
            value={
              player.stats
                .goals
            }
            theme={
              theme
            }
          />

          <PlayerMetric
            label="Assists"
            value={
              player.stats
                .assists
            }
            theme={
              theme
            }
          />
        </div>
      </div>
    </article>
  );
}

/*
|--------------------------------------------------------------------------
| Pitch
|--------------------------------------------------------------------------
*/

function PitchView({
  players,
  favouriteIds,
  favouriteBusy,
  onOpenPlayer,
  onToggleFavourite,
  theme,
}: {
  players:
    SquadPlayer[];

  favouriteIds:
    Set<string>;

  favouriteBusy:
    Set<string>;

  onOpenPlayer:
    (
      playerId:
        string,
    ) =>
      void;

  onToggleFavourite:
    (
      playerId:
        string,
    ) =>
      void;

  theme:
    KitTheme;
}) {
  const groups =
    [
      "forward",
      "midfielder",
      "defender",
      "goalkeeper",
      "unknown",
    ] satisfies SquadPosition[];

  return (
    <section
      className="
        mt-7
      "
    >
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
        Squad Map
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
        Position-organized roster
        view — not a starting XI.
      </p>

      <div
        className="
          relative
          mt-3
          overflow-hidden
          border
          px-6
          py-8
        "
        style={{
          borderColor:
            theme.colors.border,

          background: `
            linear-gradient(
              180deg,
              ${theme.colors.surface},
              ${theme.colors.backgroundElevated},
              ${theme.colors.surface}
            )
          `,
        }}
      >
        <div
          className="
            absolute
            inset-6
            border
            opacity-[0.16]
          "
          style={{
            borderColor:
              theme.colors.pitchLine,
          }}
        />

        <div
          className="
            relative
            z-10
            grid
            gap-8
          "
        >
          {groups.map(
            (
              position,
            ) => {
              const rows =
                players.filter(
                  (
                    player,
                  ) =>
                    player.position ===
                    position,
                );

              if (
                rows.length ===
                0
              ) {
                return null;
              }

              return (
                <div
                  key={
                    position
                  }
                >
                  <p
                    className="
                      mb-3
                      text-center
                      text-[7px]
                      uppercase
                    "
                    style={{
                      color:
                        theme.colors.textMuted,
                    }}
                  >
                    {
                      positionTitle(
                        position,
                      )
                    }
                  </p>

                  <div
                    className="
                      flex
                      flex-wrap
                      justify-center
                      gap-2
                    "
                  >
                    {rows.map(
                      (
                        player,
                      ) => (
                        <div
                          key={
                            player.id
                          }
                          className="
                            relative
                            flex
                            min-w-[150px]
                            cursor-pointer
                            items-center
                            gap-2
                            border
                            p-2
                          "
                          style={{
                            borderColor:
                              theme.colors.border,

                            backgroundColor:
                              `${theme.colors.background}E8`,
                          }}
                        >
                          <button
                            type="button"
                            onClick={
                              () =>
                                onOpenPlayer(
                                  player.id,
                                )
                            }
                            className="
                              absolute
                              inset-0
                              z-10
                              cursor-pointer
                            "
                          />

                          <div
                            className="
                              flex
                              h-9
                              w-9
                              shrink-0
                              items-end
                              justify-center
                              overflow-hidden
                              border
                            "
                            style={{
                              borderColor:
                                theme.colors.border,
                            }}
                          >
                            {player.portraitUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={
                                  player.portraitUrl
                                }
                                alt=""
                                className="
                                  h-full
                                  w-full
                                  object-contain
                                  object-bottom
                                "
                              />
                            ) : (
                              <UserRound
                                size={15}
                              />
                            )}
                          </div>

                          <div
                            className="
                              min-w-0
                              flex-1
                            "
                          >
                            <p
                              className="
                                text-[6px]
                              "
                              style={{
                                color:
                                  theme.colors.textMuted,
                              }}
                            >
                              #
                              {
                                player.shirtNumber ??
                                "—"
                              }
                            </p>

                            <p
                              className="
                                truncate
                                text-[8px]
                                font-medium
                              "
                            >
                              {
                                player.displayName
                              }
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={
                              favouriteBusy.has(
                                player.id,
                              )
                            }
                            onClick={
                              () =>
                                onToggleFavourite(
                                  player.id,
                                )
                            }
                            className="
                              relative
                              z-20
                              cursor-pointer
                            "
                            style={{
                              color:
                                favouriteIds.has(
                                  player.id,
                                )
                                  ? theme.colors.accent
                                  : theme.colors.textMuted,
                            }}
                          >
                            <Star
                              size={11}
                              fill={
                                favouriteIds.has(
                                  player.id,
                                )
                                  ? "currentColor"
                                  : "none"
                              }
                            />
                          </button>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              );
            },
          )}
        </div>
      </div>
    </section>
  );
}

/*
|--------------------------------------------------------------------------
| Shared UI
|--------------------------------------------------------------------------
*/

function AvailabilityBadge({
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
    <span
      className="
        inline-flex
        items-center
        gap-1.5
        border
        px-2
        py-1
        text-[6px]
        uppercase
      "
      style={{
        borderColor:
          available
            ? `${theme.colors.success}55`
            : `${theme.colors.danger}55`,

        color:
          available
            ? theme.colors.success
            : theme.colors.danger,

        backgroundColor:
          `${theme.colors.background}DD`,
      }}
    >
      <span
        className="
          h-1.5
          w-1.5
          rounded-full
        "
        style={{
          backgroundColor:
            available
              ? theme.colors.success
              : theme.colors.danger,
        }}
      />

      {available
        ? "Available"
        : "Unavailable"}
    </span>
  );
}

function PlayerMetric({
  label,
  value,
  theme,
}: {
  label:
    string;

  value:
    number;

  theme:
    KitTheme;
}) {
  return (
    <div
      className="
        px-2
        py-2.5
        text-center
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
          text-[10px]
          font-medium
        "
      >
        {value}
      </p>
    </div>
  );
}

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
    | "success"
    | "danger"
    | "accent";
}) {
  const color =
    tone ===
    "success"
      ? theme.colors.success
      : tone ===
          "danger"
        ? theme.colors.danger
        : tone ===
            "accent"
          ? theme.colors.accent
          : theme.colors.text;

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
        "
        style={{
          color,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function FilterButton({
  active,
  label,
  count,
  onClick,
  theme,
}: {
  active:
    boolean;

  label:
    string;

  count:
    number;

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
        shrink-0
        cursor-pointer
        border
        px-3
        py-1.5
        text-[7px]
        uppercase
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
      }}
    >
      {label}

      <span
        className="
          ml-2
        "
      >
        {count}
      </span>
    </button>
  );
}

function AvailabilityFilterButton({
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

  icon?:
    typeof Star;

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
        cursor-pointer
        items-center
        gap-1.5
        border
        px-3
        py-1.5
        text-[7px]
        uppercase
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
      }}
    >
      {Icon ? (
        <Icon
          size={9}
        />
      ) : null}

      {label}
    </button>
  );
}

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
    typeof Grid2X2;

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

function positionTitle(
  position:
    SquadPosition,
) {
  switch (
    position
  ) {
    case "goalkeeper":
      return "Goalkeepers";

    case "defender":
      return "Defenders";

    case "midfielder":
      return "Midfielders";

    case "forward":
      return "Forwards";

    default:
      return "Other";
  }
}

function positionShort(
  position:
    SquadPosition,
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
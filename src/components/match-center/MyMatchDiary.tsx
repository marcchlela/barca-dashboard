"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  BookHeart,
  Check,
  ChevronDown,
  Eye,
  LockKeyhole,
  Save,
  Trophy,
  X,
} from "lucide-react";

import {
  FaRegStar,
  FaStar,
  FaStarHalfStroke,
} from "react-icons/fa6";

import FootballIcon from "../icons/FootballIcon";

import type {
  MatchCenterData,
} from "../../lib/matches/get-match-center";

import type {
  KitTheme,
} from "../../lib/themes";

type MyMatchDiaryProps = {
  data:
    MatchCenterData;

  theme:
    KitTheme;
};

type WatchType =
  | "live"
  | "replay"
  | "highlights_only";

type SaveState =
  | "idle"
  | "saving"
  | "saved"
  | "error";

type DiaryPlayer = {
  id:
    string;

  name:
    string;

  portraitUrl:
    string | null;

  position:
    string | null;
};

type DiaryGoal =
  MatchCenterData[
    "events"
  ][number];

const GOAL_TYPES =
  new Set([
    "goal",
    "penalty_goal",
    "own_goal",
  ]);

export default function MyMatchDiary({
  data,
  theme,
}: MyMatchDiaryProps) {
  const finished =
    data.match.status ===
    "finished";

  const initial =
    data.diary;

  const [
    watched,
    setWatched,
  ] =
    useState(
      initial?.watched ??
        false,
    );

  const [
    watchType,
    setWatchType,
  ] =
    useState<
      WatchType | null
    >(
      normalizeWatchType(
        initial?.watchType ??
          null,
      ),
    );

  const [
    rating,
    setRating,
  ] =
    useState<
      number | null
    >(
      normalizeExistingRating(
        initial?.rating ??
          null,
      ),
    );

  const [
    favouritePlayerId,
    setFavouritePlayerId,
  ] =
    useState<
      string | null
    >(
      initial
        ?.favouritePlayerId ??
        null,
    );

  const [
    favouriteGoalEventId,
    setFavouriteGoalEventId,
  ] =
    useState<
      string | null
    >(
      initial
        ?.favouriteGoalEventId ??
        null,
    );

  const [
    notes,
    setNotes,
  ] =
    useState(
      initial?.notes ??
        "",
    );

  const [
    saveState,
    setSaveState,
  ] =
    useState<SaveState>(
      "idle",
    );

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const players =
    useMemo(
      () =>
        matchBarcelonaPlayers(
          data,
        ),
      [
        data,
      ],
    );

  const goals =
    useMemo(
      () =>
        data.events.filter(
          (
            event,
          ) =>
            event.team
              ?.isBarcelona ===
              true &&
            GOAL_TYPES.has(
              event.type,
            ),
        ),
      [
        data.events,
      ],
    );

  async function save() {
    if (!finished) {
      return;
    }

    setSaveState(
      "saving",
    );

    setError(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/matches/${data.match.id}/diary`,

          {
            method:
              "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                watched,

                watchType:
                  watched
                    ? watchType
                    : null,

                rating,

                favouritePlayerId,

                favouriteGoalEventId,

                notes,
              }),
          },
        );

      const payload =
        await response.json();

      if (
        !response.ok ||
        !payload.ok
      ) {
        throw new Error(
          payload.error ??
            "Could not save diary entry.",
        );
      }

      setSaveState(
        "saved",
      );

      window.setTimeout(
        () => {
          setSaveState(
            "idle",
          );
        },
        1800,
      );
    } catch (
      caught
    ) {
      setSaveState(
        "error",
      );

      setError(
        caught instanceof Error
          ? caught.message
          : String(
              caught,
            ),
      );
    }
  }

  return (
    <section
      id="my-match"
      className="
        scroll-mt-24
        mt-6
        overflow-hidden
        border
      "
      style={{
        borderColor:
          theme.colors
            .border,

        background:
          `linear-gradient(
            135deg,
            ${theme.colors.surface} 0%,
            ${theme.colors.backgroundElevated} 72%,
            ${theme.colors.accent}0A 100%
          )`,
      }}
    >
      <header
        className="
          flex
          flex-col
          gap-4
          border-b
          px-5
          py-5
          sm:flex-row
          sm:items-end
          sm:justify-between
          sm:px-7
        "
        style={{
          borderColor:
            theme.colors
              .border,
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="
              mt-0.5
              flex
              h-9
              w-9
              items-center
              justify-center
              border
            "
            style={{
              borderColor:
                finished
                  ? theme.colors
                      .accent
                  : theme.colors
                      .border,

              color:
                finished
                  ? theme.colors
                      .accent
                  : theme.colors
                      .textMuted,

              backgroundColor:
                finished
                  ? `${theme.colors.accent}0B`
                  : "transparent",
            }}
          >
            {finished ? (
              <BookHeart
                size={16}
              />
            ) : (
              <LockKeyhole
                size={16}
              />
            )}
          </div>

          <div>
            <p
              className="
                text-[8px]
                uppercase
                tracking-[0.24em]
              "
              style={{
                color:
                  finished
                    ? theme.colors
                        .accent
                    : theme.colors
                        .textMuted,
              }}
            >
              Personal Archive
            </p>

            <h2 className="mt-1 text-lg font-medium">
              My Match
            </h2>

            <p
              className="
                mt-1
                max-w-xl
                text-[11px]
                leading-5
              "
              style={{
                color:
                  theme.colors
                    .textMuted,
              }}
            >
              {finished
                ? "Your private memory of this Barça match."
                : "Your personal match diary unlocks after full time."}
            </p>
          </div>
        </div>

        {finished &&
        initial ? (
          <p
            className="
              text-[8px]
              uppercase
              tracking-[0.15em]
            "
            style={{
              color:
                theme.colors
                  .textMuted,
            }}
          >
            Diary entry saved
          </p>
        ) : null}
      </header>

      {!finished ? (
        <LockedDiary
          data={data}
          theme={theme}
        />
      ) : (
        <div
          className="
            grid
            gap-0
            lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]
          "
        >
          <div
            className="
              border-b
              p-5
              lg:border-b-0
              lg:border-r
              lg:p-7
            "
            style={{
              borderColor:
                theme.colors
                  .border,
            }}
          >
            <DiarySectionTitle
              title="Watching"
              subtitle="How you experienced this match"
              theme={theme}
            />

            <button
              type="button"
              onClick={() => {
                const next =
                  !watched;

                setWatched(
                  next,
                );

                if (
                  !next
                ) {
                  setWatchType(
                    null,
                  );
                }
              }}
              className="
                mt-5
                flex
                w-full
                cursor-pointer
                items-center
                justify-between
                border
                px-4
                py-4
                text-left
              "
              style={{
                borderColor:
                  watched
                    ? theme.colors
                        .accent
                    : theme.colors
                        .border,

                backgroundColor:
                  watched
                    ? `${theme.colors.accent}0B`
                    : "transparent",
              }}
            >
              <span
                className="
                  flex
                  items-center
                  gap-3
                "
              >
                <Eye
                  size={16}
                  style={{
                    color:
                      watched
                        ? theme.colors
                            .accent
                        : theme.colors
                            .textMuted,
                  }}
                />

                <span>
                  <span
                    className="
                      block
                      text-xs
                      font-medium
                    "
                  >
                    {watched
                      ? "Watched"
                      : "Not marked as watched"}
                  </span>

                  <span
                    className="
                      mt-1
                      block
                      text-[9px]
                    "
                    style={{
                      color:
                        theme.colors
                          .textMuted,
                    }}
                  >
                    {watched
                      ? "This match is part of your Barça history."
                      : "Mark it if you watched this fixture."}
                  </span>
                </span>
              </span>

              <div
                className="
                  flex
                  h-5
                  w-5
                  items-center
                  justify-center
                  border
                "
                style={{
                  borderColor:
                    watched
                      ? theme.colors
                          .accent
                      : theme.colors
                          .border,

                  backgroundColor:
                    watched
                      ? theme.colors
                          .accent
                      : "transparent",

                  color:
                    watched
                      ? theme.colors
                          .background
                      : theme.colors
                          .textMuted,
                }}
              >
                {watched ? (
                  <Check
                    size={12}
                    strokeWidth={3}
                  />
                ) : null}
              </div>
            </button>

            {watched ? (
              <div className="mt-5">
                <FieldLabel>
                  How did you watch?
                </FieldLabel>

                <div
                  className="
                    mt-2
                    grid
                    grid-cols-3
                    gap-2
                  "
                >
                  <WatchButton
                    active={
                      watchType ===
                      "live"
                    }
                    label="Live"
                    theme={theme}
                    onClick={() =>
                      setWatchType(
                        "live",
                      )
                    }
                  />

                  <WatchButton
                    active={
                      watchType ===
                      "replay"
                    }
                    label="Replay"
                    theme={theme}
                    onClick={() =>
                      setWatchType(
                        "replay",
                      )
                    }
                  />

                  <WatchButton
                    active={
                      watchType ===
                      "highlights_only"
                    }
                    label="Highlights"
                    theme={theme}
                    onClick={() =>
                      setWatchType(
                        "highlights_only",
                      )
                    }
                  />
                </div>
              </div>
            ) : null}

            <div className="mt-8">
              <FieldLabel>
                Your Rating
              </FieldLabel>

              <p
                className="mt-1 text-[9px]"
                style={{
                  color:
                    theme.colors
                      .textMuted,
                }}
              >
                Rate your experience of the match.
              </p>

              <StarRating
                value={rating}
                onChange={
                  setRating
                }
                theme={theme}
              />
            </div>
          </div>

          <div className="p-5 lg:p-7">
            <DiarySectionTitle
              title="Your Picks"
              subtitle="The player and moment you want to remember"
              theme={theme}
            />

            <div
              className="
                mt-5
                grid
                gap-5
                sm:grid-cols-2
              "
            >
              <div>
                <FieldLabel>
                  Your Man of the Match
                </FieldLabel>

                <PlayerPicker
                  players={
                    players
                  }
                  value={
                    favouritePlayerId
                  }
                  onChange={
                    setFavouritePlayerId
                  }
                  theme={theme}
                />
              </div>

              <div>
                <FieldLabel>
                  Favourite Goal
                </FieldLabel>

                <GoalPicker
                  goals={goals}
                  value={
                    favouriteGoalEventId
                  }
                  onChange={
                    setFavouriteGoalEventId
                  }
                  theme={theme}
                />
              </div>
            </div>

            <label className="mt-7 block">
              <FieldLabel>
                Notes
              </FieldLabel>

              <textarea
                value={
                  notes
                }
                onChange={(
                  event,
                ) =>
                  setNotes(
                    event
                      .target
                      .value,
                  )
                }
                maxLength={
                  5000
                }
                rows={8}
                placeholder="What do you remember about this match?"
                className="
                  mt-2
                  w-full
                  resize-y
                  border
                  px-4
                  py-3
                  text-xs
                  leading-6
                  outline-none
                  scrollbar-subtle
                "
                style={{
                  borderColor:
                    theme.colors
                      .border,

                  backgroundColor:
                    theme.colors
                      .background,

                  color:
                    theme.colors
                      .text,
                }}
              />

              <div
                className="
                  mt-2
                  flex
                  justify-end
                  font-mono
                  text-[8px]
                "
                style={{
                  color:
                    theme.colors
                      .textMuted,
                }}
              >
                {
                  notes.length
                }
                /5000
              </div>
            </label>

            {error ? (
              <div
                className="
                  mt-4
                  border
                  px-4
                  py-3
                  text-[10px]
                "
                style={{
                  borderColor:
                    "rgba(233,101,115,0.45)",

                  backgroundColor:
                    "rgba(233,101,115,0.08)",

                  color:
                    "#E96573",
                }}
              >
                {error}
              </div>
            ) : null}

            <div
              className="
                mt-6
                flex
                items-center
                justify-between
                gap-4
                border-t
                pt-5
              "
              style={{
                borderColor:
                  theme.colors
                    .border,
              }}
            >
              <p
                className="
                  text-[9px]
                  leading-4
                "
                style={{
                  color:
                    theme.colors
                      .textMuted,
                }}
              >
                Saved privately to your Barça archive.
              </p>

              <button
                type="button"
                onClick={
                  save
                }
                disabled={
                  saveState ===
                  "saving"
                }
                className="
                  inline-flex
                  min-w-32
                  cursor-pointer
                  items-center
                  justify-center
                  gap-2
                  border
                  px-5
                  py-3
                  text-[9px]
                  font-semibold
                  uppercase
                  tracking-[0.16em]
                  transition-opacity
                  disabled:cursor-wait
                  disabled:opacity-60
                "
                style={{
                  borderColor:
                    theme.colors
                      .accent,

                  backgroundColor:
                    saveState ===
                    "saved"
                      ? `${theme.colors.accent}18`
                      : theme.colors
                          .accent,

                  color:
                    saveState ===
                    "saved"
                      ? theme.colors
                          .accent
                      : theme.colors
                          .background,
                }}
              >
                {saveState ===
                "saved" ? (
                  <>
                    <Check
                      size={13}
                    />

                    Saved
                  </>
                ) : (
                  <>
                    <Save
                      size={13}
                    />

                    {saveState ===
                    "saving"
                      ? "Saving..."
                      : "Save Match"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function LockedDiary({
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

  return (
    <div
      className="
        flex
        min-h-72
        items-center
        justify-center
        px-5
        py-12
        text-center
      "
    >
      <div className="max-w-md">
        <div
          className="
            mx-auto
            flex
            h-12
            w-12
            items-center
            justify-center
            border
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
          <LockKeyhole
            size={19}
          />
        </div>

        <p
          className="
            mt-5
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
          Locked
        </p>

        <h3 className="mt-2 text-lg font-medium">
          Your diary opens after the final whistle
        </h3>

        <p
          className="
            mt-3
            text-[11px]
            leading-5
          "
          style={{
            color:
              theme.colors
                .textMuted,
          }}
        >
          After this match finishes, you can mark it watched, rate it,
          choose your Man of the Match and favourite goal, and save your
          notes.
        </p>

        <p
          className="
            mt-5
            font-mono
            text-[10px]
            tabular-nums
          "
          style={{
            color:
              theme.colors
                .textMuted,
          }}
        >
          {kickoff.toLocaleDateString(
            "en-GB",
            {
              day:
                "numeric",

              month:
                "short",

              year:
                "numeric",
            },
          )}

          {" · "}

          {kickoff.toLocaleTimeString(
            "en-US",
            {
              hour:
                "numeric",

              minute:
                "2-digit",

              hour12:
                true,
            },
          )}
        </p>
      </div>
    </div>
  );
}

function StarRating({
  value,
  onChange,
  theme,
}: {
  value:
    number | null;

  onChange:
    (
      value:
        number | null,
    ) => void;

  theme:
    KitTheme;
}) {
  const displayed =
    value ?? 0;

  return (
    <div className="mt-5">
      <div className="flex items-center gap-2">
        {[
          1,
          2,
          3,
          4,
          5,
        ].map(
          (
            star,
          ) => {
            const halfValue =
              star -
              0.5;

            let icon:
              React.ReactNode;

            if (
              displayed >=
              star
            ) {
              icon = (
                <FaStar />
              );
            } else if (
              displayed >=
              halfValue
            ) {
              icon = (
                <FaStarHalfStroke />
              );
            } else {
              icon = (
                <FaRegStar />
              );
            }

            return (
              <div
                key={star}
                className="
                  relative
                  h-8
                  w-8
                "
                style={{
                  color:
                    displayed >=
                    halfValue
                      ? theme.colors
                          .accent
                      : theme.colors
                          .textMuted,
                }}
              >
                <span
                  className="
                    pointer-events-none
                    absolute
                    inset-0
                    flex
                    items-center
                    justify-center
                    text-[26px]
                  "
                >
                  {icon}
                </span>

                <button
                  type="button"
                  aria-label={`Rate ${halfValue} stars`}
                  onClick={() =>
                    onChange(
                      halfValue,
                    )
                  }
                  className="
                    absolute
                    bottom-0
                    left-0
                    top-0
                    w-1/2
                    cursor-pointer
                  "
                />

                <button
                  type="button"
                  aria-label={`Rate ${star} stars`}
                  onClick={() =>
                    onChange(
                      star,
                    )
                  }
                  className="
                    absolute
                    bottom-0
                    right-0
                    top-0
                    w-1/2
                    cursor-pointer
                  "
                />
              </div>
            );
          },
        )}

        <div
          className="
            ml-3
            font-mono
            text-sm
            tabular-nums
          "
          style={{
            color:
              value !==
              null
                ? theme.colors
                    .accent
                : theme.colors
                    .textMuted,
          }}
        >
          {value !==
          null
            ? `${value.toFixed(1)} / 5`
            : "— / 5"}
        </div>
      </div>

      {value !==
      null ? (
        <button
          type="button"
          onClick={() =>
            onChange(
              null,
            )
          }
          className="
            mt-3
            cursor-pointer
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
          Clear rating
        </button>
      ) : null}
    </div>
  );
}

function PlayerPicker({
  players,
  value,
  onChange,
  theme,
}: {
  players:
    DiaryPlayer[];

  value:
    string | null;

  onChange:
    (
      value:
        string | null,
    ) => void;

  theme:
    KitTheme;
}) {
  const [
    open,
    setOpen,
  ] =
    useState(false);

  const selected =
    players.find(
      (
        player,
      ) =>
        player.id ===
        value,
    ) ??
    null;

  return (
    <div className="relative mt-2">
      <button
        type="button"
        onClick={() =>
          setOpen(
            (
              current,
            ) =>
              !current,
          )
        }
        className="
          flex
          w-full
          cursor-pointer
          items-center
          gap-3
          border
          px-3
          py-2.5
          text-left
        "
        style={{
          borderColor:
            open
              ? theme.colors
                  .accent
              : theme.colors
                  .border,

          backgroundColor:
            theme.colors
              .background,
        }}
      >
        {selected ? (
          <Portrait
            name={
              selected.name
            }
            url={
              selected.portraitUrl
            }
            theme={theme}
          />
        ) : (
          <EmptyPortrait
            theme={theme}
          />
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs">
            {selected
              ? selected.name
              : "Choose a player"}
          </p>

          <p
            className="
              mt-0.5
              truncate
              text-[8px]
              uppercase
              tracking-[0.12em]
            "
            style={{
              color:
                theme.colors
                  .textMuted,
            }}
          >
            {selected
              ?.position ??
              "Barcelona squad"}
          </p>
        </div>

        <ChevronDown
          size={14}
          className={
            open
              ? "rotate-180"
              : ""
          }
          style={{
            color:
              theme.colors
                .textMuted,
          }}
        />
      </button>

      {open ? (
        <div
          className="
            absolute
            left-0
            right-0
            top-[calc(100%+6px)]
            z-50
            max-h-72
            overflow-y-auto
            border
            shadow-[0_18px_50px_rgba(0,0,0,0.4)]
            scrollbar-subtle
          "
          style={{
            borderColor:
              theme.colors
                .border,

            backgroundColor:
              theme.colors
                .backgroundElevated,
          }}
        >
          {selected ? (
            <button
              type="button"
              onClick={() => {
                onChange(
                  null,
                );

                setOpen(
                  false,
                );
              }}
              className="
                flex
                w-full
                cursor-pointer
                items-center
                gap-3
                border-b
                px-3
                py-3
                text-left
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
              <X
                size={13}
              />

              <span className="text-[10px]">
                Clear selection
              </span>
            </button>
          ) : null}

          {players.map(
            (
              player,
            ) => (
              <button
                key={
                  player.id
                }
                type="button"
                onClick={() => {
                  onChange(
                    player.id,
                  );

                  setOpen(
                    false,
                  );
                }}
                className="
                  flex
                  w-full
                  cursor-pointer
                  items-center
                  gap-3
                  border-b
                  px-3
                  py-2.5
                  text-left
                  last:border-b-0
                  hover:bg-white/2.5
                "
                style={{
                  borderColor:
                    theme.colors
                      .border,
                }}
              >
                <Portrait
                  name={
                    player.name
                  }
                  url={
                    player.portraitUrl
                  }
                  theme={theme}
                />

                <div className="min-w-0">
                  <p className="truncate text-[11px]">
                    {
                      player.name
                    }
                  </p>

                  <p
                    className="
                      mt-0.5
                      text-[8px]
                      uppercase
                      tracking-[0.12em]
                    "
                    style={{
                      color:
                        theme.colors
                          .textMuted,
                    }}
                  >
                    {player.position ??
                      "Player"}
                  </p>
                </div>
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

function GoalPicker({
  goals,
  value,
  onChange,
  theme,
}: {
  goals:
    DiaryGoal[];

  value:
    string | null;

  onChange:
    (
      value:
        string | null,
    ) => void;

  theme:
    KitTheme;
}) {
  const [
    open,
    setOpen,
  ] =
    useState(false);

  const selected =
    goals.find(
      (
        goal,
      ) =>
        goal.id ===
        value,
    ) ??
    null;

  return (
    <div className="relative mt-2">
      <button
        type="button"
        onClick={() =>
          setOpen(
            (
              current,
            ) =>
              !current,
          )
        }
        className="
          flex
          w-full
          cursor-pointer
          items-center
          gap-3
          border
          px-3
          py-2.5
          text-left
        "
        style={{
          borderColor:
            open
              ? theme.colors
                  .accent
              : theme.colors
                  .border,

          backgroundColor:
            theme.colors
              .background,
        }}
      >
        {selected ? (
          <Portrait
            name={
              selected
                .primaryPlayer
                ?.name ??
              "Goal"
            }
            url={
              selected
                .primaryPlayer
                ?.portraitUrl ??
              null
            }
            theme={theme}
          />
        ) : (
          <EmptyPortrait
            theme={theme}
          />
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs">
            {selected
              ? selected
                  .primaryPlayer
                  ?.name ??
                "Barcelona goal"
              : "Choose a goal"}
          </p>

          <p
            className="
              mt-0.5
              truncate
              text-[8px]
              uppercase
              tracking-[0.12em]
            "
            style={{
              color:
                theme.colors
                  .textMuted,
            }}
          >
            {selected
              ? goalSubtitle(
                  selected,
                )
              : `${goals.length} Barça goals`}
          </p>
        </div>

        <FootballIcon
          size={12}
          className="shrink-0"
        />

        <ChevronDown
          size={14}
          className={
            open
              ? "rotate-180"
              : ""
          }
          style={{
            color:
              theme.colors
                .textMuted,
          }}
        />
      </button>

      {open ? (
        <div
          className="
            absolute
            left-0
            right-0
            top-[calc(100%+6px)]
            z-50
            max-h-72
            overflow-y-auto
            border
            shadow-[0_18px_50px_rgba(0,0,0,0.4)]
            scrollbar-subtle
          "
          style={{
            borderColor:
              theme.colors
                .border,

            backgroundColor:
              theme.colors
                .backgroundElevated,
          }}
        >
          {selected ? (
            <button
              type="button"
              onClick={() => {
                onChange(
                  null,
                );

                setOpen(
                  false,
                );
              }}
              className="
                flex
                w-full
                cursor-pointer
                items-center
                gap-3
                border-b
                px-3
                py-3
                text-left
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
              <X
                size={13}
              />

              <span className="text-[10px]">
                Clear selection
              </span>
            </button>
          ) : null}

          {goals.length ===
          0 ? (
            <div
              className="
                px-4
                py-5
                text-[10px]
              "
              style={{
                color:
                  theme.colors
                    .textMuted,
              }}
            >
              No Barça goals available.
            </div>
          ) : (
            goals.map(
              (
                goal,
              ) => (
                <button
                  key={
                    goal.id
                  }
                  type="button"
                  onClick={() => {
                    onChange(
                      goal.id,
                    );

                    setOpen(
                      false,
                    );
                  }}
                  className="
                    flex
                    w-full
                    cursor-pointer
                    items-center
                    gap-3
                    border-b
                    px-3
                    py-2.5
                    text-left
                    last:border-b-0
                    hover:bg-white/2.5
                  "
                  style={{
                    borderColor:
                      theme.colors
                        .border,
                  }}
                >
                  <Portrait
                    name={
                      goal
                        .primaryPlayer
                        ?.name ??
                      "Goal"
                    }
                    url={
                      goal
                        .primaryPlayer
                        ?.portraitUrl ??
                      null
                    }
                    theme={theme}
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px]">
                      {goal
                        .primaryPlayer
                        ?.name ??
                        "Barcelona goal"}
                    </p>

                    <p
                      className="
                        mt-0.5
                        text-[8px]
                        uppercase
                        tracking-[0.12em]
                      "
                      style={{
                        color:
                          theme.colors
                            .textMuted,
                      }}
                    >
                      {goalSubtitle(
                        goal,
                      )}
                    </p>
                  </div>

                  <FootballIcon
                    size={12}
                    className="shrink-0"
                  />
                </button>
              ),
            )
          )}
        </div>
      ) : null}
    </div>
  );
}

function Portrait({
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
  if (url) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          className="
            h-9
            w-9
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
        h-9
        w-9
        shrink-0
        items-center
        justify-center
        border
        text-[10px]
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
      {name[0] ??
        "?"}
    </div>
  );
}

function EmptyPortrait({
  theme,
}: {
  theme:
    KitTheme;
}) {
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
      <Trophy
        size={13}
      />
    </div>
  );
}

function DiarySectionTitle({
  title,
  subtitle,
  theme,
}: {
  title:
    string;

  subtitle:
    string;

  theme:
    KitTheme;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium">
        {title}
      </h3>

      <p
        className="mt-1 text-[9px]"
        style={{
          color:
            theme.colors
              .textMuted,
        }}
      >
        {subtitle}
      </p>
    </div>
  );
}

function FieldLabel({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <span
      className="
        text-[8px]
        font-semibold
        uppercase
        tracking-[0.18em]
      "
    >
      {children}
    </span>
  );
}

function WatchButton({
  active,
  label,
  theme,
  onClick,
}: {
  active:
    boolean;

  label:
    string;

  theme:
    KitTheme;

  onClick:
    () => void;
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
        px-2
        py-3
        text-[8px]
        font-semibold
        uppercase
        tracking-[0.13em]
      "
      style={{
        borderColor:
          active
            ? theme.colors
                .accent
            : theme.colors
                .border,

        backgroundColor:
          active
            ? `${theme.colors.accent}0D`
            : "transparent",

        color:
          active
            ? theme.colors
                .accent
            : theme.colors
                .textMuted,
      }}
    >
      {label}
    </button>
  );
}

function normalizeWatchType(
  value:
    string | null,
): WatchType | null {
  if (
    value ===
      "live" ||
    value ===
      "replay" ||
    value ===
      "highlights_only"
  ) {
    return value;
  }

  return null;
}

function normalizeExistingRating(
  value:
    number | null,
) {
  if (
    value === null
  ) {
    return null;
  }

  /*
   * Temporary backwards compatibility for diary tests saved
   * when the UI used a 0–10 rating scale.
   */
  if (
    value > 5 &&
    value <= 10
  ) {
    return (
      Math.round(
        (
          value /
          2
        ) *
          2,
      ) /
      2
    );
  }

  return Math.min(
    5,
    Math.max(
      0.5,
      Math.round(
        value *
          2,
      ) /
        2,
    ),
  );
}

function matchBarcelonaPlayers(
  data:
    MatchCenterData,
): DiaryPlayer[] {
  const barcelonaSide:
    "home" | "away" =
    data.match
      .barcelona.side ===
    "away"
      ? "away"
      : "home";

  const lineup =
    data.lineups[
      barcelonaSide
    ];

  if (lineup) {
    const rows = [
      ...lineup.starters,
      ...lineup.bench,
    ];

    return rows
      .map(
        (
          row,
        ) => ({
          id:
            row.player.id,

          name:
            row.player.name,

          portraitUrl:
            row.player
              .portraitUrl,

          position:
            row.player
              .primaryPosition,
        }),
      )
      .filter(
        (
          player,
          index,
          all,
        ) =>
          all.findIndex(
            (
              candidate,
            ) =>
              candidate.id ===
              player.id,
          ) ===
          index,
      )
      .sort(
        (
          left,
          right,
        ) =>
          left.name.localeCompare(
            right.name,
          ),
      );
  }

  return data
    .performances
    .barcelona
    .map(
      (
        row,
      ) => ({
        id:
          row.player.id,

        name:
          row.player.name,

        portraitUrl:
          row.player
            .portraitUrl,

        position:
          row.player
            .primaryPosition,
      }),
    )
    .sort(
      (
        left,
        right,
      ) =>
        left.name.localeCompare(
          right.name,
        ),
    );
}

function goalSubtitle(
  goal:
    DiaryGoal,
) {
  const minute =
    goal.minute !==
    null
      ? `${goal.minute}'`
      : "Goal";

  if (
    goal.type ===
    "penalty_goal"
  ) {
    return `${minute} · Penalty`;
  }

  if (
    goal.type ===
    "own_goal"
  ) {
    return `${minute} · Own goal`;
  }

  return `${minute} · Goal`;
}
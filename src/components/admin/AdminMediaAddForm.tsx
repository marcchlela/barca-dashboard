"use client";

import type {
  ReactNode,
} from "react";

import {
  useMemo,
  useState,
  useTransition,
} from "react";

import {
  Check,
  ChevronDown,
  ExternalLink,
  Loader2,
  Plus,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import {
  kitThemes,
} from "../../lib/themes";

import type {
  AdminMediaData,
  AdminMediaMatch,
  AdminMediaType,
} from "../../lib/admin/media";

export default function AdminMediaAddForm({
  data,
}: {
  data:
    AdminMediaData;
}) {
  const theme =
    kitThemes.home;

  const router =
    useRouter();

  /*
  |--------------------------------------------------------------------------
  | Finished matches only
  |--------------------------------------------------------------------------
  */

  const finishedMatches =
    useMemo(
      () =>
        data.matches
          .filter(
            (
              match,
            ) =>
              match.status ===
              "finished",
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
          ),
      [
        data.matches,
      ],
    );

  const [
    url,
    setUrl,
  ] =
    useState(
      "",
    );

  const [
    matchId,
    setMatchId,
  ] =
    useState(
      finishedMatches[0]
        ?.id ??
        "",
    );

  const [
    type,
    setType,
  ] =
    useState<
      AdminMediaType
    >(
      "match_highlight",
    );

  const [
    matchPickerOpen,
    setMatchPickerOpen,
  ] =
    useState(
      false,
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

  const [
    success,
    setSuccess,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    pending,
    startTransition,
  ] =
    useTransition();

  const selectedMatch =
    finishedMatches.find(
      (
        match,
      ) =>
        match.id ===
        matchId,
    ) ??
    null;

  function submit() {
    setError(
      null,
    );

    setSuccess(
      null,
    );

    startTransition(
      () => {
        void addMedia();
      },
    );
  }

  async function addMedia() {
    const response =
      await fetch(
        "/api/admin/media/manual",
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              url,
              matchId,
              type,
            }),
        },
      );

    const payload =
      await response.json();

    if (
      !response.ok ||
      !payload.ok
    ) {
      setError(
        payload.error ??
          "Could not add media.",
      );

      return;
    }

    setSuccess(
      `Saved: ${payload.result.title}`,
    );

    setUrl(
      "",
    );

    router.refresh();
  }

  return (
    <div>
      {/* HEADER */}

      <p
        className="
          text-[9px]
          uppercase
          tracking-[0.24em]
        "
        style={{
          color:
            theme.colors.accent,
        }}
      >
        Media Operations
      </p>

      <h2
        className="
          mt-2
          text-2xl
          font-medium
          tracking-[-0.035em]
        "
      >
        Add Official Media
      </h2>

      <p
        className="
          mt-2
          max-w-2xl
          text-[11px]
          leading-5
        "
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        Paste an official FC
        Barcelona YouTube URL and
        attach it to a completed
        Barça fixture. Video
        metadata is fetched
        automatically.
      </p>

      {/* FORM */}

      <div
        className="
          mt-6
          max-w-3xl
          border
          p-5
        "
        style={{
          borderColor:
            theme.colors.border,

          backgroundColor:
            `${theme.colors.surface}80`,
        }}
      >
        {/* URL */}

        <FieldLabel>
          YouTube URL
        </FieldLabel>

        <div className="relative mt-2">
          <ExternalLink
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
              url
            }
            onChange={
              (
                event,
              ) =>
                setUrl(
                  event.target
                    .value,
                )
            }
            placeholder="https://www.youtube.com/watch?v=..."
            className="
              h-12
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

              backgroundColor:
                theme.colors.backgroundElevated,
            }}
          />
        </div>

        {/* MATCH */}

        <div className="mt-5">
          <FieldLabel>
            Match
          </FieldLabel>

          <div className="relative mt-2">
            <button
              type="button"
              onClick={
                () =>
                  setMatchPickerOpen(
                    (
                      current,
                    ) =>
                      !current,
                  )
              }
              className="
                flex
                min-h-16
                w-full
                cursor-pointer
                items-center
                justify-between
                gap-4
                border
                px-4
                py-3
                text-left
              "
              style={{
                borderColor:
                  matchPickerOpen
                    ? theme.colors.accent
                    : theme.colors.border,

                backgroundColor:
                  theme.colors.backgroundElevated,
              }}
            >
              {selectedMatch ? (
                <MatchVisual
                  match={
                    selectedMatch
                  }
                />
              ) : (
                <span
                  className="text-[10px]"
                  style={{
                    color:
                      theme.colors.textMuted,
                  }}
                >
                  Select a completed
                  match
                </span>
              )}

              <ChevronDown
                size={14}
                className={`
                  shrink-0
                  transition-transform

                  ${
                    matchPickerOpen
                      ? "rotate-180"
                      : ""
                  }
                `}
                style={{
                  color:
                    theme.colors.textMuted,
                }}
              />
            </button>

            {matchPickerOpen ? (
              <div
                className="
                  scrollbar-subtle
                  absolute
                  left-0
                  right-0
                  top-[calc(100%+6px)]
                  z-30
                  max-h-[360px]
                  overflow-y-auto
                  border
                  shadow-2xl
                "
                style={{
                  borderColor:
                    theme.colors.border,

                  backgroundColor:
                    theme.colors.backgroundElevated,
                }}
              >
                {finishedMatches.map(
                  (
                    match,
                  ) => {
                    const active =
                      match.id ===
                      matchId;

                    return (
                      <button
                        key={
                          match.id
                        }
                        type="button"
                        onClick={
                          () => {
                            setMatchId(
                              match.id,
                            );

                            setMatchPickerOpen(
                              false,
                            );
                          }
                        }
                        className="
                          flex
                          w-full
                          cursor-pointer
                          items-center
                          justify-between
                          gap-4
                          border-b
                          px-4
                          py-3
                          text-left
                          last:border-b-0
                        "
                        style={{
                          borderColor:
                            theme.colors.border,

                          backgroundColor:
                            active
                              ? `${theme.colors.accent}0C`
                              : "transparent",
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <MatchVisual
                            match={
                              match
                            }
                          />

                          <p
                            className="
                              mt-2
                              text-[7px]
                              uppercase
                              tracking-[0.12em]
                            "
                            style={{
                              color:
                                theme.colors.textMuted,
                            }}
                          >
                            {match
                              .competition
                              .shortName ??
                              match
                                .competition
                                .name}
                            {" · "}
                            {formatDate(
                              match.kickoff,
                            )}
                          </p>
                        </div>

                        {active ? (
                          <Check
                            size={13}
                            className="shrink-0"
                            style={{
                              color:
                                theme.colors.accent,
                            }}
                          />
                        ) : null}
                      </button>
                    );
                  },
                )}
              </div>
            ) : null}
          </div>

          <p
            className="
              mt-2
              text-[8px]
              leading-4
            "
            style={{
              color:
                theme.colors.textMuted,
            }}
          >
            Only completed Barça
            matches are available.
            Future fixtures cannot
            receive match media yet.
          </p>
        </div>

        {/* TYPE */}

        <div className="mt-5">
          <FieldLabel>
            Media Type
          </FieldLabel>

          <SelectWrap>
            <select
              value={
                type
              }
              onChange={
                (
                  event,
                ) =>
                  setType(
                    event.target
                      .value as
                      AdminMediaType,
                  )
              }
              className="
                h-12
                w-full
                cursor-pointer
                appearance-none
                bg-transparent
                px-3
                pr-9
                text-[10px]
                outline-none
              "
              style={{
                color:
                  theme.colors.text,
              }}
            >
              {data.mediaTypes.map(
                (
                  item,
                ) => (
                  <option
                    key={
                      item
                    }
                    value={
                      item
                    }
                    style={{
                      backgroundColor:
                        theme.colors.backgroundElevated,
                    }}
                  >
                    {
                      mediaTypeLabel(
                        item,
                      )
                    }
                  </option>
                ),
              )}
            </select>
          </SelectWrap>
        </div>

        {/* SUBMIT */}

        <button
          type="button"
          disabled={
            pending ||
            !url ||
            !matchId
          }
          onClick={
            submit
          }
          className="
            mt-6
            flex
            h-11
            w-full
            cursor-pointer
            items-center
            justify-center
            gap-2
            border
            text-[8px]
            font-semibold
            uppercase
            tracking-[0.14em]
            disabled:cursor-not-allowed
            disabled:opacity-40
          "
          style={{
            borderColor:
              theme.colors.accent,

            color:
              theme.colors.accent,

            backgroundColor:
              `${theme.colors.accent}08`,
          }}
        >
          {pending ? (
            <Loader2
              size={12}
              className="animate-spin"
            />
          ) : (
            <Plus
              size={12}
            />
          )}

          Add media
        </button>

        {/* SUCCESS */}

        {success ? (
          <div
            className="
              mt-4
              flex
              gap-2
              border
              p-3
              text-[9px]
            "
            style={{
              borderColor:
                `${theme.colors.success}55`,

              color:
                theme.colors.success,

              backgroundColor:
                `${theme.colors.success}08`,
            }}
          >
            <Check
              size={12}
              className="shrink-0"
            />

            {success}
          </div>
        ) : null}

        {/* ERROR */}

        {error ? (
          <div
            className="
              mt-4
              border
              p-3
              text-[9px]
            "
            style={{
              borderColor:
                `${theme.colors.danger}55`,

              color:
                theme.colors.danger,

              backgroundColor:
                `${theme.colors.danger}08`,
            }}
          >
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Match visual
|--------------------------------------------------------------------------
|
| Exact order:
|
| crest 1 → team 1 → score → VS → score → team 2 → crest 2
|--------------------------------------------------------------------------
*/

function MatchVisual({
  match,
}: {
  match:
    AdminMediaMatch;
}) {
  const theme =
    kitThemes.home;

  const score =
    splitScore(
      match.score,
    );

  return (
    <div
      className="
        flex
        min-w-0
        flex-wrap
        items-center
        gap-2.5
      "
    >
      <TeamCrest
        url={
          match.homeCrestUrl
        }
        name={
          match.home
        }
      />

      <span
        className="
          min-w-0
          truncate
          text-[11px]
          font-medium

          sm:text-xs
        "
      >
        {
          match.homeShort
        }
      </span>

      {score ? (
        <>
          <span
            className="
              shrink-0
              text-sm
              font-medium
              tabular-nums
            "
            style={{
              color:
                theme.colors.accent,
            }}
          >
            {
              score.home
            }
          </span>

          <span
            className="
              shrink-0
              text-[7px]
              uppercase
              tracking-[0.13em]
            "
            style={{
              color:
                theme.colors.textMuted,
            }}
          >
            VS
          </span>

          <span
            className="
              shrink-0
              text-sm
              font-medium
              tabular-nums
            "
            style={{
              color:
                theme.colors.accent,
            }}
          >
            {
              score.away
            }
          </span>
        </>
      ) : (
        <span
          className="
            shrink-0
            text-[7px]
            uppercase
            tracking-[0.13em]
          "
          style={{
            color:
              theme.colors.textMuted,
          }}
        >
          VS
        </span>
      )}

      <span
        className="
          min-w-0
          truncate
          text-[11px]
          font-medium

          sm:text-xs
        "
      >
        {
          match.awayShort
        }
      </span>

      <TeamCrest
        url={
          match.awayCrestUrl
        }
        name={
          match.away
        }
      />
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Crest
|--------------------------------------------------------------------------
*/

function TeamCrest({
  url,
  name,
}: {
  url:
    string | null;

  name:
    string;
}) {
  const theme =
    kitThemes.home;

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
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={
            url
          }
          alt={`${name} crest`}
          className="
            max-h-7
            max-w-7
            object-contain
          "
        />
      ) : (
        <div
          className="
            h-2
            w-2
            rounded-full
          "
          style={{
            backgroundColor:
              theme.colors.textMuted,
          }}
        />
      )}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Shared UI
|--------------------------------------------------------------------------
*/

function FieldLabel({
  children,
}: {
  children:
    string;
}) {
  const theme =
    kitThemes.home;

  return (
    <span
      className="
        text-[8px]
        uppercase
        tracking-[0.14em]
      "
      style={{
        color:
          theme.colors.textMuted,
      }}
    >
      {children}
    </span>
  );
}

function SelectWrap({
  children,
}: {
  children:
    ReactNode;
}) {
  const theme =
    kitThemes.home;

  return (
    <div
      className="
        relative
        mt-2
        border
      "
      style={{
        borderColor:
          theme.colors.border,

        backgroundColor:
          theme.colors.backgroundElevated,
      }}
    >
      {children}

      <ChevronDown
        size={13}
        className="
          pointer-events-none
          absolute
          right-3
          top-1/2
          -translate-y-1/2
        "
        style={{
          color:
            theme.colors.textMuted,
        }}
      />
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Formatting
|--------------------------------------------------------------------------
*/

function splitScore(
  value:
    string | null,
) {
  if (!value) {
    return null;
  }

  const [
    home,
    away,
  ] =
    value.split(
      "-",
    );

  if (
    home ===
      undefined ||
    away ===
      undefined
  ) {
    return null;
  }

  return {
    home,
    away,
  };
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

function mediaTypeLabel(
  value:
    string,
) {
  return value
    .split(
      "_",
    )
    .map(
      (
        part,
      ) =>
        part
          .charAt(
            0,
          )
          .toUpperCase() +
        part.slice(
          1,
        ),
    )
    .join(
      " ",
    );
}
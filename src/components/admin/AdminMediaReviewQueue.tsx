"use client";

import {
  useState,
  useTransition,
} from "react";

import {
  Check,
  ChevronDown,
  ExternalLink,
  Inbox,
  Loader2,
  X,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import {
  kitThemes,
} from "../../lib/themes";

import type {
  AdminMediaReviewCandidate,
  AdminMediaReviewData,
} from "../../lib/admin/media-review";

import type {
  AdminMediaType,
} from "../../lib/admin/media";

export default function AdminMediaReviewQueue({
  data,
}: {
  data:
    AdminMediaReviewData;
}) {
  const theme =
    kitThemes.home;

  return (
    <div>
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

      <div
        className="
          mt-2
          flex
          flex-wrap
          items-end
          justify-between
          gap-4
        "
      >
        <div>
          <h2
            className="
              text-2xl
              font-medium
              tracking-[-0.035em]
            "
          >
            Review Queue
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
            Ambiguous official
            Barça videos that were
            related enough to a
            fixture to deserve human
            review, but not safe
            enough to attach
            automatically.
          </p>
        </div>

        <div
          className="
            border
            px-4
            py-3
          "
          style={{
            borderColor:
              data.candidates
                  .length >
                0
                ? `${theme.colors.warning}66`
                : theme.colors.border,
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
            Pending
          </p>

          <p
            className="
              mt-1
              text-xl
              font-medium
              tabular-nums
            "
            style={{
              color:
                data.candidates
                    .length >
                  0
                  ? theme.colors.warning
                  : theme.colors.success,
            }}
          >
            {
              data.candidates
                .length
            }
          </p>
        </div>
      </div>

      {data.candidates.length ===
      0 ? (
        <div
          className="
            mt-6
            flex
            min-h-72
            items-center
            justify-center
            border
            text-center
          "
          style={{
            borderColor:
              theme.colors.border,
          }}
        >
          <div>
            <Inbox
              size={22}
              className="mx-auto"
              style={{
                color:
                  theme.colors.success,
              }}
            />

            <p className="mt-4 text-sm">
              Review queue is clear.
            </p>

            <p
              className="
                mt-2
                max-w-sm
                text-[9px]
                leading-4
              "
              style={{
                color:
                  theme.colors.textMuted,
              }}
            >
              Future automatic media
              scans will place
              uncertain candidates
              here instead of silently
              attaching them.
            </p>
          </div>
        </div>
      ) : (
        <div
          className="
            mt-6
            grid
            gap-4

            2xl:grid-cols-2
          "
        >
          {data.candidates.map(
            (
              candidate,
            ) => (
              <ReviewCard
                key={
                  candidate.id
                }
                candidate={
                  candidate
                }
                matches={
                  data.matches
                }
                mediaTypes={
                  data.mediaTypes
                }
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function ReviewCard({
  candidate,
  matches,
  mediaTypes,
}: {
  candidate:
    AdminMediaReviewCandidate;

  matches:
    AdminMediaReviewData[
      "matches"
    ];

  mediaTypes:
    AdminMediaType[];
}) {
  const theme =
    kitThemes.home;

  const router =
    useRouter();

  const [
    type,
    setType,
  ] =
    useState<
      AdminMediaType
    >(
      candidate.type as
        AdminMediaType,
    );

  const [
    matchId,
    setMatchId,
  ] =
    useState(
      candidate.matchId,
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
    pending,
    startTransition,
  ] =
    useTransition();

  function review(
    action:
      "approve" |
      "reject",
  ) {
    setError(
      null,
    );

    startTransition(
      () => {
        void submitReview(
          action,
        );
      },
    );
  }

  async function submitReview(
    action:
      "approve" |
      "reject",
  ) {
    const response =
      await fetch(
        "/api/admin/media/review",
        {
          method:
            "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              candidateId:
                candidate.id,

              action,

              type,

              matchId,
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
          "Review action failed.",
      );

      return;
    }

    router.refresh();
  }

  return (
    <article
      className="
        overflow-hidden
        border
      "
      style={{
        borderColor:
          `${theme.colors.warning}55`,

        backgroundColor:
          `${theme.colors.surface}80`,
      }}
    >
      <div
        className="
          grid

          sm:grid-cols-[180px_minmax(0,1fr)]
        "
      >
        <div
          className="
            relative
            aspect-video
            bg-black/20

            sm:aspect-auto
            sm:min-h-40
          "
        >
          {candidate.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={
                candidate.thumbnailUrl
              }
              alt=""
              className="
                h-full
                w-full
                object-cover
              "
            />
          ) : null}
        </div>

        <div className="p-4">
          <div
            className="
              flex
              items-center
              justify-between
              gap-3
            "
          >
            <span
              className="
                text-[7px]
                uppercase
                tracking-[0.15em]
              "
              style={{
                color:
                  theme.colors.warning,
              }}
            >
              Needs Review
            </span>

            <span
              className="
                text-lg
                font-medium
                tabular-nums
              "
              style={{
                color:
                  theme.colors.accent,
              }}
            >
              {
                candidate.score
              }
            </span>
          </div>

          <p
            className="
              mt-2
              text-xs
              font-medium
              leading-5
            "
          >
            {
              candidate.title
            }
          </p>

          <a
            href={
              candidate.url
            }
            target="_blank"
            rel="noreferrer"
            className="
              mt-3
              inline-flex
              items-center
              gap-1.5
              text-[7px]
              uppercase
              tracking-[0.12em]
            "
            style={{
              color:
                theme.colors.accent,
            }}
          >
            Open source

            <ExternalLink
              size={10}
            />
          </a>
        </div>
      </div>

      <div
        className="
          border-t
          p-4
        "
        style={{
          borderColor:
            theme.colors.border,
        }}
      >
        <div
          className="
            flex
            flex-wrap
            gap-1.5
          "
        >
          {candidate.reasons
            .filter(
              (
                reason,
              ) =>
                reason !==
                "AUTO-REJECT",
            )
            .map(
              (
                reason,
              ) => (
                <span
                  key={
                    reason
                  }
                  className="
                    border
                    px-2
                    py-1
                    text-[7px]
                    font-mono
                  "
                  style={{
                    borderColor:
                      theme.colors.border,

                    color:
                      theme.colors.textMuted,
                  }}
                >
                  {reason}
                </span>
              ),
            )}
        </div>

        <div
          className="
            mt-4
            grid
            gap-3

            md:grid-cols-2
          "
        >
          <ReviewSelect
            label="Attach To"
            value={
              matchId
            }
            onChange={
              setMatchId
            }
            options={
              matches.map(
                (
                  match,
                ) => ({
                  value:
                    match.id,

                  label:
                    `${match.homeShort} vs ${match.awayShort}${match.score ? ` · ${match.score}` : ""}`,
                }),
              )
            }
          />

          <ReviewSelect
            label="Media Type"
            value={
              type
            }
            onChange={
              (
                value,
              ) =>
                setType(
                  value as
                    AdminMediaType,
                )
            }
            options={
              mediaTypes.map(
                (
                  item,
                ) => ({
                  value:
                    item,

                  label:
                    mediaTypeLabel(
                      item,
                    ),
                }),
              )
            }
          />
        </div>

        <div
          className="
            mt-4
            grid
            grid-cols-2
            gap-2
          "
        >
          <button
            type="button"
            disabled={
              pending
            }
            onClick={
              () =>
                review(
                  "reject",
                )
            }
            className="
              flex
              h-10
              cursor-pointer
              items-center
              justify-center
              gap-2
              border
              text-[8px]
              uppercase
              tracking-[0.12em]
              disabled:opacity-40
            "
            style={{
              borderColor:
                `${theme.colors.danger}55`,

              color:
                theme.colors.danger,
            }}
          >
            <X
              size={11}
            />

            Reject
          </button>

          <button
            type="button"
            disabled={
              pending
            }
            onClick={
              () =>
                review(
                  "approve",
                )
            }
            className="
              flex
              h-10
              cursor-pointer
              items-center
              justify-center
              gap-2
              border
              text-[8px]
              uppercase
              tracking-[0.12em]
              disabled:opacity-40
            "
            style={{
              borderColor:
                theme.colors.success,

              color:
                theme.colors.success,
            }}
          >
            {pending ? (
              <Loader2
                size={11}
                className="animate-spin"
              />
            ) : (
              <Check
                size={11}
              />
            )}

            Approve
          </button>
        </div>

        {error ? (
          <p
            className="
              mt-3
              text-[8px]
            "
            style={{
              color:
                theme.colors.danger,
            }}
          >
            {error}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function ReviewSelect({
  label,
  value,
  onChange,
  options,
}: {
  label:
    string;

  value:
    string;

  onChange:
    (
      value:
        string,
    ) => void;

  options:
    Array<{
      value:
        string;

      label:
        string;
    }>;
}) {
  const theme =
    kitThemes.home;

  return (
    <label>
      <span
        className="
          text-[7px]
          uppercase
          tracking-[0.13em]
        "
        style={{
          color:
            theme.colors.textMuted,
        }}
      >
        {label}
      </span>

      <div
        className="
          relative
          mt-2
          border
        "
        style={{
          borderColor:
            theme.colors.border,
        }}
      >
        <select
          value={
            value
          }
          onChange={
            (
              event,
            ) =>
              onChange(
                event.target
                  .value,
              )
          }
          className="
            h-10
            w-full
            cursor-pointer
            appearance-none
            bg-transparent
            px-3
            pr-8
            text-[8px]
            outline-none
          "
          style={{
            color:
              theme.colors.text,

            backgroundColor:
              theme.colors.backgroundElevated,
          }}
        >
          {options.map(
            (
              option,
            ) => (
              <option
                key={
                  option.value
                }
                value={
                  option.value
                }
              >
                {
                  option.label
                }
              </option>
            ),
          )}
        </select>

        <ChevronDown
          size={11}
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
    </label>
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
        word,
      ) =>
        word
          .charAt(
            0,
          )
          .toUpperCase() +
        word.slice(
          1,
        ),
    )
    .join(
      " ",
    );
}
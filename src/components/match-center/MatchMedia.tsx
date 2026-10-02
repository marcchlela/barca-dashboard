"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  BadgeCheck,
  ExternalLink,
  Play,
  Video,
} from "lucide-react";

import FootballIcon from "../icons/FootballIcon";

import type {
  MatchMediaItem,
} from "../../lib/matches/get-match-media";

import type {
  KitTheme,
} from "../../lib/themes";

type MatchMediaProps = {
  items:
    MatchMediaItem[];

  theme:
    KitTheme;
};

export default function MatchMedia({
  items,
  theme,
}: MatchMediaProps) {
  const playable =
    useMemo(
      () =>
        items.filter(
          (
            item,
          ) =>
            getYouTubeId(
              item,
            ) !==
            null,
        ),
      [
        items,
      ],
    );

  const initialId =
    playable[0]?.id ??
    items[0]?.id ??
    null;

  const [
    selectedId,
    setSelectedId,
  ] =
    useState<
      string | null
    >(
      initialId,
    );

  const selected =
    items.find(
      (
        item,
      ) =>
        item.id ===
        selectedId,
    ) ??
    items[0] ??
    null;

  if (
    items.length ===
    0
  ) {
    return (
      <EmptyMedia
        theme={theme}
      />
    );
  }

  return (
    <section
      id="media"
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

        backgroundColor:
          theme.colors
            .surface,
      }}
    >
      <header
        className="
          flex
          items-end
          justify-between
          gap-4
          border-b
          px-5
          py-4
          sm:px-7
        "
        style={{
          borderColor:
            theme.colors
              .border,
        }}
      >
        <div>
          <p
            className="
              text-[8px]
              uppercase
              tracking-[0.24em]
            "
            style={{
              color:
                theme.colors
                  .textMuted,
            }}
          >
            Watch & Relive
          </p>

          <h2 className="mt-1 text-base font-medium">
            Match Media
          </h2>
        </div>

        <div
          className="
            flex
            items-center
            gap-2
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
          <Video
            size={12}
          />

          {
            items.length
          }{" "}
          {items.length ===
          1
            ? "item"
            : "items"}
        </div>
      </header>

      {selected ? (
        <>
          <FeaturedMedia
            item={
              selected
            }
            theme={theme}
          />

          {items.length >
          1 ? (
            <div
              className="
                border-t
                px-5
                py-5
                sm:px-7
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
                  tracking-[0.2em]
                "
                style={{
                  color:
                    theme.colors
                      .textMuted,
                }}
              >
                More from this match
              </p>

              <div
                className="
                  mt-4
                  grid
                  gap-3
                  md:grid-cols-2
                  xl:grid-cols-3
                "
              >
                {items.map(
                  (
                    item,
                  ) => (
                    <MediaCard
                      key={
                        item.id
                      }
                      item={
                        item
                      }
                      selected={
                        item.id ===
                        selected.id
                      }
                      theme={
                        theme
                      }
                      onSelect={() =>
                        setSelectedId(
                          item.id,
                        )
                      }
                    />
                  ),
                )}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function FeaturedMedia({
  item,
  theme,
}: {
  item:
    MatchMediaItem;

  theme:
    KitTheme;
}) {
  const youtubeId =
    getYouTubeId(
      item,
    );
  const isHighlight =
    item.type ===
    "match_highlight";

  return (
    <div
      className="border"
      style={{
        borderColor:
          isHighlight
            ? theme.colors
                .accent
            : theme.colors
                .border,

        boxShadow:
          isHighlight
            ? `inset 0 0 0 1px ${theme.colors.accent}18`
            : undefined,
      }}
    >
      <div
        className="
          grid
          gap-0
          xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.55fr)]
        "
      >
        <div
          className="
            relative
            aspect-video
            overflow-hidden
            bg-black
          "
        >
          {youtubeId ? (
            <iframe
              key={
                youtubeId
              }
              src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0`}
              title={
                item.title
              }
              allow="
                accelerometer;
                autoplay;
                clipboard-write;
                encrypted-media;
                gyroscope;
                picture-in-picture;
                web-share
              "
              allowFullScreen
              className="
                absolute
                inset-0
                h-full
                w-full
                border-0
              "
            />
          ) : item.thumbnailUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  item.thumbnailUrl
                }
                alt=""
                className="
                  h-full
                  w-full
                  object-cover
                "
              />

              <div
                className="
                  absolute
                  inset-0
                  flex
                  items-center
                  justify-center
                  bg-black/40
                "
              >
                <a
                  href={
                    item.url
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="
                    flex
                    h-14
                    w-14
                    items-center
                    justify-center
                    border
                    bg-black/60
                    backdrop-blur-sm
                  "
                  style={{
                    borderColor:
                      theme.colors
                        .accent,

                    color:
                      theme.colors
                        .accent,
                  }}
                >
                  <Play
                    size={20}
                    fill="currentColor"
                  />
                </a>
              </div>
            </>
          ) : (
            <div
              className="
                flex
                h-full
                items-center
                justify-center
              "
              style={{
                color:
                  theme.colors
                    .textMuted,
              }}
            >
              <Video
                size={30}
              />
            </div>
          )}
        </div>

        <div
          className="
            flex
            flex-col
            justify-between
            border-t
            p-5
            xl:border-l
            xl:border-t-0
            xl:p-7
          "
          style={{
            borderColor:
              theme.colors
                .border,
          }}
        >
          <div>
            <div
              className="
                flex
                flex-wrap
                items-center
                gap-2
              "
            >
              <MediaTypeBadge
                type={
                  item.type
                }
                theme={theme}
              />

              {item.isOfficial ? (
                <span
                  className="
                    inline-flex
                    items-center
                    gap-1.5
                    text-[8px]
                    font-semibold
                    uppercase
                    tracking-[0.15em]
                  "
                  style={{
                    color:
                      theme.colors
                        .accent,
                  }}
                >
                  <BadgeCheck
                    size={12}
                  />

                  Official
                </span>
              ) : null}
            </div>

            <h3
              className="
                mt-4
                text-xl
                font-medium
                leading-tight
                tracking-[-0.03em]
              "
            >
              {
                item.title
              }
            </h3>

            {item.description ? (
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
                {
                  item.description
                }
              </p>
            ) : null}

            {item.player ? (
              <div
                className="
                  mt-5
                  flex
                  items-center
                  gap-3
                  border-t
                  pt-4
                "
                style={{
                  borderColor:
                    theme.colors
                      .border,
                }}
              >
                {item.player
                  .portraitUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        item
                          .player
                          .portraitUrl
                      }
                      alt=""
                      className="
                        h-8
                        w-8
                        object-cover
                        object-top
                      "
                    />
                  </>
                ) : null}

                <div>
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
                    Player
                  </p>

                  <p className="mt-0.5 text-xs">
                    {
                      item.player
                        .name
                    }
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <div
            className="
              mt-6
              flex
              items-center
              justify-between
              gap-4
            "
          >
            <PublishedDate
              item={item}
              theme={theme}
            />

            <a
              href={
                item.url
              }
              target="_blank"
              rel="noreferrer"
              className="
                inline-flex
                items-center
                gap-2
                text-[8px]
                font-semibold
                uppercase
                tracking-[0.14em]
              "
              style={{
                color:
                  theme.colors
                    .accent,
              }}
            >
              Open source

              <ExternalLink
                size={11}
              />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function MediaCard({
  item,
  selected,
  theme,
  onSelect,
}: {
  item:
    MatchMediaItem;

  selected:
    boolean;

  theme:
    KitTheme;

  onSelect:
    () => void;
}) {
  const youtubeId =
    getYouTubeId(
      item,
    );

  const isHighlight =
  item.type ===
  "match_highlight";

  const thumbnail =
    item.thumbnailUrl ??
    (
      youtubeId
        ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
        : null
    );

  return (
    <button
      type="button"
      onClick={
        onSelect
      }
      className="
        group
        cursor-pointer
        overflow-hidden
        border
        text-left
      "
      style={{
        borderColor:
          isHighlight ||
          selected
            ? theme.colors
                .accent
            : theme.colors
                .border,

        backgroundColor:
          selected
            ? `${theme.colors.accent}0D`
            : isHighlight
              ? `${theme.colors.accent}07`
              : theme.colors
                  .background,

        boxShadow:
          isHighlight
            ? `inset 0 0 0 1px ${theme.colors.accent}18`
            : undefined,
      }}
    >
      <div
        className="
          relative
          aspect-video
          overflow-hidden
          bg-black
        "
      >
        {thumbnail ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                thumbnail
              }
              alt=""
              className="
                h-full
                w-full
                object-cover
                transition-transform
                duration-300
                group-hover:scale-[1.025]
              "
            />
          </>
        ) : (
          <div
            className="
              flex
              h-full
              items-center
              justify-center
            "
            style={{
              color:
                theme.colors
                  .textMuted,
            }}
          >
            <Video
              size={22}
            />
          </div>
        )}

        <div
          className="
            absolute
            inset-0
            bg-gradient-to-t
            from-black/60
            via-transparent
            to-transparent
          "
        />

        <div
          className="
            absolute
            bottom-3
            left-3
            flex
            h-8
            w-8
            items-center
            justify-center
            border
            bg-black/55
            backdrop-blur-sm
          "
          style={{
            borderColor:
              selected
                ? theme.colors
                    .accent
                : "rgba(255,255,255,0.2)",

            color:
              selected
                ? theme.colors
                    .accent
                : "#ffffff",
          }}
        >
          <Play
            size={12}
            fill="currentColor"
          />
        </div>
      </div>

      <div className="p-3">
        <div
          className="
            flex
            items-center
            justify-between
            gap-2
          "
        >
          <MediaTypeBadge
            type={
              item.type
            }
            theme={theme}
          />

          {item.isOfficial ? (
            <BadgeCheck
              size={12}
              style={{
                color:
                  theme.colors
                    .accent,
              }}
            />
          ) : null}
        </div>

        <p
          className="
            mt-2
            line-clamp-2
            text-[11px]
            font-medium
            leading-4
          "
        >
          {
            item.title
          }
        </p>
      </div>
    </button>
  );
}

function EmptyMedia({
  theme,
}: {
  theme:
    KitTheme;
}) {
  return (
    <section
      id="media"
      className="
        scroll-mt-24
        mt-6
        border
      "
      style={{
        borderColor:
          theme.colors
            .border,

        backgroundColor:
          theme.colors
            .surface,
      }}
    >
      <div
        className="
          border-b
          px-5
          py-4
          sm:px-7
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
            uppercase
            tracking-[0.24em]
          "
          style={{
            color:
              theme.colors
                .textMuted,
          }}
        >
          Watch & Relive
        </p>

        <h2 className="mt-1 text-base font-medium">
          Match Media
        </h2>
      </div>

      <div
        className="
          flex
          min-h-64
          items-center
          justify-center
          px-6
          py-10
          text-center
        "
      >
        <div className="max-w-sm">
          <div
            className="
              mx-auto
              flex
              h-11
              w-11
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
            <FootballIcon
              size={16}
            />
          </div>

          <p className="mt-4 text-sm font-medium">
            No match media linked yet
          </p>

          <p
            className="
              mt-2
              text-[10px]
              leading-5
            "
            style={{
              color:
                theme.colors
                  .textMuted,
            }}
          >
            Official highlights and other verified Barça videos will
            appear here when they are available.
          </p>
        </div>
      </div>
    </section>
  );
}

function MediaTypeBadge({
  type,
  theme,
}: {
  type:
    string;

  theme:
    KitTheme;
}) {
  return (
    <span
      className="
        inline-flex
        items-center
        gap-1.5
        text-[7px]
        font-semibold
        uppercase
        tracking-[0.16em]
      "
      style={{
        color:
          theme.colors
            .textMuted,
      }}
    >
      {type ===
      "match_highlight" ? (
        <FootballIcon
          size={9}
        />
      ) : (
        <Video
          size={9}
        />
      )}

      {mediaTypeLabel(
        type,
      )}
    </span>
  );
}

function PublishedDate({
  item,
  theme,
}: {
  item:
    MatchMediaItem;

  theme:
    KitTheme;
}) {
  if (
    !item.publishedAt
  ) {
    return (
      <span
        className="
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
        Match media
      </span>
    );
  }

  const date =
    new Date(
      item.publishedAt,
    );

  return (
    <span
      className="
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
      {date.toLocaleDateString(
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
    </span>
  );
}

function getYouTubeId(
  item:
    MatchMediaItem,
) {
  if (
    item.externalMediaId &&
    /^[A-Za-z0-9_-]{11}$/.test(
      item.externalMediaId,
    )
  ) {
    return item.externalMediaId;
  }

  try {
    const url =
      new URL(
        item.url,
      );

    if (
      url.hostname ===
        "youtu.be" ||
      url.hostname.endsWith(
        ".youtu.be",
      )
    ) {
      const value =
        url.pathname
          .split("/")
          .filter(
            Boolean,
          )[0];

      return validYouTubeId(
        value,
      );
    }

    if (
      url.hostname.includes(
        "youtube.com",
      )
    ) {
      const fromQuery =
        url.searchParams.get(
          "v",
        );

      if (
        fromQuery
      ) {
        return validYouTubeId(
          fromQuery,
        );
      }

      const pieces =
        url.pathname
          .split("/")
          .filter(
            Boolean,
          );

      const specialIndex =
        pieces.findIndex(
          (
            piece,
          ) =>
            piece ===
              "embed" ||
            piece ===
              "shorts" ||
            piece ===
              "live",
        );

      if (
        specialIndex >=
          0 &&
        pieces[
          specialIndex +
            1
        ]
      ) {
        return validYouTubeId(
          pieces[
            specialIndex +
              1
          ],
        );
      }
    }
  } catch {
    return null;
  }

  return null;
}

function validYouTubeId(
  value:
    string | undefined,
) {
  if (
    !value ||
    !/^[A-Za-z0-9_-]{11}$/.test(
      value,
    )
  ) {
    return null;
  }

  return value;
}

function mediaTypeLabel(
  type:
    string,
) {
  switch (
    type
  ) {
    case "match_highlight":
      return "Highlights";

    case "goal_clip":
      return "Goal";

    case "interview":
      return "Interview";

    case "press_conference":
      return "Press Conference";

    case "training":
      return "Training";

    case "historical":
      return "Historical";

    default:
      return "Video";
  }
}
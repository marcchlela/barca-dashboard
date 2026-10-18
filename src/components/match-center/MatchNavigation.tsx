"use client";

import Link from "next/link";

import {
  ArrowLeft,
  ArrowRight,
} from "lucide-react";

import type {
  MatchNavigation as MatchNavigationData,
  MatchNavigationItem,
} from "../../lib/matches/get-match-navigation";

import type {
  KitTheme,
} from "../../lib/themes";

type MatchNavigationProps = {
  navigation:
    MatchNavigationData;

  theme:
    KitTheme;
};

export default function MatchNavigation({
  navigation,
  theme,
}: MatchNavigationProps) {
  return (
    <section
      className="
        mt-6
        grid
        grid-cols-2
        gap-px
        border
      "
      style={{
        borderColor:
          theme.colors
            .border,

        backgroundColor:
          theme.colors
            .border,
      }}
    >
      <NavigationSlot
        direction="previous"
        item={
          navigation.previous
        }
        theme={theme}
      />

      <NavigationSlot
        direction="next"
        item={
          navigation.next
        }
        theme={theme}
      />
    </section>
  );
}

function NavigationSlot({
  direction,
  item,
  theme,
}: {
  direction:
    "previous" | "next";

  item:
    MatchNavigationItem | null;

  theme:
    KitTheme;
}) {
  const previous =
    direction ===
    "previous";

  if (!item) {
    return (
      <div
        className="
          flex
          min-h-20
          items-center
          px-3
          py-3
          sm:px-5
          sm:py-4
        "
        style={{
          backgroundColor:
            theme.colors
              .surface,
        }}
      >
        <p
          className="
            text-xs
            uppercase
            tracking-[0.18em]
          "
          style={{
            color:
              theme.colors
                .textMuted,
          }}
        >
          No {direction} match
        </p>
      </div>
    );
  }

  const kickoff =
    new Date(
      item.kickoff,
    );

  return (
    <Link
      href={`/matches/${item.id}`}
      className="
        group
        relative
        flex
        min-h-20
        items-center
        gap-2
        overflow-hidden
        px-3
        py-3
        sm:gap-4
        sm:px-5
        sm:py-4
      "
      style={{
        backgroundColor:
          theme.colors
            .surface,
      }}
    >
      <div
        className="
          absolute
          bottom-0
          top-0
          w-0.75
          scale-y-0
          transition-transform
          duration-200
          group-hover:scale-y-100
        "
        style={{
          left:
            previous
              ? 0
              : undefined,

          right:
            previous
              ? undefined
              : 0,

          backgroundColor:
            theme.colors
              .accent,
        }}
      />

      {previous ? (
        <ArrowLeft
          size={17}
          className="
            shrink-0
            transition-transform
            group-hover:-translate-x-1
          "
          style={{
            color:
              theme.colors
                .accent,
          }}
        />
      ) : null}

      <div
        className={
          previous
            ? "min-w-0 flex-1"
            : "min-w-0 flex-1 text-right"
        }
      >
        <p
          className="
            text-xs
            uppercase
            tracking-[0.2em]
          "
          style={{
            color:
              theme.colors
                .textMuted,
          }}
        >
          {previous
            ? "Previous Match"
            : "Next Match"}
        </p>

        <div
          className={
            previous
              ? "mt-1.5 flex items-center gap-2 sm:gap-3"
              : "mt-1.5 flex flex-row-reverse items-center gap-2 sm:gap-3"
          }
        >
          <OpponentCrest
            item={item}
            theme={theme}
          />

          <div className="min-w-0">
            <p className="truncate text-xs font-medium sm:text-sm">
              {matchLabel(
                item,
              )}
            </p>

            <p
              className="
                mt-0.5
                truncate
                text-xs
                uppercase
                tracking-[0.13em]
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
                },
              )}

              {" · "}

              {item
                .competition
                .shortName ??
                item
                  .competition
                  .name}
            </p>
          </div>
        </div>
      </div>

      {!previous ? (
        <ArrowRight
          size={17}
          className="
            shrink-0
            transition-transform
            group-hover:translate-x-1
          "
          style={{
            color:
              theme.colors
                .accent,
          }}
        />
      ) : null}
    </Link>
  );
}

function OpponentCrest({
  item,
  theme,
}: {
  item:
    MatchNavigationItem;

  theme:
    KitTheme;
}) {
  if (
    item.opponent
      .crestUrl
  ) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={
            item.opponent
              .crestUrl
          }
          alt=""
          className="
            h-8
            w-8
            shrink-0
            object-contain
            sm:h-10
            sm:w-10
          "
        />
      </>
    );
  }

  return (
    <div
      className="
        flex
        h-8
        w-8
        shrink-0
        items-center
        justify-center
        border
        text-xs
        font-semibold
        sm:h-10
        sm:w-10
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
        item.opponent
          .name[0]
      }
    </div>
  );
}

function matchLabel(
  item:
    MatchNavigationItem,
) {
  const opponent =
    item.opponent
      .shortName ??
    item.opponent
      .name;

  if (
    item.score.barcelona !==
      null &&
    item.score.opponent !==
      null
  ) {
    return item.barcelonaSide ===
      "home"
      ? `Barça ${item.score.barcelona}–${item.score.opponent} ${opponent}`
      : `${opponent} ${item.score.opponent}–${item.score.barcelona} Barça`;
  }

  return item.barcelonaSide ===
    "home"
    ? `Barça vs ${opponent}`
    : `${opponent} vs Barça`;
}

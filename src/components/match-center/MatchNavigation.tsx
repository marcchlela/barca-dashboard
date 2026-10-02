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
        grid-cols-1
        gap-px
        border
        sm:grid-cols-2
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
          min-h-28
          items-center
          px-5
          py-4
        "
        style={{
          backgroundColor:
            theme.colors
              .surface,
        }}
      >
        <p
          className="
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
        min-h-28
        items-center
        gap-4
        overflow-hidden
        px-5
        py-4
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
            text-[8px]
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
              ? "mt-2 flex items-center gap-3"
              : "mt-2 flex flex-row-reverse items-center gap-3"
          }
        >
          <OpponentCrest
            item={item}
            theme={theme}
          />

          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {matchLabel(
                item,
              )}
            </p>

            <p
              className="
                mt-1
                truncate
                text-[9px]
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
            h-10
            w-10
            shrink-0
            object-contain
          "
        />
      </>
    );
  }

  return (
    <div
      className="
        flex
        h-10
        w-10
        shrink-0
        items-center
        justify-center
        border
        text-[10px]
        font-semibold
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
"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  BookHeart,
} from "lucide-react";

import type {
  KitTheme,
} from "../../lib/themes";

type MatchCenterTabsProps = {
  theme:
    KitTheme;
};

type TabId =
  | "overview"
  | "lineups"
  | "stats"
  | "players"
  | "media"
  | "my-match";

const TABS: Array<{
  id:
    TabId;

  label:
    string;
}> = [
  {
    id:
      "overview",

    label:
      "Overview",
  },

  {
    id:
      "lineups",

    label:
      "Lineups",
  },

  {
    id:
      "stats",

    label:
      "Stats",
  },

  {
    id:
      "players",

    label:
      "Players",
  },

  {
    id:
      "media",

    label:
      "Media",
  },

  {
    id:
      "my-match",

    label:
      "My Match",
  },
];

export default function MatchCenterTabs({
  theme,
}: MatchCenterTabsProps) {
  const [
    active,
    setActive,
  ] =
    useState<TabId>(
      "overview",
    );

  useEffect(() => {
    const elements =
      TABS.map(
        (
          tab,
        ) =>
          document.getElementById(
            tab.id,
          ),
      ).filter(
        (
          element,
        ):
          element is HTMLElement =>
          element !==
          null,
      );

    if (
      elements.length ===
      0
    ) {
      return;
    }

    const observer =
      new IntersectionObserver(
        (
          entries,
        ) => {
          const visible =
            entries
              .filter(
                (
                  entry,
                ) =>
                  entry.isIntersecting,
              )
              .sort(
                (
                  left,
                  right,
                ) =>
                  Math.abs(
                    left
                      .boundingClientRect
                      .top,
                  ) -
                  Math.abs(
                    right
                      .boundingClientRect
                      .top,
                  ),
              );

          const id =
            visible[0]
              ?.target.id;

          if (
            id &&
            isTabId(
              id,
            )
          ) {
            setActive(
              id,
            );
          }
        },

        {
          rootMargin:
            "-15% 0px -72% 0px",

          threshold:
            0,
        },
      );

    for (
      const element
      of elements
    ) {
      observer.observe(
        element,
      );
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  function navigate(
    tab:
      TabId,
  ) {
    setActive(
      tab,
    );

    document.getElementById(
      tab,
    )?.scrollIntoView({
      behavior:
        "smooth",

      block:
        "start",
    });
  }

  return (
    <nav
      className="
        sticky
        top-0
        z-40
        mt-4
        overflow-x-auto
        border
        scrollbar-subtle
        backdrop-blur-xl
      "
      style={{
        borderColor:
          theme.colors
            .border,

        backgroundColor:
          `${theme.colors.background}EE`,
      }}
      aria-label="Match Center sections"
    >
      <div className="flex min-w-max">
        {TABS.map(
          (
            tab,
          ) => {
            const selected =
              active ===
              tab.id;

            const isPersonal =
              tab.id ===
              "my-match";

            return (
              <button
                key={
                  tab.id
                }
                type="button"
                onClick={() =>
                  navigate(
                    tab.id,
                  )
                }
                className="
                  relative
                  flex
                  min-w-28
                  cursor-pointer
                  items-center
                  justify-center
                  gap-2
                  border-r
                  px-5
                  py-3.5
                  text-[9px]
                  font-medium
                  uppercase
                  tracking-[0.16em]
                  transition-colors
                  last:border-r-0
                "
                style={{
                  borderColor:
                    theme.colors
                      .border,

                  color:
                    selected
                      ? theme
                          .colors
                          .text
                      : isPersonal
                        ? theme
                            .colors
                            .accent
                        : theme
                            .colors
                            .textMuted,

                  backgroundColor:
                    selected
                      ? theme
                          .colors
                          .backgroundElevated
                      : "transparent",
                }}
              >
                {isPersonal ? (
                  <BookHeart
                    size={12}
                  />
                ) : null}

                {
                  tab.label
                }

                {selected ? (
                  <span
                    className="
                      absolute
                      bottom-0
                      left-4
                      right-4
                      h-0.5
                    "
                    style={{
                      backgroundColor:
                        theme
                          .colors
                          .accent,
                    }}
                  />
                ) : null}
              </button>
            );
          },
        )}
      </div>
    </nav>
  );
}

function isTabId(
  value:
    string,
): value is TabId {
  return TABS.some(
    (
      tab,
    ) =>
      tab.id ===
      value,
  );
}
"use client";

import Link from "next/link";

import {
  usePathname,
} from "next/navigation";

import {
  Film,
  Inbox,
  Clapperboard,
  Plus,
} from "lucide-react";

import {
  kitThemes,
} from "../../lib/themes";

export default function MediaSectionNav({
  pendingCount,
}: {
  pendingCount:
    number;
}) {
  const pathname =
    usePathname();

  const theme =
    kitThemes.home;

  const tabs = [
    {
      href:
        "/admin/media",

      label:
        "Library",

      icon:
        Film,

      active:
        pathname ===
        "/admin/media",
    },

    {
      href:
        "/admin/media/review",

      label:
        "Review Queue",

      icon:
        Inbox,

      active:
        pathname.startsWith(
          "/admin/media/review",
        ),

      count:
        pendingCount,
    },

    {
      href:
        "/admin/media/add",

      label:
        "Add Media",

      icon:
        Plus,

      active:
        pathname.startsWith(
          "/admin/media/add",
        ),
    },
    {
      href: "/admin/media/curation",
      label: "Curation",
      icon: Clapperboard,
      active: pathname.startsWith("/admin/media/curation"),
    },
  ];

  return (
    <div
      className="
        mb-5
        flex
        flex-wrap
        items-stretch
        border
      "
      style={{
        borderColor:
          theme.colors.border,
      }}
    >
      {tabs.map(
        (
          tab,
        ) => {
          const Icon =
            tab.icon;

          return (
            <Link
              key={
                tab.href
              }
              href={
                tab.href
              }
              className="
                flex
                min-h-11
                items-center
                gap-2
                border-r
                px-4
                text-[8px]
                uppercase
                tracking-[0.12em]
              "
              style={{
                borderColor:
                  theme.colors.border,

                color:
                  tab.active
                    ? theme.colors.accent
                    : theme.colors.textMuted,

                backgroundColor:
                  tab.active
                    ? `${theme.colors.accent}0A`
                    : "transparent",
              }}
            >
              <Icon
                size={12}
              />

              {
                tab.label
              }

              {"count" in
                tab &&
              tab.count !==
                undefined ? (
                <span
                  className="
                    ml-1
                    flex
                    min-w-5
                    items-center
                    justify-center
                    border
                    px-1
                    py-0.5
                    text-[7px]
                    tabular-nums
                  "
                  style={{
                    borderColor:
                      tab.count >
                      0
                        ? theme.colors.warning
                        : theme.colors.border,

                    color:
                      tab.count >
                      0
                        ? theme.colors.warning
                        : theme.colors.textMuted,
                  }}
                >
                  {
                    tab.count
                  }
                </span>
              ) : null}
            </Link>
          );
        },
      )}
    </div>
  );
}

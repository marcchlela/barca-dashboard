"use client";

import Link from "next/link";

import {
  usePathname,
} from "next/navigation";

import {
  BarChart3,
  CalendarDays,
  Home,
  LibraryBig,
  Settings,
  Shield,
  Trophy,
  UserRound,
} from "lucide-react";

import {
  motion,
} from "motion/react";

import type {
  KitTheme,
} from "../../lib/themes";

type StadiumRailProps = {
  theme: KitTheme;

  variant?:
    | "desktop"
    | "compact";
};

const navigation = [
  {
    label: "Overview",
    href: "/",
    icon: Home,
  },

  {
    label: "Matches",
    href: "/matches",
    icon: CalendarDays,
  },

  {
    label: "Squad",
    href: "/squad",
    icon: UserRound,
  },

  {
    label: "Analytics",
    href: "/analytics",
    icon: BarChart3,
  },

  {
    label: "Club",
    href: "/club",
    icon: Trophy,
  },

  {
    label: "Media",
    href: "/media",
    icon: LibraryBig,
  },

  {
    label: "My Barça",
    href: "/my-barca",
    icon: Shield,
  },
] as const;

export default function StadiumRail({
  theme,
  variant = "desktop",
}: StadiumRailProps) {
  const pathname =
    usePathname();

  if (
    variant ===
    "compact"
  ) {
    return (
      <CompactRail
        pathname={
          pathname
        }
        theme={theme}
      />
    );
  }

  return (
    <DesktopRail
      pathname={
        pathname
      }
      theme={theme}
    />
  );
}

/*
|--------------------------------------------------------------------------
| Desktop rail
|--------------------------------------------------------------------------
*/

function DesktopRail({
  pathname,
  theme,
}: {
  pathname: string;
  theme: KitTheme;
}) {
  return (
    <aside
      className="relative flex min-h-[653px] h-full flex-col border-r pr-5"
      style={{
        borderColor:
          theme.colors.border,
      }}
    >
      <Link
        href="/"
        aria-label="Go to Barça overview"
        className="group relative block pl-4"
      >
        <div
          className="absolute bottom-0 left-0 top-0 w-px"
          style={{
            backgroundColor:
              theme.colors.primary,
          }}
        />

        <p className="text-[11px] font-semibold uppercase leading-[1.25] tracking-[0.28em]">
          FC
          <br />
          Barcelona
        </p>

        <p
          className="mt-3 text-[9px] uppercase tracking-[0.22em]"
          style={{
            color:
              theme.colors.textMuted,
          }}
        >
          Més que un club
        </p>

        <div
          className="mt-4 h-px w-0 transition-all duration-200 group-hover:w-10"
          style={{
            backgroundColor:
              theme.colors.accent,
          }}
        />
      </Link>

      <nav className="relative mt-10 flex flex-col">
        {navigation.map(
          ({
            label,
            href,
            icon: Icon,
          }) => {
            const active =
              isRouteActive(
                pathname,
                href,
              );

            return (
              <Link
                key={href}
                href={href}
                className="group relative flex h-[43px] items-center gap-3 pl-4"
                aria-current={
                  active
                    ? "page"
                    : undefined
                }
              >
                {active && (
                  <motion.div
                    layoutId="stadium-rail-active"
                    className="absolute -left-px top-1/2 h-6 w-[2px] -translate-y-1/2"
                    style={{
                      backgroundColor:
                        theme.colors.accent,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 420,
                      damping: 34,
                    }}
                  />
                )}

                <Icon
                  size={15}
                  strokeWidth={1.6}
                  className="shrink-0 transition-transform duration-150 group-hover:translate-x-[1px]"
                  style={{
                    color:
                      active
                        ? theme.colors.accent
                        : theme.colors.textMuted,
                  }}
                />

                <span
                  className="text-[12px]"
                  style={{
                    color:
                      active
                        ? theme.colors.text
                        : theme.colors.textMuted,

                    fontWeight:
                      active
                        ? 500
                        : 400,
                  }}
                >
                  {label}
                </span>
              </Link>
            );
          },
        )}
      </nav>

      <div className="mt-auto pl-4 pb-3">
        <Link
          href="/settings"
          className="group flex items-center gap-3 py-3"
        >
          <Settings
            size={15}
            strokeWidth={1.6}
            className="transition-transform duration-300 group-hover:rotate-45"
            style={{
              color:
                isRouteActive(
                  pathname,
                  "/settings",
                )
                  ? theme.colors.accent
                  : theme.colors.textMuted,
            }}
          />

          <span
            className="text-[12px]"
            style={{
              color:
                isRouteActive(
                  pathname,
                  "/settings",
                )
                  ? theme.colors.text
                  : theme.colors.textMuted,
            }}
          >
            Settings
          </span>
        </Link>

        <p
          className="mt-5 text-[8px] uppercase leading-4 tracking-[0.22em]"
          style={{
            color:
              theme.colors.textMuted,
          }}
        >
          Camp Nou
          <br />
          Sempre
        </p>
      </div>
    </aside>
  );
}

/*
|--------------------------------------------------------------------------
| Compact rail
|--------------------------------------------------------------------------
*/

function CompactRail({
  pathname,
  theme,
}: {
  pathname: string;
  theme: KitTheme;
}) {
  return (
    <div
      className="border-y"
      style={{
        borderColor:
          theme.colors.border,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <nav className="flex min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navigation.map(
            ({
              label,
              href,
              icon: Icon,
            }) => {
              const active =
                isRouteActive(
                  pathname,
                  href,
                );

              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={
                    active
                      ? "page"
                      : undefined
                  }
                  className="relative flex shrink-0 items-center gap-2 px-3 py-3"
                >
                  {active && (
                    <motion.div
                      layoutId="stadium-compact-active"
                      className="absolute bottom-0 left-3 right-3 h-[2px]"
                      style={{
                        backgroundColor:
                          theme.colors.accent,
                      }}
                    />
                  )}

                  <Icon
                    size={14}
                    strokeWidth={1.6}
                    style={{
                      color:
                        active
                          ? theme.colors.accent
                          : theme.colors.textMuted,
                    }}
                  />

                  <span
                    className="text-[10px] uppercase tracking-[0.12em]"
                    style={{
                      color:
                        active
                          ? theme.colors.text
                          : theme.colors.textMuted,
                    }}
                  >
                    {label}
                  </span>
                </Link>
              );
            },
          )}
        </nav>

        <Link
          href="/settings"
          aria-label="Settings"
          className="flex h-10 w-10 shrink-0 items-center justify-center border-l"
          style={{
            borderColor:
              theme.colors.border,
          }}
        >
          <Settings
            size={15}
            strokeWidth={1.6}
            style={{
              color:
                isRouteActive(
                  pathname,
                  "/settings",
                )
                  ? theme.colors.accent
                  : theme.colors.textMuted,
            }}
          />
        </Link>
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Route matching
|--------------------------------------------------------------------------
*/

function isRouteActive(
  pathname: string,
  href: string,
) {
  if (href === "/") {
    return (
      pathname === "/"
    );
  }

  return (
    pathname === href ||
    pathname.startsWith(
      `${href}/`,
    )
  );
}
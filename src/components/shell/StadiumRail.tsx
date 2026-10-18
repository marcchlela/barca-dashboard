"use client";

import Link from "next/link";

import {
  usePathname,
} from "next/navigation";

import {
  BarChart3,
  CalendarDays,
  Heart,
  Home,
  Settings,
  Shield,
  SquarePlay,
  Trophy,
  UserRound,
  UserRoundGroup,
  type LucideProps,
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

function MyBarcaIcon({ size = 24, strokeWidth = 2, style, className }: LucideProps) {
  const iconSize = typeof size === "number" ? size : 24;
  return <span className={`relative inline-flex shrink-0 items-center justify-center ${className ?? ""}`} style={{ width: size, height: size, ...style }} aria-hidden="true">
    <Shield size={size} strokeWidth={strokeWidth} />
    <Heart className="absolute" size={Math.max(7, Math.round(iconSize * .38))} strokeWidth={strokeWidth} fill="currentColor" />
  </span>;
}

const primaryNavigation = [
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
    icon: UserRoundGroup,
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
    icon: SquarePlay,
  },

  {
    label: "My Barça",
    href: "/my-barca",
    icon: MyBarcaIcon,
  },

] as const;

const navigation = [
  ...primaryNavigation,
  { label: "Account", href: "/account", icon: UserRound },
] as const;

const mobileNavigation = primaryNavigation.filter(
  ({ href }) => href !== "/club",
);

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
      className="
        sticky
        top-5
        flex
        h-[calc(100vh-40px)]
        min-h-[653px]
        self-start
        flex-col
        border-r
        pr-5
      "
      style={{
        borderColor:
          theme.colors.border,
      }}
    >
      <Link
        href="/"
        aria-label="Go to Barça overview"
        className="group relative flex items-center gap-3 pl-4"
      >
        <div
          className="absolute bottom-0 left-0 top-0 w-px"
          style={{
            backgroundColor:
              theme.colors.primary,
          }}
        />

        <div>
          <p className="text-xs font-semibold uppercase leading-[1.25] tracking-[0.22em]">
            FC<br />Barcelona
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.16em]" style={{ color: theme.colors.textMuted }}>
            Més que un club
          </p>
        </div>

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
          className="mt-5 text-xs uppercase leading-4 tracking-[0.22em]"
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
      className="fixed inset-x-0 bottom-0 z-50 border-t px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      style={{
        borderColor:
          theme.colors.border,
        backgroundColor: `${theme.colors.background}F2`,
      }}
    >
      <div className="mx-auto max-w-xl [&>a]:hidden">
        <Link href="/" aria-label="Go to Barça overview" className="flex h-10 w-10 shrink-0 items-center justify-center border-r" style={{ borderColor: theme.colors.border }}>
          <Home size={18} strokeWidth={1.6} aria-hidden="true" />
        </Link>
        <nav className="mx-3 grid h-16 grid-cols-6 items-stretch sm:mx-5">
          {mobileNavigation.map(
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
                  aria-label={label}
                  title={label}
                  className="relative flex min-w-0 items-center justify-center rounded-sm active:scale-95"
                >
                  {active && (
                    <motion.div
                      layoutId="stadium-compact-active"
                      className="absolute inset-x-2 top-0 h-[2px]"
                      style={{
                        backgroundColor:
                          theme.colors.accent,
                      }}
                    />
                  )}

                  <Icon
                    size={20}
                    strokeWidth={1.6}
                    style={{
                      color:
                        active
                          ? theme.colors.accent
                          : theme.colors.textMuted,
                    }}
                  />

                  <span
                    className="sr-only"
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

export function MobileHeaderActions({ theme }: { theme: KitTheme }) {
  const pathname = usePathname();

  return (
    <div className="flex shrink-0 items-center gap-1 lg:hidden">
      <HeaderAction href="/settings" label="Settings" active={isRouteActive(pathname, "/settings")} theme={theme} icon={Settings} />
      <HeaderAction href="/account" label="Account" active={isRouteActive(pathname, "/account")} theme={theme} icon={UserRound} />
    </div>
  );
}

function HeaderAction({ href, label, active, theme, icon: Icon }: { href: string; label: string; active: boolean; theme: KitTheme; icon: typeof Settings }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="flex h-11 w-11 items-center justify-center rounded-sm border active:scale-95"
      style={{ color: active ? theme.colors.accent : theme.colors.textMuted, borderColor: active ? theme.colors.border : "transparent" }}
    >
      <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
    </Link>
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

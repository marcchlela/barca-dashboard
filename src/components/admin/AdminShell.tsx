"use client";

import type {
  ReactNode,
} from "react";

import Link from "next/link";

import {
  usePathname,
} from "next/navigation";

import {
  Activity,
  ArrowLeft,
  Database,
  LayoutDashboard,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  Video,
} from "lucide-react";

import ThemeScrollbarSync from "../theme/ThemeScrollbarSync";

import {
  kitThemes,
} from "../../lib/themes";

type AdminShellProps = {
  children:
    ReactNode;
};

const navigation = [
  {
    label:
      "Overview",

    href:
      "/admin",

    icon:
      LayoutDashboard,
  },

  {
    label:
      "Media",

    href:
      "/admin/media",

    icon:
      Video,
  },

  {
    label:
      "Providers",

    href:
      "/admin/providers",

    icon:
      Database,
  },

  {
    label:
      "Data Issues",

    href:
      "/admin/issues",

    icon:
      TriangleAlert,
  },

  {
    label:
      "Sync",

    href:
      "/admin/sync",

    icon:
      RefreshCw,
  },
] as const;

export default function AdminShell({
  children,
}: AdminShellProps) {
  const pathname =
    usePathname();

  const theme =
    kitThemes.home;

  return (
    <main
      className="
        min-h-screen
        overflow-x-hidden
      "
      style={{
        backgroundColor:
          theme.colors.background,

        color:
          theme.colors.text,
      }}
    >
      <ThemeScrollbarSync
        theme={theme}
      />

      {/* BACKGROUND */}

      <div
        className="
          pointer-events-none
          fixed
          inset-0
        "
        style={{
          background: `
            linear-gradient(
              135deg,
              ${theme.colors.background} 0%,
              ${theme.colors.backgroundElevated} 52%,
              ${theme.colors.background} 100%
            )
          `,
        }}
      />

      <div
        className="
          pointer-events-none
          fixed
          inset-0
          opacity-[0.025]
        "
        style={{
          backgroundImage: `
            linear-gradient(
              to right,
              ${theme.colors.pitchLine} 1px,
              transparent 1px
            ),
            linear-gradient(
              to bottom,
              ${theme.colors.pitchLine} 1px,
              transparent 1px
            )
          `,

          backgroundSize:
            "64px 64px",
        }}
      />

      {/* ADMIN ACCENT */}

      <div
        className="
          pointer-events-none
          fixed
          left-0
          top-0
          h-full
          w-1
        "
        style={{
          background: `
            linear-gradient(
              to bottom,
              ${theme.colors.primary},
              ${theme.colors.accent}
            )
          `,
        }}
      />

      <div
        className="
          relative
          mx-auto
          min-h-screen
          max-w-[1800px]

          lg:grid
          lg:grid-cols-[230px_minmax(0,1fr)]
        "
      >
        {/* DESKTOP ADMIN NAV */}

        <aside
          className="
            hidden
            min-h-screen
            border-r
            px-5
            py-6

            lg:flex
            lg:flex-col
          "
          style={{
            borderColor:
              theme.colors.border,

            backgroundColor:
              `${theme.colors.background}E8`,
          }}
        >
          <Link
            href="/"
            className="
              group
              flex
              items-center
              gap-2
              text-[10px]
              uppercase
              tracking-[0.18em]
            "
            style={{
              color:
                theme.colors.textMuted,
            }}
          >
            <ArrowLeft
              size={13}
            />

            Command Center
          </Link>

          <div className="mt-9">
            <div
              className="
                flex
                h-9
                w-9
                items-center
                justify-center
                border
              "
              style={{
                borderColor:
                  theme.colors.accent,

                color:
                  theme.colors.accent,

                backgroundColor:
                  `${theme.colors.accent}0A`,
              }}
            >
              <ShieldCheck
                size={17}
              />
            </div>

            <p
              className="
                mt-4
                text-[9px]
                uppercase
                tracking-[0.24em]
              "
              style={{
                color:
                  theme.colors.textMuted,
              }}
            >
              Barça Data Operations
            </p>

            <h1
              className="
                mt-1
                text-lg
                font-medium
                tracking-[-0.02em]
              "
            >
              Admin Control Room
            </h1>
          </div>

          <nav className="mt-10">
            {navigation.map(
              ({
                label,
                href,
                icon:
                  Icon,
              }) => {
                const active =
                  isActive(
                    pathname,
                    href,
                  );

                return (
                  <Link
                    key={href}
                    href={href}
                    className="
                      group
                      relative
                      flex
                      h-11
                      items-center
                      gap-3
                      border-l
                      px-3
                    "
                    style={{
                      borderColor:
                        active
                          ? theme.colors.accent
                          : "transparent",

                      backgroundColor:
                        active
                          ? `${theme.colors.accent}0B`
                          : "transparent",
                    }}
                  >
                    <Icon
                      size={15}
                      strokeWidth={1.6}
                      style={{
                        color:
                          active
                            ? theme.colors.accent
                            : theme.colors.textMuted,
                      }}
                    />

                    <span
                      className="
                        text-[11px]
                        uppercase
                        tracking-[0.09em]
                      "
                      style={{
                        color:
                          active
                            ? theme.colors.text
                            : theme.colors.textMuted,
                      }}
                    >
                      {
                        label
                      }
                    </span>
                  </Link>
                );
              },
            )}
          </nav>

          <div
            className="
              mt-auto
              border-t
              pt-5
            "
            style={{
              borderColor:
                theme.colors.border,
            }}
          >
            <div
              className="
                flex
                items-center
                gap-2
                text-[9px]
                uppercase
                tracking-[0.14em]
              "
              style={{
                color:
                  theme.colors.success,
              }}
            >
              <Activity
                size={12}
              />

              Private Control Surface
            </div>

            <p
              className="
                mt-2
                text-[9px]
                leading-4
              "
              style={{
                color:
                  theme.colors.textMuted,
              }}
            >
              Admin V1
              <br />
              Canonical data operations
            </p>
          </div>
        </aside>

        {/* MAIN */}

        <div className="min-w-0">
          {/* MOBILE HEADER */}

          <header
            className="
              border-b
              px-4
              py-4

              lg:hidden
            "
            style={{
              borderColor:
                theme.colors.border,

              backgroundColor:
                `${theme.colors.background}F2`,
            }}
          >
            <div
              className="
                flex
                items-center
                justify-between
                gap-4
              "
            >
              <div>
                <p
                  className="
                    text-[8px]
                    uppercase
                    tracking-[0.22em]
                  "
                  style={{
                    color:
                      theme.colors.textMuted,
                  }}
                >
                  Barça Data Operations
                </p>

                <p className="mt-1 text-sm font-medium">
                  Admin Control Room
                </p>
              </div>

              <Link
                href="/"
                aria-label="Back to Command Center"
                className="
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  border
                "
                style={{
                  borderColor:
                    theme.colors.border,

                  color:
                    theme.colors.textMuted,
                }}
              >
                <ArrowLeft
                  size={15}
                />
              </Link>
            </div>

            <nav
              className="
                scrollbar-subtle
                mt-4
                flex
                overflow-x-auto
                border-t
              "
              style={{
                borderColor:
                  theme.colors.border,
              }}
            >
              {navigation.map(
                ({
                  label,
                  href,
                  icon:
                    Icon,
                }) => {
                  const active =
                    isActive(
                      pathname,
                      href,
                    );

                  return (
                    <Link
                      key={href}
                      href={href}
                      className="
                        flex
                        shrink-0
                        items-center
                        gap-2
                        border-b-2
                        px-3
                        py-3
                      "
                      style={{
                        borderColor:
                          active
                            ? theme.colors.accent
                            : "transparent",

                        color:
                          active
                            ? theme.colors.text
                            : theme.colors.textMuted,
                      }}
                    >
                      <Icon
                        size={13}
                      />

                      <span
                        className="
                          text-[9px]
                          uppercase
                          tracking-[0.1em]
                        "
                      >
                        {
                          label
                        }
                      </span>
                    </Link>
                  );
                },
              )}
            </nav>
          </header>

          <div
            className="
              px-4
              py-5

              sm:px-6

              lg:px-8
              lg:py-7

              xl:px-10
            "
          >
            {
              children
            }
          </div>
        </div>
      </div>
    </main>
  );
}

function isActive(
  pathname:
    string,

  href:
    string,
) {
  if (
    href ===
    "/admin"
  ) {
    return (
      pathname ===
      "/admin"
    );
  }

  return (
    pathname ===
      href ||
    pathname.startsWith(
      `${href}/`,
    )
  );
}
"use client";

import {
  useLayoutEffect,
  useState,
} from "react";

import type {
  ReactNode,
} from "react";

import StadiumRail, { MobileHeaderActions } from "./StadiumRail";
import BrandHomeLink from "./BrandHomeLink";
import ThemeScrollbarSync from "../theme/ThemeScrollbarSync";

import {
  getTheme,
  isKitType,
  type KitTheme,
  type KitType,
} from "../../lib/themes";

const KIT_STORAGE_KEY =
  "barca-dashboard-kit";

type DashboardSectionShellProps = {
  title:
    string;

  season:
    string;

  theme:
    KitTheme;

  children:
    ReactNode;
};

export function useDashboardSectionTheme(
  season:
    string,
) {
  const [
    kit,
    setKit,
  ] =
    useState<KitType>(
      "home",
    );

  const [
    loaded,
    setLoaded,
  ] =
    useState(
      false,
    );

  useLayoutEffect(() => {
    try {
      const saved = window.localStorage.getItem(KIT_STORAGE_KEY);

      if (isKitType(saved)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the persisted kit before the browser paints
        setKit(saved);
      }
    } catch {
      // Storage can be unavailable in private browsing. Keep the home kit.
    } finally {
      setLoaded(true);
    }
  }, []);

  const theme =
    getTheme(
      season,
      kit,
    );

  return {
    kit,
    theme,
    loaded,
  };
}

export default function DashboardSectionShell({
  title,
  season,
  theme,
  children,
}: DashboardSectionShellProps) {
  return (
    <main
      className="
        theme-environment
        relative
        min-h-screen
        overflow-x-clip

        px-3
        py-4

        sm:px-4

        lg:px-5
        lg:py-5
        max-lg:pb-[calc(5.5rem+env(safe-area-inset-bottom))]
      "
      style={{
        backgroundColor:
          theme.colors.background,

        color:
          theme.colors.text,
      }}
    >
      <ThemeScrollbarSync
        theme={
          theme
        }
      />

      {/* ENVIRONMENT */}

      <div
        className="
          pointer-events-none
          fixed
          inset-0
          transition-all
          duration-700
        "
        style={{
          background: `
            linear-gradient(
              90deg,
              ${theme.colors.background} 0%,
              ${theme.colors.backgroundElevated} 48%,
              ${theme.colors.background} 100%
            )
          `,
        }}
      />

      {/* GRID TEXTURE */}

      <div
        className="
          pointer-events-none
          fixed
          inset-0
          opacity-[0.035]
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
            "72px 72px",
        }}
      />

      {/* KIT STRIPE */}

      <div
        className="
          pointer-events-none
          fixed
          left-0
          top-0
          h-full
          w-1.25
        "
      >
        <div
          className="
            h-1/2
            w-full
          "
          style={{
            backgroundColor:
              theme.colors.primary,
          }}
        />

        <div
          className="
            h-1/2
            w-full
          "
          style={{
            backgroundColor:
              theme.colors.secondary,
          }}
        />
      </div>

      {/* CONTENT */}

      <div
        className="
          relative
          mx-auto
          max-w-[1700px]
        "
      >
        {/* GLOBAL SECTION HEADER */}

        <header
          className="
            mb-5
            flex
            flex-col
            gap-3
            px-1

            sm:flex-row
            sm:items-end
            sm:justify-between
          "
        >
          <div className="flex min-w-0 items-center justify-between gap-2">
            <BrandHomeLink title={title} />
            <MobileHeaderActions theme={theme} />
          </div>

          <div
            className="
              text-xs
              uppercase
              tracking-[0.16em]

              sm:text-xs
            "
            style={{
              color:
                theme.colors.textMuted,
            }}
          >
            {season}

            {" • "}

            {
              theme.label
            }
          </div>
        </header>

        {/* COMPACT NAV */}

        <div
          className="
            mb-5

            lg:hidden
          "
        >
          <StadiumRail
            theme={
              theme
            }
            variant="compact"
          />
        </div>

        {/* SECTION GRID */}

        <div
          className="
            grid
            grid-cols-1
            gap-x-5
            gap-y-7

            lg:grid-cols-[150px_minmax(0,1fr)]

            xl:grid-cols-[160px_minmax(0,1fr)]
          "
        >
          {/* DESKTOP STADIUM RAIL */}

          <div
            className="
              hidden

              lg:block
            "
          >
            <StadiumRail
              theme={
                theme
              }
              variant="desktop"
            />
          </div>

          {/* PAGE */}

          <div
            className="
              min-w-0
            "
          >
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}

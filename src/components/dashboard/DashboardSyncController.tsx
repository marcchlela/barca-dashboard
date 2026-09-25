"use client";

import {
  useEffect,
  useRef,
} from "react";

import {
  useRouter,
} from "next/navigation";

import type {
  MatchState,
} from "../dev/DevControls";

/*
|--------------------------------------------------------------------------
| Existing working sync endpoints
|--------------------------------------------------------------------------
|
| These already update PostgreSQL from football-data.org.
|
| Before public deployment we'll move synchronization behind a proper
| server-side scheduler/authenticated internal endpoint.
|--------------------------------------------------------------------------
*/

const MATCHES_SYNC_ENDPOINT =
  "/api/dev/sync-football-data/matches";

const COMPETITION_SYNC_ENDPOINT =
  "/api/dev/sync-football-data";

/*
|--------------------------------------------------------------------------
| Local freshness markers
|--------------------------------------------------------------------------
*/

const LAST_MATCHES_SYNC_KEY =
  "barca-dashboard-last-matches-sync";

const LAST_COMPETITION_SYNC_KEY =
  "barca-dashboard-last-competition-sync";

/*
|--------------------------------------------------------------------------
| Cadence
|--------------------------------------------------------------------------
*/

const SECOND =
  1000;

const MINUTE =
  60 * SECOND;

const COMPETITION_SYNC_INTERVAL =
  15 * MINUTE;

const CHECK_INTERVAL =
  30 * SECOND;

type DashboardSyncControllerProps = {
  matchState:
    MatchState;
};

export default function DashboardSyncController({
  matchState,
}: DashboardSyncControllerProps) {
  const router =
    useRouter();

  /*
   * Prevent two syncs from running
   * simultaneously.
   */
  const syncingRef =
    useRef(false);

  useEffect(() => {
    let cancelled =
      false;

    /*
    |--------------------------------------------------------------------------
    | Sync check
    |--------------------------------------------------------------------------
    */

    async function syncIfDue(
      force = false,
    ) {
      if (
        cancelled ||
        syncingRef.current
      ) {
        return;
      }

      /*
       * Don't waste requests while the
       * browser believes we're offline.
       */
      if (
        typeof navigator !==
          "undefined" &&
        navigator.onLine ===
          false
      ) {
        return;
      }

      const now =
        Date.now();

      const matchInterval =
        getMatchSyncInterval(
          matchState,
        );

      const lastMatchesSync =
        readTimestamp(
          LAST_MATCHES_SYNC_KEY,
        );

      const lastCompetitionSync =
        readTimestamp(
          LAST_COMPETITION_SYNC_KEY,
        );

      const matchesDue =
        force ||
        now -
          lastMatchesSync >=
          matchInterval;

      const competitionDue =
        force ||
        now -
          lastCompetitionSync >=
          COMPETITION_SYNC_INTERVAL;

      if (
        !matchesDue &&
        !competitionDue
      ) {
        return;
      }

      syncingRef.current =
        true;

      let databaseChanged =
        false;

      try {
        /*
        |--------------------------------------------------------------------------
        | MATCHES
        |--------------------------------------------------------------------------
        |
        | This is the important one for:
        |
        | scheduled → live
        | live → finished
        | scores
        | next/previous fixture movement
        |--------------------------------------------------------------------------
        */

        if (matchesDue) {
          const success =
            await runSync(
              MATCHES_SYNC_ENDPOINT,
            );

          if (success) {
            writeTimestamp(
              LAST_MATCHES_SYNC_KEY,
              Date.now(),
            );

            databaseChanged =
              true;
          }
        }

        /*
        |--------------------------------------------------------------------------
        | COMPETITION / STANDINGS
        |--------------------------------------------------------------------------
        |
        | Doesn't need live-frequency polling.
        |--------------------------------------------------------------------------
        */

        if (
          competitionDue
        ) {
          const success =
            await runSync(
              COMPETITION_SYNC_ENDPOINT,
            );

          if (success) {
            writeTimestamp(
              LAST_COMPETITION_SYNC_KEY,
              Date.now(),
            );

            databaseChanged =
              true;
          }
        }

        /*
        |--------------------------------------------------------------------------
        | Refresh Server Components
        |--------------------------------------------------------------------------
        |
        | PostgreSQL has now been updated.
        |
        | router.refresh() causes page.tsx →
        | getDashboardOverview() to read the fresh data.
        |--------------------------------------------------------------------------
        */

        if (
          databaseChanged &&
          !cancelled
        ) {
          router.refresh();
        }
      } catch (error) {
        /*
         * Sync failure should NEVER take
         * down an otherwise usable dashboard.
         */

        console.warn(
          "BACKGROUND FOOTBALL DATA SYNC FAILED:",
          error,
        );
      } finally {
        syncingRef.current =
          false;
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Initial freshness check
    |--------------------------------------------------------------------------
    |
    | Small delay lets the dashboard render first.
    |--------------------------------------------------------------------------
    */

    const initialTimer =
      window.setTimeout(
        () => {
          void syncIfDue();
        },
        1500,
      );

    /*
    |--------------------------------------------------------------------------
    | Background checker
    |--------------------------------------------------------------------------
    |
    | This timer runs every 30 seconds,
    | but network requests only happen
    | when the relevant freshness interval
    | has actually expired.
    |--------------------------------------------------------------------------
    */

    const interval =
      window.setInterval(
        () => {
          void syncIfDue();
        },
        CHECK_INTERVAL,
      );

    /*
    |--------------------------------------------------------------------------
    | Tab becomes visible again
    |--------------------------------------------------------------------------
    |
    | Useful if the laptop has been asleep
    | or you've had another tab open for a while.
    |--------------------------------------------------------------------------
    */

    function handleVisibilityChange() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void syncIfDue();
      }
    }

    function handleWindowFocus() {
      void syncIfDue();
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    window.addEventListener(
      "focus",
      handleWindowFocus,
    );

    return () => {
      cancelled =
        true;

      window.clearTimeout(
        initialTimer,
      );

      window.clearInterval(
        interval,
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );

      window.removeEventListener(
        "focus",
        handleWindowFocus,
      );
    };
  }, [
    matchState,
    router,
  ]);

  /*
   * No visible UI.
   *
   * This component exists purely to keep
   * dashboard data fresh.
   */
  return null;
}

/*
|--------------------------------------------------------------------------
| Match refresh cadence
|--------------------------------------------------------------------------
*/

function getMatchSyncInterval(
  state:
    MatchState,
) {
  switch (state) {
    /*
     * During an actual live game we care
     * about status changes quickly.
     */
    case "live":
      return 1 * MINUTE;

    /*
     * On matchday, fixtures/status can change
     * more frequently than on normal days.
     */
    case "matchday":
      return 2 * MINUTE;

    /*
     * Shortly after a match we want the final
     * status/result to settle quickly.
     */
    case "fulltime":
      return 2 * MINUTE;

    /*
     * Ordinary dashboard usage.
     */
    default:
      return 10 * MINUTE;
  }
}

/*
|--------------------------------------------------------------------------
| Run one sync endpoint
|--------------------------------------------------------------------------
*/

async function runSync(
  endpoint:
    string,
) {
  const response =
    await fetch(
      endpoint,
      {
        method:
          "POST",

        cache:
          "no-store",
      },
    );

  if (!response.ok) {
    console.warn(
      `Sync request failed: ${endpoint} (${response.status})`,
    );

    return false;
  }

  const result =
    (await response.json()) as {
      ok?: boolean;
    };

  if (
    result.ok ===
    false
  ) {
    console.warn(
      `Sync endpoint returned failure: ${endpoint}`,
      result,
    );

    return false;
  }

  return true;
}

/*
|--------------------------------------------------------------------------
| Timestamp helpers
|--------------------------------------------------------------------------
*/

function readTimestamp(
  key:
    string,
) {
  try {
    const value =
      window.localStorage.getItem(
        key,
      );

    if (!value) {
      return 0;
    }

    const number =
      Number(value);

    if (
      !Number.isFinite(
        number,
      )
    ) {
      return 0;
    }

    return number;
  } catch {
    return 0;
  }
}

function writeTimestamp(
  key:
    string,

  value:
    number,
) {
  try {
    window.localStorage.setItem(
      key,
      String(value),
    );
  } catch {
    /*
     * If localStorage is unavailable,
     * syncing can still work.
     *
     * It just won't preserve throttling
     * across browser refreshes.
     */
  }
}
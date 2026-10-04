import "server-only";

const API_BASES = [
  "https://api.sofascore.com/api/v1",
  "https://www.sofascore.com/api/v1",
] as const;

const REQUEST_TIMEOUT_MS =
  12_000;

export type SofaScoreTeam = {
  id:
    number;

  name:
    string;

  shortName?:
    string;

  slug?:
    string;
};

export type SofaScoreScheduledEvent = {
  id:
    number;

  startTimestamp?:
    number;

  homeTeam:
    SofaScoreTeam;

  awayTeam:
    SofaScoreTeam;

  status?: {
    type?:
      string;
  };
};

export type SofaScoreLineupPlayer = {
  player: {
    id:
      number;

    name:
      string;

    shortName?:
      string;

    slug?:
      string;
  };

  substitute?:
    boolean;

  statistics?: {
    minutesPlayed?:
      number;
  };
};

export type SofaScoreLineups = {
  home?: {
    players?:
      SofaScoreLineupPlayer[];
  };

  away?: {
    players?:
      SofaScoreLineupPlayer[];
  };
};

export type SofaScoreHeatmapPoint = {
  x:
    number;

  y:
    number;
};

type ScheduledEventsResponse = {
  events?:
    SofaScoreScheduledEvent[];
};

type HeatmapResponse = {
  heatmap?:
    SofaScoreHeatmapPoint[];
};

/*
|--------------------------------------------------------------------------
| Scheduled events
|--------------------------------------------------------------------------
*/

export async function fetchSofaScoreScheduledEvents(
  date:
    string,
) {
  const primary =
    await requestJson<ScheduledEventsResponse>(
      `/sport/football/scheduled-events/${date}`,
    );

  const primaryEvents =
    primary?.events ??
    [];

  if (
    primaryEvents.length >
    0
  ) {
    return primaryEvents;
  }

  /*
   * Some schedule dates expose additional
   * rows through the inverse endpoint.
   */

  const inverse =
    await requestJson<ScheduledEventsResponse>(
      `/sport/football/scheduled-events/${date}/inverse`,
    );

  return (
    inverse?.events ??
    []
  );
}

/*
|--------------------------------------------------------------------------
| Lineups
|--------------------------------------------------------------------------
*/

export async function fetchSofaScoreLineups(
  eventId:
    number,
) {
  return requestJson<SofaScoreLineups>(
    `/event/${eventId}/lineups`,
  );
}

/*
|--------------------------------------------------------------------------
| Player heatmap
|--------------------------------------------------------------------------
*/

export async function fetchSofaScorePlayerHeatmap(
  eventId:
    number,

  playerId:
    number,
) {
  const response =
    await requestJson<HeatmapResponse>(
      `/event/${eventId}/player/${playerId}/heatmap`,
    );

  const points =
    response?.heatmap ??
    [];

  return points
    .filter(
      (
        point,
      ) =>
        Number.isFinite(
          point.x,
        ) &&
        Number.isFinite(
          point.y,
        ),
    )
    .map(
      (
        point,
      ) => ({
        x:
          clamp(
            point.x,
            0,
            100,
          ),

        y:
          clamp(
            point.y,
            0,
            100,
          ),
      }),
    );
}

/*
|--------------------------------------------------------------------------
| HTTP
|--------------------------------------------------------------------------
|
| Important:
|
| This uses ordinary public HTTP requests only.
|
| We do NOT:
| - solve browser challenges
| - obtain Cloudflare clearance cookies
| - use proxies
| - emulate a logged-in user
|
| If both public hosts reject us, the provider is considered unavailable
| for this integration and the sync should fail normally.
|--------------------------------------------------------------------------
*/

async function requestJson<T>(
  path:
    string,
): Promise<T | null> {
  let lastError:
    Error | null =
    null;

  for (
    const baseUrl
    of API_BASES
  ) {
    try {
      return await requestFromBase<T>(
        baseUrl,
        path,
      );
    } catch (
      error
    ) {
      const normalized =
        error instanceof Error
          ? error
          : new Error(
              String(
                error,
              ),
            );

      lastError =
        normalized;

      /*
       * Only try the alternate public host
       * for access/network/server failures.
       *
       * A real 404 means the requested
       * resource simply does not exist.
       */

      if (
        normalized.message.includes(
          "404",
        )
      ) {
        return null;
      }
    }
  }

  throw (
    lastError ??
    new Error(
      `SofaScore request failed (${path}).`,
    )
  );
}

async function requestFromBase<T>(
  baseUrl:
    string,

  path:
    string,
): Promise<T | null> {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      REQUEST_TIMEOUT_MS,
    );

  try {
    const response =
      await fetch(
        `${baseUrl}${path}`,
        {
          method:
            "GET",

          cache:
            "no-store",

          signal:
            controller.signal,

          headers: {
            Accept:
              "application/json, text/plain, */*",

            "Accept-Language":
              "en-US,en;q=0.9",

            /*
             * Conventional XHR marker used by
             * the site's public web requests.
             */
            "X-Requested-With":
              "XMLHttpRequest",

            /*
             * Keep our application identity
             * honest rather than pretending
             * to be a browser.
             */
            "User-Agent":
              "BarcaDashboard/1.0",
          },
        },
      );

    if (
      response.status ===
      404
    ) {
      return null;
    }

    if (
      !response.ok
    ) {
      const body =
        await response
          .text()
          .catch(
            () => "",
          );

      const compactBody =
        body
          .replace(
            /\s+/g,
            " ",
          )
          .trim()
          .slice(
            0,
            180,
          );

      throw new Error(
        [
          "SofaScore request failed:",
          `${response.status}`,
          response.statusText,
          `host=${baseUrl}`,
          `path=${path}`,
          compactBody
            ? `body=${compactBody}`
            : "",
        ]
          .filter(
            Boolean,
          )
          .join(
            " ",
          ),
      );
    }

    return (
      await response.json()
    ) as T;
  } catch (
    error
  ) {
    if (
      error instanceof Error &&
      error.name ===
        "AbortError"
    ) {
      throw new Error(
        `SofaScore request timed out: host=${baseUrl} path=${path}`,
      );
    }

    throw error;
  } finally {
    clearTimeout(
      timeout,
    );
  }
}

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function clamp(
  value:
    number,

  minimum:
    number,

  maximum:
    number,
) {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value,
    ),
  );
}
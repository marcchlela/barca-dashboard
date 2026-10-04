import "server-only";

const BASE_URL =
  "https://api.pitchapi.dev/v1";

const REQUEST_TIMEOUT_MS =
  15_000;

export type PitchApiTeam = {
  id:
    string;

  name:
    string;
};

export type PitchApiMatch = {
  id:
    string;

  date:
    string;

  time_utc:
    string;

  status:
    string;

  home_team:
    PitchApiTeam;

  away_team:
    PitchApiTeam;

  score_home:
    number | null;

  score_away:
    number | null;
};

type DateResponse = {
  data: {
    matches:
      PitchApiMatch[];
  };
};

export type PitchHeatmapPlayer = {
  player: {
    id:
      string;

    name:
      string;

    shirt_number?:
      number | string | null;
  };

  team:
    PitchApiTeam;

  side:
    "home" | "away";

  actions:
    number;

  cells:
    [
      number,
      number,
      number,
    ][];
};

export type PitchHeatmapResponse = {
  data: {
    match_id:
      string;

    grid: {
      length:
        number;

      width:
        number;

      frame:
        string;

      cell_length_m?:
        number;

      cell_width_m?:
        number;
    };

    teams: Array<{
      team:
        PitchApiTeam;

      side:
        "home" | "away";

      actions:
        number;

      cells:
        [
          number,
          number,
          number,
        ][];
    }>;

    players:
      PitchHeatmapPlayer[];
  };
};

/*
|--------------------------------------------------------------------------
| Public functions
|--------------------------------------------------------------------------
*/

export async function fetchPitchApiDate(
  date:
    string,
) {
  return requestJson<DateResponse>(
    `/date/${encodeURIComponent(
      date,
    )}`,
  );
}

export async function fetchPitchApiHeatmaps(
  matchId:
    string,
) {
  /*
   * acting_ltr is exactly what we want
   * for player season aggregation:
   *
   * Every player attacks toward the
   * same end regardless of home/away.
   */

  return requestJson<PitchHeatmapResponse>(
    `/matches/${encodeURIComponent(
      matchId,
    )}/heatmaps?frame=acting_ltr`,
  );
}

/*
|--------------------------------------------------------------------------
| HTTP
|--------------------------------------------------------------------------
*/

async function requestJson<T>(
  path:
    string,
): Promise<T> {
  const key =
    process.env
      .PITCH_API_KEY;

  if (!key) {
    throw new Error(
      "PITCH_API_KEY is not configured.",
    );
  }

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
        `${BASE_URL}${path}`,
        {
          method:
            "GET",

          cache:
            "no-store",

          signal:
            controller.signal,

          headers: {
            Accept:
              "application/json",

            "X-API-KEY":
              key,
          },
        },
      );

    const body =
      await response.text();

    if (
      !response.ok
    ) {
      const compactBody =
        body
          .replace(
            /\s+/g,
            " ",
          )
          .trim()
          .slice(
            0,
            300,
          );

      throw new Error(
        [
          "PitchAPI request failed:",
          response.status,
          response.statusText,
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

    return JSON.parse(
      body,
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
        `PitchAPI request timed out (${path}).`,
      );
    }

    throw error;
  } finally {
    clearTimeout(
      timeout,
    );
  }
}
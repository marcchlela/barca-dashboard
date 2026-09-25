import {
  FOOTBALL_DATA_BASE_URL,
  FOOTBALL_DATA_IDS,
} from "./constants";

import type {
  FootballDataCompetition,
  FootballDataMatchesResponse,
  FootballDataStandingsResponse,
  FootballDataTeam,
} from "./types";

function getApiKey() {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  if (!apiKey) {
    throw new Error(
      "FOOTBALL_DATA_API_KEY is missing from the environment.",
    );
  }

  return apiKey;
}

async function footballDataRequest<T>(
  path: string,
): Promise<T> {
  const response = await fetch(
    `${FOOTBALL_DATA_BASE_URL}${path}`,
    {
      headers: {
        "X-Auth-Token": getApiKey(),
      },

      // We will control caching ourselves later.
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `football-data.org request failed: ${response.status} ${response.statusText}\n${body}`,
    );
  }

  return (await response.json()) as T;
}

export function getBarcelonaTeam() {
  return footballDataRequest<FootballDataTeam>(
    `/teams/${FOOTBALL_DATA_IDS.teams.barcelona}`,
  );
}

export function getLaLigaCompetition() {
  return footballDataRequest<FootballDataCompetition>(
    `/competitions/${FOOTBALL_DATA_IDS.competitions.laLiga}`,
  );
}

export function getLaLigaStandings() {
  return footballDataRequest<FootballDataStandingsResponse>(
    `/competitions/${FOOTBALL_DATA_IDS.competitions.laLiga}/standings`,
  );
}

export function getLaLigaMatches() {
  return footballDataRequest<FootballDataMatchesResponse>(
    `/competitions/${FOOTBALL_DATA_IDS.competitions.laLiga}/matches`,
  );
}

export function getBarcelonaMatches() {
  return footballDataRequest<FootballDataMatchesResponse>(
    `/teams/${FOOTBALL_DATA_IDS.teams.barcelona}/matches`,
  );
}
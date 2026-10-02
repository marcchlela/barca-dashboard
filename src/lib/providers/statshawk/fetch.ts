import "server-only";

import { StatsHawkClient } from "./client";

import {
  normalizeStatsHawkBoxscore,
  normalizeStatsHawkRoster,
  statsHawkCandidate,
  statsHawkTeamReference,
} from "./normalize";

import type {
  StatsHawkMatchBundle,
  StatsHawkRosterPlayer,
} from "./types";

import {
  asArray,
} from "../shared/json";

import {
  matchTeamIdentity,
  resolveMatchIdentity,
  type MatchIdentityInput,
} from "../shared/match-identity";

type CompetitionConfig = {
  slug:
    | "laliga"
    | "ucl";

  providerName:
    string;
};

type CachedRoster = {
  expiresAt: number;

  players:
    StatsHawkRosterPlayer[];
};

const ROSTER_TTL_MS =
  6 * 60 * 60 * 1000;

const rosterCache =
  new Map<
    string,
    CachedRoster
  >();

function competitionConfig(
  competitionName: string,
): CompetitionConfig {
  const normalized =
    competitionName.toLowerCase();

  if (
    normalized.includes(
      "champions",
    )
  ) {
    return {
      slug:
        "ucl",

      providerName:
        "UEFA Champions League",
    };
  }

  if (
    normalized.includes(
      "primera",
    ) ||
    normalized.includes(
      "la liga",
    ) ||
    normalized.includes(
      "laliga",
    )
  ) {
    return {
      slug:
        "laliga",

      providerName:
        "La Liga",
    };
  }

  throw new Error(
    `StatsHawk production provider does not support competition "${competitionName}".`,
  );
}

function seasonYear(
  kickoff: string,
) {
  const year =
    Number(
      kickoff.slice(
        0,
        4,
      ),
    );

  const month =
    Number(
      kickoff.slice(
        5,
        7,
      ),
    );

  if (
    !Number.isFinite(
      year,
    ) ||
    !Number.isFinite(
      month,
    )
  ) {
    throw new Error(
      `Invalid kickoff "${kickoff}".`,
    );
  }

  return month >= 7
    ? year
    : year - 1;
}

async function rosterForTeam(
  client: StatsHawkClient,
  teamProviderId: string,
) {
  const cached =
    rosterCache.get(
      teamProviderId,
    );

  if (
    cached &&
    cached.expiresAt >
      Date.now()
  ) {
    return cached.players;
  }

  const response =
    await client.get(
      `/teams/${encodeURIComponent(
        teamProviderId,
      )}/roster`,
      3,
    );

  const players =
    normalizeStatsHawkRoster(
      response,
    );

  rosterCache.set(
    teamProviderId,
    {
      expiresAt:
        Date.now() +
        ROSTER_TTL_MS,

      players,
    },
  );

  return players;
}

export async function fetchStatsHawkMatchBundle(
  internal: MatchIdentityInput,
  options?: {
    includeBarcelonaRoster?: boolean;
  },
): Promise<StatsHawkMatchBundle> {
  const config =
    competitionConfig(
      internal.competition.name,
    );

  const client =
    new StatsHawkClient(
      12,
    );

  const edition =
    seasonYear(
      internal.kickoff,
    );

  const date =
    internal.kickoff.slice(
      0,
      10,
    );

  const schedule =
    await client.get(
      `/competitions/${encodeURIComponent(
        config.slug,
      )}/editions/${edition}/games?date=${encodeURIComponent(
        date,
      )}`,
      2,
    );

  const candidates =
    asArray(
      schedule.data,
      "items",
      "games",
      "contests",
    )
      .map(
        (value) => ({
          value,

          candidate:
            statsHawkCandidate(
              value,
              config.providerName,
            ),
        }),
      )
      .filter(
        (
          row,
        ): row is {
          value: unknown;

          candidate: NonNullable<
            ReturnType<
              typeof statsHawkCandidate
            >
          >;
        } =>
          row.candidate !==
          null,
      );

  const resolved =
    candidates.find(
      ({ candidate }) => {
        const identity =
          resolveMatchIdentity(
            internal,
            {
              providerMatchId:
                candidate.providerMatchId,

              kickoff:
                candidate.kickoff,

              calendarDate:
                candidate.calendarDate,

              localTime:
                null,

              temporalPrecision:
                candidate.kickoff
                  ? "exact"
                  : candidate.calendarDate
                    ? "date_only"
                    : "unknown",

              homeTeam:
                candidate.homeTeam,

              awayTeam:
                candidate.awayTeam,

              homeScore:
                candidate.homeScore,

              awayScore:
                candidate.awayScore,

              competition:
                candidate.competition,
            },

            "statshawk",
          );

        return identity.matched;
      },
    );

  if (
    !resolved ||
    !resolved.candidate
      .providerMatchId
  ) {
    throw new Error(
      "No StatsHawk fixture passed the hardened target-match resolver.",
    );
  }

  const providerMatchId =
    resolved.candidate
      .providerMatchId;

  const detail =
    await client.get(
      `/contests/${encodeURIComponent(
        providerMatchId,
      )}`,
      1,
    );

  const detailCandidate =
    statsHawkCandidate(
      detail.data,
      config.providerName,
    );

  if (
    !detailCandidate
  ) {
    throw new Error(
      "StatsHawk contest detail did not contain usable match identity.",
    );
  }

  const detailResolution =
    resolveMatchIdentity(
      internal,
      {
        providerMatchId:
          detailCandidate.providerMatchId,

        kickoff:
          detailCandidate.kickoff,

        calendarDate:
          detailCandidate.calendarDate,

        localTime:
          null,

        temporalPrecision:
          detailCandidate.kickoff
            ? "exact"
            : detailCandidate.calendarDate
              ? "date_only"
              : "unknown",

        homeTeam:
          detailCandidate.homeTeam,

        awayTeam:
          detailCandidate.awayTeam,

        homeScore:
          detailCandidate.homeScore,

        awayScore:
          detailCandidate.awayScore,

        competition:
          detailCandidate.competition,
      },

      "statshawk",
    );

  if (
    !detailResolution.matched
  ) {
    throw new Error(
      "StatsHawk contest detail failed the hardened identity re-check.",
    );
  }

  const home =
    statsHawkTeamReference(
      detail.data,
      "home",
    );

  const away =
    statsHawkTeamReference(
      detail.data,
      "away",
    );

  if (
    !home.id ||
    !away.id
  ) {
    throw new Error(
      "StatsHawk contest detail did not provide both provider team IDs.",
    );
  }

  const homeName =
    home.name ??
    detailCandidate.homeTeam;

  const awayName =
    away.name ??
    detailCandidate.awayTeam;

  const boxscore =
    await client.get(
      `/contests/${encodeURIComponent(
        providerMatchId,
      )}/boxscore`,
      2,
    );

  /*
   * Box-score lines expose team IDs but don't always repeat team names.
   * Supply names from the already-validated contest detail.
   */
  const playerStatistics =
    normalizeStatsHawkBoxscore(
      boxscore,
      {
        [home.id]:
          homeName,

        [away.id]:
          awayName,
      },
    );

  let barcelonaTeamProviderId:
    | string
    | null = null;

  if (
    matchTeamIdentity(
      "FC Barcelona",
      homeName,
    ).matched
  ) {
    barcelonaTeamProviderId =
      home.id;
  } else if (
    matchTeamIdentity(
      "FC Barcelona",
      awayName,
    ).matched
  ) {
    barcelonaTeamProviderId =
      away.id;
  }

  const barcelonaRoster =
    options
      ?.includeBarcelonaRoster &&
    barcelonaTeamProviderId
      ? await rosterForTeam(
          client,
          barcelonaTeamProviderId,
        )
      : [];

  return {
    providerMatchId,

    competitionSlug:
      config.slug,

    candidate:
      detailCandidate,

    homeTeamProviderId:
      home.id,

    awayTeamProviderId:
      away.id,

    homeTeamName:
      homeName,

    awayTeamName:
      awayName,

    playerStatistics,

    barcelonaTeamProviderId,

    barcelonaRoster,

    usage:
      client.usage(),
  };
}
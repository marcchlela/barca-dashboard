import "server-only";

import {
  BigBallsClient,
} from "./client";

import {
  bigBallsCandidate,
  normalizeBigBallsBundle,
} from "./normalize";

import type {
  BigBallsMatchBundle,
} from "./types";

import {
  asArray,
} from "../shared/json";

import {
  resolveMatchIdentity,
  type MatchIdentityInput,
} from "../shared/match-identity";

type CachedMatchBundle = {
  expiresAt:
    number;

  promise:
    Promise<BigBallsMatchBundle>;
};

type CompetitionConfig = {
  league:
    "laliga" | "cl";
};

/*
 * The base rich-match sync and canonical merger can request
 * the same Big Balls bundle during one workflow.
 *
 * Cache it so we never spend quota twice for the same match.
 */
const MATCH_BUNDLE_TTL_MS =
  15 * 60 * 1000;

const matchBundleCache =
  new Map<
    string,
    CachedMatchBundle
  >();

function competitionConfig(
  competitionName:
    string,
): CompetitionConfig {
  const normalized =
    competitionName
      .toLowerCase()
      .trim();

  if (
    normalized.includes(
      "champions",
    ) ||
    normalized ===
      "ucl" ||
    normalized ===
      "cl"
  ) {
    return {
      league:
        "cl",
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
      league:
        "laliga",
    };
  }

  throw new Error(
    `Big Balls production provider does not support competition "${competitionName}".`,
  );
}

function matchCacheKey(
  internal:
    MatchIdentityInput,
) {
  /*
   * Deliberately ignore providerIds.
   *
   * A provider mapping can be persisted between the base
   * provider stage and canonical merge. That must not turn
   * the same football match into a different cache entry.
   */
  return JSON.stringify({
    kickoff:
      internal.kickoff,

    competition:
      internal.competition
        .name,

    home:
      internal.homeTeam
        .name,

    away:
      internal.awayTeam
        .name,

    homeScore:
      internal.score.home,

    awayScore:
      internal.score.away,
  });
}

async function resolveProviderMatchId(
  client:
    BigBallsClient,

  internal:
    MatchIdentityInput,

  league:
    CompetitionConfig["league"],
) {
  /*
   * Once we have an exact persisted mapping, prefer it over
   * another list/search request.
   *
   * The detail endpoint is still revalidated below against
   * immutable match facts before any data is trusted.
   */
  const mappedId =
    internal.providerIds[
      "big-balls-data"
    ];

  if (mappedId) {
    return mappedId;
  }

  const date =
    internal.kickoff.slice(
      0,
      10,
    );

  const listBody =
    await client.get(
      `/v1/matches?sport=football&league=${encodeURIComponent(
        league,
      )}&date=${encodeURIComponent(
        date,
      )}&limit=200`,
    );

  const found =
    asArray(
      listBody.data,
    )
      .map(
        (row) => ({
          row,

          candidate:
            bigBallsCandidate(
              row,
            ),
        }),
      )
      .find(
        ({
          candidate,
        }) =>
          candidate &&
          resolveMatchIdentity(
            internal,
            candidate,
          ).matched,
      );

  const providerMatchId =
    found?.candidate
      ?.providerMatchId;

  if (!providerMatchId) {
    throw new Error(
      `No Big Balls ${league} fixture passed the hardened target-match resolver.`,
    );
  }

  return providerMatchId;
}

async function fetchBigBallsMatchBundleUncached(
  internal:
    MatchIdentityInput,
): Promise<BigBallsMatchBundle> {
  const client =
    new BigBallsClient();

  const config =
    competitionConfig(
      internal.competition
        .name,
    );

  const providerMatchId =
    await resolveProviderMatchId(
      client,
      internal,
      config.league,
    );

  const encoded =
    encodeURIComponent(
      providerMatchId,
    );

  const [
    detailBody,
    teamStatsBody,
    storedStatsBody,
  ] =
    await Promise.all([
      client.get(
        `/v1/matches/${encoded}?sport=football`,
      ),

      client.get(
        `/v1/matches/${encoded}/statistics`,
      ),

      client.get(
        `/v1/stored/matches/${encoded}/stats`,
      ),
    ]);

  /*
   * Even an exact persisted provider mapping is never trusted
   * blindly.
   *
   * Re-check date/kickoff, teams, score and competition.
   */
  const detailCandidate =
    bigBallsCandidate(
      detailBody.data,
    );

  if (
    !detailCandidate ||
    !resolveMatchIdentity(
      internal,
      detailCandidate,
    ).matched
  ) {
    throw new Error(
      "Big Balls fixture detail failed immutable-fact validation.",
    );
  }

  return normalizeBigBallsBundle({
    providerMatchId,

    detailBody,

    teamStatsBody,

    storedStatsBody,

    requestCount:
      client.requestCount,
  });
}

export function fetchBigBallsMatchBundle(
  internal:
    MatchIdentityInput,
): Promise<BigBallsMatchBundle> {
  const key =
    matchCacheKey(
      internal,
    );

  const existing =
    matchBundleCache.get(
      key,
    );

  if (
    existing &&
    existing.expiresAt >
      Date.now()
  ) {
    return existing.promise;
  }

  if (existing) {
    matchBundleCache.delete(
      key,
    );
  }

  const promise =
    fetchBigBallsMatchBundleUncached(
      internal,
    ).catch(
      (error) => {
        const current =
          matchBundleCache.get(
            key,
          );

        if (
          current?.promise ===
          promise
        ) {
          matchBundleCache.delete(
            key,
          );
        }

        throw error;
      },
    );

  matchBundleCache.set(
    key,
    {
      expiresAt:
        Date.now() +
        MATCH_BUNDLE_TTL_MS,

      promise,
    },
  );

  return promise;
}
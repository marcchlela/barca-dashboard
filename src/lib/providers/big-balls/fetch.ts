import "server-only";

import { BigBallsClient } from "./client";

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
  expiresAt: number;

  promise:
    Promise<BigBallsMatchBundle>;
};

/*
 * The base rich-match sync and the canonical player merger
 * both need the same Big Balls match bundle.
 *
 * Do not pay for the same provider requests twice during
 * one backfill / QA workflow.
 */
const MATCH_BUNDLE_TTL_MS =
  15 * 60 * 1000;

const matchBundleCache =
  new Map<
    string,
    CachedMatchBundle
  >();

function matchCacheKey(
  internal: MatchIdentityInput,
) {
  /*
   * Deliberately ignore providerIds here.
   *
   * A base sync may persist a provider mapping before the
   * canonical merge runs, which would otherwise change the
   * cache key even though this is still the exact same match.
   */
  return JSON.stringify({
    kickoff:
      internal.kickoff,

    competition:
      internal.competition.name,

    home:
      internal.homeTeam.name,

    away:
      internal.awayTeam.name,

    homeScore:
      internal.score.home,

    awayScore:
      internal.score.away,
  });
}

async function fetchBigBallsMatchBundleUncached(
  internal: MatchIdentityInput,
): Promise<BigBallsMatchBundle> {
  const client =
    new BigBallsClient();

  const date =
    internal.kickoff.slice(
      0,
      10,
    );

  const listBody =
    await client.get(
      `/v1/matches?sport=football&league=laliga&date=${date}&limit=200`,
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
      "No Big Balls fixture passed the hardened target-match resolver.",
    );
  }

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
  internal: MatchIdentityInput,
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
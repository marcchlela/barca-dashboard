import "server-only";

import {
  GoalApiClient,
} from "./client";

import {
  goalCandidate,
  normalizeGoalBundle,
} from "./normalize";

import type {
  GoalMatchBundle,
} from "./types";

import {
  asArray,
  asObject,
} from "../shared/json";

import {
  resolveMatchIdentity,
  type MatchIdentityInput,
} from "../shared/match-identity";

type CachedGoalBundle = {
  expiresAt: number;

  promise:
    Promise<GoalMatchBundle>;
};

const GOAL_BUNDLE_TTL_MS =
  15 * 60 * 1000;

const goalBundleCache =
  new Map<
    string,
    CachedGoalBundle
  >();

function cacheKey(
  internal:
    MatchIdentityInput,
) {
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

async function fetchGoalMatchBundleUncached(
  internal:
    MatchIdentityInput,
): Promise<GoalMatchBundle> {
  const client =
    new GoalApiClient();

  const date =
    internal.kickoff.slice(
      0,
      10,
    );

  let providerMatchId:
    | string
    | null = null;

  for (
    const offset
    of [
      0,
      100,
      200,
    ]
  ) {
    const body =
      await client.get(
        `/fixtures?from=${date}&to=${date}&limit=100&offset=${offset}`,
      );

    const rows =
      asArray(
        body.data,
      );

    for (
      const row
      of rows
    ) {
      const candidate =
        goalCandidate(
          row,
        );

      if (
        candidate
          ?.providerMatchId &&
        resolveMatchIdentity(
          internal,
          candidate,
        ).matched
      ) {
        providerMatchId =
          candidate.providerMatchId;

        break;
      }
    }

    if (
      providerMatchId
    ) {
      break;
    }

    const pagination =
      asObject(
        body.pagination,
      );

    if (
      pagination?.hasMore !==
        true ||
      rows.length < 100
    ) {
      break;
    }
  }

  if (!providerMatchId) {
    throw new Error(
      "No GOAL fixture passed the hardened target-match resolver.",
    );
  }

  const encoded =
    encodeURIComponent(
      providerMatchId,
    );

  const [
    detailBody,
    lineupBody,
    eventBody,
    statisticsBody,
  ] =
    await Promise.all([
      client.get(
        `/fixtures/${encoded}`,
      ),

      client.get(
        `/fixtures/${encoded}/lineups`,
      ),

      client.get(
        `/fixtures/${encoded}/events`,
      ),

      client.get(
        `/fixtures/${encoded}/statistics`,
      ),
    ]);

  const detailCandidate =
    goalCandidate(
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
      "GOAL fixture detail failed immutable-fact validation.",
    );
  }

  return normalizeGoalBundle({
    providerMatchId,

    detailBody,

    lineupBody,

    eventBody,

    statisticsBody,

    requestCount:
      client.requestCount,
  });
}

export function fetchGoalMatchBundle(
  internal:
    MatchIdentityInput,
): Promise<GoalMatchBundle> {
  const key =
    cacheKey(
      internal,
    );

  const cached =
    goalBundleCache.get(
      key,
    );

  if (
    cached &&
    cached.expiresAt >
      Date.now()
  ) {
    return cached.promise;
  }

  if (cached) {
    goalBundleCache.delete(
      key,
    );
  }

  const promise =
    fetchGoalMatchBundleUncached(
      internal,
    ).catch(
      (error) => {
        const current =
          goalBundleCache.get(
            key,
          );

        if (
          current?.promise ===
          promise
        ) {
          goalBundleCache.delete(
            key,
          );
        }

        throw error;
      },
    );

  goalBundleCache.set(
    key,
    {
      expiresAt:
        Date.now() +
        GOAL_BUNDLE_TTL_MS,

      promise,
    },
  );

  return promise;
}
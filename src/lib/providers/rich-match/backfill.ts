import "server-only";

import { db } from "../../../prisma/db";

import {
  isBigBallsQuotaError,
  type BigBallsQuotaError,
} from "../big-balls/client";

import {
  syncBigBallsFallbackMatch,
} from "./big-balls-fallback";

import {
  persistCanonicalPlayerStatistics,
} from "./persist-canonical-player-stats";

import {
  syncRichMatch,
} from "./sync";

type CoverageLevel =
  | "full-rich"
  | "partial-big-balls"
  | "deferred-quota"
  | "failed";

type CanonicalPlayerSummary = {
  persisted: boolean;

  mergedPlayers: number;

  fieldsFilledByStatsHawk:
    number;

  conflicts: number;

  conflictDetails:
    unknown[];

  bigBallsResolved:
    number;

  statsHawkResolved:
    number;

  statsHawkUnresolved:
    number;

  writePlan:
    unknown;

  counts:
    unknown | null;
};

type QuotaInfo = {
  exhausted:
    boolean;

  remaining:
    number | null;

  reset:
    string | null;

  retryAfter:
    string | null;
};

type BackfillMatchResult = {
  matchId: string;

  kickoff: string;

  competition: string;

  home: string;

  away: string;

  score: string;

  ok: boolean;

  deferred: boolean;

  coverageLevel:
    CoverageLevel;

  dryRun: boolean;

  fallbackReason:
    | string
    | null;

  error:
    | string
    | null;

  sync:
    unknown | null;

  canonicalPlayerStats:
    | CanonicalPlayerSummary
    | null;
};

/*
 * Our Prisma/ORM date-time values are Temporal.Instant-like,
 * not native JavaScript Date instances.
 *
 * We only need to serialize kickoff, so use the smallest
 * structural contract possible instead of assuming Date.
 */
type SerializableInstant = {
  toString(): string;
};

type DeferredMatchInput = {
  id: string;

  kickoff:
    SerializableInstant;

  homeScore:
    | number
    | null;

  awayScore:
    | number
    | null;

  homeTeam: {
    name: string;
  };

  awayTeam: {
    name: string;
  };

  competition: {
    name: string;
  };
};

function errorMessage(
  error: unknown,
) {
  return error instanceof Error
    ? error.message
    : String(error);
}

function isGoalAvailabilityFailure(
  error: unknown,
) {
  return errorMessage(
    error,
  ).includes(
    "No GOAL fixture passed the hardened target-match resolver.",
  );
}

function quotaInfo(
  error:
    BigBallsQuotaError,
): QuotaInfo {
  return {
    exhausted:
      true,

    remaining:
      error.remaining,

    reset:
      error.reset,

    retryAfter:
      error.retryAfter,
  };
}

function canonicalSummary(
  result:
    Awaited<
      ReturnType<
        typeof persistCanonicalPlayerStatistics
      >
    >,
): CanonicalPlayerSummary {
  return {
    persisted:
      result.persisted,

    mergedPlayers:
      result.merge.players,

    fieldsFilledByStatsHawk:
      result.merge
        .fieldsFilledByStatsHawk,

    conflicts:
      result.merge.conflicts,

    conflictDetails:
      result.merge
        .conflictDetails,

    bigBallsResolved:
      result.identity
        .bigBallsResolved,

    statsHawkResolved:
      result.identity
        .statsHawkResolved,

    statsHawkUnresolved:
      result.identity
        .statsHawkUnresolved
        .length,

    writePlan:
      result.writePlan,

    counts:
      "counts" in result
        ? result.counts
        : null,
  };
}

function deferredResult(
  match:
    DeferredMatchInput,

  dryRun:
    boolean,

  reason:
    string,
): BackfillMatchResult {
  return {
    matchId:
      match.id,

    kickoff:
      match.kickoff
        .toString(),

    competition:
      match.competition
        .name,

    home:
      match.homeTeam.name,

    away:
      match.awayTeam.name,

    score:
      `${match.homeScore ?? "?"}-${match.awayScore ?? "?"}`,

    ok:
      false,

    deferred:
      true,

    coverageLevel:
      "deferred-quota",

    dryRun,

    fallbackReason:
      null,

    error:
      reason,

    sync:
      null,

    canonicalPlayerStats:
      null,
  };
}

export async function backfillCurrentRichSeason(
  input: {
    dryRun: boolean;

    competitionCodes?:
      string[];
  },
) {
  const season =
    await db.orm.public.Season
      .where({
        isCurrent:
          true,
      })
      .first();

  if (!season) {
    throw new Error(
      "No current season exists in the database.",
    );
  }

  const barcelona =
    await db.orm.public.Team
      .where({
        isBarcelona:
          true,
      })
      .first();

  if (!barcelona) {
    throw new Error(
      "FC Barcelona does not exist in the database.",
    );
  }

  const matches =
    await db.orm.public.Match
      .where({
        seasonId:
          season.id,

        status:
          "finished",
      })
      .include(
        "homeTeam",
      )
      .include(
        "awayTeam",
      )
      .include(
        "competition",
      )
      .orderBy(
        (match) =>
          match.kickoff.asc(),
      )
      .all();

  const barcelonaMatches =
    matches.filter(
      (match) =>
        match.homeTeamId ===
          barcelona.id ||
        match.awayTeamId ===
          barcelona.id,
    );

  const selectedMatches =
    input.competitionCodes &&
    input.competitionCodes
      .length > 0
      ? barcelonaMatches.filter(
          (match) =>
            input
              .competitionCodes!
              .includes(
                match.competition
                  .code,
              ),
        )
      : barcelonaMatches;

  const results:
    BackfillMatchResult[] =
    [];

  let quota:
    QuotaInfo = {
      exhausted:
        false,

      remaining:
        null,

      reset:
        null,

      retryAfter:
        null,
    };

  for (
    let index = 0;
    index <
    selectedMatches.length;
    index += 1
  ) {
    const match =
      selectedMatches[
        index
      ];

    const label =
      `${match.homeTeam.name} ${match.homeScore ?? "?"}-${match.awayScore ?? "?"} ${match.awayTeam.name}`;

    console.log(
      `[RICH BACKFILL] ${input.dryRun ? "DRY RUN" : "SYNC"}: ${label}`,
    );

    let coverageLevel:
      CoverageLevel =
      "failed";

    let fallbackReason:
      | string
      | null =
      null;

    let baseSync:
      unknown | null =
      null;

    /*
     * PHASE 1
     *
     * GOAL + Big Balls when GOAL exists.
     * Big Balls fallback when GOAL has no verified fixture.
     */
    try {
      baseSync =
        await syncRichMatch({
          matchId:
            match.id,

          dryRun:
            input.dryRun,
        });

      coverageLevel =
        "full-rich";
    } catch (error) {
      /*
       * Stop immediately when the daily Big Balls quota is gone.
       * Do NOT waste requests on the remaining fixtures.
       */
      if (
        isBigBallsQuotaError(
          error,
        )
      ) {
        quota =
          quotaInfo(
            error,
          );

        const reason =
          errorMessage(
            error,
          );

        console.warn(
          `[RICH BACKFILL] Big Balls quota exhausted at ${label}. Deferring the rest of the run.`,
        );

        results.push(
          deferredResult(
            match,
            input.dryRun,
            reason,
          ),
        );

        for (
          let remainingIndex =
            index + 1;
          remainingIndex <
          selectedMatches.length;
          remainingIndex += 1
        ) {
          results.push(
            deferredResult(
              selectedMatches[
                remainingIndex
              ],
              input.dryRun,
              "Deferred because Big Balls quota was exhausted earlier in this run.",
            ),
          );
        }

        break;
      }

      if (
        !isGoalAvailabilityFailure(
          error,
        )
      ) {
        const message =
          errorMessage(
            error,
          );

        console.error(
          `[RICH BACKFILL] BASE SYNC FAILED: ${label}:`,
          message,
        );

        results.push({
          matchId:
            match.id,

          kickoff:
            match.kickoff
              .toString(),

          competition:
            match.competition
              .name,

          home:
            match.homeTeam
              .name,

          away:
            match.awayTeam
              .name,

          score:
            `${match.homeScore ?? "?"}-${match.awayScore ?? "?"}`,

          ok:
            false,

          deferred:
            false,

          coverageLevel:
            "failed",

          dryRun:
            input.dryRun,

          fallbackReason:
            null,

          error:
            message,

          sync:
            null,

          canonicalPlayerStats:
            null,
        });

        continue;
      }

      fallbackReason =
        errorMessage(
          error,
        );

      console.warn(
        `[RICH BACKFILL] GOAL unavailable for ${label}; trying Big Balls fallback.`,
      );

      try {
        baseSync =
          await syncBigBallsFallbackMatch(
            {
              matchId:
                match.id,

              dryRun:
                input.dryRun,

              goalFailureReason:
                fallbackReason,
            },
          );

        coverageLevel =
          "partial-big-balls";
      } catch (
        fallbackError
      ) {
        if (
          isBigBallsQuotaError(
            fallbackError,
          )
        ) {
          quota =
            quotaInfo(
              fallbackError,
            );

          const reason =
            errorMessage(
              fallbackError,
            );

          console.warn(
            `[RICH BACKFILL] Big Balls quota exhausted during fallback for ${label}. Deferring the rest of the run.`,
          );

          results.push(
            deferredResult(
              match,
              input.dryRun,
              reason,
            ),
          );

          for (
            let remainingIndex =
              index + 1;
            remainingIndex <
            selectedMatches.length;
            remainingIndex += 1
          ) {
            results.push(
              deferredResult(
                selectedMatches[
                  remainingIndex
                ],
                input.dryRun,
                "Deferred because Big Balls quota was exhausted earlier in this run.",
              ),
            );
          }

          break;
        }

        const message =
          errorMessage(
            fallbackError,
          );

        console.error(
          `[RICH BACKFILL] FALLBACK FAILED: ${label}:`,
          message,
        );

        results.push({
          matchId:
            match.id,

          kickoff:
            match.kickoff
              .toString(),

          competition:
            match.competition
              .name,

          home:
            match.homeTeam
              .name,

          away:
            match.awayTeam
              .name,

          score:
            `${match.homeScore ?? "?"}-${match.awayScore ?? "?"}`,

          ok:
            false,

          deferred:
            false,

          coverageLevel:
            "failed",

          dryRun:
            input.dryRun,

          fallbackReason,

          error:
            message,

          sync:
            null,

          canonicalPlayerStats:
            null,
        });

        continue;
      }
    }

    /*
     * PHASE 2
     *
     * Big Balls primary + StatsHawk field/identity fallback.
     */
    try {
      const canonical =
        await persistCanonicalPlayerStatistics(
          {
            matchId:
              match.id,

            dryRun:
              input.dryRun,
          },
        );

      results.push({
        matchId:
          match.id,

        kickoff:
          match.kickoff
            .toString(),

        competition:
          match.competition
            .name,

        home:
          match.homeTeam
            .name,

        away:
          match.awayTeam
            .name,

        score:
          `${match.homeScore ?? "?"}-${match.awayScore ?? "?"}`,

        ok:
          true,

        deferred:
          false,

        coverageLevel,

        dryRun:
          input.dryRun,

        fallbackReason,

        error:
          null,

        sync:
          baseSync,

        canonicalPlayerStats:
          canonicalSummary(
            canonical,
          ),
      });
    } catch (
      canonicalError
    ) {
      /*
       * Normally the canonical merger should reuse the cached
       * Big Balls payload. Still handle a 429 defensively.
       */
      if (
        isBigBallsQuotaError(
          canonicalError,
        )
      ) {
        quota =
          quotaInfo(
            canonicalError,
          );

        const reason =
          errorMessage(
            canonicalError,
          );

        console.warn(
          `[RICH BACKFILL] Big Balls quota exhausted during canonical merge for ${label}. Deferring the rest of the run.`,
        );

        results.push(
          deferredResult(
            match,
            input.dryRun,
            reason,
          ),
        );

        for (
          let remainingIndex =
            index + 1;
          remainingIndex <
          selectedMatches.length;
          remainingIndex += 1
        ) {
          results.push(
            deferredResult(
              selectedMatches[
                remainingIndex
              ],
              input.dryRun,
              "Deferred because Big Balls quota was exhausted earlier in this run.",
            ),
          );
        }

        break;
      }

      const message =
        errorMessage(
          canonicalError,
        );

      console.error(
        `[RICH BACKFILL] CANONICAL PLAYER SYNC FAILED: ${label}:`,
        message,
      );

      results.push({
        matchId:
          match.id,

        kickoff:
          match.kickoff
            .toString(),

        competition:
          match.competition
            .name,

        home:
          match.homeTeam
            .name,

        away:
          match.awayTeam
            .name,

        score:
          `${match.homeScore ?? "?"}-${match.awayScore ?? "?"}`,

        ok:
          false,

        deferred:
          false,

        coverageLevel,

        dryRun:
          input.dryRun,

        fallbackReason,

        error:
          `Canonical player-stat merge failed: ${message}`,

        sync:
          baseSync,

        canonicalPlayerStats:
          null,
      });
    }
  }

  const succeeded =
    results.filter(
      (result) =>
        result.ok,
    ).length;

  const deferred =
    results.filter(
      (result) =>
        result.deferred,
    ).length;

  const failed =
    results.filter(
      (result) =>
        !result.ok &&
        !result.deferred,
    ).length;

  const fullRich =
    results.filter(
      (result) =>
        result.ok &&
        result.coverageLevel ===
          "full-rich",
    ).length;

  const partialBigBalls =
    results.filter(
      (result) =>
        result.ok &&
        result.coverageLevel ===
          "partial-big-balls",
    ).length;

  const canonicalReady =
    results.filter(
      (result) =>
        result.ok &&
        result.canonicalPlayerStats !==
          null,
    ).length;

  const canonicalConflicts =
    results.reduce(
      (
        total,
        result,
      ) =>
        total +
        (
          result
            .canonicalPlayerStats
            ?.conflicts ??
          0
        ),
      0,
    );

  const fieldsFilledByStatsHawk =
    results.reduce(
      (
        total,
        result,
      ) =>
        total +
        (
          result
            .canonicalPlayerStats
            ?.fieldsFilledByStatsHawk ??
          0
        ),
      0,
    );

  return {
    season: {
      id:
        season.id,

      label:
        season.label,

      startYear:
        season.startYear,

      endYear:
        season.endYear,
    },

    mode:
      input.dryRun
        ? "dry-run"
        : "write",

    competitionCodes:
      input.competitionCodes ??
      null,

    matchesFound:
      selectedMatches.length,

    succeeded,

    deferred,

    failed,

    quota,

    coverage: {
      fullRich,

      partialBigBalls,
    },

    canonical: {
      ready:
        canonicalReady,

      conflicts:
        canonicalConflicts,

      fieldsFilledByStatsHawk,
    },

    allProcessed:
      failed === 0 &&
      deferred === 0,

    allCanonicalReady:
      failed === 0 &&
      deferred === 0 &&
      canonicalReady ===
        selectedMatches.length,

    allFullRich:
      failed === 0 &&
      deferred === 0 &&
      partialBigBalls ===
        0,

    results,
  };
}
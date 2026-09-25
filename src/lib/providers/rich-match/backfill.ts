import "server-only";

import { db } from "../../../prisma/db";
import { syncBigBallsFallbackMatch } from "./big-balls-fallback";
import { syncRichMatch } from "./sync";

type CoverageLevel =
  | "full-rich"
  | "partial-big-balls"
  | "failed";

type BackfillMatchResult = {
  matchId: string;
  kickoff: string;
  competition: string;
  home: string;
  away: string;
  score: string;

  ok: boolean;

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

export async function backfillCurrentRichSeason(
  input: {
    dryRun: boolean;
    competitionCodes?: string[];
  },
) {
  const season =
    await db.orm.public.Season
      .where({
        isCurrent: true,
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
        isBarcelona: true,
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
      .include("homeTeam")
      .include("awayTeam")
      .include("competition")
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
    input.competitionCodes.length >
      0
      ? barcelonaMatches.filter(
          (match) =>
            input.competitionCodes!.includes(
              match.competition.code,
            ),
        )
      : barcelonaMatches;

  const results: BackfillMatchResult[] =
    [];

  for (
    const match
    of selectedMatches
  ) {
    const label =
      `${match.homeTeam.name} ${match.homeScore ?? "?"}-${match.awayScore ?? "?"} ${match.awayTeam.name}`;

    console.log(
      `[RICH BACKFILL] ${input.dryRun ? "DRY RUN" : "SYNC"}: ${label}`,
    );

    try {
      const sync =
        await syncRichMatch({
          matchId:
            match.id,

          dryRun:
            input.dryRun,
        });

      results.push({
        matchId:
          match.id,

        kickoff:
          match.kickoff.toString(),

        competition:
          match.competition.name,

        home:
          match.homeTeam.name,

        away:
          match.awayTeam.name,

        score:
          `${match.homeScore ?? "?"}-${match.awayScore ?? "?"}`,

        ok:
          true,

        coverageLevel:
          "full-rich",

        dryRun:
          input.dryRun,

        fallbackReason:
          null,

        error:
          null,

        sync,
      });

      continue;
    } catch (error) {
      if (
        !isGoalAvailabilityFailure(
          error,
        )
      ) {
        const message =
          errorMessage(error);

        console.error(
          `[RICH BACKFILL] FAILED: ${label}:`,
          message,
        );

        results.push({
          matchId:
            match.id,

          kickoff:
            match.kickoff.toString(),

          competition:
            match.competition.name,

          home:
            match.homeTeam.name,

          away:
            match.awayTeam.name,

          score:
            `${match.homeScore ?? "?"}-${match.awayScore ?? "?"}`,

          ok:
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
        });

        continue;
      }

      /*
       * GOAL coverage is missing.
       *
       * Do not throw away the entire match.
       * Attempt the verified Big Balls La Liga fallback.
       */
      const goalFailure =
        errorMessage(error);

      console.warn(
        `[RICH BACKFILL] GOAL unavailable for ${label}; trying Big Balls fallback.`,
      );

      try {
        const fallback =
          await syncBigBallsFallbackMatch(
            {
              matchId:
                match.id,

              dryRun:
                input.dryRun,

              goalFailureReason:
                goalFailure,
            },
          );

        results.push({
          matchId:
            match.id,

          kickoff:
            match.kickoff.toString(),

          competition:
            match.competition.name,

          home:
            match.homeTeam.name,

          away:
            match.awayTeam.name,

          score:
            `${match.homeScore ?? "?"}-${match.awayScore ?? "?"}`,

          ok:
            true,

          coverageLevel:
            "partial-big-balls",

          dryRun:
            input.dryRun,

          fallbackReason:
            goalFailure,

          error:
            null,

          sync:
            fallback,
        });
      } catch (
        fallbackError
      ) {
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
            match.kickoff.toString(),

          competition:
            match.competition.name,

          home:
            match.homeTeam.name,

          away:
            match.awayTeam.name,

          score:
            `${match.homeScore ?? "?"}-${match.awayScore ?? "?"}`,

          ok:
            false,

          coverageLevel:
            "failed",

          dryRun:
            input.dryRun,

          fallbackReason:
            goalFailure,

          error:
            message,

          sync:
            null,
        });
      }
    }
  }

  const succeeded =
    results.filter(
      (result) =>
        result.ok,
    ).length;

  const failed =
    results.filter(
      (result) =>
        !result.ok,
    ).length;

  const fullRich =
    results.filter(
      (result) =>
        result.coverageLevel ===
        "full-rich",
    ).length;

  const partialBigBalls =
    results.filter(
      (result) =>
        result.coverageLevel ===
        "partial-big-balls",
    ).length;

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

    failed,

    coverage: {
      fullRich,
      partialBigBalls,
    },

    allProcessed:
      failed === 0,

    allFullRich:
      failed === 0 &&
      partialBigBalls === 0,

    results,
  };
}
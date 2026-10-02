import "server-only";

import {
  db,
} from "../../../prisma/db";

import {
  syncOfficialMatchMediaBatch,
} from "./match-media";

const DEFAULT_EXTRA_MEDIA_WINDOW_HOURS =
  96;

const DEFAULT_MISSING_HIGHLIGHT_LOOKBACK_DAYS =
  14;

type WorkerReason =
  | "missing-highlight"
  | "collecting-extra-media"
  | "complete-window-expired"
  | "stale-missing-highlight"
  | "forced";

export async function runAutomaticMatchMediaWorker(
  input: {
    dryRun:
      boolean;

    forceAllFinished?:
      boolean;

    extraMediaWindowHours?:
      number;

    missingHighlightLookbackDays?:
      number;
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
        (
          match,
        ) =>
          match.kickoff.asc(),
      )
      .all();

  const barcelonaMatches =
    matches.filter(
      (
        match,
      ) =>
        match.homeTeamId ===
          barcelona.id ||
        match.awayTeamId ===
          barcelona.id,
    );

  const now =
    Date.now();

  const extraMediaWindowHours =
    input.extraMediaWindowHours ??
    DEFAULT_EXTRA_MEDIA_WINDOW_HOURS;

  const missingHighlightLookbackDays =
    input.missingHighlightLookbackDays ??
    DEFAULT_MISSING_HIGHLIGHT_LOOKBACK_DAYS;

  const decisions:
    Array<{
      matchId:
        string;

      kickoff:
        string;

      home:
        string;

      away:
        string;

      score:
        string;

      competition:
        string;

      hasOfficialHighlight:
        boolean;

      officialMediaCount:
        number;

      ageHours:
        number;

      eligible:
        boolean;

      reason:
        WorkerReason;
    }> =
    [];

  for (
    const match
    of barcelonaMatches
  ) {
    const media =
      await db.orm.public.MediaItem
        .where({
          matchId:
            match.id,
        })
        .all();

    const officialMedia =
      media.filter(
        (
          item,
        ) =>
          item.isOfficial,
      );

    const hasOfficialHighlight =
      officialMedia.some(
        (
          item,
        ) =>
          item.type ===
          "match_highlight",
      );

    const kickoff =
      match.kickoff
        .toString();

    const ageHours =
      Math.max(
        0,
        (
          now -
          new Date(
            kickoff,
          ).getTime()
        ) /
          (
            60 *
            60 *
            1000
          ),
      );

    let eligible =
      false;

    let reason:
      WorkerReason;

    if (
      input.forceAllFinished
    ) {
      eligible =
        true;

      reason =
        "forced";
    } else if (
      !hasOfficialHighlight
    ) {
      if (
        ageHours <=
        missingHighlightLookbackDays *
          24
      ) {
        eligible =
          true;

        reason =
          "missing-highlight";
      } else {
        reason =
          "stale-missing-highlight";
      }
    } else if (
      ageHours <=
      extraMediaWindowHours
    ) {
      /*
       * The main highlight may be uploaded first.
       *
       * Keep checking the same fixture for a few days because Barça
       * may later publish Un Dia De Partit, an interview, press
       * conference or another useful match-specific video.
       */
      eligible =
        true;

      reason =
        "collecting-extra-media";
    } else {
      reason =
        "complete-window-expired";
    }

    decisions.push({
      matchId:
        match.id,

      kickoff,

      home:
        match.homeTeam
          .name,

      away:
        match.awayTeam
          .name,

      score:
        `${match.homeScore ?? "?"}-${match.awayScore ?? "?"}`,

      competition:
        match.competition
          .name,

      hasOfficialHighlight,

      officialMediaCount:
        officialMedia.length,

      ageHours:
        Math.round(
          ageHours *
            10,
        ) /
        10,

      eligible,

      reason,
    });
  }

  const eligibleMatches =
    decisions.filter(
      (
        decision,
      ) =>
        decision.eligible,
    );

  const batch =
    await syncOfficialMatchMediaBatch({
      matchIds:
        eligibleMatches.map(
          (
            decision,
          ) =>
            decision.matchId,
        ),

      dryRun:
        input.dryRun,
    });

  const batchByMatch =
    new Map(
      batch.results.map(
        (
          result,
        ) => [
          result.matchId,
          result,
        ],
      ),
    );

  const results =
    decisions.map(
      (
        decision,
      ) => {
        const sync =
          batchByMatch.get(
            decision.matchId,
          ) ??
          null;

        return {
          ...decision,

          sync:
            sync
              ? {
                  ok:
                    sync.ok,

                  accepted:
                    sync.accepted.map(
                      (
                        candidate,
                      ) => ({
                        videoId:
                          candidate.videoId,

                        title:
                          candidate.title,

                        type:
                          candidate.type,

                        score:
                          candidate.score,
                      }),
                    ),

                  writePlan:
                    sync.writePlan,

                  persisted:
                    sync.persisted,

                  error:
                    sync.error,
                }
              : null,
        };
      },
    );

  const failed =
    batch.results.filter(
      (
        result,
      ) =>
        !result.ok,
    ).length;

  const acceptedCandidates =
    batch.results.reduce(
      (
        total,
        result,
      ) =>
        total +
        result.accepted.length,
      0,
    );

  return {
    season: {
      id:
        season.id,

      label:
        season.label,
    },

    mode:
      input.dryRun
        ? "dry-run"
        : "write",

    policy: {
      extraMediaWindowHours,

      missingHighlightLookbackDays,

      forceAllFinished:
        input.forceAllFinished ??
        false,
    },

    counts: {
      finishedBarcelonaMatches:
        barcelonaMatches.length,

      eligible:
        eligibleMatches.length,

      skipped:
        decisions.length -
        eligibleMatches.length,

      missingHighlight:
        decisions.filter(
          (
            decision,
          ) =>
            decision.reason ===
            "missing-highlight",
        ).length,

      collectingExtraMedia:
        decisions.filter(
          (
            decision,
          ) =>
            decision.reason ===
            "collecting-extra-media",
        ).length,

      staleMissingHighlight:
        decisions.filter(
          (
            decision,
          ) =>
            decision.reason ===
            "stale-missing-highlight",
        ).length,

      completeWindowExpired:
        decisions.filter(
          (
            decision,
          ) =>
            decision.reason ===
            "complete-window-expired",
        ).length,

      failed,

      acceptedCandidates,
    },

    youtube:
      batch.youtube,

    writePlan:
      batch.writePlan,

    allProcessed:
      failed ===
      0,

    results,
  };
}
import "server-only";

import {
  Temporal,
} from "temporal-polyfill";

import {
  db,
} from "../../../prisma/db";

import type {
  MatchMediaCandidate,
} from "./match-media";

const REVIEW_MIN_SCORE =
  50;

export type ReviewQueuePlan = {
  queued:
    number;

  refreshed:
    number;

  removedPending:
    number;

  preservedReviewed:
    number;
};

export function makeEmptyReviewQueuePlan():
  ReviewQueuePlan {
  return {
    queued:
      0,

    refreshed:
      0,

    removedPending:
      0,

    preservedReviewed:
      0,
  };
}

export async function syncMediaReviewQueue(
  input: {
    seasonId:
      string;

    matchId:
      string;

    dataSourceId:
      string;

    accepted:
      MatchMediaCandidate[];

    rejected:
      MatchMediaCandidate[];
  },
): Promise<ReviewQueuePlan> {
  const plan =
    makeEmptyReviewQueuePlan();

  /*
  |--------------------------------------------------------------------------
  | Automatically accepted candidates
  |--------------------------------------------------------------------------
  |
  | If a candidate was previously pending review but is now considered safe
  | enough for automatic canonical media, remove that pending review item.
  |--------------------------------------------------------------------------
  */

  for (
    const candidate
    of input.accepted
  ) {
    const existing =
      await db.orm.public.MediaReviewCandidate
        .where({
          dataSourceId:
            input.dataSourceId,

          externalMediaId:
            candidate.videoId,

          matchId:
            input.matchId,
        })
        .first();

    if (
      existing &&
      existing.status ===
        "pending"
    ) {
      await db.orm.public.MediaReviewCandidate
        .where({
          id:
            existing.id,
        })
        .delete();

      plan.removedPending +=
        1;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Ambiguous rejected candidates
  |--------------------------------------------------------------------------
  */

  for (
    const candidate
    of input.rejected
  ) {
    if (
      !shouldQueueCandidate(
        candidate,
      )
    ) {
      continue;
    }

    const existing =
      await db.orm.public.MediaReviewCandidate
        .where({
          dataSourceId:
            input.dataSourceId,

          externalMediaId:
            candidate.videoId,

          matchId:
            input.matchId,
        })
        .first();

    const nextData = {
      seasonId:
        input.seasonId,

      matchId:
        input.matchId,

      dataSourceId:
        input.dataSourceId,

      externalMediaId:
        candidate.videoId,

      type:
        candidate.type,

      title:
        candidate.title,

      url:
        candidate.url,

      thumbnailUrl:
        candidate.thumbnailUrl,

      publishedAt:
        Temporal.Instant.from(
          candidate.publishedAt,
        ),

      durationSeconds:
        candidate.durationSeconds,

      embeddable:
        candidate.embeddable,

      score:
        candidate.score,

      reasons:
        candidate.reasons,

      lastSeenAt:
        Temporal.Now.instant(),
    };

    /*
    |--------------------------------------------------------------------------
    | New review candidate
    |--------------------------------------------------------------------------
    */

    if (!existing) {
      await db.orm.public.MediaReviewCandidate
        .create({
          ...nextData,

          status:
            "pending",

          reviewedAt:
            null,

          reviewNote:
            null,
        });

      plan.queued +=
        1;

      continue;
    }

    /*
    |--------------------------------------------------------------------------
    | Existing pending candidate
    |--------------------------------------------------------------------------
    */

    if (
      existing.status ===
      "pending"
    ) {
      await db.orm.public.MediaReviewCandidate
        .where({
          id:
            existing.id,
        })
        .update(
          nextData,
        );

      plan.refreshed +=
        1;

      continue;
    }

    /*
    |--------------------------------------------------------------------------
    | Existing human-reviewed candidate
    |--------------------------------------------------------------------------
    |
    | Refresh the scorer evidence, but NEVER put an approved/rejected item
    | back into Pending automatically.
    |--------------------------------------------------------------------------
    */

    await db.orm.public.MediaReviewCandidate
      .where({
        id:
          existing.id,
      })
      .update(
        nextData,
      );

    plan.preservedReviewed +=
      1;
  }

  return plan;
}

function shouldQueueCandidate(
  candidate:
    MatchMediaCandidate,
) {
  if (
    candidate.accepted
  ) {
    return false;
  }

  if (
    !candidate.embeddable
  ) {
    return false;
  }

  if (
    candidate.score <
    REVIEW_MIN_SCORE
  ) {
    return false;
  }

  /*
   * Require a genuine opponent signal.
   */

  if (
    !candidate.reasons.includes(
      "opponent-name:+40",
    )
  ) {
    return false;
  }

  /*
   * Hard-excluded categories should remain ignored instead of filling
   * the human review inbox.
   */

  if (
    candidate.reasons.some(
      (
        reason,
      ) =>
        reason.startsWith(
          "excluded-category:",
        ),
    )
  ) {
    return false;
  }

  return true;
}
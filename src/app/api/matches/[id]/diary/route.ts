import {
  NextResponse,
} from "next/server";
import { Temporal } from "temporal-polyfill";
import { resolveWatchedAt, validWatchedOn } from "../../../../../lib/my-barca/watch-date";

import {
  db,
} from "../../../../../prisma/db";

type RouteContext = {
  params: Promise<{
    id:
      string;
  }>;
};

type DiaryInput = {
  watched?:
    unknown;

  watchType?:
    unknown;

  watchedOn?:
    unknown;

  rating?:
    unknown;

  favouritePlayerId?:
    unknown;

  favouriteGoalEventId?:
    unknown;

  notes?:
    unknown;
};

const GOAL_TYPES =
  new Set([
    "goal",
    "penalty_goal",
    "own_goal",
  ]);

export async function PUT(
  request:
    Request,

  context:
    RouteContext,
) {
  try {
    const {
      id: matchId,
    } =
      await context.params;

    if (
      !isUuid(
        matchId,
      )
    ) {
      return errorResponse(
        "Invalid match ID.",
        400,
      );
    }

    const match =
      await db.orm.public.Match
        .where({
          id:
            matchId,
        })
        .include(
          "homeTeam",
        )
        .include(
          "awayTeam",
        )
        .first();

    if (!match) {
      return errorResponse(
        "Match not found.",
        404,
      );
    }

    if (
      !match.homeTeam
        .isBarcelona &&
      !match.awayTeam
        .isBarcelona
    ) {
      return errorResponse(
        "Diary entries are only supported for FC Barcelona matches.",
        400,
      );
    }

    /*
     * My Match is a post-match diary.
     *
     * This is enforced here as well as in the UI so future,
     * scheduled or live fixtures cannot be rated through the API.
     */
    if (
      match.status !==
      "finished"
    ) {
      return errorResponse(
        "My Match unlocks after the match has finished.",
        409,
      );
    }

    const body =
      (
        await request.json()
      ) as DiaryInput;

    const parsed =
      parseDiaryInput(
        body,
      );

    if (
      !parsed.ok
    ) {
      return errorResponse(
        parsed.error,
        400,
      );
    }

    if (
      parsed.value
        .favouritePlayerId
    ) {
      const playerStatistic =
        await db.orm.public.PlayerMatchStatistic
          .where({
            matchId,

            playerId:
              parsed.value
                .favouritePlayerId,
          })
          .include(
            "team",
          )
          .first();

      const lineupMembership =
        playerStatistic
          ? null
          : await findBarcelonaLineupPlayer(
              matchId,

              parsed.value
                .favouritePlayerId,

              match.homeTeamId,

              match.awayTeamId,

              match.homeTeam
                .isBarcelona,
            );

      if (
        (
          !playerStatistic ||
          !playerStatistic
            .team
            .isBarcelona
        ) &&
        !lineupMembership
      ) {
        return errorResponse(
          "Man of the Match must be a Barcelona player from this match.",
          400,
        );
      }
    }

    if (
      parsed.value
        .favouriteGoalEventId
    ) {
      const event =
        await db.orm.public.MatchEvent
          .where({
            id:
              parsed.value
                .favouriteGoalEventId,

            matchId,
          })
          .include(
            "team",
          )
          .first();

      if (
        !event ||
        !GOAL_TYPES.has(
          event.type,
        ) ||
        event.team
          ?.isBarcelona !==
          true
      ) {
        return errorResponse(
          "Favourite goal must be a Barcelona goal from this match.",
          400,
        );
      }
    }

    const existing =
      await db.orm.public.MatchDiaryEntry
        .where({
          matchId,
        })
        .first();

    const watchedOn = body.watchedOn === undefined ? undefined : body.watchedOn === null || body.watchedOn === "" ? null : body.watchedOn;
    if (watchedOn !== undefined && watchedOn !== null && (typeof watchedOn !== "string" || !validWatchedOn(watchedOn))) {
      return errorResponse("Watched date must be a real YYYY-MM-DD date.", 400);
    }
    const watchedAt = resolveWatchedAt({
      watched: parsed.value.watched,
      watchType: parsed.value.watchType,
      previousWatchType: existing?.watchType ?? null,
      kickoff: match.kickoff.toString(),
      existingWatchedAt: existing?.watchedAt?.toString() ?? null,
      watchedOn: watchedOn as string | null | undefined,
      now: new Date().toISOString(),
    });

    const data = {
      watched:
        parsed.value
          .watched,

      watchType:
        parsed.value
          .watched
          ? parsed.value
              .watchType
          : null,

      watchedAt: watchedAt ? Temporal.Instant.from(watchedAt) : null,

      rating:
        parsed.value
          .rating,

      favouritePlayerId:
        parsed.value
          .favouritePlayerId,

      favouriteGoalEventId:
        parsed.value
          .favouriteGoalEventId,

      notes:
        parsed.value
          .notes,
    };

    const diary =
      existing
        ? await db.orm.public.MatchDiaryEntry
            .where({
              id:
                existing.id,
            })
            .update(
              data,
            )
        : await db.orm.public.MatchDiaryEntry
            .create({
              matchId,

              ...data,
            });

    if (!diary) {
      throw new Error(
        "Diary entry could not be saved.",
      );
    }

    return NextResponse.json({
      ok:
        true,

      result: {
        id:
          diary.id,

        matchId:
          diary.matchId,

        watched:
          diary.watched,

        watchType:
          diary.watchType,

        watchedAt:
          diary.watchedAt
            ?.toString() ??
          null,

        rating:
          diary.rating,

        favouritePlayerId:
          diary.favouritePlayerId,

        favouriteGoalEventId:
          diary.favouriteGoalEventId,

        notes:
          diary.notes,
      },
    });
  } catch (
    error
  ) {
    console.error(
      "MATCH DIARY SAVE FAILED:",
      error,
    );

    return errorResponse(
      error instanceof Error
        ? error.message
        : String(
            error,
          ),
      500,
    );
  }
}

async function findBarcelonaLineupPlayer(
  matchId:
    string,

  playerId:
    string,

  homeTeamId:
    string,

  awayTeamId:
    string,

  barcelonaIsHome:
    boolean,
) {
  const teamId =
    barcelonaIsHome
      ? homeTeamId
      : awayTeamId;

  const lineup =
    await db.orm.public.Lineup
      .where({
        matchId,

        teamId,
      })
      .first();

  if (!lineup) {
    return null;
  }

  return db.orm.public.LineupPlayer
    .where({
      lineupId:
        lineup.id,

      playerId,
    })
    .first();
}

function parseDiaryInput(
  body:
    DiaryInput,
):
  | {
      ok:
        true;

      value: {
        watched:
          boolean;

        watchType:
          | "live"
          | "replay"
          | "highlights_only"
          | null;

        rating:
          number | null;

        favouritePlayerId:
          string | null;

        favouriteGoalEventId:
          string | null;

        notes:
          string | null;
      };
    }
  | {
      ok:
        false;

      error:
        string;
    } {
  if (
    typeof body.watched !==
    "boolean"
  ) {
    return {
      ok:
        false,

      error:
        "watched must be a boolean.",
    };
  }

  let watchType:
    | "live"
    | "replay"
    | "highlights_only"
    | null =
    null;

  if (
    body.watchType !==
      null &&
    body.watchType !==
      undefined
  ) {
    if (
      body.watchType !==
        "live" &&
      body.watchType !==
        "replay" &&
      body.watchType !==
        "highlights_only"
    ) {
      return {
        ok:
          false,

        error:
          "Invalid watch type.",
      };
    }

    watchType =
      body.watchType;
  }

  let rating:
    number | null =
    null;

  if (
    body.rating !==
      null &&
    body.rating !==
      undefined
  ) {
    if (
      typeof body.rating !==
        "number" ||
      !Number.isFinite(
        body.rating,
      ) ||
      body.rating < 0.5 ||
      body.rating > 5
    ) {
      return {
        ok:
          false,

        error:
          "Rating must be between 0.5 and 5 stars.",
      };
    }

    const doubled =
      body.rating *
      2;

    if (
      Math.abs(
        doubled -
        Math.round(
          doubled,
        ),
      ) >
      0.000001
    ) {
      return {
        ok:
          false,

        error:
          "Rating must use half-star increments.",
      };
    }

    rating =
      Math.round(
        doubled,
      ) /
      2;
  }

  const favouritePlayerId =
    nullableUuid(
      body.favouritePlayerId,
    );

  if (
    favouritePlayerId ===
    undefined
  ) {
    return {
      ok:
        false,

      error:
        "Invalid Man of the Match player ID.",
    };
  }

  const favouriteGoalEventId =
    nullableUuid(
      body.favouriteGoalEventId,
    );

  if (
    favouriteGoalEventId ===
    undefined
  ) {
    return {
      ok:
        false,

      error:
        "Invalid favourite goal ID.",
    };
  }

  let notes:
    string | null =
    null;

  if (
    body.notes !==
      null &&
    body.notes !==
      undefined
  ) {
    if (
      typeof body.notes !==
      "string"
    ) {
      return {
        ok:
          false,

        error:
          "Notes must be text.",
      };
    }

    const trimmed =
      body.notes.trim();

    if (
      trimmed.length >
      5000
    ) {
      return {
        ok:
          false,

        error:
          "Notes cannot exceed 5000 characters.",
      };
    }

    notes =
      trimmed ||
      null;
  }

  return {
    ok:
      true,

    value: {
      watched:
        body.watched,

      watchType,

      rating,

      favouritePlayerId:
        favouritePlayerId ??
        null,

      favouriteGoalEventId:
        favouriteGoalEventId ??
        null,

      notes,
    },
  };
}

function nullableUuid(
  value:
    unknown,
):
  | string
  | null
  | undefined {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ""
  ) {
    return null;
  }

  if (
    typeof value !==
      "string" ||
    !isUuid(
      value,
    )
  ) {
    return undefined;
  }

  return value;
}

function isUuid(
  value:
    string,
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function errorResponse(
  error:
    string,

  status:
    number,
) {
  return NextResponse.json(
    {
      ok:
        false,

      error,
    },

    {
      status,
    },
  );
}

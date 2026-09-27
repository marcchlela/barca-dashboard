import {
  NextResponse,
} from "next/server";

import {
  db,
} from "../../../../prisma/db";

import {
  dedupeGoalScoringEvents,
} from "../../../../lib/providers/rich-match/goal-event-dedupe";

export async function POST(
  request:
    Request,
) {
  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    return NextResponse.json(
      {
        ok:
          false,

        error:
          "Not found.",
      },

      {
        status:
          404,
      },
    );
  }

  try {
    const body =
      (
        await request.json()
      ) as {
        matchId?:
          unknown;
      };

    if (
      typeof body.matchId !==
        "string" ||
      body.matchId.trim()
        .length === 0
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "matchId is required.",
        },

        {
          status:
            400,
        },
      );
    }

    const matchId =
      body.matchId.trim();

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
      return NextResponse.json(
        {
          ok:
            false,

          error:
            `Match ${matchId} was not found.`,
        },

        {
          status:
            404,
        },
      );
    }

    if (
      !match.homeTeam
        .isBarcelona &&
      !match.awayTeam
        .isBarcelona
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Match is not an FC Barcelona fixture.",
        },

        {
          status:
            400,
        },
      );
    }

    const goalSource =
      await db.orm.public.DataSource
        .where({
          code:
            "goal-api",
        })
        .first();

    if (!goalSource) {
      throw new Error(
        "GOAL data source does not exist.",
      );
    }

    const result =
      await db.transaction(
        async (
          tx,
        ) =>
          dedupeGoalScoringEvents(
            tx.orm,

            {
              matchId,

              dataSourceId:
                goalSource.id,
            },
          ),
      );

    return NextResponse.json({
      ok:
        true,

      match: {
        id:
          match.id,

        home:
          match.homeTeam
            .name,

        away:
          match.awayTeam
            .name,

        score: {
          home:
            match.homeScore,

          away:
            match.awayScore,
        },
      },

      result,
    });
  } catch (
    error
  ) {
    console.error(
      "GOAL EVENT REPAIR FAILED:",
      error,
    );

    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : String(
                error,
              ),
      },

      {
        status:
          500,
      },
    );
  }
}
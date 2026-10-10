import {
  NextResponse,
} from "next/server";
import { guardAdminRequest } from "../../../../lib/admin/access";

import {
  db,
} from "../../../../prisma/db";

import {
  fetchPitchApiDate,
  fetchPitchApiHeatmaps,
  type PitchApiMatch,
} from "../../../../lib/providers/pitch-api/client";

import {
  normalizedPersonName,
  repairMojibake,
} from "../../../../lib/providers/shared/normalization";

type RequestBody = {
  matchId?:
    string;
};

export async function POST(
  request:
    Request,
) {
  const denied = await guardAdminRequest(request);
  if (denied) return denied;
  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    return NextResponse.json(
      {
        ok:
          false,

        error:
          "PitchAPI probe is disabled in production.",
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
        await request
          .json()
          .catch(
            () => ({}),
          )
      ) as RequestBody;

    if (
      !body.matchId
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

    /*
    |--------------------------------------------------------------------------
    | Canonical match
    |--------------------------------------------------------------------------
    */

    const match =
      await db.orm.public.Match
        .where({
          id:
            body.matchId,
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
        .first();

    if (!match) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Canonical match was not found.",
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
      throw new Error(
        "Target match is not an FC Barcelona fixture.",
      );
    }

    const kickoff =
      new Date(
        match.kickoff.toString(),
      );

    const date =
      kickoff
        .toISOString()
        .slice(
          0,
          10,
        );

    /*
    |--------------------------------------------------------------------------
    | Resolve provider match
    |--------------------------------------------------------------------------
    */

    const dateResponse =
      await fetchPitchApiDate(
        date,
      );

    const candidates =
      (
        dateResponse.data
          ?.matches ??
        []
      ).filter(
        (
          candidate,
        ) =>
          matchIdentityMatches(
            match,
            candidate,
          ),
      );

    if (
      candidates.length !==
      1
    ) {
      return NextResponse.json({
        ok:
          true,

        stage:
          "match_resolution",

        matched:
          false,

        canonical: {
          id:
            match.id,

          date,

          competition:
            match.competition
              .name,

          home:
            repairMojibake(
              match.homeTeam
                .name,
            ),

          away:
            repairMojibake(
              match.awayTeam
                .name,
            ),

          score:
            `${match.homeScore ?? "?"}-${match.awayScore ?? "?"}`,
        },

        candidates:
          candidates.map(
            (
              candidate,
            ) => ({
              id:
                candidate.id,

              kickoff:
                candidate.time_utc,

              home:
                candidate.home_team
                  .name,

              away:
                candidate.away_team
                  .name,

              score:
                `${candidate.score_home ?? "?"}-${candidate.score_away ?? "?"}`,
            }),
          ),

        dateMatchCount:
          dateResponse.data
            ?.matches
            ?.length ??
          0,
      });
    }

    const providerMatch =
      candidates[0];

    /*
    |--------------------------------------------------------------------------
    | Heatmaps
    |--------------------------------------------------------------------------
    */

    const heatmap =
      await fetchPitchApiHeatmaps(
        providerMatch.id,
      );

    const barcelonaSide =
      match.homeTeam
        .isBarcelona
        ? "home"
        : "away";

    const providerBarcelona =
      barcelonaSide ===
      "home"
        ? providerMatch
            .home_team
        : providerMatch
            .away_team;

    const barcelonaPlayers =
      (
        heatmap.data
          ?.players ??
        []
      ).filter(
        (
          player,
        ) =>
          player.team.id ===
            providerBarcelona.id ||
          teamKey(
            player.team.name,
          ) ===
            teamKey(
              providerBarcelona.name,
            ),
      );

    /*
    |--------------------------------------------------------------------------
    | Useful response
    |--------------------------------------------------------------------------
    */

    return NextResponse.json({
      ok:
        true,

      stage:
        "heatmaps",

      matched:
        true,

      canonical: {
        id:
          match.id,

        date,

        kickoff:
          match.kickoff.toString(),

        home:
          repairMojibake(
            match.homeTeam
              .name,
          ),

        away:
          repairMojibake(
            match.awayTeam
              .name,
          ),

        score:
          `${match.homeScore ?? "?"}-${match.awayScore ?? "?"}`,
      },

      provider: {
        matchId:
          providerMatch.id,

        home:
          providerMatch
            .home_team,

        away:
          providerMatch
            .away_team,

        kickoff:
          providerMatch
            .time_utc,

        score:
          `${providerMatch.score_home ?? "?"}-${providerMatch.score_away ?? "?"}`,
      },

      heatmap: {
        grid:
          heatmap.data
            .grid,

        teamHeatmaps:
          heatmap.data
            .teams
            ?.length ??
          0,

        playerHeatmaps:
          heatmap.data
            .players
            ?.length ??
          0,

        barcelonaPlayerHeatmaps:
          barcelonaPlayers
            .length,

        barcelonaPlayers:
          barcelonaPlayers.map(
            (
              player,
            ) => ({
              id:
                player.player
                  .id,

              name:
                player.player
                  .name,

              shirtNumber:
                player.player
                  .shirt_number ??
                null,

              side:
                player.side,

              actions:
                player.actions,

              occupiedCells:
                player.cells
                  .length,

              /*
               * Useful sample so we can
               * immediately verify the
               * payload really contains
               * positional density.
               */
              sampleCells:
                player.cells.slice(
                  0,
                  8,
                ),
            }),
          ),
      },
    });
  } catch (
    error
  ) {
    console.error(
      "PITCH HEATMAP PROBE FAILED:",
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

/*
|--------------------------------------------------------------------------
| Matching
|--------------------------------------------------------------------------
*/

function matchIdentityMatches(
  canonical: {
    kickoff: {
      toString():
        string;
    };

    homeScore:
      number | null;

    awayScore:
      number | null;

    homeTeam: {
      name:
        string;

      shortName:
        string | null;
    };

    awayTeam: {
      name:
        string;

      shortName:
        string | null;
    };
  },

  provider:
    PitchApiMatch,
) {
  const homeMatches =
    teamMatches(
      [
        canonical.homeTeam
          .name,

        canonical.homeTeam
          .shortName,
      ],

      provider.home_team
        .name,
    );

  const awayMatches =
    teamMatches(
      [
        canonical.awayTeam
          .name,

        canonical.awayTeam
          .shortName,
      ],

      provider.away_team
        .name,
    );

  if (
    !homeMatches ||
    !awayMatches
  ) {
    return false;
  }

  /*
   * Finished canonical matches should
   * also agree on score.
   */

  if (
    canonical.homeScore !==
      null &&
    canonical.awayScore !==
      null &&
    provider.score_home !==
      null &&
    provider.score_away !==
      null
  ) {
    if (
      canonical.homeScore !==
        provider.score_home ||
      canonical.awayScore !==
        provider.score_away
    ) {
      return false;
    }
  }

  /*
   * Kickoff tolerance protects against
   * accidental same-day collisions.
   */

  const canonicalTime =
    new Date(
      canonical.kickoff.toString(),
    ).getTime();

  const providerTime =
    new Date(
      provider.time_utc,
    ).getTime();

  if (
    Number.isFinite(
      canonicalTime,
    ) &&
    Number.isFinite(
      providerTime,
    )
  ) {
    const difference =
      Math.abs(
        canonicalTime -
        providerTime,
      );

    if (
      difference >
      3 *
        60 *
        60 *
        1000
    ) {
      return false;
    }
  }

  return true;
}

function teamMatches(
  canonicalNames:
    Array<
      string | null
    >,

  providerName:
    string,
) {
  const providerKey =
    teamKey(
      providerName,
    );

  return canonicalNames
    .filter(
      (
        value,
      ): value is string =>
        Boolean(
          value,
        ),
    )
    .some(
      (
        value,
      ) =>
        teamKey(
          value,
        ) ===
        providerKey,
    );
}

function teamKey(
  value:
    string,
) {
  return normalizedPersonName(
    repairMojibake(
      value,
    ),
  )
    .replace(
      /\b(fc|cf|club|football|futbol|futbol club)\b/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

import {
  NextResponse,
} from "next/server";

import { db } from "../../../../prisma/db";

import {
  fetchStatsHawkMatchBundle,
} from "../../../../lib/providers/statshawk/fetch";

import type {
  MatchIdentityInput,
} from "../../../../lib/providers/shared/match-identity";

export async function GET(
  request: Request,
) {
  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Not found.",
      },
      {
        status: 404,
      },
    );
  }

  try {
    const url =
      new URL(
        request.url,
      );

    const matchId =
      url.searchParams.get(
        "matchId",
      );

    const includeRoster =
      url.searchParams.get(
        "roster",
      ) === "1";

    if (
      !matchId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "matchId is required.",
        },
        {
          status: 400,
        },
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
        .include(
          "competition",
        )
        .first();

    if (!match) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Match not found.",
        },
        {
          status: 404,
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
          ok: false,
          error:
            "Match is not an FC Barcelona fixture.",
        },
        {
          status: 400,
        },
      );
    }

    const mappings =
      await db.orm.public.ProviderMapping
        .where({
          internalId:
            match.id,

          entityType:
            "match",
        })
        .include(
          "dataSource",
        )
        .all();

    const internal:
      MatchIdentityInput = {
      kickoff:
        match.kickoff.toString(),

      competition: {
        name:
          match.competition.name,
      },

      homeTeam: {
        name:
          match.homeTeam.name,
      },

      awayTeam: {
        name:
          match.awayTeam.name,
      },

      score: {
        home:
          match.homeScore,

        away:
          match.awayScore,
      },

      providerIds:
        Object.fromEntries(
          mappings.map(
            (mapping) => [
              mapping.dataSource
                .code,

              mapping.providerId,
            ],
          ),
        ),
    };

    const bundle =
      await fetchStatsHawkMatchBundle(
        internal,
        {
          includeBarcelonaRoster:
            includeRoster,
        },
      );

    const barcelonaProviderTeamId =
      match.homeTeam
        .isBarcelona
        ? bundle.homeTeamProviderId
        : bundle.awayTeamProviderId;

    const barcelonaStats =
      bundle.playerStatistics.filter(
        (statistic) =>
          statistic.teamProviderId ===
          barcelonaProviderTeamId,
      );

    return NextResponse.json({
      ok: true,

      result: {
        match: {
          internalId:
            match.id,

          providerMatchId:
            bundle.providerMatchId,

          competition:
            bundle.competitionSlug,

          home:
            bundle.homeTeamName,

          away:
            bundle.awayTeamName,

          kickoff:
            bundle.candidate.kickoff,

          score: {
            home:
              bundle.candidate
                .homeScore,

            away:
              bundle.candidate
                .awayScore,
          },
        },

        playerStatistics: {
          total:
            bundle.playerStatistics
              .length,

          barcelona:
            barcelonaStats.length,

          sample:
            barcelonaStats
              .slice(
                0,
                5,
              )
              .map(
                (statistic) => ({
                  personId:
                    statistic.personId,

                  name:
                    statistic.name,

                  minutes:
                    statistic.minutes,

                  goals:
                    statistic.goals,

                  assists:
                    statistic.assists,

                  shots:
                    statistic.shots,

                  shotsOnTarget:
                    statistic.shotsOnTarget,

                  passes:
                    statistic.passes,

                  completedPasses:
                    statistic.completedPasses,

                  passAccuracy:
                    statistic.passAccuracy,

                  tackles:
                    statistic.tackles,

                  interceptions:
                    statistic.interceptions,

                  saves:
                    statistic.saves,

                  goalsConceded:
                    statistic.goalsConceded,

                  cleanSheet:
                    statistic.cleanSheet,
                }),
              ),
        },

        roster: {
          requested:
            includeRoster,

          count:
            bundle.barcelonaRoster
              .length,

          sample:
            bundle.barcelonaRoster
              .slice(
                0,
                8,
              ),
        },

        usage:
          bundle.usage,

        database: {
          writes:
            0,
        },
      },
    });
  } catch (error) {
    console.error(
      "STATSHawk PRODUCTION PROVIDER TEST FAILED:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof
          Error
            ? error.message
            : String(
                error,
              ),
      },
      {
        status: 500,
      },
    );
  }
}
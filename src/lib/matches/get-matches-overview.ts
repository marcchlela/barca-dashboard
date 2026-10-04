import "server-only";

import {
  db,
} from "../../prisma/db";

export async function getMatchesOverview() {
  const season =
    await db.orm.public.Season
      .where({
        isCurrent:
          true,
      })
      .first();

  if (!season) {
    throw new Error(
      "No current season exists.",
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

  const [
    matches,
    diaryEntries,
  ] =
    await Promise.all([
      db.orm.public.Match
        .where({
          seasonId:
            season.id,
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
        .all(),

      db.orm.public.MatchDiaryEntry
        .all(),
    ]);

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

  const diaryByMatch =
    new Map(
      diaryEntries.map(
        (
          entry,
        ) => [
          entry.matchId,
          entry,
        ],
      ),
    );

  const competitions =
    Array.from(
      new Map(
        barcelonaMatches.map(
          (
            match,
          ) => [
            match.competition.id,
            {
              id:
                match.competition.id,

              code:
                match.competition.code,

              name:
                match.competition.name,

              shortName:
                match.competition.shortName,

              logoUrl:
                match.competition.logoUrl,
            },
          ],
        ),
      ).values(),
    ).sort(
      (
        left,
        right,
      ) =>
        left.name.localeCompare(
          right.name,
        ),
    );

  const serializedMatches =
    barcelonaMatches.map(
      (
        match,
      ) => {
        const diary =
          diaryByMatch.get(
            match.id,
          );

        const barcaAtHome =
          match.homeTeamId ===
          barcelona.id;

        const opponent =
          barcaAtHome
            ? match.awayTeam
            : match.homeTeam;

        return {
          id:
            match.id,

          kickoff:
            match.kickoff.toString(),

          status:
            match.status,

          matchday:
            match.matchday,

          stage:
            match.stage,

          round:
            match.round,

          venue:
            match.venue,

          homeScore:
            match.homeScore,

          awayScore:
            match.awayScore,

          barcaAtHome,

          result:
            getBarcaResult(
              match,
              barcelona.id,
            ),

          competition: {
            id:
              match.competition.id,

            code:
              match.competition.code,

            name:
              match.competition.name,

            shortName:
              match.competition.shortName,

            logoUrl:
              match.competition.logoUrl,
          },

          homeTeam: {
            id:
              match.homeTeam.id,

            name:
              match.homeTeam.name,

            shortName:
              match.homeTeam.shortName,

            code:
              match.homeTeam.code,

            crestUrl:
              match.homeTeam.crestUrl,
          },

          awayTeam: {
            id:
              match.awayTeam.id,

            name:
              match.awayTeam.name,

            shortName:
              match.awayTeam.shortName,

            code:
              match.awayTeam.code,

            crestUrl:
              match.awayTeam.crestUrl,
          },

          opponent: {
            id:
              opponent.id,

            name:
              opponent.name,

            shortName:
              opponent.shortName,

            code:
              opponent.code,

            crestUrl:
              opponent.crestUrl,
          },

          diary:
            diary
              ? {
                  watched:
                    diary.watched,

                  rating:
                    diary.rating,

                  watchType:
                    diary.watchType,
                }
              : null,
        };
      },
    );

  const finished =
    serializedMatches.filter(
      (
        match,
      ) =>
        match.status ===
        "finished",
    );

  const upcoming =
    serializedMatches.filter(
      (
        match,
      ) =>
        match.status ===
          "scheduled",
    );

  const live =
    serializedMatches.filter(
      (
        match,
      ) =>
        [
          "live",
          "halftime",
          "extra_time",
          "penalties",
        ].includes(
          match.status,
        ),
    );

  const watched =
    serializedMatches.filter(
      (
        match,
      ) =>
        match.diary
          ?.watched ===
        true,
    );

  return {
    generatedAt:
      new Date()
        .toISOString(),

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

    barcelona: {
      id:
        barcelona.id,

      name:
        barcelona.name,

      shortName:
        barcelona.shortName,

      crestUrl:
        barcelona.crestUrl,
    },

    summary: {
      total:
        serializedMatches.length,

      finished:
        finished.length,

      upcoming:
        upcoming.length,

      live:
        live.length,

      watched:
        watched.length,
    },

    competitions,

    matches:
      serializedMatches,
  };
}

function getBarcaResult(
  match: {
    homeTeamId:
      string;

    homeScore:
      number | null;

    awayScore:
      number | null;
  },

  barcelonaId:
    string,
) {
  if (
    match.homeScore ===
      null ||
    match.awayScore ===
      null
  ) {
    return null;
  }

  const barcaAtHome =
    match.homeTeamId ===
    barcelonaId;

  const barcaScore =
    barcaAtHome
      ? match.homeScore
      : match.awayScore;

  const opponentScore =
    barcaAtHome
      ? match.awayScore
      : match.homeScore;

  if (
    barcaScore >
    opponentScore
  ) {
    return "W";
  }

  if (
    barcaScore <
    opponentScore
  ) {
    return "L";
  }

  return "D";
}

export type MatchesOverviewData =
  Awaited<
    ReturnType<
      typeof getMatchesOverview
    >
  >;
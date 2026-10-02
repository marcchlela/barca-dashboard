import "server-only";

import {
  db,
} from "../../prisma/db";

export type MatchNavigationItem = {
  id:
    string;

  kickoff:
    string;

  status:
    string;

  competition: {
    name:
      string;

    shortName:
      string | null;

    code:
      string | null;
  };

  opponent: {
    id:
      string;

    name:
      string;

    shortName:
      string | null;

    crestUrl:
      string | null;
  };

  barcelonaSide:
    "home" | "away";

  score: {
    barcelona:
      number | null;

    opponent:
      number | null;
  };
};

export type MatchNavigation = {
  previous:
    MatchNavigationItem | null;

  next:
    MatchNavigationItem | null;
};

export async function getMatchNavigation(
  matchId:
    string,
): Promise<MatchNavigation> {
  const current =
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

  if (!current) {
    return {
      previous:
        null,

      next:
        null,
    };
  }

  /*
   * Navigation is season-wide across every competition.
   *
   * We deliberately filter Barça fixtures in application code
   * rather than assuming a competition-specific sequence.
   */
  const seasonMatches =
    await db.orm.public.Match
      .where({
        seasonId:
          current.seasonId,
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
      .all();

  const barcelonaMatches =
    seasonMatches
      .filter(
        (match) =>
          match.homeTeam
            .isBarcelona ||
          match.awayTeam
            .isBarcelona,
      )
      .sort(
        (
          left,
          right,
        ) =>
          Number(
            left.kickoff
              .epochMilliseconds,
          ) -
          Number(
            right.kickoff
              .epochMilliseconds,
          ),
      );

  const currentIndex =
    barcelonaMatches.findIndex(
      (match) =>
        match.id ===
        matchId,
    );

  if (
    currentIndex === -1
  ) {
    return {
      previous:
        null,

      next:
        null,
    };
  }

  return {
    previous:
      currentIndex > 0
        ? serializeNavigationItem(
            barcelonaMatches[
              currentIndex -
                1
            ],
          )
        : null,

    next:
      currentIndex <
      barcelonaMatches.length -
        1
        ? serializeNavigationItem(
            barcelonaMatches[
              currentIndex +
                1
            ],
          )
        : null,
  };
}

function serializeNavigationItem(
  match: {
    id:
      string;

    kickoff: {
      toString():
        string;
    };

    status:
      string;

    homeTeamId:
      string;

    awayTeamId:
      string;

    homeScore:
      number | null;

    awayScore:
      number | null;

    homeTeam: {
      id:
        string;

      name:
        string;

      shortName:
        string | null;

      crestUrl:
        string | null;

      isBarcelona:
        boolean;
    };

    awayTeam: {
      id:
        string;

      name:
        string;

      shortName:
        string | null;

      crestUrl:
        string | null;

      isBarcelona:
        boolean;
    };

    competition: {
      name:
        string;

      shortName:
        string | null;

      code:
        string | null;
    };
  },
): MatchNavigationItem {
  const barcelonaIsHome =
    match.homeTeam
      .isBarcelona;

  const opponent =
    barcelonaIsHome
      ? match.awayTeam
      : match.homeTeam;

  return {
    id:
      match.id,

    kickoff:
      match.kickoff
        .toString(),

    status:
      match.status,

    competition: {
      name:
        match.competition
          .name,

      shortName:
        match.competition
          .shortName,

      code:
        match.competition
          .code,
    },

    opponent: {
      id:
        opponent.id,

      name:
        opponent.name,

      shortName:
        opponent.shortName,

      crestUrl:
        opponent.crestUrl,
    },

    barcelonaSide:
      barcelonaIsHome
        ? "home"
        : "away",

    score: {
      barcelona:
        barcelonaIsHome
          ? match.homeScore
          : match.awayScore,

      opponent:
        barcelonaIsHome
          ? match.awayScore
          : match.homeScore,
    },
  };
}
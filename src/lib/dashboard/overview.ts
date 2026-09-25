import { or } from "@prisma/orm-postgres/orm-client";
import { Temporal } from "temporal-polyfill";

import { db } from "../../prisma/db";

type StoryKind =
  | "win"
  | "draw"
  | "loss"
  | "key"
  | "trophy"
  | "injury"
  | "upcoming";

type StoryIcon =
  | "season-opener"
  | "champions-league"
  | "clasico"
  | "statement-win"
  | "latest-result"
  | "next-match"
  | "league-finale"
  | "first-loss"
  | "trophy"
  | "injury"
  | "key";

type StoryCompetition = {
  name: string;
  shortName: string | null;
  code: string;
  logoUrl: string | null;
};

type StoryTeam = {
  name: string;
  shortName: string | null;
  code: string;
  crestUrl: string | null;
};

type StoryCandidate = {
  id: string;
  date: string;

  kind: StoryKind;
  icon: StoryIcon;

  title: string;
  subtitle: string | null;

  priority: number;

  competition: StoryCompetition | null;

  teams: [StoryTeam, StoryTeam] | null;
};

export async function getDashboardOverview() {
  const now =
    Temporal.Now.instant();

  /*
  |--------------------------------------------------------------------------
  | Barça
  |--------------------------------------------------------------------------
  */

  const barcelona =
    await db.orm.public.Team
      .where({
        isBarcelona: true,
      })
      .first();

  if (!barcelona) {
    throw new Error(
      "FC Barcelona does not exist in the local database.",
    );
  }

  const barcelonaId =
    barcelona.id;

  /*
  |--------------------------------------------------------------------------
  | Current season
  |--------------------------------------------------------------------------
  */

  const currentSeason =
    await db.orm.public.Season
      .where({
        isCurrent: true,
      })
      .first();

  if (!currentSeason) {
    throw new Error(
      "No current season exists in the local database.",
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Next match
  |--------------------------------------------------------------------------
  */

  const nextMatch =
    await db.orm.public.Match
      .where((match) =>
        or(
          match.homeTeamId.eq(
            barcelonaId,
          ),
          match.awayTeamId.eq(
            barcelonaId,
          ),
        ),
      )
      .where((match) =>
        match.kickoff.gte(now),
      )
      .where((match) =>
        match.status.in([
          "scheduled",
          "live",
          "halftime",
        ]),
      )
      .include("homeTeam")
      .include("awayTeam")
      .include("competition")
      .orderBy((match) =>
        match.kickoff.asc(),
      )
      .first();

  /*
  |--------------------------------------------------------------------------
  | Previous match
  |--------------------------------------------------------------------------
  */

  const previousMatch =
    await db.orm.public.Match
      .where((match) =>
        or(
          match.homeTeamId.eq(
            barcelonaId,
          ),
          match.awayTeamId.eq(
            barcelonaId,
          ),
        ),
      )
      .where({
        status: "finished",
      })
      .where((match) =>
        match.kickoff.lt(now),
      )
      .include("homeTeam")
      .include("awayTeam")
      .include("competition")
      .orderBy((match) =>
        match.kickoff.desc(),
      )
      .first();

  /*
  |--------------------------------------------------------------------------
  | Current league standing
  |--------------------------------------------------------------------------
  */

  const standing =
    await db.orm.public.StandingSnapshot
      .where({
        seasonId:
          currentSeason.id,

        teamId:
          barcelonaId,
      })
      .orderBy((standing) =>
        standing.matchday.desc(),
      )
      .first();

  /*
  |--------------------------------------------------------------------------
  | Recent form
  |--------------------------------------------------------------------------
  */

  const recentMatches =
    await db.orm.public.Match
      .where((match) =>
        or(
          match.homeTeamId.eq(
            barcelonaId,
          ),
          match.awayTeamId.eq(
            barcelonaId,
          ),
        ),
      )
      .where({
        status: "finished",
      })
      .include("homeTeam")
      .include("awayTeam")
      .include("competition")
      .orderBy((match) =>
        match.kickoff.desc(),
      )
      .limit(5)
      .all();

  const recentForm =
    recentMatches
      .map((match) => {
        const result =
          getBarcaResult(
            match,
            barcelonaId,
          );

        if (
          result ===
            "upcoming" ||
          result === null
        ) {
          return null;
        }

        return result;
      })
      .filter(
        (
          result,
        ): result is
          | "W"
          | "D"
          | "L" =>
          result !== null,
      );

  /*
  |--------------------------------------------------------------------------
  | All current-season Barça matches
  |--------------------------------------------------------------------------
  */

  const seasonMatches =
    await db.orm.public.Match
      .where({
        seasonId:
          currentSeason.id,
      })
      .where((match) =>
        or(
          match.homeTeamId.eq(
            barcelonaId,
          ),
          match.awayTeamId.eq(
            barcelonaId,
          ),
        ),
      )
      .include("homeTeam")
      .include("awayTeam")
      .include("competition")
      .orderBy((match) =>
        match.kickoff.asc(),
      )
      .all();

  /*
  |--------------------------------------------------------------------------
  | Curated/manual events
  |--------------------------------------------------------------------------
  */

  const manualMoments =
    await db.orm.public.SeasonMoment
      .where({
        seasonId:
          currentSeason.id,
      })
      .orderBy((moment) =>
        moment.occurredAt.asc(),
      )
      .all();

  /*
  |--------------------------------------------------------------------------
  | Build Season Story
  |--------------------------------------------------------------------------
  */

  const seasonStory =
    buildSeasonStory({
      matches:
        seasonMatches,

      manualMoments,

      barcelonaId,

      nextMatchId:
        nextMatch?.id ??
        null,
    });

  /*
  |--------------------------------------------------------------------------
  | Match serializer
  |--------------------------------------------------------------------------
  */

  type IncludedMatch =
    NonNullable<
      typeof nextMatch
    >;

  function serializeMatch(
    match:
      | IncludedMatch
      | null,
  ) {
    if (!match) {
      return null;
    }

    const barcaAtHome =
      match.homeTeamId ===
      barcelonaId;

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

      venue:
        match.venue,

      competition: {
        id:
          match.competition.id,

        name:
          match.competition
            .name,

        shortName:
          match.competition
            .shortName,

        code:
          match.competition
            .code,

        logoUrl:
          match.competition
            .logoUrl,
      },

      homeTeam: {
        id:
          match.homeTeam.id,

        name:
          match.homeTeam.name,

        shortName:
          match.homeTeam
            .shortName,

        code:
          match.homeTeam.code,

        crestUrl:
          match.homeTeam
            .crestUrl,
      },

      awayTeam: {
        id:
          match.awayTeam.id,

        name:
          match.awayTeam.name,

        shortName:
          match.awayTeam
            .shortName,

        code:
          match.awayTeam.code,

        crestUrl:
          match.awayTeam
            .crestUrl,
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

      barcaAtHome,

      score: {
        home:
          match.homeScore,

        away:
          match.awayScore,
      },
    };
  }

  return {
    season: {
      id:
        currentSeason.id,

      label:
        currentSeason.label,

      startYear:
        currentSeason.startYear,

      endYear:
        currentSeason.endYear,

      startDate:
        currentSeason.startDate?.toString() ??
        null,

      endDate:
        currentSeason.endDate?.toString() ??
        null,
    },

    barcelona: {
      id:
        barcelona.id,

      name:
        barcelona.name,

      shortName:
        barcelona.shortName,

      code:
        barcelona.code,

      crestUrl:
        barcelona.crestUrl,
    },

    standing:
      standing
        ? {
            matchday:
              standing.matchday,

            position:
              standing.position,

            played:
              standing.played,

            won:
              standing.won,

            drawn:
              standing.drawn,

            lost:
              standing.lost,

            goalsFor:
              standing.goalsFor,

            goalsAgainst:
              standing.goalsAgainst,

            goalDifference:
              standing.goalDifference,

            points:
              standing.points,
          }
        : null,

    recentForm,

    nextMatch:
      serializeMatch(
        nextMatch,
      ),

    previousMatch:
      serializeMatch(
        previousMatch,
      ),

    seasonStory,
  };
}

/*
|--------------------------------------------------------------------------
| Result helper
|--------------------------------------------------------------------------
*/

function getBarcaResult(
  match: {
    homeTeamId: string;
    awayTeamId: string;

    homeScore:
      number | null;

    awayScore:
      number | null;
  },

  barcelonaId: string,
) {
  if (
    match.homeScore ===
      null ||
    match.awayScore ===
      null
  ) {
    return "upcoming" as const;
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
    return "W" as const;
  }

  if (
    barcaScore <
    opponentScore
  ) {
    return "L" as const;
  }

  return "D" as const;
}

/*
|--------------------------------------------------------------------------
| Season Story
|--------------------------------------------------------------------------
*/

function buildSeasonStory({
  matches,
  manualMoments,
  barcelonaId,
  nextMatchId,
}: {
  matches: Array<{
    id: string;

    kickoff:
      Temporal.Instant;

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
      name: string;

      shortName:
        string | null;

      code: string;

      crestUrl:
        string | null;
    };

    awayTeam: {
      name: string;

      shortName:
        string | null;

      code: string;

      crestUrl:
        string | null;
    };

    competition: {
      name: string;

      shortName:
        string | null;

      code: string;

      logoUrl:
        string | null;
    };
  }>;

  manualMoments: Array<{
    id: string;

    type: string;

    title: string;

    description:
      string | null;

    occurredAt:
      Temporal.Instant;

    importance: number;
  }>;

  barcelonaId:
    string;

  nextMatchId:
    string | null;
}) {
  const candidates:
    StoryCandidate[] = [];

  const usedMatches =
    new Set<string>();

  /*
  |--------------------------------------------------------------------------
  | Match → story helper
  |--------------------------------------------------------------------------
  */

  const addMatch = (
    match:
      (typeof matches)[number],

    {
      title,
      priority,
      icon,
      forceKind,
      force = false,
    }: {
      title: string;

      priority: number;

      icon:
        StoryIcon;

      forceKind?:
        StoryKind;

      force?:
        boolean;
    },
  ) => {
    /*
     * Avoid showing the exact same match twice
     * unless we explicitly decide otherwise later.
     */
    if (
      usedMatches.has(
        match.id,
      ) &&
      !force
    ) {
      return;
    }

    usedMatches.add(
      match.id,
    );

    const barcaAtHome =
      match.homeTeamId ===
      barcelonaId;

    const opponent =
      barcaAtHome
        ? match.awayTeam
        : match.homeTeam;

    const result =
      getBarcaResult(
        match,
        barcelonaId,
      );

    let kind:
      StoryKind;

    if (forceKind) {
      kind = forceKind;
    } else if (
      result === "W"
    ) {
      kind = "win";
    } else if (
      result === "D"
    ) {
      kind = "draw";
    } else if (
      result === "L"
    ) {
      kind = "loss";
    } else {
      kind = "upcoming";
    }

    const score =
      match.homeScore !==
        null &&
      match.awayScore !==
        null
        ? `${match.homeScore}–${match.awayScore}`
        : null;

    const subtitle =
      [
        opponent.shortName ??
          opponent.name,

        score,

        match.competition
          .shortName ??
          match.competition
            .name,
      ]
        .filter(Boolean)
        .join(" • ");

    const teams:
      [StoryTeam, StoryTeam] =
      [
        {
          name:
            match.homeTeam
              .name,

          shortName:
            match.homeTeam
              .shortName,

          code:
            match.homeTeam
              .code,

          crestUrl:
            match.homeTeam
              .crestUrl,
        },

        {
          name:
            match.awayTeam
              .name,

          shortName:
            match.awayTeam
              .shortName,

          code:
            match.awayTeam
              .code,

          crestUrl:
            match.awayTeam
              .crestUrl,
        },
      ];

    candidates.push({
      id:
        `match:${match.id}`,

      date:
        match.kickoff.toString(),

      kind,

      icon,

      title,

      subtitle,

      priority,

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

        logoUrl:
          match.competition
            .logoUrl,
      },

      teams,
    });
  };

  /*
  |--------------------------------------------------------------------------
  | Season opener
  |--------------------------------------------------------------------------
  */

  const opener =
    matches[0];

  if (opener) {
    addMatch(opener, {
      title:
        "Season opener",

      priority:
        100,

      icon:
        "season-opener",
    });
  }

  /*
  |--------------------------------------------------------------------------
  | First Champions League match
  |--------------------------------------------------------------------------
  */

  const firstUcl =
    matches.find(
      (match) =>
        match.competition
          .code === "CL",
    );

  if (firstUcl) {
    addMatch(firstUcl, {
      title:
        "Champions League begins",

      priority:
        92,

      icon:
        "champions-league",

      forceKind:
        "key",
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Final La Liga fixture
  |--------------------------------------------------------------------------
  */

  const laLigaMatches =
    matches.filter(
      (match) =>
        match.competition
          .code === "PD",
    );

  const lastLaLigaMatch =
    laLigaMatches[
      laLigaMatches.length -
        1
    ];

  if (lastLaLigaMatch) {
    addMatch(
      lastLaLigaMatch,
      {
        title:
          "La Liga finale",

        priority:
          94,

        icon:
          "league-finale",
      },
    );
  }

  /*
  |--------------------------------------------------------------------------
  | El Clásicos
  |--------------------------------------------------------------------------
  */

  const clasicos =
    matches.filter(
      (match) =>
        isClasico(
          match,
          barcelonaId,
        ),
    );

  for (
    const clasico of
      clasicos
  ) {
    addMatch(clasico, {
      title:
        "El Clásico",

      priority:
        98,

      icon:
        "clasico",

      forceKind:
        "key",
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Finished matches
  |--------------------------------------------------------------------------
  */

  const finishedMatches =
    matches.filter(
      (match) =>
        match.status ===
          "finished" &&
        match.homeScore !==
          null &&
        match.awayScore !==
          null,
    );

  /*
  |--------------------------------------------------------------------------
  | First loss
  |--------------------------------------------------------------------------
  |
  | This simply does not exist until Barça actually loses.
  |--------------------------------------------------------------------------
  */

  const firstLoss =
    finishedMatches.find(
      (match) =>
        getBarcaResult(
          match,
          barcelonaId,
        ) === "L",
    );

  if (firstLoss) {
    addMatch(firstLoss, {
      title:
        "First loss",

      priority:
        88,

      icon:
        "first-loss",
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Biggest win
  |--------------------------------------------------------------------------
  */

  let biggestWin:
    | (typeof matches)[number]
    | null = null;

  let biggestMargin = 0;

  for (
    const match of
      finishedMatches
  ) {
    if (
      getBarcaResult(
        match,
        barcelonaId,
      ) !== "W"
    ) {
      continue;
    }

    const barcaAtHome =
      match.homeTeamId ===
      barcelonaId;

    const barcaScore =
      barcaAtHome
        ? match.homeScore!
        : match.awayScore!;

    const opponentScore =
      barcaAtHome
        ? match.awayScore!
        : match.homeScore!;

    const margin =
      barcaScore -
      opponentScore;

    if (
      margin >
      biggestMargin
    ) {
      biggestMargin =
        margin;

      biggestWin =
        match;
    }
  }

  if (
    biggestWin &&
    biggestMargin >= 3
  ) {
    addMatch(
      biggestWin,
      {
        title:
          "Statement win",

        priority:
          80,

        icon:
          "statement-win",
      },
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Latest completed match
  |--------------------------------------------------------------------------
  */

  const latestFinished =
    finishedMatches[
      finishedMatches.length -
        1
    ];

  if (latestFinished) {
    addMatch(
      latestFinished,
      {
        title:
          "Latest result",

        priority:
          68,

        icon:
          "latest-result",
      },
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Next match
  |--------------------------------------------------------------------------
  */

  const nextMatch =
    matches.find(
      (match) =>
        match.id ===
        nextMatchId,
    );

  if (nextMatch) {
    addMatch(nextMatch, {
      title:
        "Next up",

      priority:
        72,

      icon:
        "next-match",

      forceKind:
        "upcoming",
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Manual / curated events
  |--------------------------------------------------------------------------
  */

  for (
    const moment of
      manualMoments
  ) {
    candidates.push({
      id:
        `moment:${moment.id}`,

      date:
        moment.occurredAt.toString(),

      kind:
        mapMomentKind(
          moment.type,
        ),

      icon:
        mapMomentIcon(
          moment.type,
        ),

      title:
        moment.title,

      subtitle:
        moment.description,

      priority:
        76 +
        Math.min(
          Math.max(
            moment.importance,
            1,
          ),
          10,
        ) *
          3,

      competition:
        null,

      teams:
        null,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Keep the story curated
  |--------------------------------------------------------------------------
  */

  return candidates
    .sort(
      (a, b) =>
        b.priority -
        a.priority,
    )
    .slice(0, 9)
    .sort(
      (a, b) =>
        new Date(
          a.date,
        ).getTime() -
        new Date(
          b.date,
        ).getTime(),
    )
    .map((candidate) => {
      const {
        priority,
        ...event
      } = candidate;

      void priority;

      return event;
    });
}

/*
|--------------------------------------------------------------------------
| El Clásico detection
|--------------------------------------------------------------------------
*/

function isClasico(
  match: {
    homeTeamId:
      string;

    awayTeamId:
      string;

    homeTeam: {
      name: string;
      code: string;
    };

    awayTeam: {
      name: string;
      code: string;
    };
  },

  barcelonaId:
    string,
) {
  const opponent =
    match.homeTeamId ===
    barcelonaId
      ? match.awayTeam
      : match.homeTeam;

  return (
    opponent.code ===
      "RMA" ||
    opponent.name
      .toLowerCase()
      .includes(
        "real madrid",
      )
  );
}

/*
|--------------------------------------------------------------------------
| Manual moment mappings
|--------------------------------------------------------------------------
*/

function mapMomentKind(
  type: string,
): StoryKind {
  switch (type) {
    case "trophy":
      return "trophy";

    case "injury":
      return "injury";

    default:
      return "key";
  }
}

function mapMomentIcon(
  type: string,
): StoryIcon {
  switch (type) {
    case "trophy":
      return "trophy";

    case "injury":
      return "injury";

    default:
      return "key";
  }
}

export type DashboardOverview =
  Awaited<
    ReturnType<
      typeof getDashboardOverview
    >
  >;

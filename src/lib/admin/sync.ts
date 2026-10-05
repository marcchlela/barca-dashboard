import "server-only";

import {
  db,
} from "../../prisma/db";

export async function getAdminSyncData() {
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

  const matches =
    await db.orm.public.Match
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
      .all();

  const barcelonaMatches =
    matches
      .filter(
        (
          match,
        ) =>
          match.homeTeamId ===
            barcelona.id ||
          match.awayTeamId ===
            barcelona.id,
      )
      .sort(
        (
          left,
          right,
        ) =>
          instantMilliseconds(
            right.kickoff,
          ) -
          instantMilliseconds(
            left.kickoff,
          ),
      );

  const finishedMatches =
    barcelonaMatches.filter(
      (
        match,
      ) =>
        match.status ===
        "finished",
    );

  const scheduledMatches =
    barcelonaMatches.filter(
      (
        match,
      ) =>
        match.status ===
        "scheduled",
    );

  const latestActivity =
    latestDate(
      barcelonaMatches.map(
        (
          match,
        ) =>
          match.updatedAt,
      ),
    );

  return {
    generatedAt:
      new Date()
        .toISOString(),

    environment:
      process.env.NODE_ENV ??
      "development",

    executionEnabled:
      process.env.NODE_ENV !==
      "production",

    season: {
      id:
        season.id,

      label:
        season.label,
    },

    automation: {
      internalJobConfigured:
        Boolean(
          process.env
            .INTERNAL_JOB_SECRET,
        ),

      footballDataConfigured:
        Boolean(
          process.env
            .FOOTBALL_DATA_API_KEY,
        ),

      goalApiConfigured: Boolean(process.env.GOAL_API_KEY),

      richMatchConfigured:
        Boolean(
          process.env
            .GOAL_API_KEY,
        ) &&
        (
          Boolean(
            process.env
              .BBS_API_KEY,
          ) ||
          Boolean(
            process.env
              .STATSHAWK_API_KEY,
          )
        ),

      youtubeConfigured:
        Boolean(
          process.env
            .YOUTUBE_API_KEY,
        ),
    },

    summary: {
      matches:
        barcelonaMatches.length,

      finished:
        finishedMatches.length,

      scheduled:
        scheduledMatches.length,

      latestActivity,
    },

    matches:
      barcelonaMatches.map(
        (
          match,
        ) => ({
          id:
            match.id,

          label:
            `${match.homeTeam.shortName ?? match.homeTeam.name} vs ${match.awayTeam.shortName ?? match.awayTeam.name}`,

          homeTeam:
            match.homeTeam
              .shortName ??
            match.homeTeam
              .name,

          awayTeam:
            match.awayTeam
              .shortName ??
            match.awayTeam
              .name,

          competition:
            match.competition
              .shortName ??
            match.competition
              .name,

          competitionCode:
            match.competition
              .code,

          kickoff:
            match.kickoff
              .toString(),

          status:
            match.status,

          matchday:
            match.matchday,

          score:
            match.homeScore !==
                null &&
              match.awayScore !==
                null
              ? `${match.homeScore}-${match.awayScore}`
              : null,
        }),
      ),
  };
}

function instantMilliseconds(
  value: {
    toString():
      string;
  },
) {
  return new Date(
    value.toString(),
  ).getTime();
}

function latestDate(
  values:
    Array<
      | {
          toString():
            string;
        }
      | string
      | null
      | undefined
    >,
) {
  let latest:
    string | null =
    null;

  let latestTime =
    -Infinity;

  for (
    const value
    of values
  ) {
    if (!value) {
      continue;
    }

    const iso =
      typeof value ===
      "string"
        ? value
        : value.toString();

    const time =
      new Date(
        iso,
      ).getTime();

    if (
      Number.isFinite(
        time,
      ) &&
      time >
        latestTime
    ) {
      latestTime =
        time;

      latest =
        iso;
    }
  }

  return latest;
}

export type AdminSyncData =
  Awaited<
    ReturnType<
      typeof getAdminSyncData
    >
  >;

import { db } from "../../../prisma/db";
import { Temporal } from "temporal-polyfill";

import {
  getBarcelonaMatches,
  getLaLigaStandings,
} from "./client";

import type {
  FootballDataMatch,
  FootballDataTeam,
} from "./types";

const PROVIDER_CODE = "football-data-org";

/*
|--------------------------------------------------------------------------
| Shared helpers
|--------------------------------------------------------------------------
*/

function dateOnlyToInstant(value: string) {
  return Temporal.Instant.from(
    `${value}T00:00:00Z`,
  );
}

function seasonLabelFromDates(
  startDate: string,
  endDate: string,
) {
  const startYear = Number(
    startDate.slice(0, 4),
  );

  const endYear = Number(
    endDate.slice(0, 4),
  );

  return {
    startYear,
    endYear,

    label:
      `${startYear}/${String(endYear).slice(-2)}`,
  };
}

function mapMatchStatus(
  status: FootballDataMatch["status"],
) {
  switch (status) {
    case "IN_PLAY":
      return "live" as const;

    case "PAUSED":
      return "halftime" as const;

    case "FINISHED":
    case "AWARDED":
      return "finished" as const;

    case "POSTPONED":
    case "SUSPENDED":
      return "postponed" as const;

    case "CANCELLED":
      return "cancelled" as const;

    case "TIMED":
    case "SCHEDULED":
    default:
      return "scheduled" as const;
  }
}

/*
|--------------------------------------------------------------------------
| Provider
|--------------------------------------------------------------------------
*/

async function ensureDataSource() {
  return db.orm.public.DataSource.upsert({
    create: {
      code: PROVIDER_CODE,
      name: "football-data.org",

      baseUrl:
        "https://api.football-data.org/v4",

      isOfficial: false,
      isEnabled: true,

      licenseNotes:
        "Free-tier football data provider. Respect API terms and rate limits.",
    },

    update: {
      name: "football-data.org",

      baseUrl:
        "https://api.football-data.org/v4",

      isEnabled: true,
    },

    conflictOn: {
      code: PROVIDER_CODE,
    },
  });
}

/*
|--------------------------------------------------------------------------
| Provider mappings
|--------------------------------------------------------------------------
*/

async function findProviderMapping({
  dataSourceId,
  entityType,
  providerId,
}: {
  dataSourceId: string;
  entityType:
    | "season"
    | "competition"
    | "team"
    | "player"
    | "match"
    | "event"
    | "media"
    | "trophy";
  providerId: string;
}) {
  return db.orm.public.ProviderMapping
    .where({
      dataSourceId,
      entityType,
      providerId,
    })
    .first();
}

async function ensureProviderMapping({
  dataSourceId,
  entityType,
  internalId,
  providerId,
}: {
  dataSourceId: string;
  entityType:
    | "season"
    | "competition"
    | "team"
    | "player"
    | "match"
    | "event"
    | "media"
    | "trophy";
  internalId: string;
  providerId: string;
}) {
  const existing =
    await findProviderMapping({
      dataSourceId,
      entityType,
      providerId,
    });

  if (existing) {
    return existing;
  }

  return db.orm.public.ProviderMapping.create({
    dataSourceId,
    entityType,
    internalId,
    providerId,
  });
}

/*
|--------------------------------------------------------------------------
| Season
|--------------------------------------------------------------------------
*/

async function ensureSeason({
  dataSourceId,
  providerSeasonId,
  startDate,
  endDate,
}: {
  dataSourceId: string;
  providerSeasonId: number;
  startDate: string;
  endDate: string;
}) {
  const {
    label,
    startYear,
    endYear,
  } = seasonLabelFromDates(
    startDate,
    endDate,
  );

  const season =
    await db.orm.public.Season.upsert({
      create: {
        label,
        startYear,
        endYear,

        startDate:
          dateOnlyToInstant(startDate),

        endDate:
          dateOnlyToInstant(endDate),

        era: "modern",
        isCurrent: true,

        visualKey: label,
      },

      update: {
        startDate:
          dateOnlyToInstant(startDate),

        endDate:
          dateOnlyToInstant(endDate),

        era: "modern",
        isCurrent: true,
      },

      conflictOn: {
        label,
      },
    });

  await ensureProviderMapping({
    dataSourceId,
    entityType: "season",

    internalId: season.id,

    providerId:
      String(providerSeasonId),
  });

  return season;
}

/*
|--------------------------------------------------------------------------
| Competition
|--------------------------------------------------------------------------
*/

async function ensureCompetition({
  dataSourceId,
  providerId,
  name,
  code,
  type,
  emblem,
  country,
}: {
  dataSourceId: string;
  providerId: number;
  name: string;
  code: string;
  type: string;
  emblem: string | null;
  country: string | null;
}) {
  const competitionType =
    type === "LEAGUE"
      ? ("league" as const)
      : type === "CUP"
        ? ("cup" as const)
        : ("other" as const);

  const competition =
    await db.orm.public.Competition.upsert({
      create: {
        name,

        shortName:
          code === "PD"
            ? "La Liga"
            : name,

        code,

        type: competitionType,

        country,

        logoUrl: emblem,
      },

      update: {
        name,

        shortName:
          code === "PD"
            ? "La Liga"
            : name,

        type: competitionType,

        country,

        logoUrl: emblem,
      },

      conflictOn: {
        code,
      },
    });

  await ensureProviderMapping({
    dataSourceId,
    entityType: "competition",

    internalId:
      competition.id,

    providerId:
      String(providerId),
  });

  return competition;
}

/*
|--------------------------------------------------------------------------
| Team
|--------------------------------------------------------------------------
*/

async function ensureTeam({
  dataSourceId,
  providerTeam,
  country,
}: {
  dataSourceId: string;
  providerTeam: FootballDataTeam;
  country: string | null;
}) {
  /*
   * Prefer provider ID mapping over TLA because
   * provider IDs are the reliable identity.
   */
  const mapping =
    await findProviderMapping({
      dataSourceId,

      entityType: "team",

      providerId:
        String(providerTeam.id),
    });

  if (mapping) {
    const existingTeam =
      await db.orm.public.Team
        .where({
          id: mapping.internalId,
        })
        .first();

    if (existingTeam) {
      await db.orm.public.Team
        .where({
          id: existingTeam.id,
        })
        .update({
          name: providerTeam.name,

          shortName:
            providerTeam.shortName ??
            null,

          country,

          crestUrl:
            providerTeam.crest ??
            null,

          isBarcelona:
            providerTeam.id === 81,
        });

      return existingTeam;
    }
  }

  const fallbackCode =
    providerTeam.tla ??
    `FD-${providerTeam.id}`;

  const team =
    await db.orm.public.Team.upsert({
      create: {
        name: providerTeam.name,

        shortName:
          providerTeam.shortName ??
          null,

        code: fallbackCode,

        country,

        crestUrl:
          providerTeam.crest ??
          null,

        isBarcelona:
          providerTeam.id === 81,
      },

      update: {
        name: providerTeam.name,

        shortName:
          providerTeam.shortName ??
          null,

        country,

        crestUrl:
          providerTeam.crest ??
          null,

        isBarcelona:
          providerTeam.id === 81,
      },

      conflictOn: {
        code: fallbackCode,
      },
    });

  await ensureProviderMapping({
    dataSourceId,

    entityType: "team",

    internalId: team.id,

    providerId:
      String(providerTeam.id),
  });

  return team;
}

/*
|--------------------------------------------------------------------------
| Existing La Liga standings sync
|--------------------------------------------------------------------------
*/

export async function syncLaLigaCurrentSeason() {
  const standingsResponse =
    await getLaLigaStandings();

  const totalStanding =
    standingsResponse.standings.find(
      (standing) =>
        standing.type === "TOTAL",
    );

  if (!totalStanding) {
    throw new Error(
      "football-data.org did not return TOTAL La Liga standings.",
    );
  }

  const dataSource =
    await ensureDataSource();

  const providerSeason =
    standingsResponse.season;

  const season =
    await ensureSeason({
      dataSourceId: dataSource.id,

      providerSeasonId:
        providerSeason.id,

      startDate:
        providerSeason.startDate,

      endDate:
        providerSeason.endDate,
    });

  const providerCompetition =
    standingsResponse.competition;

  const competition =
    await ensureCompetition({
      dataSourceId: dataSource.id,

      providerId:
        providerCompetition.id,

      name:
        providerCompetition.name,

      code:
        providerCompetition.code,

      type:
        providerCompetition.type,

      emblem:
        providerCompetition.emblem,

      country:
        standingsResponse.area.name,
    });

  let teamsSynced = 0;
  let standingsSynced = 0;

  for (const row of totalStanding.table) {
    const team =
      await ensureTeam({
        dataSourceId:
          dataSource.id,

        providerTeam:
          row.team,

        country:
          standingsResponse.area.name,
      });

    teamsSynced += 1;

    const matchday =
      providerSeason.currentMatchday ??
      row.playedGames;

    const existing =
      await db.orm.public.StandingSnapshot
        .where({
          seasonId:
            season.id,

          competitionId:
            competition.id,

          matchday,

          teamId:
            team.id,
        })
        .first();

    const snapshot = {
      position:
        row.position,

      played:
        row.playedGames,

      won:
        row.won,

      drawn:
        row.draw,

      lost:
        row.lost,

      goalsFor:
        row.goalsFor,

      goalsAgainst:
        row.goalsAgainst,

      goalDifference:
        row.goalDifference,

      points:
        row.points,

      snapshotAt:
        Temporal.Now.instant(),
    };

    if (existing) {
      await db.orm.public.StandingSnapshot
        .where({
          id: existing.id,
        })
        .update(snapshot);
    } else {
      await db.orm.public.StandingSnapshot.create({
        seasonId:
          season.id,

        competitionId:
          competition.id,

        teamId:
          team.id,

        matchday,

        ...snapshot,
      });
    }

    standingsSynced += 1;
  }

  return {
    provider:
      dataSource.name,

    season: {
      id:
        season.id,

      label:
        season.label,
    },

    competition: {
      id:
        competition.id,

      name:
        competition.name,
    },

    teamsSynced,
    standingsSynced,

    barcelona:
      totalStanding.table.find(
        (row) =>
          row.team.id === 81,
      ) ?? null,
  };
}

/*
|--------------------------------------------------------------------------
| Barça matches sync
|--------------------------------------------------------------------------
*/

export async function syncBarcelonaMatches() {
  const response =
    await getBarcelonaMatches();

  const dataSource =
    await ensureDataSource();

  let matchesCreated = 0;
  let matchesUpdated = 0;

  const competitions =
    new Set<string>();

  for (const providerMatch of response.matches) {
    /*
    |--------------------------------------------------------------------------
    | Season
    |--------------------------------------------------------------------------
    */

    const season =
      await ensureSeason({
        dataSourceId:
          dataSource.id,

        providerSeasonId:
          providerMatch.season.id,

        startDate:
          providerMatch.season.startDate,

        endDate:
          providerMatch.season.endDate,
      });

    /*
    |--------------------------------------------------------------------------
    | Competition
    |--------------------------------------------------------------------------
    */

    const competition =
      await ensureCompetition({
        dataSourceId:
          dataSource.id,

        providerId:
          providerMatch.competition.id,

        name:
          providerMatch.competition.name,

        code:
          providerMatch.competition.code,

        type:
          providerMatch.competition.type,

        emblem:
          providerMatch.competition.emblem,

        country:
          providerMatch.area.name,
      });

    competitions.add(
      competition.code,
    );

    /*
    |--------------------------------------------------------------------------
    | Teams
    |--------------------------------------------------------------------------
    */

    const homeTeam =
      await ensureTeam({
        dataSourceId:
          dataSource.id,

        providerTeam:
          providerMatch.homeTeam,

        country:
          providerMatch.area.name,
      });

    const awayTeam =
      await ensureTeam({
        dataSourceId:
          dataSource.id,

        providerTeam:
          providerMatch.awayTeam,

        country:
          providerMatch.area.name,
      });

    /*
    |--------------------------------------------------------------------------
    | Match
    |--------------------------------------------------------------------------
    */

    const mapping =
      await findProviderMapping({
        dataSourceId:
          dataSource.id,

        entityType:
          "match",

        providerId:
          String(providerMatch.id),
      });

    const matchData = {
      seasonId:
        season.id,

      competitionId:
        competition.id,

      homeTeamId:
        homeTeam.id,

      awayTeamId:
        awayTeam.id,

      kickoff:
        Temporal.Instant.from(
          providerMatch.utcDate,
        ),

      status:
        mapMatchStatus(
          providerMatch.status,
        ),

      matchday:
        providerMatch.matchday,

      stage:
        providerMatch.stage,

      round:
        providerMatch.group,

      venue:
        null,

      homeScore:
        providerMatch.score
          .fullTime.home,

      awayScore:
        providerMatch.score
          .fullTime.away,
    };

    if (mapping) {
      const existingMatch =
        await db.orm.public.Match
          .where({
            id:
              mapping.internalId,
          })
          .first();

      if (existingMatch) {
        await db.orm.public.Match
          .where({
            id:
              existingMatch.id,
          })
          .update(
            matchData,
          );

        matchesUpdated += 1;

        continue;
      }
    }

    const match =
      await db.orm.public.Match.create(
        matchData,
      );

    await ensureProviderMapping({
      dataSourceId:
        dataSource.id,

      entityType:
        "match",

      internalId:
        match.id,

      providerId:
        String(providerMatch.id),
    });

    matchesCreated += 1;
  }

  return {
    provider:
      dataSource.name,

    fetched:
      response.matches.length,

    matchesCreated,
    matchesUpdated,

    competitions:
      [...competitions],
  };
}

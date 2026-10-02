import { or } from "@prisma/orm-postgres/orm-client";
import { Temporal } from "temporal-polyfill";

import { db } from "../../prisma/db";
import type { InternalMatch } from "./types";

type MatchWithRelations = NonNullable<Awaited<ReturnType<typeof findLatestMatch>>>;

async function findLatestMatch(barcelonaId: string) {
  return db.orm.public.Match
    .where((match) =>
      or(
        match.homeTeamId.eq(barcelonaId),
        match.awayTeamId.eq(barcelonaId),
      ),
    )
    .where({ status: "finished" })
    .where((match) => match.kickoff.lt(Temporal.Now.instant()))
    .include("homeTeam")
    .include("awayTeam")
    .include("competition")
    .orderBy((match) => match.kickoff.desc())
    .first();
}

async function findMatchById(matchId: string) {
  return db.orm.public.Match
    .where({ id: matchId })
    .include("homeTeam")
    .include("awayTeam")
    .include("competition")
    .first();
}

export class DataLabMatchNotFoundError extends Error {}

export async function getInternalBarcelonaMatch(
  requestedMatchId?: string,
): Promise<InternalMatch> {
  const barcelona = await db.orm.public.Team
    .where({ isBarcelona: true })
    .first();

  if (!barcelona) {
    throw new DataLabMatchNotFoundError(
      "FC Barcelona does not exist in the local database.",
    );
  }

  const match: MatchWithRelations | null = requestedMatchId
    ? await findMatchById(requestedMatchId)
    : await findLatestMatch(barcelona.id);

  if (!match) {
    throw new DataLabMatchNotFoundError(
      requestedMatchId
        ? `No match exists with id ${requestedMatchId}.`
        : "No finished FC Barcelona match exists in the local database.",
    );
  }

  if (
    match.homeTeamId !== barcelona.id &&
    match.awayTeamId !== barcelona.id
  ) {
    throw new DataLabMatchNotFoundError(
      `Match ${match.id} is not an FC Barcelona match.`,
    );
  }

  const mappings = await db.orm.public.ProviderMapping
    .where({ internalId: match.id, entityType: "match" })
    .include("dataSource")
    .all();

  return {
    id: match.id,
    kickoff: match.kickoff.toString(),
    status: match.status,
    competition: {
      id: match.competition.id,
      name: match.competition.name,
      code: match.competition.code,
    },
    seasonId: match.seasonId,
    matchday: match.matchday,
    homeTeam: {
      id: match.homeTeam.id,
      name: match.homeTeam.name,
    },
    awayTeam: {
      id: match.awayTeam.id,
      name: match.awayTeam.name,
    },
    score: {
      home: match.homeScore,
      away: match.awayScore,
    },
    providerIds: Object.fromEntries(
      mappings.map((mapping) => [
        mapping.dataSource.code,
        mapping.providerId,
      ]),
    ),
  };
}

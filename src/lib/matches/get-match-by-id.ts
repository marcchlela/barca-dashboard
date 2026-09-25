import { db } from "../../prisma/db";

export async function getMatchById(
  id: string,
) {
  const match =
    await db.orm.public.Match
      .where({
        id,
      })
      .include("homeTeam")
      .include("awayTeam")
      .include("competition")
      .include("season")
      .first();

  if (!match) {
    return null;
  }

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

    homeScore:
      match.homeScore,

    awayScore:
      match.awayScore,

    competition: {
      name:
        match.competition.name,

      shortName:
        match.competition.shortName,

      code:
        match.competition.code,

      logoUrl:
        match.competition.logoUrl,
    },

    season: {
      label:
        match.season.label,
    },

    homeTeam: {
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
      name:
        match.awayTeam.name,

      shortName:
        match.awayTeam.shortName,

      code:
        match.awayTeam.code,

      crestUrl:
        match.awayTeam.crestUrl,
    },
  };
}
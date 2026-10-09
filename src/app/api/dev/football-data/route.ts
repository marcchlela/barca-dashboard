import { NextResponse } from "next/server";

import {
  getBarcelonaTeam,
  getLaLigaStandings,
} from "../../../../lib/providers/football-data/client";

export async function GET() {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  try {
    const [barcelona, standings] =
      await Promise.all([
        getBarcelonaTeam(),
        getLaLigaStandings(),
      ]);

    const totalTable = standings.standings.find(
      (standing) => standing.type === "TOTAL",
    );

    const barcelonaStanding =
      totalTable?.table.find(
        (entry) => entry.team.id === barcelona.id,
      ) ?? null;

    return NextResponse.json({
      provider: "football-data.org",

      barcelona: {
        id: barcelona.id,
        name: barcelona.name,
        shortName: barcelona.shortName,
        tla: barcelona.tla,
        crest: barcelona.crest,
        venue: barcelona.venue,
      },

      laLiga: {
        name: standings.competition.name,
        season: standings.season,
        barcelona: barcelonaStanding,
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown football-data error",
      },
      {
        status: 500,
      },
    );
  }
}

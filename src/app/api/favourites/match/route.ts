import { NextResponse } from "next/server";
import { db } from "../../../../prisma/db";

type Body = { seasonId?: unknown; matchId?: unknown; slot?: unknown };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PUT(request: Request) {
  try {
    const body = await request.json() as Body;
    if (typeof body.seasonId !== "string" || !uuid.test(body.seasonId) || !Number.isInteger(body.slot) || ![1, 2, 3].includes(body.slot as number) || (body.matchId !== null && (typeof body.matchId !== "string" || !uuid.test(body.matchId)))) {
      return NextResponse.json({ ok: false, error: "A season, slot 1–3, and valid match ID (or null) are required." }, { status: 400 });
    }

    const seasonId = body.seasonId;
    const slot = body.slot as number;
    const matchId = body.matchId as string | null;
    const season = await db.orm.public.Season.where({ id: seasonId }).first();
    if (!season) return NextResponse.json({ ok: false, error: "Season not found." }, { status: 404 });

    if (matchId) {
      const match = await db.orm.public.Match.include("homeTeam").include("awayTeam").where({ id: matchId }).first();
      if (!match || match.seasonId !== seasonId || match.status !== "finished" || (!match.homeTeam.isBarcelona && !match.awayTeam.isBarcelona)) {
        return NextResponse.json({ ok: false, error: "Choose a finished Barça match from this season." }, { status: 400 });
      }
      const alreadyPicked = await db.orm.public.FavouriteMatch.where({ matchId }).first();
      if (alreadyPicked && (alreadyPicked.seasonId !== seasonId || alreadyPicked.slot !== slot)) {
        return NextResponse.json({ ok: false, error: "That match is already in your top three." }, { status: 409 });
      }
    }

    const existing = await db.orm.public.FavouriteMatch.where({ seasonId, slot }).first();
    if (existing && !matchId) await db.orm.public.FavouriteMatch.where({ id: existing.id }).delete();
    else if (existing && matchId && existing.matchId !== matchId) await db.orm.public.FavouriteMatch.where({ id: existing.id }).update({ matchId });
    else if (!existing && matchId) await db.orm.public.FavouriteMatch.create({ seasonId, matchId, slot });
    return NextResponse.json({ ok: true, result: { seasonId, slot, matchId } });
  } catch (error) {
    console.error("FAVOURITE MATCH SAVE FAILED:", error);
    return NextResponse.json({ ok: false, error: "Could not save your top match. Please try again." }, { status: 500 });
  }
}

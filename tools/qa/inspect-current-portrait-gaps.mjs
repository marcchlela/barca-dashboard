import { db } from "../../src/prisma/db.ts";

const season = await db.orm.public.Season.where({ isCurrent: true }).first();
const team = await db.orm.public.Team.where({ isBarcelona: true }).first();
if (!season || !team) throw new Error("Current season or Barça team missing.");

const rows = await db.orm.public.SquadMembership.where({ seasonId: season.id, teamId: team.id }).include("player").all();
for (const row of rows) {
  if (!row.player?.isActive || row.player.portraitUrl) continue;
  console.log(JSON.stringify({
    name: row.player.displayName,
    position: row.position,
    leftAt: row.leftAt?.toString() ?? null,
    currentlyShown: !row.leftAt || Date.parse(row.leftAt.toString()) > Date.now(),
  }));
}

process.exit(0);

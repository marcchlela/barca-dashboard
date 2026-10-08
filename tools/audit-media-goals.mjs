#!/usr/bin/env node
// Read-only event audit before assigning an official film to one canonical goal.
import "dotenv/config";
import "temporal-polyfill/full/global";
import postgres from "@prisma/orm-postgres/runtime";
import contractJson from "../src/prisma/contract.json" with { type: "json" };

const db = postgres({ contractJson, url: process.env.DATABASE_URL, verifyMarker: false });
const season = await db.orm.public.Season.where({ isCurrent: true }).first();
if (!season) throw new Error("Current season unavailable.");
const matches = await db.orm.public.Match.where({ seasonId: season.id, status: "finished" }).include("homeTeam").include("awayTeam").orderBy((match) => match.kickoff.asc()).all();
const events = await db.orm.public.MatchEvent.include("primaryPlayer").all();
for (const match of matches.filter((match) => match.homeTeam.isBarcelona || match.awayTeam.isBarcelona)) {
  const goals = events.filter((event) => event.matchId === match.id && ["goal", "own_goal", "penalty_goal"].includes(event.type));
  console.log(JSON.stringify({ fixture: `${match.homeTeam.name} ${match.homeScore}-${match.awayScore} ${match.awayTeam.name}`, matchId: match.id, goals: goals.map((goal) => ({ id: goal.id, minute: goal.minute, scorer: goal.primaryPlayer?.displayName ?? null, teamId: goal.teamId, type: goal.type })) }));
}

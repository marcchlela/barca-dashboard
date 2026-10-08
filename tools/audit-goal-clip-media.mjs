#!/usr/bin/env node
// Read-only: identify stored goal-clip labels before manual footage review.
import "dotenv/config";
import "temporal-polyfill/full/global";
import postgres from "@prisma/orm-postgres/runtime";
import contractJson from "../src/prisma/contract.json" with { type: "json" };

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const db = postgres({ contractJson, url: process.env.DATABASE_URL, verifyMarker: false });
const [clips, moments] = await Promise.all([
  db.orm.public.MediaItem.where({ type: "goal_clip" }).all(),
  db.orm.public.MediaMoment.all(),
]);
console.log(JSON.stringify(clips.map((clip) => ({
  id: clip.id,
  url: clip.url,
  title: clip.title,
  matchId: clip.matchId,
  exactGoalLinks: moments.filter((moment) => moment.mediaItemId === clip.id).length,
})), null, 2));

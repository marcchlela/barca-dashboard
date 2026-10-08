#!/usr/bin/env node
// Curated, fixture-checked official Barça videos. Preview by default; pass --write to persist.
import "dotenv/config";
import "temporal-polyfill/full/global";
import postgres from "@prisma/orm-postgres/runtime";
import contractJson from "../src/prisma/contract.json" with { type: "json" };

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const db = postgres({ contractJson, url: process.env.DATABASE_URL, verifyMarker: false });
const write = process.argv.includes("--write");
const season = await db.orm.public.Season.where({ isCurrent: true }).first();
if (!season) throw new Error("No current season.");
const matches = await db.orm.public.Match.where({ seasonId: season.id }).include("homeTeam").include("awayTeam").all();

const films = [
  { date: "2026-09-19", home: "Sevilla", away: "Barcelona", homeScore: 1, awayScore: 3,
    type: "press_conference", title: "Hansi Flick ahead of Sevilla",
    description: "Official Barça video of Flick's thoughts before the 2026/27 away match at Sevilla.",
    url: "https://www.fcbarcelona.com/en/videos/4578323" },
  { date: "2026-09-09", home: "Barcelona", away: "Feyenoord", homeScore: 5, awayScore: 1,
    type: "press_conference", title: "Hansi Flick ahead of Feyenoord",
    description: "Official Barça video of Flick's pre-match comments before the 2026/27 Champions League opener.",
    url: "https://www.fcbarcelona.com/en/videos/4573788" },
  { date: "2026-09-09", home: "Barcelona", away: "Feyenoord", homeScore: 5, awayScore: 1,
    type: "interview", title: "Flick reacts to the Feyenoord win",
    description: "Official Barça post-match reaction after the 5–1 Champions League win.",
    url: "https://www.fcbarcelona.com/en/videos/4574402" },
  { date: "2026-09-13", home: "Levante", away: "Barcelona", homeScore: 2, awayScore: 4,
    type: "press_conference", title: "Hansi Flick ahead of Levante",
    description: "Official Barça video of Flick's views before the 2026/27 away match at Levante.",
    url: "https://www.fcbarcelona.com/en/videos/4575581" },
  { date: "2026-09-13", home: "Levante", away: "Barcelona", homeScore: 2, awayScore: 4,
    type: "interview", title: "Flick reacts to the Levante win",
    description: "Official Barça post-match reaction after the 4–2 win at Levante.",
    url: "https://www.fcbarcelona.com/en/videos/4575904" },
];

const plan = [];
for (const film of films) {
  const candidates = matches.filter((match) =>
    match.kickoff.toString().slice(0, 10) === film.date &&
    match.homeTeam.name.toLowerCase().includes(film.home.toLowerCase()) &&
    match.awayTeam.name.toLowerCase().includes(film.away.toLowerCase()) &&
    match.homeScore === film.homeScore && match.awayScore === film.awayScore,
  );
  if (candidates.length !== 1) throw new Error(`Expected exactly one canonical fixture for ${film.title}; found ${candidates.length}.`);
  const match = candidates[0];
  const existing = await db.orm.public.MediaItem.where({ url: film.url }).first();
  if (existing && (existing.matchId !== match.id || existing.type !== film.type || existing.isOfficial !== true)) {
    throw new Error(`Existing video conflicts with curation: ${film.url}`);
  }
  plan.push({ film, matchId: match.id, action: existing ? "unchanged" : "create" });
}
if (write) {
  for (const row of plan.filter((row) => row.action === "create")) {
    await db.orm.public.MediaItem.create({ type: row.film.type, title: row.film.title, description: row.film.description, url: row.film.url, isOfficial: true, seasonId: season.id, matchId: row.matchId });
  }
}
console.log(JSON.stringify({ mode: write ? "write" : "preview", created: write ? plan.filter((row) => row.action === "create").length : 0, films: plan.map(({ film, matchId, action }) => ({ title: film.title, matchId, action, url: film.url })) }, null, 2));

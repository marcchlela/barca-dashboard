#!/usr/bin/env node
// Deliberate, idempotent curation of individually verified official archive URLs.
import "dotenv/config";
import "temporal-polyfill/full/global";
import postgres from "@prisma/orm-postgres/runtime";
import contractJson from "../src/prisma/contract.json" with { type: "json" };

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const db = postgres({ contractJson, url: process.env.DATABASE_URL, verifyMarker: false });
const seasons = await db.orm.public.Season.all();
const byYear = new Map(seasons.map((season) => [season.startYear, season]));
const catalogue = [
  {
    year: 2014,
    type: "match_highlight",
    title: "2015 Champions League final · Juventus 1–3 Barça",
    description: "Official Barça highlights of the Berlin final on 6 June 2015. Watch at Barça Play; access may vary.",
    url: "https://www.fcbarcelona.com/en/videos/817512",
  },
  {
    year: 2014,
    type: "historical",
    title: "The Berlin final · full match",
    description: "The complete Juventus–Barça 2015 Champions League final in Barça's archive. Access may require Barça Play Premium.",
    url: "https://www.fcbarcelona.com/en/videos/817552",
  },
  {
    year: 2016,
    type: "match_highlight",
    title: "La Remontada · Barça 6–1 Paris",
    description: "Official ten-minute highlights of the 8 March 2017 comeback. Watch at Barça Play; access may vary.",
    url: "https://www.fcbarcelona.com/en/videos/1607907",
  },
  {
    year: 2016,
    type: "goal_clip",
    title: "Sergi Roberto's winner against Paris",
    description: "Official Barça video explicitly depicting Roberto's decisive goal in the 2017 comeback. This historical clip is not linked to a canonical MatchEvent.",
    url: "https://www.fcbarcelona.com/en/videos/966945",
  },
  {
    year: 2016,
    type: "historical",
    title: "La Remontada · full match",
    description: "The complete 2017 Barça–Paris match in Barça's archive. Access may require Barça Play Premium.",
    url: "https://www.fcbarcelona.com/en/videos/776784",
  },
];

let created = 0;
let unchanged = 0;
for (const entry of catalogue) {
  const season = byYear.get(entry.year);
  if (!season) throw new Error(`Missing ${entry.year}/${String(entry.year + 1).slice(-2)} canonical season.`);
  const existing = await db.orm.public.MediaItem.where({ url: entry.url }).first();
  if (existing) {
    if (existing.seasonId !== season.id || existing.type !== entry.type) throw new Error(`Existing media conflicts with curation: ${entry.url}`);
    unchanged += 1;
    continue;
  }
  await db.orm.public.MediaItem.create({
    type: entry.type,
    title: entry.title,
    description: entry.description,
    url: entry.url,
    isOfficial: true,
    seasonId: season.id,
  });
  created += 1;
}
console.log(JSON.stringify({ created, unchanged, total: catalogue.length }, null, 2));

#!/usr/bin/env node
// Read-only local audit: node --experimental-strip-types tools/qa-club-history.mjs
import "dotenv/config";
import "temporal-polyfill/full/global";
import postgres from "@prisma/orm-postgres/runtime";
import contractJson from "../src/prisma/contract.json" with { type: "json" };
import { CLUB_SEASONS, CLUB_HONOURS, CLUB_MOMENTS } from "../src/lib/club/history.ts";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const db = postgres({ contractJson, url: process.env.DATABASE_URL, verifyMarker: false });
const [seasons, moments, matches] = await Promise.all([
  db.orm.public.Season.all(), db.orm.public.SeasonMoment.all(), db.orm.public.Match.all(),
]);
const issues = [];
const byYear = new Map(seasons.map((season) => [season.startYear, season]));
for (const curated of CLUB_SEASONS) {
  const season = byYear.get(curated.startYear);
  if (!season) issues.push(`Missing ${curated.label}`);
  else if (season.endYear !== curated.endYear) issues.push(`End-year mismatch: ${curated.label}`);
}
const current = seasons.filter((season) => season.isCurrent);
if (current.length !== 1 || current[0]?.startYear !== 2026) issues.push("Current season is not uniquely 2026/27.");
const mapped = new Map();
for (const moment of moments) {
  const metadata = moment.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata) || !("clubCurationId" in metadata)) continue;
  const key = String(metadata.clubCurationId);
  mapped.set(key, (mapped.get(key) ?? 0) + 1);
  if (!("sourceUrl" in metadata) || !String(metadata.sourceUrl).startsWith("https://")) issues.push(`Missing source: ${key}`);
}
for (const honour of CLUB_HONOURS.filter((item) => item.startYear !== null)) {
  const key = `honour:${honour.name}:${honour.publishedLabel}`;
  if (mapped.get(key) !== 1) issues.push(`Honour not stored exactly once: ${key}`);
}
for (const moment of CLUB_MOMENTS) if (mapped.get(`moment:${moment.id}`) !== 1) issues.push(`Story moment not stored exactly once: ${moment.id}`);
if (mapped.has("honour:Mediterranean League:1937")) issues.push("Calendar-year-only 1937 honour was assigned to a season.");
if (!matches.some((match) => match.seasonId === current[0]?.id)) issues.push("Current-season match spine missing.");
console.log(JSON.stringify({ ok: issues.length === 0, indexedSeasons: CLUB_SEASONS.length, storedSeasons: CLUB_SEASONS.filter((item) => byYear.has(item.startYear)).length, storedCuratedMoments: mapped.size, currentSeasonId: current[0]?.id ?? null, currentMatches: matches.filter((match) => match.seasonId === current[0]?.id).length, issues }, null, 2));
process.exit(issues.length ? 1 : 0);

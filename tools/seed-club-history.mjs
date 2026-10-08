#!/usr/bin/env node
// Run explicitly: node --experimental-strip-types tools/seed-club-history.mjs
// Additive and repeatable: never changes an existing season or current-season ID.
import "dotenv/config";
import "temporal-polyfill/full/global";
import postgres from "@prisma/orm-postgres/runtime";
import contractJson from "../src/prisma/contract.json" with { type: "json" };
import { CLUB_SEASONS, CLUB_HONOURS, CHRONOLOGY_SOURCE } from "../src/lib/club/history.ts";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const db = postgres({ contractJson, url: process.env.DATABASE_URL, verifyMarker: false });
const dryRun = process.argv.includes("--preview");

if (CLUB_SEASONS.length !== 128 || CLUB_SEASONS[0].startYear !== 1899 || CLUB_SEASONS.at(-1).startYear !== 2026 ||
    CLUB_SEASONS.some((season, index) => index > 0 && season.startYear !== CLUB_SEASONS[index - 1].startYear + 1)) {
  throw new Error("The men’s season spine is not continuous from 1899–1900 through 2026–27.");
}
const ambiguous = CLUB_HONOURS.filter((honour) => honour.startYear === null);
const currentBefore = await db.orm.public.Season.where({ isCurrent: true }).first();
if (!currentBefore || currentBefore.startYear !== 2026) throw new Error("Expected the canonical current 2026/27 season before import.");
const existingSeasons = await db.orm.public.Season.all();
const byYear = new Map(existingSeasons.map((season) => [season.startYear, season]));
const missing = CLUB_SEASONS.filter((season) => !byYear.has(season.startYear));
console.log(JSON.stringify({ mode: dryRun ? "preview" : "write", seasonCount: CLUB_SEASONS.length, missingSeasons: missing.length, source: CHRONOLOGY_SOURCE, ambiguousHonours: ambiguous.map((item) => `${item.name} ${item.publishedLabel}`) }, null, 2));
if (dryRun) process.exit(0);

for (const season of CLUB_SEASONS) {
  const existing = byYear.get(season.startYear);
  if (existing) {
    if (existing.endYear !== season.endYear) throw new Error(`Existing season ${existing.label} has unexpected end year.`);
    continue;
  }
  const created = await db.orm.public.Season.create({
    label: season.label, startYear: season.startYear, endYear: season.endYear,
    era: season.startYear >= 2000 ? "modern" : season.startYear >= 1950 ? "older" : "historic",
    isCurrent: false, visualKey: `club:${season.era.id}`,
  });
  byYear.set(season.startYear, created);
}

const existingMoments = await db.orm.public.SeasonMoment.all();
const keys = new Set(existingMoments.map((moment) => {
  const metadata = moment.metadata;
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) && "clubCurationId" in metadata ? String(metadata.clubCurationId) : null;
}).filter(Boolean));
let momentsCreated = 0;
for (const season of CLUB_SEASONS) {
  const seasonId = byYear.get(season.startYear)?.id;
  if (!seasonId) throw new Error(`Missing canonical ID for ${season.label}`);
  for (const honour of season.honours) {
    const clubCurationId = `honour:${honour.name}:${honour.publishedLabel}`;
    if (keys.has(clubCurationId)) continue;
    await db.orm.public.SeasonMoment.create({
      seasonId, type: "trophy", title: honour.name,
      description: `Official honours record: ${honour.publishedLabel}`,
      occurredAt: Temporal.Instant.from(`${season.startYear}-07-01T12:00:00Z`),
      importance: honour.name === "Champions League" ? 5 : 2,
      metadata: { clubCurationId, sourceUrl: honour.source, publishedLabel: honour.publishedLabel, datePrecision: "season" },
    });
    keys.add(clubCurationId); momentsCreated++;
  }
  for (const moment of season.moments) {
    const clubCurationId = `moment:${moment.id}`;
    if (keys.has(clubCurationId)) continue;
    await db.orm.public.SeasonMoment.create({
      seasonId, type: "historical", title: moment.title, description: moment.description,
      occurredAt: Temporal.Instant.from(moment.occurredAt), importance: 5,
      metadata: { clubCurationId, sourceUrl: moment.source, datePrecision: moment.preciseDate ? "day" : "season" },
    });
    keys.add(clubCurationId); momentsCreated++;
  }
}
const currentAfter = await db.orm.public.Season.where({ isCurrent: true }).first();
if (currentAfter?.id !== currentBefore.id) throw new Error("Current-season ID changed during Club import.");
console.log(JSON.stringify({ seasonsCreated: missing.length, momentsCreated, currentSeasonIdUnchanged: true }, null, 2));
process.exit(0);

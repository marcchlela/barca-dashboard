#!/usr/bin/env node
// Preview by default; --write imports individually verified official Barça archive uploads.
import "dotenv/config";
import "temporal-polyfill/full/global";
import postgres from "@prisma/orm-postgres/runtime";
import contractJson from "../src/prisma/contract.json" with { type: "json" };

const catalogue = [
  { id: "iVSbEVjD8E4", year: 2008, type: "match_highlight", clue: "united" },
  { id: "fCG5pBNuSbY", year: 2010, type: "match_highlight", clue: "manchester united" },
  { id: "1mVu7AzvCDo", year: 2014, type: "match_highlight", clue: "juventus" },
  { id: "O3potfenY1A", year: 2014, type: "match_feature", clue: "victory celebrations" },
  { id: "u07-rXDFr9w", year: 2014, type: "training", clue: "training session in berlin" },
  { id: "ftecBmF1vH4", year: 2014, type: "match_feature", clue: "lift the champions league trophy" },
  { id: "XFNSzPytLs8", year: 2014, type: "match_feature", clue: "winners 2015" },
  { id: "ZSrGwGD_Vgc", year: 2014, type: "interview", clue: "worked hard to reach the final" },
  { id: "h4m68r8kWAc", year: 2016, type: "match_highlight", clue: "6-1 psg" },
  { id: "SoOHFUh5Dus", year: 2016, type: "match_feature", clue: "final celebrations" },
  { id: "PF7MF9jMNlM", year: 2016, type: "match_feature", clue: "crazy reactions" },
  { id: "zg1bFOLsnDk", year: 2016, type: "match_preview", clue: "psg preview" },
  { id: "LmoBNKPJh7o", year: 2016, type: "training", clue: "gearing up for paris" },
  { id: "_vtHu5Yj83I", year: 2016, type: "interview", clue: "sergi roberto remembers" },
];
const write = process.argv.includes("--write");
if (!process.env.DATABASE_URL || !process.env.YOUTUBE_API_KEY) throw new Error("DATABASE_URL and YOUTUBE_API_KEY are required.");
const db = postgres({ contractJson, url: process.env.DATABASE_URL, verifyMarker: false });
const seasons = await db.orm.public.Season.all();
const byYear = new Map(seasons.map((season) => [season.startYear, season]));
const url = new URL("https://www.googleapis.com/youtube/v3/videos");
url.search = new URLSearchParams({ part: "snippet,contentDetails,status", id: catalogue.map((entry) => entry.id).join(","), key: process.env.YOUTUBE_API_KEY }).toString();
const response = await fetch(url);
if (!response.ok) throw new Error(`YouTube metadata request failed (${response.status}).`);
const payload = await response.json();
const videoById = new Map((payload.items ?? []).map((video) => [video.id, video]));
const source = await db.orm.public.DataSource.where({ code: "youtube-fcbarcelona-official" }).first();
if (write && !source) throw new Error("Official YouTube DataSource is missing; run the existing worker first.");
const plan = [];
for (const entry of catalogue) {
  const video = videoById.get(entry.id);
  const season = byYear.get(entry.year);
  if (!video || !season) throw new Error(`Missing verified video or canonical season for ${entry.id}.`);
  if (video.snippet.channelId !== "UC14UlmYlSNiQCBe9Eookf_A" || video.status.privacyStatus !== "public" || video.status.embeddable !== true) throw new Error(`Unofficial or unavailable video ${entry.id}.`);
  if (!video.snippet.title.toLowerCase().includes(entry.clue)) throw new Error(`Video ${entry.id} no longer matches its curated subject.`);
  const watchUrl = `https://www.youtube.com/watch?v=${entry.id}`;
  const existing = await db.orm.public.MediaItem.where({ url: watchUrl }).first();
  if (existing && (existing.seasonId !== season.id || existing.type !== entry.type || existing.matchId)) throw new Error(`Existing row conflicts with historical curation: ${entry.id}.`);
  plan.push({ entry, video, season, existing });
}
let created = 0;
let unchanged = 0;
for (const row of plan) {
  if (row.existing) { unchanged++; continue; }
  if (write) {
    const thumbs = row.video.snippet.thumbnails ?? {};
    await db.orm.public.MediaItem.create({ type: row.entry.type, title: row.video.snippet.title, description: row.video.snippet.description || null, url: `https://www.youtube.com/watch?v=${row.entry.id}`, externalMediaId: row.entry.id, thumbnailUrl: (thumbs.maxres ?? thumbs.standard ?? thumbs.high ?? thumbs.medium ?? thumbs.default)?.url ?? null, isOfficial: true, publishedAt: Temporal.Instant.from(row.video.snippet.publishedAt), seasonId: row.season.id, dataSourceId: source.id });
    created++;
  }
}
console.log(JSON.stringify({ mode: write ? "write" : "preview", officialVideos: catalogue.length, wouldCreate: write ? 0 : plan.length - unchanged, created, unchanged, subjects: plan.map((row) => ({ id: row.entry.id, season: row.season.label, type: row.entry.type, title: row.video.snippet.title })) }, null, 2));

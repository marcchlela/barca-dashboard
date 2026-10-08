#!/usr/bin/env node
// Read-only discovery of official FC Barcelona uploads near stored current-season fixtures.
import "dotenv/config";
import "temporal-polyfill/full/global";
import postgres from "@prisma/orm-postgres/runtime";
import contractJson from "../src/prisma/contract.json" with { type: "json" };

const apiKey = process.env.YOUTUBE_API_KEY;
if (!apiKey || !process.env.DATABASE_URL) throw new Error("YOUTUBE_API_KEY and DATABASE_URL are required.");
const db = postgres({ contractJson, url: process.env.DATABASE_URL, verifyMarker: false });
const season = await db.orm.public.Season.where({ isCurrent: true }).first();
if (!season) throw new Error("Current season is unavailable.");
const matches = (await db.orm.public.Match.where({ seasonId: season.id, status: "finished" }).include("homeTeam").include("awayTeam").orderBy((match) => match.kickoff.asc()).all())
  .filter((match) => match.homeTeam.isBarcelona || match.awayTeam.isBarcelona);
const stored = await db.orm.public.MediaItem.all();
const storedIds = new Set(stored.flatMap((item) => { try { return [new URL(item.url).searchParams.get("v")].filter(Boolean); } catch { return []; } }));
const startMs = Math.min(...matches.map((match) => Date.parse(match.kickoff.toString()))) - 30 * 60 * 60 * 1000;
const endMs = Math.max(...matches.map((match) => Date.parse(match.kickoff.toString()))) + 80 * 60 * 60 * 1000;
let token;
let requests = 0;
const uploads = [];
for (let page = 0; page < 12; page++) {
  const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
  url.search = new URLSearchParams({ part: "snippet,contentDetails", playlistId: "UU14UlmYlSNiQCBe9Eookf_A", maxResults: "50", key: apiKey, ...(token ? { pageToken: token } : {}) }).toString();
  requests++;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`YouTube playlist request failed (${response.status}); key and quota should be checked without printing the key.`);
  const payload = await response.json();
  if (!Array.isArray(payload.items)) throw new Error("YouTube did not return playlist items.");
  uploads.push(...payload.items.map((item) => ({ id: item.contentDetails?.videoId, title: item.snippet?.title ?? "", publishedAt: item.snippet?.publishedAt ?? "", channelId: item.snippet?.channelId })));
  const oldest = Math.min(...payload.items.map((item) => Date.parse(item.snippet?.publishedAt ?? "")));
  if (!payload.nextPageToken || oldest < startMs) break;
  token = payload.nextPageToken;
}
const official = uploads.filter((item) => item.channelId === "UC14UlmYlSNiQCBe9Eookf_A" && Date.parse(item.publishedAt) >= startMs && Date.parse(item.publishedAt) <= endMs);
const terms = /preview|previa|press|roda de premsa|rueda de prensa|flick|training|entrenam|entrenam|interview|reaction|highlight|resumen|resum|match|partit|goals|gol|behind the scenes|day of/i;
const output = matches.map((match) => {
  const kickoff = Date.parse(match.kickoff.toString());
  const opponent = match.homeTeam.isBarcelona ? match.awayTeam : match.homeTeam;
  const aliases = [opponent.name, opponent.shortName, opponent.name.split(" ")[0]].filter((value) => value && value.length >= 4);
  const videos = official.filter((video) => {
    const published = Date.parse(video.publishedAt);
    return published >= kickoff - 24 * 60 * 60 * 1000 && published <= kickoff + 72 * 60 * 60 * 1000 && (terms.test(video.title) || aliases.some((alias) => video.title.toLowerCase().includes(alias.toLowerCase())));
  }).map((video) => ({ id: video.id, publishedAt: video.publishedAt, title: video.title, stored: storedIds.has(video.id) }));
  return { matchId: match.id, fixture: `${match.homeTeam.name} ${match.homeScore}-${match.awayScore} ${match.awayTeam.name}`, kickoff: match.kickoff.toString(), videos };
});
console.log(JSON.stringify({ season: season.label, requests, officialUploadsInWindow: official.length, matches: output }, null, 2));

#!/usr/bin/env node
// Read-only baseline: node tools/qa-media-foundation.mjs
import "dotenv/config";
import "temporal-polyfill/full/global";
import postgres from "@prisma/orm-postgres/runtime";
import contractJson from "../src/prisma/contract.json" with { type: "json" };

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const db = postgres({ contractJson, url: process.env.DATABASE_URL, verifyMarker: false });
const [media, seasons, matches, events, moments, saves, reviewCandidates] = await Promise.all([
  db.orm.public.MediaItem.all(),
  db.orm.public.Season.all(),
  db.orm.public.Match.all(),
  db.orm.public.MatchEvent.all(),
  db.orm.public.MediaMoment.all(),
  db.orm.public.MediaSave.all(),
  db.orm.public.MediaReviewCandidate.all(),
]);
const currentSeason = seasons.find((season) => season.isCurrent);
const byType = Object.fromEntries([...new Set(media.map((item) => item.type))].sort().map((type) => [type, media.filter((item) => item.type === type).length]));
const matchedIds = new Set(matches.map((match) => match.id));
const issues = media.filter((item) => item.matchId && !matchedIds.has(item.matchId)).map((item) => `Missing match for media ${item.id}`);
const mediaById = new Map(media.map((item) => [item.id, item]));
const eventById = new Map(events.map((event) => [event.id, event]));
for (const moment of moments) {
  const item = mediaById.get(moment.mediaItemId);
  const event = eventById.get(moment.matchEventId);
  if (!item || !event || !["goal", "own_goal", "penalty_goal"].includes(event.type) || item.matchId !== event.matchId) issues.push(`Invalid exact-goal link ${moment.id}`);
}
console.log(JSON.stringify({
  mediaItems: media.length,
  byType,
  currentSeasonItems: media.filter((item) => item.seasonId === currentSeason?.id).length,
  historicalSeasonItems: media.filter((item) => item.seasonId && item.seasonId !== currentSeason?.id).length,
  matchLinked: media.filter((item) => item.matchId).length,
  playerLinked: media.filter((item) => item.playerId).length,
  official: media.filter((item) => item.isOfficial).length,
  goalEvents: events.filter((event) => ["goal", "own_goal", "penalty_goal"].includes(event.type)).length,
  goalClipItems: media.filter((item) => item.type === "goal_clip").length,
  exactGoalLinks: moments.length,
  featured: media.filter((item) => item.featuredAt).length,
  savedItems: saves.length,
  reviewQueue: Object.fromEntries([...new Set(reviewCandidates.map((candidate) => candidate.status))].sort().map((status) => [status, reviewCandidates.filter((candidate) => candidate.status === status).length])),
  pendingReview: reviewCandidates.filter((candidate) => candidate.status === "pending").map((candidate) => ({ id: candidate.id, title: candidate.title, type: candidate.type, matchId: candidate.matchId, url: candidate.url, score: candidate.score, reasons: candidate.reasons })),
  sample: media.slice(0, 8).map((item) => ({ title: item.title, type: item.type, matchId: item.matchId, url: item.url })),
  issues,
}, null, 2));
process.exit(issues.length ? 1 : 0);

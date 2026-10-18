import "server-only";

import { Temporal } from "temporal-polyfill";
import { db } from "../../../prisma/db";
import { asArray } from "../shared/json";
import { GoalApiClient, GoalApiHttpError } from "./client";
import { BEIN_YOUTUBE_CHANNEL_ID, normalizeBeinHighlight, normalizeBeinYoutubeHighlight, type BeinHighlightCandidate } from "./bein-normalize";

const LOCK_KEY = "goal-api-bein-highlights";
const MODE = "bein-highlight-refresh";
const SOURCE_CODE = "bein-sports-mena";
const LOOKBACK_MS = 14 * 86_400_000;

async function fetchBeinYoutubeHighlights(match: { kickoff: { toString(): string } }) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];
  const kickoff = Date.parse(match.kickoff.toString());
  const queries = ["برشلونة ملخص", "Barcelona highlights"];
  for (const query of queries) {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("channelId", BEIN_YOUTUBE_CHANNEL_ID);
    url.searchParams.set("type", "video");
    url.searchParams.set("order", "date");
    url.searchParams.set("maxResults", "25");
    url.searchParams.set("publishedAfter", new Date(kickoff - 3 * 3_600_000).toISOString());
    url.searchParams.set("publishedBefore", new Date(kickoff + 72 * 3_600_000).toISOString());
    url.searchParams.set("q", query);
    url.searchParams.set("key", apiKey);
    const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
    const body = await response.json() as { items?: unknown[]; error?: { message?: string } };
    if (!response.ok) throw new Error(`YouTube API request failed (${response.status}): ${body.error?.message ?? response.statusText}`);
    const candidates = (body.items ?? []).map(normalizeBeinYoutubeHighlight).filter((item): item is BeinHighlightCandidate => item !== null);
    if (candidates.length > 0) return candidates;
  }
  return [];
}

function retryDue(last: { status: string; finishedAt: string } | null, now: number) {
  if (!last) return true;
  // The outer media scheduler runs every three hours. Retrying successful empty
  // searches on that same cadence catches highlights published after full time
  // without adding another background loop or increasing the normal job rate.
  const delay = last.status === "blocked" ? 24 * 3_600_000 : 3 * 3_600_000;
  return now >= Date.parse(last.finishedAt) + delay;
}

export async function runBeinHighlightRefresh(input: { client?: GoalApiClient; now?: number } = {}) {
  if (!process.env.YOUTUBE_API_KEY && !process.env.GOAL_API_KEY && !input.client) return { status: "unconfigured" as const, matchId: null, created: 0, error: "YOUTUBE_API_KEY or GOAL_API_KEY is not configured." };
  const now = input.now ?? Date.now();
  const active = await db.orm.public.GoalMediaSyncRun.where({ lockKey: LOCK_KEY }).first();
  if (active && now - Date.parse(active.startedAt.toString()) < 15 * 60_000) return { status: "already-running" as const, matchId: null, created: 0, error: null };
  if (active) await db.orm.public.GoalMediaSyncRun.where({ id: active.id }).update({ lockKey: null, status: "interrupted", finishedAt: Temporal.Instant.from(new Date(now).toISOString()) });
  const latest = await db.orm.public.GoalMediaSyncRun.where({ mode: MODE }).orderBy((run) => run.startedAt.desc()).first();
  if (!retryDue(latest?.finishedAt ? { status: latest.status, finishedAt: latest.finishedAt.toString() } : null, now)) return { status: "cooldown" as const, matchId: null, created: 0, error: null };

  const [source, goalSource, matches, existing] = await Promise.all([
    db.orm.public.DataSource.where({ code: SOURCE_CODE }).first(),
    db.orm.public.DataSource.where({ code: "goal-api" }).first(),
    db.orm.public.Match.where({ status: "finished" }).include("homeTeam").include("awayTeam").orderBy((match) => match.kickoff.desc()).all(),
    db.orm.public.MediaItem.all(),
  ]);
  const candidate = matches.find((match) =>
    (match.homeTeam.isBarcelona || match.awayTeam.isBarcelona) &&
    now - Date.parse(match.kickoff.toString()) <= LOOKBACK_MS &&
    !existing.some((item) => item.matchId === match.id && item.dataSourceId === source?.id && item.type === "match_highlight"),
  );
  if (!candidate) return { status: "complete" as const, matchId: null, created: 0, error: null };
  const mapping = goalSource ? await db.orm.public.ProviderMapping.where({ dataSourceId: goalSource.id, entityType: "match", internalId: candidate.id }).first() : null;
  if (!process.env.YOUTUBE_API_KEY && !mapping) return { status: "no-provider-mapping" as const, matchId: candidate.id, created: 0, error: null };

  const run = await db.orm.public.GoalMediaSyncRun.create({ lockKey: LOCK_KEY, mode: MODE, status: "running", startedAt: Temporal.Instant.from(new Date(now).toISOString()) });
  try {
    let videos = await fetchBeinYoutubeHighlights(candidate);
    if (videos.length === 0 && mapping && (process.env.GOAL_API_KEY || input.client)) {
      const body = await (input.client ?? new GoalApiClient()).get(`/videos/match/${encodeURIComponent(mapping.providerId)}`);
      videos = asArray(body, "data", "videos").map((row) => normalizeBeinHighlight(row, { home: candidate.homeTeam.name, away: candidate.awayTeam.name })).filter((row): row is BeinHighlightCandidate => row !== null);
    }
    if (videos.length > 1) throw new Error(`GOAL video metadata returned ${videos.length} matching beIN highlights; automatic attachment refused as ambiguous.`);
    let created = 0;
    if (videos.length === 1) {
      const mediaSource = source ?? await db.orm.public.DataSource.create({ code: SOURCE_CODE, name: "beIN SPORTS MENA", baseUrl: "https://www.youtube.com/channel/UCJUCcJUeh0Cz2xyKwkw5Q1w", isOfficial: true, isEnabled: true, licenseNotes: "Official broadcaster metadata from its verified YouTube channel or GOAL API; no scraping or media copying." });
      const video = videos[0];
      const duplicate = await db.orm.public.MediaItem.where({ dataSourceId: mediaSource.id, externalMediaId: video.externalId }).first();
      if (!duplicate) {
        await db.orm.public.MediaItem.create({ type: "match_highlight", title: video.title, url: video.url, externalMediaId: video.externalId, thumbnailUrl: video.thumbnailUrl, isOfficial: false, publishedAt: video.publishedAt ? Temporal.Instant.from(video.publishedAt) : null, seasonId: candidate.seasonId, matchId: candidate.id, dataSourceId: mediaSource.id });
        created = 1;
      }
    }
    await db.orm.public.GoalMediaSyncRun.where({ id: run.id }).update({ lockKey: null, status: "success", finishedAt: Temporal.Instant.from(new Date(now).toISOString()), result: { matchId: candidate.id, candidates: videos.length, created } });
    return { status: "success" as const, matchId: candidate.id, created, error: null };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const blocked = (error instanceof GoalApiHttpError && (error.status === 403 || error.status === 429)) || /(?:^|\D)(?:403|429)(?:\D|$)/.test(detail);
    await db.orm.public.GoalMediaSyncRun.where({ id: run.id }).update({ lockKey: null, status: blocked ? "blocked" : "failed", finishedAt: Temporal.Instant.from(new Date(now).toISOString()), error: detail.slice(0, 500) });
    return { status: blocked ? "blocked" as const : "failed" as const, matchId: candidate.id, created: 0, error: detail.slice(0, 500) };
  }
}

import "server-only";

import { Temporal } from "temporal-polyfill";
import { db } from "../../../prisma/db";
import { dailyGoalUrl, fetchDailyGoalMatch } from "./adapter";
import { decideGoals, findFixture, parseYouTubeDuration, shouldPreserveGoalMoment, type CanonicalFixture, type VideoEvidence } from "./match";

const goalTypes = new Set(["goal", "own_goal", "penalty_goal"]);

export async function getOfficialVideoEvidence(id: string): Promise<VideoEvidence | null> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "snippet,contentDetails,status");
  url.searchParams.set("id", id);
  url.searchParams.set("key", key);
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`YouTube metadata returned ${response.status}.`);
  if (Number(response.headers.get("content-length") ?? 0) > 100_000) throw new Error("YouTube metadata response is too large.");
  const payload = await response.json() as { items?: Array<{ id: string; snippet?: { title?: string; channelId?: string; publishedAt?: string }; contentDetails?: { duration?: string }; status?: { embeddable?: boolean; privacyStatus?: string } }> };
  const item = payload.items?.[0];
  if (!item || item.status?.privacyStatus !== "public") return null;
  return { id: item.id, title: item.snippet?.title ?? "", channelId: item.snippet?.channelId ?? "", durationSeconds: parseYouTubeDuration(item.contentDetails?.duration), embeddable: item.status?.embeddable === true, publishedAt: item.snippet?.publishedAt ?? null };
}

export async function previewDailyGoalImport(url: string, preRoll: number) {
  if (!Number.isInteger(preRoll) || preRoll < 0 || preRoll > 10) throw new Error("Pre-roll must be 0–10 seconds.");
  const source = await fetchDailyGoalMatch(url);
  const [matches, events, media, moments, prior, video] = await Promise.all([
    db.orm.public.Match.include("homeTeam").include("awayTeam").include("competition").all(),
    db.orm.public.MatchEvent.include("primaryPlayer").all(),
    db.orm.public.MediaItem.all(),
    db.orm.public.MediaMoment.all(),
    db.orm.public.GoalTimestampCandidate.all(),
    getOfficialVideoEvidence(source.videoId),
  ]);
  const fixtures: CanonicalFixture[] = matches.filter((match) => match.status === "finished" && (match.homeTeam.isBarcelona || match.awayTeam.isBarcelona)).map((match) => ({ id: match.id, kickoff: match.kickoff.toString(), home: match.homeTeam.name, away: match.awayTeam.name, competition: match.competition.code, homeScore: match.homeScore, awayScore: match.awayScore }));
  const fixture = findFixture(source, fixtures);
  const candidates = media.filter((item) => item.externalMediaId === source.videoId || item.url === `https://www.youtube.com/watch?v=${source.videoId}`);
  const attached = candidates.filter((item) => item.matchId === fixture?.id && item.isOfficial && item.type === "match_highlight");
  const mediaItem = attached.length === 1 && candidates.every((item) => item.matchId === fixture?.id) ? attached[0] : null;
  const goals = events.filter((event) => event.matchId === fixture?.id && goalTypes.has(event.type)).map((event) => ({ id: event.id, minute: event.minute, type: event.type, scorer: event.primaryPlayer?.displayName ?? null, rawScorer: event.rawData && typeof event.rawData === "object" && "scorerName" in event.rawData && typeof event.rawData.scorerName === "string" ? event.rawData.scorerName : null }));
  const decisions = decideGoals(source, fixture, goals, video, mediaItem?.id ?? null, preRoll).map((decision) => {
    const existing = moments.find((moment) => moment.matchEventId === decision.matchEventId && moment.mediaItemId === mediaItem?.id);
    const staged = prior.find((candidate) => candidate.clipUrl === decision.clip.permalink);
    const reasons = [...decision.reasons];
    let status = decision.status;
    if (candidates.length > 1 && !mediaItem) reasons.push("Video ID is attached to multiple or conflicting MediaItems.");
    if (staged?.status === "rejected") { status = "rejected" as const; reasons.push("This clip was previously rejected; it cannot auto-publish."); }
    return { ...decision, status, reasons, existing: existing ? { id: existing.id, startSecond: existing.startSecond, verificationBasis: existing.verificationBasis } : null, stagedStatus: staged?.status ?? null };
  });
  return { source, fixture, video, mediaItem: mediaItem ? { id: mediaItem.id, title: mediaItem.title } : null, decisions, summary: { accepted: decisions.filter((item) => item.status === "accepted").length, review: decisions.filter((item) => item.status === "review").length, rejected: decisions.filter((item) => item.status === "rejected").length + source.warnings.length } };
}

export async function applyDailyGoalImport(url: string, preRoll: number, prepared?: Awaited<ReturnType<typeof previewDailyGoalImport>>) {
  const preview = prepared ?? await previewDailyGoalImport(url, preRoll);
  if (prepared && preview.source.url !== dailyGoalUrl(url).toString()) throw new Error("Prepared DailyGoal page does not match the requested URL.");
  let published = 0;
  let preserved = 0;
  let queued = 0;
  const now = Temporal.Now.instant();
  for (const decision of preview.decisions) {
    if (decision.status === "accepted" && preview.mediaItem && decision.matchEventId) {
      if (shouldPreserveGoalMoment(decision.existing)) preserved++;
      else {
        await db.orm.public.MediaMoment.create({ mediaItemId: preview.mediaItem.id, matchEventId: decision.matchEventId, startSecond: decision.startSecond, endSecond: null, evidenceUrl: decision.clip.permalink, reviewNote: "DailyGoal public JSON-LD offset; official YouTube metadata and canonical event matched. Metadata-confirmed, not visually inspected.", verificationBasis: "dailygoal_metadata", verifiedAt: now });
        published++;
      }
      const stale = await db.orm.public.GoalTimestampCandidate.where({ clipUrl: decision.clip.permalink }).first();
      if (stale?.status === "pending" && !stale.reviewedAt && !stale.reviewNote && stale.matchEventId === decision.matchEventId &&
        Array.isArray(stale.reasons) && stale.reasons.length === 1 && stale.reasons[0] === "The official video is not attached to this canonical fixture.") {
        await db.orm.public.GoalTimestampCandidate.where({ id: stale.id }).update({ status: "approved", reviewedAt: now, reviewNote: "Automatically resolved after the official highlight was attached; metadata-confirmed, not visually reviewed.", mediaItemId: preview.mediaItem.id });
      }
    } else if (decision.status === "review") {
      // No official film means there is nothing an admin can safely approve yet.
      // Keep the fixture retryable instead of filling the human review queue.
      if (!preview.mediaItem) continue;
      const existing = await db.orm.public.GoalTimestampCandidate.where({ clipUrl: decision.clip.permalink }).first();
      if (existing?.status === "approved" || existing?.status === "rejected") continue;
      const values = { sourceUrl: preview.source.url, videoId: preview.source.videoId, matchId: preview.fixture?.id ?? null, mediaItemId: preview.mediaItem?.id ?? null, matchEventId: decision.matchEventId, scorer: decision.clip.scorer, minute: decision.clip.minute, sourceSecond: decision.clip.startOffset, startSecond: decision.startSecond, confidence: decision.confidence, reasons: decision.reasons };
      if (existing) await db.orm.public.GoalTimestampCandidate.where({ id: existing.id }).update(values);
      else {
        await db.orm.public.GoalTimestampCandidate.create({ clipUrl: decision.clip.permalink, ...values });
        queued++;
      }
    }
  }
  return { ...preview, applied: { published, preserved, queued, rejected: preview.summary.rejected } };
}

export async function reviewDailyGoalCandidate(input: { id: string; action: "approve" | "reject"; matchEventId?: string; startSecond?: number; reviewNote?: string }) {
  const candidate = await db.orm.public.GoalTimestampCandidate.where({ id: input.id }).first();
  if (!candidate || candidate.status !== "pending") throw new Error("Pending goal timestamp candidate not found.");
  const now = Temporal.Now.instant();
  const note = input.reviewNote?.trim().slice(0, 500) || null;
  if (input.action === "reject") {
    await db.orm.public.GoalTimestampCandidate.where({ id: candidate.id }).update({ status: "rejected", reviewedAt: now, reviewNote: note });
    return { status: "rejected" };
  }
  if (!candidate.matchId || !candidate.mediaItemId) throw new Error("Attach an official film to the canonical fixture before approval.");
  const eventId = input.matchEventId ?? candidate.matchEventId;
  const second = input.startSecond ?? candidate.startSecond;
  if (!eventId || !Number.isInteger(second) || second < 0) throw new Error("Choose a goal and a valid starting second.");
  const [event, media, video] = await Promise.all([db.orm.public.MatchEvent.where({ id: eventId }).first(), db.orm.public.MediaItem.where({ id: candidate.mediaItemId }).first(), getOfficialVideoEvidence(candidate.videoId)]);
  if (!event || event.matchId !== candidate.matchId || !goalTypes.has(event.type)) throw new Error("Choose a canonical goal from this fixture.");
  if (!media || media.matchId !== candidate.matchId || media.externalMediaId !== candidate.videoId || !media.isOfficial || media.type !== "match_highlight" || !video || video.channelId !== "UC14UlmYlSNiQCBe9Eookf_A" || video.durationSeconds === null || second >= video.durationSeconds) throw new Error("Official highlight identity or corrected timestamp could not be verified.");
  const existing = await db.orm.public.MediaMoment.where({ mediaItemId: media.id, matchEventId: event.id }).first();
  if (existing?.verificationBasis === "manual_visual") throw new Error("A manually verified goal link already exists and will not be overwritten.");
  if (existing) await db.orm.public.MediaMoment.where({ id: existing.id }).update({ startSecond: second, endSecond: null, evidenceUrl: candidate.clipUrl, reviewNote: `Admin-approved DailyGoal metadata timestamp. ${note ?? "Footage not recorded as visually inspected."}`, verificationBasis: "dailygoal_admin_review", verifiedAt: now });
  else await db.orm.public.MediaMoment.create({ mediaItemId: media.id, matchEventId: event.id, startSecond: second, endSecond: null, evidenceUrl: candidate.clipUrl, reviewNote: `Admin-approved DailyGoal metadata timestamp. ${note ?? "Footage not recorded as visually inspected."}`, verificationBasis: "dailygoal_admin_review", verifiedAt: now });
  await db.orm.public.GoalTimestampCandidate.where({ id: candidate.id }).update({ status: "approved", reviewedAt: now, reviewNote: note, matchEventId: event.id, startSecond: second });
  return { status: "approved" };
}

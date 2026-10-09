import "server-only";

import { db } from "../../prisma/db";

const GOAL_TYPES = new Set(["goal", "own_goal", "penalty_goal"]);

export async function getMediaCuration() {
  const [media, matches, events, moments, timestampCandidates] = await Promise.all([
    db.orm.public.MediaItem.all(),
    db.orm.public.Match.include("homeTeam").include("awayTeam").all(),
    db.orm.public.MatchEvent.include("primaryPlayer").all(),
    db.orm.public.MediaMoment.all(),
    db.orm.public.GoalTimestampCandidate.where({ status: "pending" }).all(),
  ]);
  const matchById = new Map(matches.map((match) => [match.id, match]));
  const mediaById = new Map(media.map((item) => [item.id, item]));
  const goals = events.filter((event) => GOAL_TYPES.has(event.type)).map((event) => {
    const match = matchById.get(event.matchId);
    return {
      id: event.id,
      matchId: event.matchId,
      label: `${event.minute ?? "?"}' ${event.primaryPlayer?.displayName ?? (event.type === "own_goal" ? "Own goal" : "Scorer unknown")}`,
      matchLabel: match ? `${match.homeTeam.shortName ?? match.homeTeam.name} ${match.homeScore ?? "–"}–${match.awayScore ?? "–"} ${match.awayTeam.shortName ?? match.awayTeam.name}` : "Unknown fixture",
      kickoff: match?.kickoff.toString() ?? null,
    };
  }).sort((a, b) => (b.kickoff ?? "").localeCompare(a.kickoff ?? "") || a.label.localeCompare(b.label));
  return {
    media: media.filter((item) => item.matchId && (item.isOfficial || item.dataSourceId)).map((item) => ({
      id: item.id, matchId: item.matchId!, title: item.title, url: item.url, type: item.type,
      featured: item.featuredAt !== null,
    })).sort((a, b) => a.title.localeCompare(b.title)),
    featured: media.filter((item) => item.isOfficial).map((item) => ({ id: item.id, title: item.title, url: item.url, featured: item.featuredAt !== null })),
    goals,
    moments: moments.map((moment) => ({
      id: moment.id, mediaItemId: moment.mediaItemId, matchEventId: moment.matchEventId,
      mediaTitle: mediaById.get(moment.mediaItemId)?.title ?? "Unknown film",
      goalLabel: goals.find((goal) => goal.id === moment.matchEventId)?.label ?? "Unknown goal",
      startSecond: moment.startSecond, endSecond: moment.endSecond, verificationBasis: moment.verificationBasis,
    })),
    timestampCandidates: timestampCandidates.map((candidate) => ({
      id: candidate.id, clipUrl: candidate.clipUrl, scorer: candidate.scorer, minute: candidate.minute,
      sourceSecond: candidate.sourceSecond, startSecond: candidate.startSecond,
      matchId: candidate.matchId, mediaItemId: candidate.mediaItemId, matchEventId: candidate.matchEventId,
      reasons: Array.isArray(candidate.reasons) ? candidate.reasons.filter((value): value is string => typeof value === "string") : [],
    })),
  };
}

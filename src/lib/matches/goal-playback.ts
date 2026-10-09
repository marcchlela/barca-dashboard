import type { MatchMediaItem } from "./get-match-media";

const GOAL_TYPES = new Set(["goal", "penalty_goal", "own_goal"]);
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export type PlayableGoal = {
  eventId: string;
  label: string;
  videoId: string;
  mediaTitle: string;
  startSecond: number;
  endSecond: number | null;
  verificationBasis: string;
};

export function getYouTubeId(item: Pick<MatchMediaItem, "url" | "externalMediaId">): string | null {
  try {
    const url = new URL(item.url);
    if (url.protocol !== "https:") return null;
    let id: string | null = null;
    if (url.hostname === "youtu.be") id = url.pathname.split("/")[1] ?? null;
    if (["youtube.com", "www.youtube.com", "m.youtube.com", "www.youtube-nocookie.com"].includes(url.hostname)) {
      id = url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/live/")
        ? url.pathname.split("/")[2] ?? null : url.searchParams.get("v");
    }
    if (!id || !VIDEO_ID.test(id) || item.externalMediaId && item.externalMediaId !== id) return null;
    return id;
  } catch { return null; }
}

function priority(basis: string): number {
  if (basis === "manual_visual") return 3;
  if (basis === "dailygoal_admin_review") return 2;
  if (basis === "dailygoal_metadata") return 1;
  return 0;
}

/** MediaMoment already carries the canonical MatchEvent ID; never infer by scorer or minute. */
export function selectPlayableGoals(events: Array<{ id: string; type: string }>, media: MatchMediaItem[]): Map<string, PlayableGoal> {
  const goalIds = new Set(events.filter((event) => GOAL_TYPES.has(event.type)).map((event) => event.id));
  const selected = new Map<string, PlayableGoal>();
  const ranks = new Map<string, number>();
  for (const item of media) {
    if (!item.isOfficial) continue;
    const videoId = getYouTubeId(item);
    if (!videoId) continue;
    for (const moment of item.verifiedGoals) {
      if (!goalIds.has(moment.id) || priority(moment.verificationBasis) === 0) continue;
      const startSecond = moment.startSecond ?? (item.type === "goal_clip" ? 0 : null);
      if (startSecond === null || !Number.isInteger(startSecond) || startSecond < 0) continue;
      const endSecond = moment.endSecond !== null && Number.isInteger(moment.endSecond) && moment.endSecond > startSecond ? moment.endSecond : null;
      const rank = priority(moment.verificationBasis) * 10 + (item.type === "goal_clip" ? 1 : 0);
      if ((ranks.get(moment.id) ?? -1) >= rank) continue;
      selected.set(moment.id, { eventId: moment.id, label: moment.label, videoId, mediaTitle: item.title,
        startSecond, endSecond, verificationBasis: moment.verificationBasis });
      ranks.set(moment.id, rank);
    }
  }
  return selected;
}

export function goalEmbedUrl(goal: PlayableGoal): string {
  const params = new URLSearchParams({ start: String(goal.startSecond), autoplay: "1", rel: "0" });
  if (goal.endSecond !== null) params.set("end", String(goal.endSecond));
  return `https://www.youtube-nocookie.com/embed/${goal.videoId}?${params}`;
}

export function goalYouTubeUrl(goal: PlayableGoal): string {
  return `https://www.youtube.com/watch?v=${goal.videoId}&t=${goal.startSecond}s`;
}

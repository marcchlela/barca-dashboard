export type WatchKind = "live" | "replay" | "highlights_only" | null;

export function validWatchedOn(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function resolveWatchedAt(input: {
  watched: boolean;
  watchType: WatchKind;
  previousWatchType: WatchKind;
  kickoff: string;
  existingWatchedAt: string | null;
  watchedOn: string | null | undefined;
  now: string;
}): string | null {
  if (!input.watched) return null;
  if (input.watchType === "live") return input.kickoff;
  if (input.watchedOn === null) return null;
  if (input.watchedOn !== undefined) {
    if (!validWatchedOn(input.watchedOn)) throw new Error("Watched date must be a real YYYY-MM-DD date.");
    if (input.previousWatchType === input.watchType && input.existingWatchedAt?.slice(0, 10) === input.watchedOn) return input.existingWatchedAt;
    return `${input.watchedOn}T12:00:00Z`;
  }
  return input.previousWatchType === input.watchType && input.existingWatchedAt ? input.existingWatchedAt : input.now;
}

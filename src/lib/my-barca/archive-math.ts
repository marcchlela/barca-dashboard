export const RATING_BINS = Array.from({ length: 10 }, (_, index) => (index + 1) / 2);

export function ratingHistogram(entries: { rating: number | null }[]) {
  return RATING_BINS.map((rating) => ({ rating, count: entries.filter((entry) => entry.rating === rating).length }));
}

export function seasonSummary(entries: { watched: boolean; rating: number | null }[]) {
  const rated = entries.filter((entry) => entry.rating !== null);
  return {
    finished: entries.length,
    watched: entries.filter((entry) => entry.watched).length,
    rated: rated.length,
    average: rated.length ? rated.reduce((sum, entry) => sum + (entry.rating ?? 0), 0) / rated.length : null,
  };
}

export function mostPickedPlayers<T extends { watched: boolean; favouritePlayer: { id: string; name: string } | null }>(entries: T[]) {
  const counts = new Map<string, { player: NonNullable<T["favouritePlayer"]>; count: number }>();
  for (const entry of entries) {
    if (!entry.watched || !entry.favouritePlayer) continue;
    const old = counts.get(entry.favouritePlayer.id);
    counts.set(entry.favouritePlayer.id, { player: entry.favouritePlayer, count: (old?.count ?? 0) + 1 });
  }
  const top = Math.max(0, ...[...counts.values()].map((item) => item.count));
  return [...counts.values()].filter((item) => item.count === top && top > 0).sort((a, b) => a.player.name.localeCompare(b.player.name));
}

export type PlayerPerformanceCoverageRow = {
  matchId: string;
  teamId: string;
  rating: number | null;
  minutes?: number | null;
  goals?: number | null;
  assists?: number | null;
  shots?: number | null;
  shotsOnTarget?: number | null;
  passAccuracy?: number | null;
  tackles?: number | null;
  interceptions?: number | null;
};

/** A finished Barça match still needs the rich provider when no Barça player
 * rating has been stored. Rows without a rating are deliberately incomplete:
 * they can power basic performance tables, but not the requested ratings. */
export function needsBarcelonaPlayerRatings(
  matchId: string,
  barcelonaTeamId: string,
  rows: PlayerPerformanceCoverageRow[],
) {
  return !rows.some((row) =>
    row.matchId === matchId &&
    row.teamId === barcelonaTeamId &&
    row.rating !== null &&
    Number.isFinite(row.rating),
  );
}

/** Ratings are optional because the free fallback provider publishes a useful
 * box score without a rating. A row is complete enough for Match Center when
 * at least one real performance field has been persisted for a Barça player. */
export function needsBarcelonaPlayerPerformance(
  matchId: string,
  barcelonaTeamId: string,
  rows: PlayerPerformanceCoverageRow[],
) {
  const fields: (keyof PlayerPerformanceCoverageRow)[] = [
    "minutes", "goals", "assists", "shots", "shotsOnTarget",
    "passAccuracy", "tackles", "interceptions",
  ];
  return !rows.some((row) =>
    row.matchId === matchId &&
    row.teamId === barcelonaTeamId &&
    fields.some((field) => typeof row[field] === "number" && Number.isFinite(row[field])),
  );
}

export function playerRatingRefreshDue(
  last: { status: string; finishedAt: string } | null,
  now = Date.now(),
) {
  if (!last) return { due: true, nextAt: null as string | null };
  const delay = last.status === "blocked"
    ? 24 * 3_600_000
    : last.status === "success"
      ? 20 * 60_000
      : 3 * 3_600_000;
  const next = Date.parse(last.finishedAt) + delay;
  return {
    due: !Number.isFinite(next) || now >= next,
    nextAt: Number.isFinite(next) ? new Date(next).toISOString() : null,
  };
}

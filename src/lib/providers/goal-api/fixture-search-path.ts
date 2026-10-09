// Verified against GOAL fixture detail for 2026/27 Barça matches. Filtering by
// league avoids losing a fixture among hundreds of unrelated games on a date.
const GOAL_LEAGUE_IDS: Record<string, string> = {
  "primera division": "cmr77dvnt006nrx063v3w622e",
  "uefa champions league": "cmr77dw3900f5rx06j05wgzv4",
};

export function goalFixtureListingPath(
  competitionName: string,
  date: string,
  offset: number,
) {
  const leagueId = GOAL_LEAGUE_IDS[competitionName.trim().toLowerCase()];
  return leagueId
    ? `/fixtures/date/${date}?leagueId=${leagueId}&limit=100&offset=${offset}`
    : `/fixtures?from=${date}&to=${date}&limit=100&offset=${offset}`;
}

export function missingHistoricalRounds(
  latestOfficialRound: number,
  counts: ReadonlyMap<number, number>,
) {
  return Array.from({ length: Math.max(0, Math.min(38, latestOfficialRound - 1)) }, (_, index) => index + 1)
    .filter((round) => counts.get(round) !== 20);
}

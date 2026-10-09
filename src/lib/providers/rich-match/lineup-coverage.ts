/** Complete sides are left untouched by automatic lineup recovery. */
export function lineupNeedsBackfill(
  homeTeamId: string,
  awayTeamId: string,
  lineups: Array<{ teamId: string; isConfirmed: boolean; players: Array<{ role: string }> }>,
) {
  const sides = [homeTeamId, awayTeamId].map((teamId) => {
    const lineup = lineups.find((row) => row.teamId === teamId);
    if (!lineup) return "missing" as const;
    return lineup.isConfirmed && lineup.players.filter((player) => player.role === "starter").length === 11
      ? "complete" as const : "partial" as const;
  });
  return { home: sides[0], away: sides[1] };
}

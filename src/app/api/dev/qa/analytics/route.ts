import { NextResponse } from "next/server";
import { getAnalyticsOverview } from "../../../../../lib/analytics/get-analytics-overview";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  try {
    const data = await getAnalyticsOverview();
    const incompleteRounds = data.rounds.filter((round) => !round.complete).map((round) => ({
      matchday: round.matchday, teams: round.table.length,
    }));
    const metricCoverage = Object.fromEntries(
      ["possession", "passes", "passAccuracy", "shots", "shotsOnTarget"].map((metric) => [
        metric, data.trend.filter((match) => match[metric as keyof typeof match] !== null).length,
      ]),
    );
    const latestRound = data.rounds.filter((round) => round.complete).at(-1);
    const barcelonaCurrent = latestRound?.table.find((row) => row.barcelona) ?? null;
    return NextResponse.json({
      ok: incompleteRounds.length === 0,
      season: data.season.label,
      coverage: data.coverage,
      metricCoverage,
      barcelonaCurrent: barcelonaCurrent ? {
        matchday: latestRound!.matchday,
        position: barcelonaCurrent.position,
        played: barcelonaCurrent.played,
        points: barcelonaCurrent.points,
        goalDifference: barcelonaCurrent.goalDifference,
      } : null,
      incompleteRounds,
      rounds: data.rounds.map((round) => ({ matchday: round.matchday, teams: round.table.length, complete: round.complete, basis: round.basis })),
      players: data.players.length,
      storedHeatmaps: data.players.filter((player) => player.heatmap !== null).length,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

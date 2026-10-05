export type BracketFixture = {
  id: string;
  stage: string | null;
  kickoff: string | null;
  status: string;
  leg: number | null;
  homeProviderId: string | null;
  awayProviderId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homePenaltyScore: number | null;
  awayPenaltyScore: number | null;
};

export function confirmedWinner(fixture: BracketFixture, fixtures: BracketFixture[]) {
  if (fixture.status !== "finished" || fixture.homeScore === null || fixture.awayScore === null ||
      !fixture.homeProviderId || !fixture.awayProviderId) return null;
  const reverse = fixtures.find((other) => other.id !== fixture.id && other.stage === fixture.stage &&
    other.homeProviderId === fixture.awayProviderId && other.awayProviderId === fixture.homeProviderId);
  if (reverse) {
    if (reverse.status !== "finished" || reverse.homeScore === null || reverse.awayScore === null) return null;
    const homeAggregate = fixture.homeScore + reverse.awayScore;
    const awayAggregate = fixture.awayScore + reverse.homeScore;
    if (homeAggregate > awayAggregate) return fixture.homeProviderId;
    if (awayAggregate > homeAggregate) return fixture.awayProviderId;
    const final = fixture.kickoff && reverse.kickoff && fixture.kickoff > reverse.kickoff ? fixture : reverse;
    if (final.homePenaltyScore !== null && final.awayPenaltyScore !== null) {
      return final.homePenaltyScore > final.awayPenaltyScore ? final.homeProviderId :
        final.awayPenaltyScore > final.homePenaltyScore ? final.awayProviderId : null;
    }
    return null;
  }
  // A provider marking a fixture as one leg of a tie is not enough to
  // establish the winner until the other leg is actually stored.
  if (fixture.leg !== null) return null;
  if (fixture.homeScore > fixture.awayScore) return fixture.homeProviderId;
  if (fixture.awayScore > fixture.homeScore) return fixture.awayProviderId;
  if (fixture.homePenaltyScore !== null && fixture.awayPenaltyScore !== null) {
    return fixture.homePenaltyScore > fixture.awayPenaltyScore ? fixture.homeProviderId :
      fixture.awayPenaltyScore > fixture.homePenaltyScore ? fixture.awayProviderId : null;
  }
  return null;
}

export function confirmedNextFixture(fixture: BracketFixture, fixtures: BracketFixture[], nextStage: string) {
  const winner = confirmedWinner(fixture, fixtures);
  return winner ? fixtures.find((candidate) => candidate.stage === nextStage &&
    (candidate.homeProviderId === winner || candidate.awayProviderId === winner)) ?? null : null;
}

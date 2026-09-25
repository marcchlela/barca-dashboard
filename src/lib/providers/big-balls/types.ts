export type BigBallsPlayerPosition =
  | "goalkeeper"
  | "defender"
  | "midfielder"
  | "forward"
  | "unknown";

export type BigBallsPlayerStatistic = {
  providerId: string;
  name: string;
  teamProviderId: string;
  teamName: string;
  shirtNumber: number | null;
  position: BigBallsPlayerPosition;
  minutes: number | null;
  goals: number | null;
  assists: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  passes: number | null;
  completedPasses: number | null;
  passAccuracy: number | null;
  keyPasses: number | null;
  tackles: number | null;
  blocks: number | null;
  interceptions: number | null;
  duelsWon: number | null;
  duelsTotal: number | null;
  dribblesAttempted: number | null;
  successfulDribbles: number | null;
  fouls: number | null;
  yellowCards: number | null;
  redCards: number | null;
  saves: number | null;
  rating: number | null;
  raw: Record<string, number | string | boolean | null>;
};

export type BigBallsMatchBundle = {
  requestCount: number;
  providerMatchId: string;
  homeTeamProviderId: string;
  awayTeamProviderId: string;
  candidate: {
    kickoff: string | null;
    calendarDate: string | null;
    homeTeam: string;
    awayTeam: string;
    homeScore: number | null;
    awayScore: number | null;
    competition: string | null;
  };
  teamStatistics: {
    home: Record<string, number | null>;
    away: Record<string, number | null>;
  };
  players: BigBallsPlayerStatistic[];
};

export type GoalPlayerPosition =
  | "goalkeeper"
  | "defender"
  | "midfielder"
  | "forward"
  | "unknown";

export type GoalLineupPlayer = {
  providerId: string;
  legacyEventKey: string | null;
  name: string;
  shirtNumber: number | null;
  matchPosition: string | null;
  primaryPosition: GoalPlayerPosition;
  lineupOrdinal: number | null;
  role: "starter" | "substitute";
  imageUrl: string | null;
};

export type GoalLineupSide = {
  providerTeamId: string;
  teamName: string;
  formation: string | null;
  coachName: string | null;
  players: GoalLineupPlayer[];
};

export type GoalScoringEvent = {
  providerId: string;
  minute: number | null;
  scorerProviderKey: string | null;
  scorerName: string | null;
  assistProviderKey: string | null;
  assistName: string | null;
  side: "home" | "away";
  type: "goal" | "own_goal" | "penalty_goal";
  homeScore: number | null;
  awayScore: number | null;
};

export type GoalTeamStatistic = {
  possession: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  shotsOffTarget: number | null;
  blockedShots: number | null;
  shotsInsideBox: number | null;
  shotsOutsideBox: number | null;
  passes: number | null;
  completedPasses: number | null;
  passAccuracy: number | null;
  corners: number | null;
  fouls: number | null;
  offsides: number | null;
  yellowCards: number | null;
  redCards: number | null;
  saves: number | null;
  attacks: number | null;
  dangerousAttacks: number | null;
  freeKicks: number | null;
  goalKicks: number | null;
  throwIns: number | null;
  substitutions: number | null;
  raw: Record<string, { home: number | null; away: number | null }>;
};

export type GoalMatchBundle = {
  requestCount: number;
  providerMatchId: string;
  candidate: {
    kickoff: string | null;
    calendarDate: string | null;
    homeTeam: string;
    awayTeam: string;
    homeScore: number | null;
    awayScore: number | null;
    competition: string | null;
  };
  home: GoalLineupSide;
  away: GoalLineupSide;
  events: GoalScoringEvent[];
  statistics: {
    home: GoalTeamStatistic;
    away: GoalTeamStatistic;
  };
};

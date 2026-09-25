export type StatsHawkPlayerPosition =
  | "goalkeeper"
  | "defender"
  | "midfielder"
  | "forward"
  | "unknown";

export type StatsHawkRequestRecord = {
  path: string;
  status: number | null;
  expectedUnits: number;
  quotaRemaining: number | null;
  error: string | null;
};

export type StatsHawkUsage = {
  requestCount: number;
  expectedUnits: number;
  quotaRemaining: number | null;
  requests: StatsHawkRequestRecord[];
};

export type StatsHawkPlayerStatistic = {
  personId: string;
  name: string;

  teamProviderId: string;
  teamName: string;

  position: StatsHawkPlayerPosition;

  minutes: number | null;

  goals: number | null;
  assists: number | null;

  shots: number | null;
  shotsOnTarget: number | null;

  passes: number | null;
  completedPasses: number | null;
  passAccuracy: number | null;

  tackles: number | null;
  interceptions: number | null;

  fouls: number | null;

  yellowCards: number | null;
  redCards: number | null;

  saves: number | null;
  goalsConceded: number | null;
  cleanSheet: boolean | null;

  raw: {
    phases: Array<{
      phase: string | null;
      measures: Record<
        string,
        string | number | boolean | null
      >;
    }>;
  };
};

export type StatsHawkRosterPlayer = {
  personId: string;
  displayName: string;

  position: StatsHawkPlayerPosition;

  birthDate: string | null;

  height:
    | string
    | number
    | null;

  weight:
    | string
    | number
    | null;

  nationality: string | null;
  preferredFoot: string | null;
  portraitUrl: string | null;

  rawPosition: string | null;
};

export type StatsHawkMatchCandidate = {
  providerMatchId: string | null;

  kickoff: string | null;
  calendarDate: string | null;

  homeTeam: string;
  awayTeam: string;

  homeScore: number | null;
  awayScore: number | null;

  competition: string | null;
};

export type StatsHawkMatchBundle = {
  providerMatchId: string;

  competitionSlug:
    | "laliga"
    | "ucl";

  candidate:
    StatsHawkMatchCandidate;

  homeTeamProviderId: string;
  awayTeamProviderId: string;

  homeTeamName: string;
  awayTeamName: string;

  playerStatistics:
    StatsHawkPlayerStatistic[];

  barcelonaTeamProviderId:
    string | null;

  barcelonaRoster:
    StatsHawkRosterPlayer[];

  usage: StatsHawkUsage;
};
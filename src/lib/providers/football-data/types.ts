export type FootballDataArea = {
  id: number;
  name: string;
  code: string | null;
  flag: string | null;
};

export type FootballDataTeam = {
  id: number;
  area?: FootballDataArea;

  name: string;
  shortName: string | null;
  tla: string | null;

  crest: string | null;

  address?: string | null;
  website?: string | null;

  founded?: number | null;

  clubColors?: string | null;
  venue?: string | null;

  lastUpdated?: string;
};

export type FootballDataCompetition = {
  id: number;

  area: FootballDataArea;

  name: string;
  code: string;

  type: string;

  emblem: string | null;

  currentSeason?: FootballDataSeason | null;
};

export type FootballDataSeason = {
  id: number;

  startDate: string;
  endDate: string;

  currentMatchday: number | null;

  winner?: FootballDataTeam | null;
};

export type FootballDataScore = {
  winner:
    | "HOME_TEAM"
    | "AWAY_TEAM"
    | "DRAW"
    | null;

  duration:
    | "REGULAR"
    | "EXTRA_TIME"
    | "PENALTY_SHOOTOUT"
    | null;

  fullTime: {
    home: number | null;
    away: number | null;
  };

  halfTime: {
    home: number | null;
    away: number | null;
  };
};

export type FootballDataMatch = {
  area: FootballDataArea;

  competition: {
    id: number;
    name: string;
    code: string;
    type: string;
    emblem: string | null;
  };

  season: FootballDataSeason;

  id: number;

  utcDate: string;

  status:
    | "SCHEDULED"
    | "TIMED"
    | "IN_PLAY"
    | "PAUSED"
    | "FINISHED"
    | "SUSPENDED"
    | "POSTPONED"
    | "CANCELLED"
    | "AWARDED";

  matchday: number | null;

  stage: string | null;

  group: string | null;

  lastUpdated: string;

  homeTeam: FootballDataTeam;
  awayTeam: FootballDataTeam;

  score: FootballDataScore;
};

export type FootballDataMatchesResponse = {
  filters: Record<string, unknown>;

  resultSet: {
    count: number;
    competitions?: string;
    first?: string;
    last?: string;
    played?: number;
  };

  competition?: FootballDataCompetition;

  matches: FootballDataMatch[];
};

export type FootballDataStandingTableRow = {
  position: number;

  team: FootballDataTeam;

  playedGames: number;

  form: string | null;

  won: number;
  draw: number;
  lost: number;

  points: number;

  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
};

export type FootballDataStanding = {
  stage: string;

  type: "TOTAL" | "HOME" | "AWAY";

  group: string | null;

  table: FootballDataStandingTableRow[];
};

export type FootballDataStandingsResponse = {
  filters: Record<string, unknown>;

  area: FootballDataArea;

  competition: FootballDataCompetition;

  season: FootballDataSeason;

  standings: FootballDataStanding[];
};
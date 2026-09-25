export type SourceClassification =
  | "OFFICIAL_API"
  | "PUBLIC_API_UNDOCUMENTED"
  | "PUBLIC_WEB_MANUAL_ONLY"
  | "RESTRICTED_DO_NOT_AUTOMATE"
  | "UNKNOWN_DO_NOT_AUTOMATE";

export type AutomationPolicy = "ALLOW" | "MANUAL_ONLY" | "DENY";

export type DataCoverage = {
  fixturesResults: boolean;
  standings: boolean;
  teamProfiles: boolean;
  playerProfiles: boolean;
  venue: boolean;
  referee: boolean;
  attendance: boolean;
  lineups: boolean;
  bench: boolean;
  formation: boolean;
  events: boolean;
  goalsAssists: boolean;
  cards: boolean;
  substitutions: boolean;
  teamStatistics: boolean;
  possession: boolean;
  shots: boolean;
  shotsOnTarget: boolean;
  passes: boolean;
  completedPasses: boolean;
  passAccuracy: boolean;
  keyPasses: boolean;
  xG: boolean;
  shotCoordinates: boolean;
  playerMatchStatistics: boolean;
  ratings: boolean;
  playerMinutes: boolean;
  playerGoals: boolean;
  playerAssists: boolean;
  tackles: boolean;
  interceptions: boolean;
  duels: boolean;
  duelsWon: boolean;
  dribbles: boolean;
  fouls: boolean;
  saves: boolean;
  goalkeeperStatistics: boolean;
  injuriesSuspensions: boolean;
  momentum: boolean;
  heatmaps: boolean;
};

export type SourceProfile = {
  id: string;
  name: string;
  classification: SourceClassification;
  automationPolicy: AutomationPolicy;
  accessMode: string;
  currentSeasonExpected: boolean | null;
  requiresCredential: boolean;
  documentationUrl: string;
  termsUrl: string | null;
  summary: string;
  limitations: string[];
};

export type InternalMatch = {
  id: string;
  kickoff: string;
  status: string;
  competition: {
    id: string;
    name: string;
    code: string;
  };
  seasonId: string;
  matchday: number | null;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  score: { home: number | null; away: number | null };
  providerIds: Record<string, string>;
};

export type MatchCandidate = {
  providerMatchId: string | null;
  kickoff: string | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  competition: string | null;
};

export type MatchResolution = {
  matched: boolean;
  confidence: number;
  criteria: {
    providerId: boolean;
    kickoff: boolean;
    homeTeam: boolean;
    awayTeam: boolean;
    score: boolean;
    competition: boolean;
  };
  notes: string[];
};

export type ProviderProbeStatus =
  | "ok"
  | "not_configured"
  | "not_available"
  | "skipped_by_policy"
  | "error";

export type ProviderProbe = {
  provider: SourceProfile;
  status: ProviderProbeStatus;
  testedAutomatically: boolean;
  currentSeasonAvailable: boolean | null;
  match: MatchCandidate | null;
  resolution: MatchResolution | null;
  coverage: DataCoverage;
  completeness: Record<string, "complete" | "partial" | "absent" | "unknown">;
  evidence: string[];
  sanitizedSample: unknown;
  error: string | null;
};

export type DataLabReport = {
  generatedAt: string;
  environment: "development";
  cache: {
    hit: boolean;
    ttlSeconds: number;
    refreshBypassed: boolean;
  };
  database: {
    mode: "read-only";
    writesAttempted: 0;
    schemaChanged: false;
  };
  internalMatch: InternalMatch;
  providers: ProviderProbe[];
  comparison: {
    resolvedProviders: string[];
    coverageByField: Record<keyof DataCoverage, string[]>;
  };
  recommendation: {
    primary: string;
    secondary: string[];
    fieldOwnership: Record<string, string>;
    unresolvedGaps: string[];
  };
};

export function emptyCoverage(
  overrides: Partial<DataCoverage> = {},
): DataCoverage {
  return {
    fixturesResults: false,
    standings: false,
    teamProfiles: false,
    playerProfiles: false,
    venue: false,
    referee: false,
    attendance: false,
    lineups: false,
    bench: false,
    formation: false,
    events: false,
    goalsAssists: false,
    cards: false,
    substitutions: false,
    teamStatistics: false,
    possession: false,
    shots: false,
    shotsOnTarget: false,
    passes: false,
    completedPasses: false,
    passAccuracy: false,
    keyPasses: false,
    xG: false,
    shotCoordinates: false,
    playerMatchStatistics: false,
    ratings: false,
    playerMinutes: false,
    playerGoals: false,
    playerAssists: false,
    tackles: false,
    interceptions: false,
    duels: false,
    duelsWon: false,
    dribbles: false,
    fouls: false,
    saves: false,
    goalkeeperStatistics: false,
    injuriesSuspensions: false,
    momentum: false,
    heatmaps: false,
    ...overrides,
  };
}

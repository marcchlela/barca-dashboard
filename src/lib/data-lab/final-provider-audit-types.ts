import type {
  InternalMatch,
  MatchCandidate,
  MatchResolution,
} from "./types";

export const FINAL_AUDIT_STAT_FIELDS = [
  "possession",
  "shots",
  "shotsOnTarget",
  "shotsOffTarget",
  "blockedShots",
  "corners",
  "fouls",
  "offsides",
  "passes",
  "completedPasses",
  "passAccuracy",
  "tackles",
  "interceptions",
  "saves",
  "xG",
  "xA",
  "rating",
  "minutes",
  "goals",
  "assists",
  "keyPasses",
  "duels",
  "dribbles",
  "coordinates",
] as const;

export type FinalAuditStatField = typeof FINAL_AUDIT_STAT_FIELDS[number];
export type AuditFieldState =
  | "present_nonzero"
  | "present_zero_only"
  | "present_empty"
  | "absent"
  | "documentation_only"
  | "unknown";

export type AuditProvider = "goal-api" | "big-balls-data";

export type AuditRequestRecord = {
  path: string;
  status: number | null;
  rateLimit: number | null;
  rateLimitRemaining: number | null;
  rateLimitReset: string | null;
  source: string | null;
  error: string | null;
};

export type ProviderBudgetReport = {
  hardRequestLimit: 100;
  requestsConsumed: number;
  rateLimitBefore: number | null;
  rateLimitAfter: number | null;
  advertisedAccountLimit: number | null;
  requests: AuditRequestRecord[];
};

export type LineupSideAudit = {
  starters: number;
  completeStartingXI: boolean;
  bench: number;
  unclassifiedRows: number;
  formations: string | null;
  names: number;
  providerPlayerIds: number;
  shirtNumbers: number;
  broadPositions: number;
  lineupOrdinals: number;
  playerImages: number;
  coaches: number;
  confirmedOrPredictedStatus: string | null;
  publishedOrUpdatedAt: string | null;
};

export type LineupAudit = {
  status: "available" | "partial" | "not_available" | "error" | "unknown";
  home: LineupSideAudit;
  away: LineupSideAudit;
  barcelonaSide: "home" | "away" | null;
  barcelona: LineupSideAudit | null;
  evidence: string[];
};

export type EventsAudit = {
  status: "available" | "partial" | "not_available" | "plan_gated" | "error" | "unknown";
  totalRows: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  substitutions: number;
  penalties: number;
  ownGoals: number;
  rowsWithMinute: number;
  rowsWithAddedTime: number;
  rowsWithPlayerId: number;
  rowsWithRelatedPlayerId: number;
  rowsWithCoordinates: number;
  rowsWithXG: number;
  rowsWithXGOT: number;
  goalCountMatchesFinalScore: boolean | null;
  actualKeys: string[];
  evidence: string[];
};

export type StatisticsAudit = {
  status: "available" | "partial" | "not_available" | "plan_gated" | "error" | "unknown";
  teamRowCount: number;
  playerRowCount: number;
  actualTeamFields: string[];
  actualPlayerFields: string[];
  fieldStates: Record<FinalAuditStatField, AuditFieldState>;
  evidence: string[];
};

export type ProviderMatchAudit = {
  label: string;
  internal: InternalMatch;
  status: "resolved" | "not_available" | "error";
  providerMatchId: string | null;
  candidate: MatchCandidate | null;
  resolution: MatchResolution | null;
  immutableFactDisagreements: string[];
  lineup: LineupAudit;
  events: EventsAudit;
  statistics: StatisticsAudit;
  error: string | null;
};

export type FootballDataCheck = {
  label: string;
  status: "agree" | "disagree" | "not_configured" | "not_available" | "error";
  providerMatchId: string | null;
  disagreements: string[];
  evidence: string[];
};

export type FinalProviderAuditReport = {
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
  documentation: {
    researchedAt: string;
    goalApi: string[];
    bigBallsData: string[];
  };
  selection: Array<{
    label: string;
    internalMatchId: string;
    competition: string;
    kickoff: string;
    fixture: string;
    score: string;
  }>;
  footballDataCrossChecks: FootballDataCheck[];
  providers: {
    goalApi: {
      configured: boolean;
      resolvedMatches: number;
      budget: ProviderBudgetReport;
      matches: ProviderMatchAudit[];
      verdict: string;
    };
    bigBallsData: {
      configured: boolean;
      account: {
        plan: string | null;
        perMinute: number | null;
        perDay: number | null;
      };
      resolvedMatches: number;
      budget: ProviderBudgetReport;
      matches: ProviderMatchAudit[];
      seasonPlayerAudit: {
        status: "available" | "not_available" | "plan_gated" | "error" | "not_tested";
        playerId: string | null;
        playerName: string | null;
        actualFields: string[];
        xG: AuditFieldState;
        xA: AuditFieldState;
        rating: AuditFieldState;
        evidence: string[];
      };
      verdict: string;
    };
  };
  providerComparison: Array<{
    fieldGroup: string;
    recommendedOwner: string;
    supportingProviders: string[];
    evidence: string;
  }>;
  unresolved: string[];
};

import type {
  InternalMatch,
  MatchCandidate,
  MatchResolution,
} from "./types";

export const RELIABILITY_FIELD_MAP = {
  minutes: ["minutes", "mins"],
  goals: ["goals"],
  assists: ["assists"],
  shots: ["shots"],
  shotsOnTarget: ["sot", "shots_on_target"],
  shotAccuracy: ["shot_accuracy"],
  passes: ["passes"],
  completedPasses: ["passes_cmp", "passes_completed"],
  passAccuracy: ["pass_pct", "pass_accuracy"],
  tackles: ["tackles"],
  interceptions: ["intc", "interceptions"],
  fouls: ["fouls"],
  yellowCards: ["yellow", "yellow_cards"],
  redCards: ["red", "red_cards"],
  saves: ["saves"],
  savePercentage: ["save_pct", "save_percentage"],
  goalsConceded: ["goals_conceded"],
  cleanSheet: ["clean_sheet", "clean_sheets"],
  xG: ["xg", "expected_goals"],
  xA: ["xa", "expected_assists"],
} as const;

export type ReliabilityField = keyof typeof RELIABILITY_FIELD_MAP;
export type FieldState =
  | "absent"
  | "present_zero_only"
  | "present_nonzero"
  | "unknown";

export type SelectedReliabilityMatch = {
  label: string;
  competitionKind: "la_liga" | "champions_league";
  selectionReasons: string[];
  internal: InternalMatch;
};

export type StatsHawkRequestRecord = {
  path: string;
  status: number | null;
  expectedUnits: number;
  quotaRemaining: number | null;
  cache: string | null;
  error: string | null;
};

export type PlayerPhaseRow = {
  appearanceId: string | null;
  personId: string | null;
  personName: string | null;
  teamId: string | null;
  teamName: string | null;
  phase: string | null;
  measures: Record<string, unknown>;
};

export type PlayerRowAudit = {
  providerAppearanceRows: number;
  providerPhaseRows: number;
  barcelonaAppearanceRows: number;
  barcelonaPhaseRows: number;
  rowsWithMinutesAboveZero: number;
  rowsWithMinutesEqualZero: number;
  rowsWithStatisticsDespiteZeroMinutes: number;
  zeroActivityRows: number;
  duplicatePlayerIds: string[];
  duplicatePhaseRows: string[];
  goalkeeperPhaseRows: number;
  outfieldPhaseRows: number;
  unknownPhaseRows: number;
  representativeActiveRows: Array<{
    personId: string | null;
    personName: string | null;
    phase: string | null;
    measures: Record<string, unknown>;
  }>;
  representativeZeroMinuteRows: Array<{
    personId: string | null;
    personName: string | null;
    phase: string | null;
    hasNonZeroStatistic: boolean;
    measures: Record<string, unknown>;
  }>;
};

export type ProviderIdentityCheck = {
  provider: "statshawk" | "football-data-org" | "openfootball";
  status: "agree" | "disagree" | "not_available" | "not_configured" | "error";
  candidate: MatchCandidate | null;
  resolution: MatchResolution | null;
  disagreements: string[];
  evidence: string[];
};

export type ReliabilityMatchResult = {
  label: string;
  competitionKind: SelectedReliabilityMatch["competitionKind"];
  selectionReasons: string[];
  internal: InternalMatch;
  statsHawkCompetition: {
    id: string;
    slug: string;
    name: string;
  } | null;
  status: "ok" | "not_available" | "unsupported_competition" | "error";
  contestId: string | null;
  candidate: MatchCandidate | null;
  resolution: MatchResolution | null;
  fieldStates: Record<ReliabilityField, FieldState>;
  observedMeasureKeys: string[];
  rowAudit: PlayerRowAudit | null;
  identityChecks: ProviderIdentityCheck[];
  error: string | null;
};

export type RosterEntryAudit = {
  personId: string | null;
  displayName: string | null;
  position: string | null;
  shirtNumber: string | number | null;
  nationality: string | null;
  birthCountry: string | null;
  birthDate: string | null;
  preferredFoot: string | null;
  height: string | number | null;
  weight: string | number | null;
  portraitUrl: string | null;
  membershipStatus: string | null;
  source: string | null;
};

export type RosterAudit = {
  status: "ok" | "not_available" | "error";
  teamId: string | null;
  totalRows: number;
  uniqueProviderPersonIds: number;
  duplicateProviderPersonIds: string[];
  coverage: {
    providerPersonId: number;
    displayName: number;
    position: number;
    shirtNumber: number;
    nationality: number;
    birthCountry: number;
    birthDate: number;
    preferredFoot: number;
    height: number;
    weight: number;
    portraitOrPhoto: number;
    membershipStatus: number;
  };
  sourceCounts: Record<string, number>;
  representativeRows: RosterEntryAudit[];
  evidence: string[];
};

export type PlayerOverviewAudit = {
  personId: string;
  displayName: string | null;
  selectedRole: "goalkeeper" | "defender" | "midfielder" | "forward";
  competition: {
    id: string;
    slug: string;
    name: string;
  };
  status: "ok" | "not_available" | "error";
  identity: {
    id: string | null;
    displayName: string | null;
    position: string | null;
  } | null;
  currentTeam: {
    id: string | null;
    name: string | null;
  } | null;
  profile: {
    birthDate: string | null;
    nationality: string | null;
    birthCountry: string | null;
    preferredFoot: string | null;
    height: string | number | null;
    weight: string | number | null;
    portraitUrl: string | null;
  } | null;
  actualStatPaths: string[];
  totalsByPhase: Record<string, Record<string, number>>;
  fieldStates: Record<ReliabilityField, FieldState>;
  appearances: number | null;
  starts: number | null;
  gameLogRows: number;
  error: string | null;
};

export type SeasonSanityRow = {
  personId: string;
  displayName: string | null;
  competitionSlug: string;
  retrievedMatchCount: number;
  overviewTotals: Record<string, number>;
  retrievedMatchSums: Record<string, number>;
  comparableKeys: string[];
  note: string;
};

export type StatsHawkReliabilityReport = {
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
  budget: {
    hardLimitWeightedUnits: 120;
    expectedUnitsAttempted: number;
    actualWeightedUnitsConsumed: number | null;
    quotaBefore: number | null;
    quotaAfter: number | null;
    quotaLimit: number | null;
    requestCount: number;
    requests: StatsHawkRequestRecord[];
  };
  selection: {
    currentSeasonId: string | null;
    availableFinished: {
      laLiga: number;
      championsLeague: number;
    };
    selected: Array<{
      label: string;
      internalMatchId: string;
      competitionKind: SelectedReliabilityMatch["competitionKind"];
      selectionReasons: string[];
    }>;
  };
  competitionDiscovery: {
    laLiga: {
      id: string;
      slug: string;
      name: string;
    } | null;
    championsLeague: {
      id: string;
      slug: string;
      name: string;
    } | null;
    capabilities: Record<string, {
      advertisedPhases: string[];
      advertisedMeasures: string[];
      error: string | null;
    }>;
  };
  matches: ReliabilityMatchResult[];
  consistencyMatrix: Record<
    ReliabilityField,
    Record<string, FieldState>
  >;
  playerRowSemantics: {
    testedMatches: number;
    totalBarcelonaAppearanceRows: number;
    rowsWithMinutesAboveZero: number;
    rowsWithMinutesEqualZero: number;
    rowsWithStatisticsDespiteZeroMinutes: number;
    zeroActivityRows: number;
    duplicatePlayerIdOccurrences: number;
    duplicatePhaseOccurrences: number;
    interpretation: string[];
    proposedCanonicalParticipationRule: string[];
  };
  roster: RosterAudit;
  playerOverviews: PlayerOverviewAudit[];
  seasonTotalsSanity: SeasonSanityRow[];
  competitionCoverage: {
    laLiga: {
      selected: number;
      resolved: number;
      consistentlyPresentFields: ReliabilityField[];
    };
    championsLeague: {
      selected: number;
      resolved: number;
      consistentlyPresentFields: ReliabilityField[];
      shapeComparisonWithLaLiga: string;
    };
    allCompetitions: string;
  };
  xGxAVerdict: {
    matchXGObserved: boolean;
    matchXAObserved: boolean;
    overviewXGObserved: boolean;
    overviewXAObserved: boolean;
    advertisedOnly: boolean;
    conclusion: string;
  };
  reliabilityVerdict: {
    decision:
      | "suitable_as_primary_free_player_stats_source"
      | "promising_but_not_yet_primary"
      | "not_suitable";
    rationale: string[];
  };
  schemaProposal: {
    prismaModified: false;
    normalizedColumnsToAddLater: Array<{
      model: string;
      field: string;
      type: string;
      reason: string;
    }>;
    derivedFields: Array<{
      field: string;
      recommendation: string;
    }>;
    provenance: {
      currentRecommendation: string;
      futureMultiProviderRecommendation: string;
      rejectedForNow: string[];
    };
    profileAndSquadNotes: string[];
  };
  playerIdentityStrategy: {
    automaticEvidenceOrder: string[];
    normalization: string[];
    ambiguousCasePolicy: string[];
    mappingTarget: string;
  };
  unresolved: string[];
};

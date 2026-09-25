import {
  DATA_LAB_CACHE_TTL_SECONDS,
  readDataLabCache,
  writeDataLabCache,
} from "./cache";
import { getInternalBarcelonaMatch } from "./internal-match";
import { probeFootballData } from "./providers/football-data";
import { probeOpenFootball } from "./providers/openfootball";
import { probeStatsHawk } from "./providers/statshawk";
import { probeStatsBomb } from "./providers/statsbomb";
import { probeTheSportsDb } from "./providers/the-sports-db";
import { ALL_SOURCE_PROFILES } from "./source-status";
import { runDataLabDeterministicValidation } from "./validation";
import {
  emptyCoverage,
  type DataLabReport,
  type ProviderProbe,
  type SourceProfile,
} from "./types";

function skippedProbe(provider: SourceProfile): ProviderProbe {
  return {
    provider,
    status: "skipped_by_policy",
    testedAutomatically: false,
    currentSeasonAvailable: provider.currentSeasonExpected,
    match: null,
    resolution: null,
    coverage: emptyCoverage(),
    completeness: {},
    evidence: [
      provider.automationPolicy === "DENY"
        ? "No request was made: the source is legally restricted or permission/provenance is unclear."
        : "No adapter is enabled for this source.",
    ],
    sanitizedSample: null,
    error: null,
  };
}

export async function runBarcelonaDataLab({
  matchId,
  refresh = false,
}: {
  matchId?: string;
  refresh?: boolean;
} = {}): Promise<DataLabReport> {
  const internalMatch = await getInternalBarcelonaMatch(matchId);
  const cacheKey = internalMatch.id;

  if (!refresh) {
    const cached = readDataLabCache(cacheKey);
    if (cached) {
      return {
        ...cached,
        cache: {
          ...cached.cache,
          hit: true,
          refreshBypassed: false,
        },
      };
    }
  }

  const automated = await Promise.all([
    probeFootballData(internalMatch),
    probeTheSportsDb(internalMatch),
    probeStatsBomb(internalMatch),
    probeOpenFootball(internalMatch),
    probeStatsHawk(internalMatch),
  ]);
  const automatedIds = new Set(automated.map((probe) => probe.provider.id));
  const providers = [
    ...automated,
    ...ALL_SOURCE_PROFILES
      .filter((profile) => !automatedIds.has(profile.id))
      .map(skippedProbe),
  ];
  const coverageFields = Object.keys(emptyCoverage()) as Array<
    keyof ReturnType<typeof emptyCoverage>
  >;
  const coverageByField = Object.fromEntries(
    coverageFields.map((field) => [
      field,
      providers
        .filter((probe) => probe.coverage[field])
        .map((probe) => probe.provider.id),
    ]),
  ) as DataLabReport["comparison"]["coverageByField"];

  const report: DataLabReport = {
    generatedAt: new Date().toISOString(),
    environment: "development",
    cache: {
      hit: false,
      ttlSeconds: DATA_LAB_CACHE_TTL_SECONDS,
      refreshBypassed: refresh,
    },
    database: {
      mode: "read-only",
      writesAttempted: 0,
      schemaChanged: false,
    },
    validation: runDataLabDeterministicValidation(),
    internalMatch,
    providers,
    comparison: {
      resolvedProviders: providers
        .filter((probe) => probe.resolution?.matched)
        .map((probe) => probe.provider.id),
      coverageByField,
    },
    recommendation: {
      primary: "football-data-org",
      secondary: ["statshawk", "openfootball", "thesportsdb"],
      fieldOwnership: {
        "fixtures, results, standings": "football-data-org",
        "fixture/result cross-check": "statshawk + openfootball",
        venue: "statshawk; thesportsdb as secondary enrichment",
        "player profiles and roster positions": "statshawk (roster is not a match lineup)",
        "player minutes, goals, assists": "statshawk",
        "player shots and shots on target": "statshawk",
        "player passing and pass accuracy": "statshawk",
        "player tackles, interceptions, and fouls": "statshawk",
        "goalkeeper saves and goalkeeper statistics": "statshawk",
        "player card totals": "statshawk (not a timestamped event timeline)",
        "complete lineups and bench": "NO_FREE_RELIABLE_SOURCE",
        formation: "NO_FREE_RELIABLE_SOURCE",
        "complete goals, assists, cards, substitutions": "NO_FREE_RELIABLE_SOURCE",
        "complete team statistics": "NO_FREE_RELIABLE_SOURCE",
        "xG and shot coordinates": "NO_FREE_RELIABLE_SOURCE",
        "player ratings": "NO_FREE_RELIABLE_SOURCE",
        "injuries and suspensions": "NO_FREE_RELIABLE_SOURCE",
      },
      unresolvedGaps: [
        "Complete confirmed lineups, bench, and formations",
        "Complete event timeline with assists, cards, and substitutions",
        "Possession, shots, passing, and other team statistics",
        "xG, shot coordinates, momentum, and heatmaps",
        "Player ratings",
        "Current injuries and suspensions with reuse permission",
      ],
    },
  };

  writeDataLabCache(cacheKey, report);
  return report;
}

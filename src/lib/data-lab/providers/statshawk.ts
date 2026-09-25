import { matchTeamIdentity, resolveMatchCandidate } from "../match-resolver";
import { SOURCE_PROFILES } from "../source-status";
import {
  emptyCoverage,
  type InternalMatch,
  type MatchCandidate,
  type ProviderProbe,
} from "../types";
import { safeErrorMessage } from "../http";

const DEFAULT_BASE_URL = "https://api.statshawk.ai/v1";
const REQUEST_TIMEOUT_MS = 12_000;

type JsonObject = Record<string, unknown>;
type StatsHawkEnvelope = {
  data?: unknown;
  meta?: {
    cache?: string;
    request_id?: string;
    fetched_at?: string;
    source?: string | null;
  };
  error?: unknown;
};

type RequestRecord = {
  path: string;
  status: number | null;
  documentedCost: number;
  quotaLimit: number | null;
  quotaRemaining: number | null;
  cache: string | null;
  requestId: string | null;
  error: string | null;
};

function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function stringField(
  value: JsonObject | null,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const candidate = value?.[key];
    if (typeof candidate === "string" && candidate) return candidate;
  }
  return null;
}

function numberField(
  value: JsonObject | null,
  ...keys: string[]
): number | null {
  for (const key of keys) {
    const candidate = value?.[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return null;
}

function arrayField(value: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  const object = asObject(value);
  for (const key of keys) {
    if (Array.isArray(object?.[key])) return object[key] as unknown[];
  }
  return [];
}

function envelopeData(envelope: StatsHawkEnvelope) {
  return envelope.data;
}

function listData(envelope: StatsHawkEnvelope, ...keys: string[]) {
  return arrayField(envelopeData(envelope), ...keys);
}

function reference(
  object: JsonObject | null,
  key: string,
): { id: string | null; name: string | null } {
  const value = object?.[key];
  if (typeof value === "string") {
    return {
      id: value,
      name: stringField(object, key + "_name"),
    };
  }

  const nested = asObject(value);
  return {
    id: stringField(nested, "id") ?? stringField(object, key + "_id"),
    name: stringField(nested, "name") ?? stringField(object, key + "_name"),
  };
}

class StatsHawkClient {
  readonly requests: RequestRecord[] = [];

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async request(
    path: string,
    documentedCost: number,
  ): Promise<StatsHawkEnvelope> {
    let response: Response | null = null;
    let body: StatsHawkEnvelope | null = null;

    try {
      response = await fetch(this.baseUrl + path, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "X-API-Key": this.apiKey,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const text = await response.text();
      body = text ? JSON.parse(text) as StatsHawkEnvelope : {};
      const meta = asObject(body.meta);
      this.requests.push({
        path,
        status: response.status,
        documentedCost,
        quotaLimit: Number(response.headers.get("x-account-quota-limit")) || null,
        quotaRemaining:
          Number(response.headers.get("x-account-quota-remaining")) || null,
        cache: stringField(meta, "cache"),
        requestId: stringField(meta, "request_id"),
        error: response.ok
          ? null
          : JSON.stringify(body.error ?? body).slice(0, 300),
      });

      if (!response.ok) {
        throw new Error(
          "StatsHawk " + path + " returned HTTP " + response.status + ".",
        );
      }

      return body;
    } catch (error) {
      if (
        !response ||
        !this.requests.some((request) => request.path === path)
      ) {
        this.requests.push({
          path,
          status: response?.status ?? null,
          documentedCost,
          quotaLimit: null,
          quotaRemaining: null,
          cache: null,
          requestId: null,
          error: safeErrorMessage(error),
        });
      }
      throw error;
    }
  }

  async optional(path: string, documentedCost: number) {
    try {
      return await this.request(path, documentedCost);
    } catch {
      return null;
    }
  }

  usage() {
    const metered = this.requests.filter(
      (request) => request.quotaRemaining !== null,
    );
    const first = metered[0];
    const endingRemaining = metered.length
      ? Math.min(
          ...metered.map((request) => request.quotaRemaining as number),
        )
      : null;
    const startingRemaining =
      first?.quotaRemaining === null || first?.quotaRemaining === undefined
        ? null
        : first.quotaRemaining + first.documentedCost;

    return {
      requestCount: this.requests.length,
      successfulRequests: this.requests.filter(
        (request) => request.status !== null && request.status < 400,
      ).length,
      weightedUnitsConsumed:
        startingRemaining !== null && endingRemaining !== null
          ? startingRemaining - endingRemaining
          : null,
      quotaLimit:
        metered.find((request) => request.quotaLimit !== null)?.quotaLimit ??
        null,
      quotaRemaining: endingRemaining,
      requests: this.requests,
    };
  }
}

function competitionRows(envelope: StatsHawkEnvelope) {
  return listData(envelope, "items", "competitions")
    .map(asObject)
    .filter((row): row is JsonObject => row !== null);
}

function contestRows(envelope: StatsHawkEnvelope) {
  return listData(envelope, "items", "games", "contests")
    .map(asObject)
    .filter((row): row is JsonObject => row !== null);
}

function contestCandidate(
  contest: JsonObject,
  competitionName: string,
): MatchCandidate {
  const score = asObject(contest.score);
  const kickoff = stringField(contest, "kickoff");
  const hasZone = Boolean(
    kickoff && (kickoff.endsWith("Z") || /[+-][0-9]{2}:[0-9]{2}$/.test(kickoff)),
  );

  return {
    providerMatchId: stringField(contest, "id"),
    kickoff: hasZone ? kickoff : null,
    calendarDate: kickoff?.slice(0, 10) ?? null,
    localTime: kickoff && !hasZone ? kickoff.slice(11, 19) : null,
    temporalPrecision: hasZone
      ? "exact"
      : kickoff
        ? "local_time_unknown_zone"
        : "unknown",
    homeTeam: stringField(contest, "home_team_name") ?? "",
    awayTeam: stringField(contest, "away_team_name") ?? "",
    homeScore: numberField(score, "home"),
    awayScore: numberField(score, "away"),
    competition: competitionName,
  };
}

type PlayerLine = {
  personId: string | null;
  personName: string | null;
  teamId: string | null;
  teamName: string | null;
  phase: string | null;
  measures: JsonObject;
};

function playerLines(value: unknown): PlayerLine[] {
  const line = asObject(value);
  if (!line) return [];
  const person = reference(line, "person");
  const team = reference(line, "team");
  const base = {
    personId: person.id,
    personName: person.name,
    teamId: team.id,
    teamName: team.name,
  };
  const phases = arrayField(line, "phases")
    .map(asObject)
    .filter((phase): phase is JsonObject => phase !== null);

  if (phases.length) {
    return phases.map((phase) => ({
      ...base,
      phase: stringField(phase, "phase", "role"),
      measures:
        asObject(phase.measures) ??
        asObject(phase.statistics) ??
        asObject(phase.stats) ??
        {},
    }));
  }

  return [{
    ...base,
    phase: stringField(line, "phase", "role"),
    measures:
      asObject(line.measures) ??
      asObject(line.statistics) ??
      asObject(line.stats) ??
      {},
  }];
}

function primitiveMeasures(measures: JsonObject) {
  return Object.fromEntries(
    Object.entries(measures).filter(([, value]) =>
      value === null ||
      typeof value === "number" ||
      typeof value === "string" ||
      typeof value === "boolean"
    ),
  );
}

function lineMinutes(line: PlayerLine) {
  return numberField(line.measures, "minutes", "mins") ?? 0;
}

function isPopulatedLine(line: PlayerLine) {
  if (lineMinutes(line) > 0) return true;
  return Object.values(line.measures).some(
    (value) => typeof value === "number" && value > 0,
  );
}

function rosterRows(envelope: StatsHawkEnvelope) {
  const data = envelopeData(envelope);
  const direct = arrayField(
    data,
    "items",
    "roster",
    "players",
    "memberships",
  );
  if (direct.length) return direct;

  const object = asObject(data);
  for (const value of Object.values(object ?? {})) {
    const nested = arrayField(
      value,
      "items",
      "roster",
      "players",
      "memberships",
    );
    if (nested.length) return nested;
  }
  return [];
}

function rosterSample(value: unknown) {
  const row = asObject(value);
  const personObject = asObject(row?.person) ?? asObject(row?.player);
  const bio = asObject(personObject?.bio);
  const person = reference(row, row?.person ? "person" : "player");
  return {
    personId: person.id,
    name:
      person.name ??
      stringField(bio, "display_name", "full_name"),
    position:
      stringField(row, "position", "position_name") ??
      stringField(personObject, "position", "position_name") ??
      stringField(bio, "position", "position_name"),
    shirtNumber:
      numberField(row, "shirt_number", "jersey_number", "number") ??
      stringField(row, "shirt_number", "jersey_number", "number"),
    status: stringField(row, "status", "membership_status"),
  };
}

function capabilitySample(envelope: StatsHawkEnvelope | null) {
  const data = asObject(envelope?.data);
  const phases = arrayField(data, "phases");
  const measures = [
    ...new Set(
      phases.flatMap((phase) =>
        arrayField(asObject(phase), "measures")
          .filter((measure): measure is string => typeof measure === "string")
      ),
    ),
  ];
  return {
    available: Boolean(envelope),
    phaseCount: phases.length,
    measureCount: measures.length,
    phases: phases.slice(0, 10),
    measures: measures.slice(0, 30),
  };
}

function overviewSample(
  envelope: StatsHawkEnvelope | null,
  fallbackLine?: PlayerLine,
  fallbackTeamId?: string | null,
) {
  if (!envelope) return null;
  const data = asObject(envelope.data);
  const person = asObject(data?.person) ?? asObject(data?.identity) ?? data;
  const bio = asObject(person?.bio);
  const currentTeam =
    asObject(data?.current_team) ??
    asObject(data?.team);
  const capabilities = asObject(data?.capabilities);
  const seasonStats = asObject(data?.season_stats) ?? asObject(data?.stats);

  return {
    person: {
      id: stringField(person, "id") ?? fallbackLine?.personId ?? null,
      name:
        stringField(person, "name", "full_name", "display_name") ??
        stringField(bio, "display_name", "full_name") ??
        fallbackLine?.personName ??
        null,
      position:
        stringField(person, "position") ??
        stringField(bio, "position"),
    },
    currentTeam: currentTeam
      ? {
          id: stringField(currentTeam, "id") ?? fallbackTeamId ?? null,
          name: stringField(currentTeam, "name"),
        }
      : null,
    capabilityKeys: Object.keys(capabilities ?? {}),
    seasonStatKeys: Object.keys(seasonStats ?? {}),
  };
}

function hasMeasure(keys: Set<string>, ...names: string[]) {
  return names.some((name) => keys.has(name));
}

export async function probeStatsHawk(
  internal: InternalMatch,
): Promise<ProviderProbe> {
  const provider = SOURCE_PROFILES.statsHawk;
  const apiKey = process.env.STATSHAWK_API_KEY;
  const baseUrl = (
    process.env.STATSHAWK_BASE_URL ?? DEFAULT_BASE_URL
  ).replace(/\/$/, "");

  if (!apiKey) {
    return {
      provider,
      status: "not_configured",
      testedAutomatically: false,
      currentSeasonAvailable: null,
      match: null,
      resolution: null,
      coverage: emptyCoverage(),
      completeness: {},
      evidence: ["STATSHAWK_API_KEY is not configured; no request was made."],
      sanitizedSample: null,
      error: null,
    };
  }

  const client = new StatsHawkClient(baseUrl, apiKey);

  try {
    const competitions = await client.request("/competitions", 1);
    const competition = competitionRows(competitions).find((row) => {
      const slug = stringField(row, "slug")?.toLowerCase();
      const name = stringField(row, "name") ?? "";
      return slug === "laliga" || name.toLowerCase() === "la liga";
    });

    if (!competition) {
      return {
        provider,
        status: "not_available",
        testedAutomatically: true,
        currentSeasonAvailable: false,
        match: null,
        resolution: null,
        coverage: emptyCoverage(),
        completeness: {},
        evidence: [
          "The live competition index did not contain a La Liga competition.",
        ],
        sanitizedSample: { requestExperiment: client.usage() },
        error: null,
      };
    }

    const competitionId = stringField(competition, "id");
    const competitionSlug = stringField(competition, "slug") ?? "laliga";
    const competitionName = stringField(competition, "name") ?? "La Liga";
    const kickoffYear = Number(internal.kickoff.slice(0, 4));
    const kickoffMonth = Number(internal.kickoff.slice(5, 7));
    const seasonYear = kickoffMonth >= 7 ? kickoffYear : kickoffYear - 1;
    const matchDate = internal.kickoff.slice(0, 10);
    const schedulePath =
      "/competitions/" +
      encodeURIComponent(competitionSlug) +
      "/editions/" +
      seasonYear +
      "/games?date=" +
      encodeURIComponent(matchDate);
    const schedule = await client.request(schedulePath, 2);
    const scheduled = contestRows(schedule)
      .map((row) => ({
        row,
        candidate: contestCandidate(row, competitionName),
      }))
      .find(({ candidate }) =>
        resolveMatchCandidate(internal, candidate, provider.id).matched
      );

    if (!scheduled?.candidate.providerMatchId) {
      return {
        provider,
        status: "not_available",
        testedAutomatically: true,
        currentSeasonAvailable: true,
        match: null,
        resolution: null,
        coverage: emptyCoverage(),
        completeness: {},
        evidence: [
          "La Liga was available, but the dated schedule contained no safely resolved Barcelona match.",
        ],
        sanitizedSample: {
          competition: {
            id: competitionId,
            slug: competitionSlug,
            name: competitionName,
          },
          candidateCount: contestRows(schedule).length,
          requestExperiment: client.usage(),
        },
        error: null,
      };
    }

    const contestId = scheduled.candidate.providerMatchId;
    const detailEnvelope = await client.request(
      "/contests/" + encodeURIComponent(contestId),
      1,
    );
    const detail = asObject(detailEnvelope.data);
    if (!detail) {
      throw new Error("StatsHawk contest detail returned no data object.");
    }
    const match = contestCandidate(detail, competitionName);
    const resolution = resolveMatchCandidate(internal, match, provider.id);
    const boxscoreEnvelope = await client.request(
      "/contests/" + encodeURIComponent(contestId) + "/boxscore",
      2,
    );
    const boxscore = asObject(boxscoreEnvelope.data);
    const appearances = arrayField(boxscore, "lines", "players");
    const allLines = appearances.flatMap(playerLines);
    const homeTeam = reference(detail, "home_team");
    const awayTeam = reference(detail, "away_team");
    const barcelonaSide = matchTeamIdentity(
      "FC Barcelona",
      homeTeam.name ?? "",
    ).matched
      ? "home"
      : matchTeamIdentity("FC Barcelona", awayTeam.name ?? "").matched
        ? "away"
        : null;
    const barcelonaTeamId =
      barcelonaSide === "home"
        ? homeTeam.id
        : barcelonaSide === "away"
          ? awayTeam.id
          : null;
    const barcelonaLines = allLines.filter((line) =>
      barcelonaTeamId
        ? line.teamId === barcelonaTeamId
        : matchTeamIdentity("FC Barcelona", line.teamName ?? "").matched
    );
    const populatedLines = barcelonaLines
      .filter(isPopulatedLine)
      .sort((left, right) => lineMinutes(right) - lineMinutes(left));
    const measureKeys = new Set(
      populatedLines.flatMap((line) => Object.keys(line.measures)),
    );

    const capabilitiesPath =
      "/competitions/" +
      encodeURIComponent(competitionSlug) +
      "/capabilities";
    const capabilities = await client.optional(capabilitiesPath, 1);
    const roster = barcelonaTeamId
      ? await client.optional(
          "/teams/" + encodeURIComponent(barcelonaTeamId) + "/roster",
          3,
        )
      : null;
    const rosterEntries = roster ? rosterRows(roster) : [];
    const overviewPerson = populatedLines.find((line) => line.personId)?.personId;
    const overview = overviewPerson
      ? await client.optional(
          "/persons/" +
            encodeURIComponent(overviewPerson) +
            "/overview?competition=" +
            encodeURIComponent(competitionSlug) +
            "&season=" +
            seasonYear,
          1,
        )
      : null;
    const sampledLines = populatedLines.slice(0, 4).map((line) => ({
      personId: line.personId,
      personName: line.personName,
      teamId: line.teamId,
      phase: line.phase,
      measures: primitiveMeasures(line.measures),
    }));
    const requestExperiment = client.usage();
    const location = asObject(detail.location);
    const rosterSamples = rosterEntries.slice(0, 4).map(rosterSample);
    const rosterHasPosition = rosterSamples.some((row) => row.position);
    const rosterHasShirtNumber = rosterSamples.some(
      (row) => row.shirtNumber !== null,
    );

    return {
      provider,
      status: resolution.matched ? "ok" : "not_available",
      testedAutomatically: true,
      currentSeasonAvailable: true,
      match,
      resolution,
      coverage: emptyCoverage({
        fixturesResults: true,
        playerProfiles: Boolean(overview),
        venue: Boolean(stringField(location, "venue_name")),
        goalsAssists: hasMeasure(measureKeys, "goals", "assists"),
        cards: hasMeasure(measureKeys, "yellow", "red"),
        shots: hasMeasure(measureKeys, "shots"),
        shotsOnTarget: hasMeasure(measureKeys, "sot", "shots_on_target"),
        passes: hasMeasure(measureKeys, "passes"),
        completedPasses: hasMeasure(measureKeys, "passes_cmp", "passes_completed"),
        passAccuracy: hasMeasure(measureKeys, "pass_pct", "pass_accuracy"),
        xG: hasMeasure(measureKeys, "xg", "expected_goals"),
        playerMatchStatistics: populatedLines.length > 0,
        ratings: hasMeasure(measureKeys, "rating"),
        playerMinutes: hasMeasure(measureKeys, "minutes", "mins"),
        playerGoals: hasMeasure(measureKeys, "goals"),
        playerAssists: hasMeasure(measureKeys, "assists"),
        tackles: hasMeasure(measureKeys, "tackles"),
        interceptions: hasMeasure(measureKeys, "intc", "interceptions"),
        fouls: hasMeasure(measureKeys, "fouls"),
        saves: hasMeasure(measureKeys, "saves"),
        goalkeeperStatistics: hasMeasure(
          measureKeys,
          "saves",
          "save_pct",
          "goals_conceded",
          "clean_sheet",
        ),
      }),
      completeness: {
        fixture: "complete",
        contestDetail: "complete",
        playerMatchStatistics: populatedLines.length ? "complete" : "absent",
        roster: rosterEntries.length ? "unknown" : "absent",
        playerOverview: overview ? "complete" : "absent",
        lineups: "absent",
        bench: "absent",
        formation: "absent",
        injuries: "absent",
      },
      evidence: [
        "Resolved StatsHawk contest " + contestId + " with an exact timezone-aware kickoff.",
        "The finalized box score returned " +
          barcelonaLines.length +
          " Barcelona rows; " +
          populatedLines.length +
          " contained actual activity.",
        "Observed Barcelona player measure keys: " +
          ([...measureKeys].sort().join(", ") || "none") +
          ".",
        "Roster data is not a confirmed match lineup or bench; lineup, bench, formation, and shirt-number coverage remain unclaimed.",
        roster
          ? "The Barcelona roster request returned " +
            rosterEntries.length +
            " rows; sampled position=" +
            rosterHasPosition +
            ", sampled shirtNumber=" +
            rosterHasShirtNumber +
            "."
          : "The optional Barcelona roster request was unsupported or unavailable.",
        overview
          ? "One populated Barcelona player overview was verified."
          : "The optional player overview was unsupported or unavailable.",
        "No soccer injury-history call was made because StatsHawk documents current injury coverage for MLB, NFL, NBA, NHL, and WNBA rather than soccer.",
        "This isolated run used " +
          requestExperiment.requestCount +
          " requests and " +
          (requestExperiment.weightedUnitsConsumed ?? "an unreported number of") +
          " weighted units.",
      ],
      sanitizedSample: {
        competition: {
          id: competitionId,
          slug: competitionSlug,
          name: competitionName,
        },
        contest: {
          id: contestId,
          status: stringField(detail, "status"),
          kickoff: match.kickoff,
          homeTeam: {
            id: homeTeam.id,
            name: homeTeam.name,
            score: match.homeScore,
          },
          awayTeam: {
            id: awayTeam.id,
            name: awayTeam.name,
            score: match.awayScore,
          },
          venue: stringField(location, "venue_name"),
        },
        boxscore: {
          finalized: boxscore?.finalized ?? null,
          totalAppearanceCount: appearances.length,
          totalPhaseLineCount: allLines.length,
          barcelonaLineCount: barcelonaLines.length,
          populatedBarcelonaLineCount: populatedLines.length,
          observedMeasureKeys: [...measureKeys].sort(),
          playerRows: sampledLines,
        },
        capabilities: capabilitySample(capabilities),
        roster: {
          rowCount: rosterEntries.length,
          hasPositionInSample: rosterHasPosition,
          hasShirtNumberInSample: rosterHasShirtNumber,
          rows: rosterSamples,
        },
        playerOverview: overviewSample(
          overview,
          populatedLines.find((line) => line.personId === overviewPerson),
          barcelonaTeamId,
        ),
        explicitlyNotVerified: [
          "confirmed lineup",
          "bench",
          "formation",
          "match positions",
          "match shirt numbers",
          "soccer injury history",
        ],
        requestExperiment,
      },
      error: null,
    };
  } catch (error) {
    return {
      provider,
      status: "error",
      testedAutomatically: true,
      currentSeasonAvailable: null,
      match: null,
      resolution: null,
      coverage: emptyCoverage(),
      completeness: {},
      evidence: [
        "StatsHawk failed independently; all other provider probes were allowed to continue.",
      ],
      sanitizedSample: { requestExperiment: client.usage() },
      error: safeErrorMessage(error),
    };
  }
}

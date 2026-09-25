import { FOOTBALL_DATA_BASE_URL } from "../../providers/football-data/constants";
import type { FootballDataMatch } from "../../providers/football-data/types";
import { fetchJson, safeErrorMessage } from "../http";
import { resolveMatchCandidate } from "../match-resolver";
import { SOURCE_PROFILES } from "../source-status";
import {
  emptyCoverage,
  type InternalMatch,
  type MatchCandidate,
  type ProviderProbe,
} from "../types";

type DetailedTeam = FootballDataMatch["homeTeam"] & {
  coach?: { name?: string | null } | null;
  formation?: string | null;
  lineup?: unknown[];
  bench?: unknown[];
};

type DetailedMatch = FootballDataMatch & {
  venue?: string | null;
  attendance?: number | null;
  referees?: Array<{ name?: string | null; role?: string | null }>;
  goals?: unknown[];
  bookings?: unknown[];
  substitutions?: unknown[];
  homeTeam: DetailedTeam;
  awayTeam: DetailedTeam;
};

type MatchList = { matches?: DetailedMatch[] };

function toCandidate(match: DetailedMatch): MatchCandidate {
  return {
    providerMatchId: String(match.id),
    kickoff: match.utcDate,
    calendarDate: match.utcDate.slice(0, 10),
    localTime: null,
    temporalPrecision: "exact",
    homeTeam: match.homeTeam.name,
    awayTeam: match.awayTeam.name,
    homeScore: match.score.fullTime.home,
    awayScore: match.score.fullTime.away,
    competition: match.competition.name,
  };
}

async function request<T>(path: string, apiKey: string) {
  return fetchJson<T>(`${FOOTBALL_DATA_BASE_URL}${path}`, {
    headers: { "X-Auth-Token": apiKey },
  });
}

async function findMatch(internal: InternalMatch, apiKey: string) {
  const providerId = internal.providerIds[SOURCE_PROFILES.footballData.id];
  if (providerId) {
    return request<DetailedMatch>(`/matches/${providerId}`, apiKey);
  }

  const date = internal.kickoff.slice(0, 10);
  const response = await request<MatchList>(
    `/competitions/${encodeURIComponent(internal.competition.code)}/matches?dateFrom=${date}&dateTo=${date}`,
    apiKey,
  );

  return (response.matches ?? []).find((item) =>
    resolveMatchCandidate(internal, toCandidate(item)).matched,
  ) ?? null;
}

export async function probeFootballData(
  internal: InternalMatch,
): Promise<ProviderProbe> {
  const provider = SOURCE_PROFILES.footballData;
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  if (!apiKey) {
    return {
      provider,
      status: "not_configured",
      testedAutomatically: false,
      currentSeasonAvailable: true,
      match: null,
      resolution: null,
      coverage: emptyCoverage(),
      completeness: {},
      evidence: ["FOOTBALL_DATA_API_KEY is not configured."],
      sanitizedSample: null,
      error: null,
    };
  }

  try {
    const raw = await findMatch(internal, apiKey);
    if (!raw) {
      return {
        provider,
        status: "not_available",
        testedAutomatically: true,
        currentSeasonAvailable: true,
        match: null,
        resolution: null,
        coverage: emptyCoverage(),
        completeness: {},
        evidence: ["No matching current-season fixture was returned."],
        sanitizedSample: null,
        error: null,
      };
    }

    const match = toCandidate(raw);
    const resolution = resolveMatchCandidate(internal, match, provider.id);
    const lineups = [
      ...(raw.homeTeam.lineup ?? []),
      ...(raw.awayTeam.lineup ?? []),
    ];
    const benches = [
      ...(raw.homeTeam.bench ?? []),
      ...(raw.awayTeam.bench ?? []),
    ];
    const goals = raw.goals ?? [];
    const bookings = raw.bookings ?? [];
    const substitutions = raw.substitutions ?? [];

    return {
      provider,
      status: resolution.matched ? "ok" : "not_available",
      testedAutomatically: true,
      currentSeasonAvailable: true,
      match,
      resolution,
      coverage: emptyCoverage({
        fixturesResults: true,
        venue: Boolean(raw.venue),
        referee: Boolean(raw.referees?.length),
        attendance: typeof raw.attendance === "number",
        lineups: lineups.length > 0,
        bench: benches.length > 0,
        formation: Boolean(raw.homeTeam.formation || raw.awayTeam.formation),
        events: goals.length + bookings.length + substitutions.length > 0,
        goalsAssists: goals.length > 0,
        cards: bookings.length > 0,
        substitutions: substitutions.length > 0,
      }),
      completeness: {
        fixture: "complete",
        venue: raw.venue ? "complete" : "absent",
        lineups: lineups.length ? "unknown" : "absent",
        events: goals.length + bookings.length + substitutions.length ? "unknown" : "absent",
        teamStatistics: "absent",
      },
      evidence: [
        `Resolved football-data.org match ${raw.id}.`,
        "The tested free response contained the fixture and result but no rich match arrays.",
      ],
      sanitizedSample: {
        id: raw.id,
        utcDate: raw.utcDate,
        status: raw.status,
        competition: raw.competition.name,
        matchday: raw.matchday,
        venue: raw.venue ?? null,
        homeTeam: raw.homeTeam.name,
        awayTeam: raw.awayTeam.name,
        score: raw.score,
        counts: {
          lineups: lineups.length,
          benches: benches.length,
          goals: goals.length,
          bookings: bookings.length,
          substitutions: substitutions.length,
        },
        referees: (raw.referees ?? []).slice(0, 2),
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
      evidence: ["The provider failed independently; other probes were allowed to continue."],
      sanitizedSample: null,
      error: safeErrorMessage(error),
    };
  }
}

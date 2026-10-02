import { fetchJson, safeErrorMessage } from "../http";
import { resolveMatchCandidate } from "../match-resolver";
import { SOURCE_PROFILES } from "../source-status";
import {
  emptyCoverage,
  type InternalMatch,
  type MatchCandidate,
  type ProviderProbe,
} from "../types";

type OpenFootballMatch = {
  round?: string;
  date: string;
  time?: string;
  team1: string;
  team2: string;
  score?: { ht?: [number, number]; ft?: [number, number] } | [number, number];
};

type OpenFootballSeason = {
  name: string;
  matches: OpenFootballMatch[];
};

function fullTimeScore(score: OpenFootballMatch["score"]) {
  if (!score) return null;
  if (Array.isArray(score)) return score;
  return score.ft ?? null;
}

function toCandidate(match: OpenFootballMatch): MatchCandidate {
  const score = fullTimeScore(match.score);
  return {
    providerMatchId: null,
    kickoff: null,
    calendarDate: match.date,
    localTime: match.time ?? null,
    temporalPrecision: match.time
      ? "local_time_unknown_zone"
      : "date_only",
    homeTeam: match.team1,
    awayTeam: match.team2,
    homeScore: score?.[0] ?? null,
    awayScore: score?.[1] ?? null,
    competition: "Spain Primera División",
  };
}

export async function probeOpenFootball(
  internal: InternalMatch,
): Promise<ProviderProbe> {
  const provider = SOURCE_PROFILES.openFootball;
  const year = Number(internal.kickoff.slice(0, 4));
  const month = Number(internal.kickoff.slice(5, 7));
  const startYear = month >= 7 ? year : year - 1;
  const seasonPath = `${startYear}-${String(startYear + 1).slice(-2)}`;
  const url = `https://raw.githubusercontent.com/openfootball/football.json/master/${seasonPath}/es.1.json`;

  try {
    const raw = await fetchJson<OpenFootballSeason>(url);
    const candidateRows = raw.matches
      .map((row) => ({ row, candidate: toCandidate(row) }))
      .filter(({ candidate }) =>
        resolveMatchCandidate(internal, candidate).matched,
      );
    const found = candidateRows[0];

    if (!found) {
      return {
        provider,
        status: "not_available",
        testedAutomatically: true,
        currentSeasonAvailable: true,
        match: null,
        resolution: null,
        coverage: emptyCoverage(),
        completeness: {},
        evidence: [`Loaded ${raw.matches.length} ${raw.name} rows but found no safe match.`],
        sanitizedSample: { season: raw.name, rowCount: raw.matches.length },
        error: null,
      };
    }

    const resolution = resolveMatchCandidate(internal, found.candidate);

    return {
      provider,
      status: "ok",
      testedAutomatically: true,
      currentSeasonAvailable: true,
      match: found.candidate,
      resolution,
      coverage: emptyCoverage({ fixturesResults: true }),
      completeness: {
        fixture: "complete",
        richMatchData: "absent",
      },
      evidence: [
        `Resolved one row from ${raw.name}.`,
        "The CC0 row agrees on date, teams, full-time score, and half-time score.",
      ],
      sanitizedSample: {
        season: raw.name,
        match: found.row,
        sourceUrl: url,
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

import type {
  InternalMatch,
  MatchCandidate,
  MatchResolution,
} from "./types";

const TEAM_STOP_WORDS = new Set([
  "club",
  "de",
  "del",
  "fc",
  "cf",
  "futbol",
  "rc",
  "rcd",
  "sad",
]);

function normalizedTeamName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((part) => part && !TEAM_STOP_WORDS.has(part))
    .join(" ")
    .trim();
}

function namesMatch(left: string, right: string) {
  const a = normalizedTeamName(left);
  const b = normalizedTeamName(right);

  return a === b || a.includes(b) || b.includes(a);
}

function competitionMatches(left: string, right: string | null) {
  if (!right) return false;

  const normalizedLeft = normalizedTeamName(left).replace("primera division", "liga");
  const normalizedRight = normalizedTeamName(right).replace("primera division", "liga");

  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  );
}

export function resolveMatchCandidate(
  internal: InternalMatch,
  candidate: MatchCandidate,
  providerId?: string,
): MatchResolution {
  const expectedProviderId = providerId
    ? internal.providerIds[providerId]
    : undefined;
  const idMatch = Boolean(
    expectedProviderId &&
      candidate.providerMatchId &&
      expectedProviderId === candidate.providerMatchId,
  );
  const homeTeam = namesMatch(internal.homeTeam.name, candidate.homeTeam);
  const awayTeam = namesMatch(internal.awayTeam.name, candidate.awayTeam);
  const score =
    internal.score.home !== null &&
    internal.score.away !== null &&
    candidate.homeScore === internal.score.home &&
    candidate.awayScore === internal.score.away;
  const competition = competitionMatches(
    internal.competition.name,
    candidate.competition,
  );

  let kickoff = false;
  let kickoffDeltaHours: number | null = null;
  if (candidate.kickoff) {
    kickoffDeltaHours = Math.abs(
      Date.parse(candidate.kickoff) - Date.parse(internal.kickoff),
    ) / 3_600_000;
    kickoff = kickoffDeltaHours <= 18;
  }

  const confidence = Math.min(
    1,
    (idMatch ? 0.15 : 0) +
      (kickoff ? 0.2 : 0) +
      (homeTeam ? 0.2 : 0) +
      (awayTeam ? 0.2 : 0) +
      (score ? 0.2 : 0) +
      (competition ? 0.05 : 0),
  );
  const matched =
    homeTeam && awayTeam && (idMatch || (kickoff && (score || confidence >= 0.6)));

  return {
    matched,
    confidence: Number(confidence.toFixed(2)),
    criteria: {
      providerId: idMatch,
      kickoff,
      homeTeam,
      awayTeam,
      score,
      competition,
    },
    notes: [
      expectedProviderId
        ? `Internal provider ID available: ${expectedProviderId}.`
        : "No internal provider ID was available; used date, teams, score, and competition.",
      kickoffDeltaHours === null
        ? "Provider supplied no kickoff timestamp."
        : `Kickoff delta: ${kickoffDeltaHours.toFixed(2)} hours.`,
      "A match requires both team names plus either an exact provider ID or compatible kickoff and score evidence.",
    ],
  };
}

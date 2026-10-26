import "server-only";

import { asArray } from "../shared/json";
import { resolveMatchIdentity, type MatchIdentityInput } from "../shared/match-identity";
import { HighlightlyClient } from "./client";
import { highlightlyCandidate, normalizeHighlightlyLineups } from "./normalize";

const BUNDLE_TTL_MS = 15 * 60_000;
const INCOMPLETE_BUNDLE_TTL_MS = 60_000;

type HighlightlyLineupBundle = ReturnType<typeof normalizeHighlightlyLineups> & {
  providerMatchId: string;
  requestCount: number;
};

const cache = new Map<string, { expiresAt: number; promise: Promise<HighlightlyLineupBundle> }>();

export function highlightlyLocalDate(kickoff: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Beirut",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(kickoff));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

async function fetchUncached(internal: MatchIdentityInput): Promise<HighlightlyLineupBundle> {
  const client = new HighlightlyClient();
  const match = await resolveHighlightlyMatch(internal, client);
  const providerMatchId = match.providerMatchId;
  const lineupBody = await client.get(`/lineups/${encodeURIComponent(providerMatchId)}`);
  return {
    providerMatchId,
    requestCount: client.requestCount,
    ...normalizeHighlightlyLineups(lineupBody),
  };
}

export async function resolveHighlightlyMatch(
  internal: MatchIdentityInput,
  client = new HighlightlyClient(),
) {
  const params = new URLSearchParams({
    date: highlightlyLocalDate(internal.kickoff),
    timezone: "Asia/Beirut",
    limit: "100",
  });
  const barcelonaIsHome = /barcelona/i.test(internal.homeTeam.name);
  params.set(barcelonaIsHome ? "homeTeamName" : "awayTeamName", "Barcelona");
  const body = await client.get(`/matches?${params}`);
  const matches = asArray(body.data)
    .map((row) => ({ row, candidate: highlightlyCandidate(row) }))
    .filter((entry) => entry.candidate && resolveMatchIdentity(internal, entry.candidate).matched);
  if (matches.length !== 1 || !matches[0].candidate?.providerMatchId) {
    throw new Error(
      matches.length > 1
        ? "Multiple Highlightly fixtures passed immutable-fact validation."
        : "No Highlightly fixture passed immutable-fact validation.",
    );
  }
  return {
    providerMatchId: matches[0].candidate.providerMatchId,
    detail: matches[0].row,
  };
}

export function fetchHighlightlyLineups(internal: MatchIdentityInput) {
  const key = JSON.stringify({
    kickoff: internal.kickoff,
    competition: internal.competition.name,
    home: internal.homeTeam.name,
    away: internal.awayTeam.name,
  });
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;
  if (cached) cache.delete(key);
  const promise = fetchUncached(internal)
    .then((bundle) => {
      // A fixture can exist before its lineups do. Recheck incomplete responses
      // promptly instead of treating an empty XI as fresh for fifteen minutes.
      if ((!bundle.home || !bundle.away) && cache.get(key)?.promise === promise) {
        cache.set(key, { expiresAt: Date.now() + INCOMPLETE_BUNDLE_TTL_MS, promise });
      }
      return bundle;
    })
    .catch((error) => {
      if (cache.get(key)?.promise === promise) cache.delete(key);
      throw error;
    });
  cache.set(key, { expiresAt: Date.now() + BUNDLE_TTL_MS, promise });
  return promise;
}

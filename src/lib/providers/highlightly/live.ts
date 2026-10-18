import "server-only";

import { asArray, asObject } from "../shared/json";
import { resolveMatchIdentity, type MatchIdentityInput } from "../shared/match-identity";
import { HighlightlyClient } from "./client";
import { highlightlyCandidate, normalizeHighlightlyLiveEvents, normalizeHighlightlyLivePeriod, normalizeHighlightlyLiveStatus, normalizeHighlightlyStatistics } from "./normalize";
import { resolveHighlightlyMatch } from "./fetch";

export async function fetchHighlightlyLiveBundle(
  internal: MatchIdentityInput,
  mappedProviderId?: string | null,
) {
  const client = new HighlightlyClient();
  let providerMatchId = mappedProviderId ?? null;
  let detail = null;
  if (providerMatchId) {
    const body = await client.get(`/matches/${encodeURIComponent(providerMatchId)}`);
    detail = asObject(asArray(body.data)[0]) ?? asObject(body.data);
    const candidate = highlightlyCandidate(detail);
    if (!detail || !candidate || !resolveMatchIdentity(internal, candidate).matched) {
      providerMatchId = null;
      detail = null;
    }
  }
  if (!providerMatchId || !detail) {
    const resolved = await resolveHighlightlyMatch(internal, client);
    providerMatchId = resolved.providerMatchId;
    const body = await client.get(`/matches/${encodeURIComponent(providerMatchId)}`);
    detail = asObject(asArray(body.data)[0]) ?? asObject(body.data);
  }
  const candidate = highlightlyCandidate(detail);
  if (!detail || !candidate || !resolveMatchIdentity(internal, candidate).matched) {
    throw new Error("Highlightly live fixture failed immutable identity validation.");
  }
  const stats = normalizeHighlightlyStatistics(detail);
  return {
    providerMatchId,
    requestCount: client.requestCount,
    status: normalizeHighlightlyLiveStatus(detail),
    period: normalizeHighlightlyLivePeriod(detail),
    candidate,
    events: normalizeHighlightlyLiveEvents(detail, internal.homeTeam.name, internal.awayTeam.name),
    statisticRows: stats.rows,
  };
}

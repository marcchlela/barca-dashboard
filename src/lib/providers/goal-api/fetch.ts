import "server-only";

import { GoalApiClient } from "./client";
import { goalCandidate, normalizeGoalBundle } from "./normalize";
import { asArray, asObject } from "../shared/json";
import {
  resolveMatchIdentity,
  type MatchIdentityInput,
} from "../shared/match-identity";

export async function fetchGoalMatchBundle(internal: MatchIdentityInput) {
  const client = new GoalApiClient();
  const date = internal.kickoff.slice(0, 10);
  let providerMatchId: string | null = null;

  for (const offset of [0, 100, 200]) {
    const body = await client.get(
      `/fixtures?from=${date}&to=${date}&limit=100&offset=${offset}`,
    );
    const rows = asArray(body.data);
    for (const row of rows) {
      const candidate = goalCandidate(row);
      if (
        candidate?.providerMatchId &&
        resolveMatchIdentity(internal, candidate).matched
      ) {
        providerMatchId = candidate.providerMatchId;
        break;
      }
    }
    if (providerMatchId) break;
    const pagination = asObject(body.pagination);
    if (pagination?.hasMore !== true || rows.length < 100) break;
  }

  if (!providerMatchId) {
    throw new Error("No GOAL fixture passed the hardened target-match resolver.");
  }

  const encoded = encodeURIComponent(providerMatchId);
  const [detailBody, lineupBody, eventBody, statisticsBody] = await Promise.all([
    client.get(`/fixtures/${encoded}`),
    client.get(`/fixtures/${encoded}/lineups`),
    client.get(`/fixtures/${encoded}/events`),
    client.get(`/fixtures/${encoded}/statistics`),
  ]);
  const detailCandidate = goalCandidate(detailBody.data);
  if (!detailCandidate || !resolveMatchIdentity(internal, detailCandidate).matched) {
    throw new Error("GOAL fixture detail failed immutable-fact validation.");
  }

  return normalizeGoalBundle({
    providerMatchId,
    detailBody,
    lineupBody,
    eventBody,
    statisticsBody,
    requestCount: client.requestCount,
  });
}

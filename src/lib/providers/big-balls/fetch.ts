import "server-only";

import { BigBallsClient } from "./client";
import { bigBallsCandidate, normalizeBigBallsBundle } from "./normalize";
import { asArray } from "../shared/json";
import {
  resolveMatchIdentity,
  type MatchIdentityInput,
} from "../shared/match-identity";

export async function fetchBigBallsMatchBundle(internal: MatchIdentityInput) {
  const client = new BigBallsClient();
  const date = internal.kickoff.slice(0, 10);
  const listBody = await client.get(
    `/v1/matches?sport=football&league=laliga&date=${date}&limit=200`,
  );
  const found = asArray(listBody.data)
    .map((row) => ({ row, candidate: bigBallsCandidate(row) }))
    .find(({ candidate }) => candidate && resolveMatchIdentity(internal, candidate).matched);
  const providerMatchId = found?.candidate?.providerMatchId;
  if (!providerMatchId) {
    throw new Error("No Big Balls fixture passed the hardened target-match resolver.");
  }

  const encoded = encodeURIComponent(providerMatchId);
  const [detailBody, teamStatsBody, storedStatsBody] = await Promise.all([
    client.get(`/v1/matches/${encoded}?sport=football`),
    client.get(`/v1/matches/${encoded}/statistics`),
    client.get(`/v1/stored/matches/${encoded}/stats`),
  ]);
  const detailCandidate = bigBallsCandidate(detailBody.data);
  if (!detailCandidate || !resolveMatchIdentity(internal, detailCandidate).matched) {
    throw new Error("Big Balls fixture detail failed immutable-fact validation.");
  }

  return normalizeBigBallsBundle({
    providerMatchId,
    detailBody,
    teamStatsBody,
    storedStatsBody,
    requestCount: client.requestCount,
  });
}

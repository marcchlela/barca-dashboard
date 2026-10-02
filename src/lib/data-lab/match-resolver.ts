import {
  matchTeamIdentity,
  normalizedTeamName,
  resolveMatchIdentity,
} from "../providers/shared/match-identity";

import type {
  InternalMatch,
  MatchCandidate,
  MatchResolution,
} from "./types";

export { matchTeamIdentity, normalizedTeamName };

export function resolveMatchCandidate(
  internal: InternalMatch,
  candidate: MatchCandidate,
  providerId?: string,
): MatchResolution {
  return resolveMatchIdentity(internal, candidate, providerId);
}

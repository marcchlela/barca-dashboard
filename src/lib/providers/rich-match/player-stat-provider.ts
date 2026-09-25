import "server-only";

import { fetchBigBallsMatchBundle } from "../big-balls/fetch";
import type { BigBallsMatchBundle } from "../big-balls/types";
import type { MatchIdentityInput } from "../shared/match-identity";

export type PlayerMatchStatisticsProvider<TBundle> = {
  code: string;
  fetchMatch: (match: MatchIdentityInput) => Promise<TBundle>;
};

export const bigBallsPlayerStatisticsProvider = {
  code: "big-balls-data",
  fetchMatch: fetchBigBallsMatchBundle,
} satisfies PlayerMatchStatisticsProvider<BigBallsMatchBundle>;

// A StatsHawk adapter can implement the same interface later. Selection and
// fallback policy intentionally remain outside this one-match ingestion proof.

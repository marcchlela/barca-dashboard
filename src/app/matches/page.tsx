import MatchesPageClient from "../../components/matches/MatchesPageClient";

import {
  getMatchesOverview,
} from "../../lib/matches/get-matches-overview";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export default async function MatchesPage() {
  const data =
    await getMatchesOverview();

  return (
    <MatchesPageClient
      data={
        data
      }
    />
  );
}
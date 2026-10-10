import MatchesPageClient from "../../components/matches/MatchesPageClient";
import { getViewer } from "../../lib/auth/session";

import {
  getMatchesOverview,
} from "../../lib/matches/get-matches-overview";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export default async function MatchesPage() {
  const data =
    await getMatchesOverview((await getViewer())?.id ?? null);

  return (
    <MatchesPageClient
      data={
        data
      }
    />
  );
}

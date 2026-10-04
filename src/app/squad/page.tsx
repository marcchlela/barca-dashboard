import SquadPageClient from "../../components/squad/SquadPageClient";

import {
  getSquadOverview,
} from "../../lib/squad/get-squad-overview";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export default async function SquadPage() {
  const data =
    await getSquadOverview();

  return (
    <SquadPageClient
      data={
        data
      }
    />
  );
}
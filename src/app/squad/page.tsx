import SquadPageClient from "../../components/squad/SquadPageClient";
import { getViewer } from "../../lib/auth/session";

import {
  getSquadOverview,
} from "../../lib/squad/get-squad-overview";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export default async function SquadPage() {
  const viewer = await getViewer();
  const data = await getSquadOverview(viewer?.id ?? null);

  return (
    <SquadPageClient
      signedIn={Boolean(viewer)}
      data={
        data
      }
    />
  );
}

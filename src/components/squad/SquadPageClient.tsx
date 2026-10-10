"use client";

import DashboardSectionShell, {
  useDashboardSectionTheme,
} from "../shell/DashboardSectionShell";

import SquadOverview from "./SquadOverview";

import type {
  SquadOverviewData,
} from "../../lib/squad/get-squad-overview";

export default function SquadPageClient({
  data,
  signedIn,
}: {
  data:
    SquadOverviewData;
  signedIn: boolean;
}) {
  const {
    theme,
  } =
    useDashboardSectionTheme(
      data.season.label,
    );

  return (
    <DashboardSectionShell
      title="Squad"
      season={
        data.season.label
      }
      theme={
        theme
      }
    >
      <SquadOverview
        signedIn={signedIn}
        data={
          data
        }
        theme={
          theme
        }
      />
    </DashboardSectionShell>
  );
}

"use client";

import DashboardSectionShell, {
  useDashboardSectionTheme,
} from "../shell/DashboardSectionShell";

import MatchesOverview from "./MatchesOverview";

import type {
  MatchesOverviewData,
} from "../../lib/matches/get-matches-overview";

export default function MatchesPageClient({
  data,
}: {
  data:
    MatchesOverviewData;
}) {
  const {
    theme,
  } =
    useDashboardSectionTheme(
      data.season.label,
    );

  return (
    <DashboardSectionShell
      title="Matches"
      season={
        data.season.label
      }
      theme={
        theme
      }
    >
      <MatchesOverview
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